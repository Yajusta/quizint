// Media routes (§5.3, §4.8): upload with magic-byte detection, sharp re-encode,
// music-metadata duration, static serving under /uploads with long cache.

import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';

import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { fileTypeFromBuffer as fromBuffer } from 'file-type';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { parseBuffer as parseMusicMetadata } from 'music-metadata';

import {
  IMAGE_MAX_INPUT_PIXELS,
  IMAGE_MAX_WIDTH,
  UPLOAD_MAX_AUDIO_MB,
  UPLOAD_MAX_IMAGE_MB,
  UPLOAD_MULTIPART_MAX_FIELD_SIZE,
  UPLOAD_MULTIPART_MAX_FIELDS,
  UPLOAD_MULTIPART_MAX_FILES,
  UPLOAD_MULTIPART_MAX_PARTS,
} from '@quiz/shared';

import { apiError } from '../../lib/api.js';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// Matched on the detected *extension*: file-type reports MIME strings a plain list misses
// ('audio/x-m4a' for .m4a, 'audio/ogg; codecs=opus' for Opus), the extension is stable.
const AUDIO_EXTS = new Set(['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac']);

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // Busboy bounds: one file (a second one is a 413, not silently dropped), a handful of parts and
  // small field values, so a crafted body cannot make the parser hold thousands of parts.
  await app.register(multipart, {
    limits: {
      fileSize: UPLOAD_MAX_AUDIO_MB * 1024 * 1024,
      files: UPLOAD_MULTIPART_MAX_FILES,
      fields: UPLOAD_MULTIPART_MAX_FIELDS,
      parts: UPLOAD_MULTIPART_MAX_PARTS,
      fieldSize: UPLOAD_MULTIPART_MAX_FIELD_SIZE,
    },
  });

  // Every route of this encapsulated plugin is admin-only, so the guard applies unconditionally:
  // testing `req.url` here once let `/api/v1/%6Dedia` (raw URL, decoded only by the router) through.
  // Static /uploads stays public: it is registered as a sibling plugin, outside this scope.
  app.addHook('onRequest', app.authenticate);

  // --- POST /api/v1/media -------------------------------------------------------
  app.post('/media', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const ownerId = req.adminId;
    if (ownerId == null) return reply.status(401).send(apiError('UNAUTHORIZED'));
    let buffer: Buffer | null = null;
    let filename = 'upload';
    // Consume the whole body: busboy only yields the next part once the current file stream has
    // ended, so a file part left unread would stall the request. Field values arrive buffered
    // (bounded by fieldSize) and are ignored; any file other than the first "file" is drained.
    for await (const part of req.parts()) {
      if (part.type !== 'file') continue;
      if (part.fieldname === 'file' && buffer === null) {
        buffer = await part.toBuffer();
        filename = part.filename || 'upload';
      } else {
        await finished(part.file.resume());
      }
    }
    if (!buffer) return reply.status(400).send(apiError('VALIDATION', 'multipart field "file" required'));

    // Magic-byte detection — never trust the declared content type.
    const detected = await fromBuffer(buffer);
    const mime = detected?.mime ?? 'application/octet-stream';
    const isImage = IMAGE_MIMES.has(mime);
    const isAudio = AUDIO_EXTS.has(detected?.ext ?? '');
    if (!isImage && !isAudio) {
      return reply.status(415).send(apiError('MEDIA_UNSUPPORTED_TYPE', `detected: ${mime}`));
    }
    const maxMb = isImage ? UPLOAD_MAX_IMAGE_MB : UPLOAD_MAX_AUDIO_MB;
    if (buffer.byteLength > maxMb * 1024 * 1024) {
      return reply.status(413).send(apiError('MEDIA_TOO_LARGE', `${buffer.byteLength} > ${maxMb}MB`));
    }

    let storageKey: string;
    let width: number | null = null;
    let height: number | null = null;
    let durationSec: number | null = null;
    let finalBuffer: Buffer = buffer;

    if (isImage) {
      // Every image, GIFs included, is re-encoded to WebP (animated for a GIF), which drops any
      // payload hidden in the client bytes, and capped at 1600 px wide. Nothing the client sent
      // is ever written to the public /uploads route as is.
      // Valid magic bytes over a truncated or garbage body: sharp rejects, that is a 415, not a 500.
      try {
        // limitInputPixels is read from the header, before any pixel is decoded (decompression bomb).
        const img = sharp(buffer, {
          failOn: 'none',
          animated: mime === 'image/gif',
          limitInputPixels: IMAGE_MAX_INPUT_PIXELS,
        });
        finalBuffer = Buffer.from(
          await img
            .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer(),
        );
        const outMeta = await sharp(finalBuffer).metadata();
        width = outMeta.width ?? null;
        // An animated WebP reports the height of the whole page stack: use the frame height.
        height = outMeta.pageHeight ?? outMeta.height ?? null;
      } catch {
        return reply.status(415).send(apiError('MEDIA_UNSUPPORTED_TYPE', `undecodable: ${mime}`));
      }
      storageKey = `${randomUUID()}.webp`;
    } else {
      const meta = await parseMusicMetadata(buffer).catch(() => null);
      durationSec = meta?.format?.duration ?? null;
      storageKey = `${randomUUID()}${detected?.ext ? `.${detected.ext}` : ''}`;
    }

    await writeFile(join(app.uploadsDir, storageKey), finalBuffer);

    const row = await app.prisma.media
      .create({
        data: {
          ownerId,
          kind: isImage ? 'IMAGE' : 'AUDIO',
          mimeType: isImage ? 'image/webp' : mime,
          originalName: filename,
          storageKey,
          sizeBytes: finalBuffer.byteLength,
          width,
          height,
          durationSec,
        },
      })
      .catch(async (err: unknown) => {
        // No row means DELETE /media could never reach the file: do not leave it under /uploads.
        await unlink(join(app.uploadsDir, storageKey)).catch(() => undefined);
        throw err;
      });

    return reply.status(201).send({
      media: {
        id: row.id,
        kind: row.kind,
        mimeType: row.mimeType,
        originalName: row.originalName,
        url: `/uploads/${row.storageKey}`,
        sizeBytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        durationSec: row.durationSec,
        createdAt: row.createdAt.getTime(),
      },
    });
  });

  // --- DELETE /api/v1/media/:id ---------------------------------------------------
  app.delete<{ Params: { id: string } }>('/media/:id', async (req, reply) => {
    const ownerId = req.adminId;
    if (ownerId == null) return reply.status(401).send(apiError('UNAUTHORIZED'));
    const media = await app.prisma.media.findFirst({ where: { id: req.params.id, ownerId } });
    if (!media) return reply.status(404).send(apiError('NOT_FOUND'));
    const referenced =
      (await app.prisma.question.count({ where: { mediaId: media.id } })) > 0 ||
      (await app.prisma.choice.count({ where: { mediaId: media.id } })) > 0 ||
      (await snapshotReferences(app, media.storageKey));
    if (referenced) return reply.status(409).send(apiError('MEDIA_REFERENCED'));
    await app.prisma.media.delete({ where: { id: media.id } });
    await unlink(join(app.uploadsDir, media.storageKey)).catch(() => undefined);
    return reply.status(204).send();
  });
}

/**
 * A session snapshot (live or historical) freezes media as `<PUBLIC_URL>/uploads/<storageKey>`
 * inside a JSON column, out of reach of the Question/Choice relations: a file it names must
 * survive, or the projected stage and every past session's detail would 404 on it.
 */
async function snapshotReferences(app: FastifyInstance, storageKey: string): Promise<boolean> {
  // Keys are `<uuid>.<ext>`, but escape LIKE wildcards anyway.
  const escaped = storageKey.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const rows = await app.prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "LiveSession"
    WHERE "quizSnapshot" LIKE ${`%/uploads/${escaped}"%`} ESCAPE '\\'
    LIMIT 1`;
  return rows.length > 0;
}

// Static /uploads — public, immutable cache (content-addressed by uuid).
export async function uploadsStaticPlugin(app: FastifyInstance): Promise<void> {
  await app.register(staticFiles, {
    root: app.uploadsDir,
    prefix: '/uploads/',
    immutable: true,
    maxAge: '31536000',
    decorateReply: false,
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    uploadsDir: string;
  }
}
