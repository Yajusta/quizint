// Right pane, « Réglages » tab (plan § 5.3): scoring (hint « Peut être négatif »), time limit,
// speed bonus (inert without a time limit), `Switch` « Média visible sur les téléphones », media
// block (upload, `--radius-lg` preview, « Retirer »). On a played question, scoring is read-only;
// time, bonus and media stay editable — exactly what the PUT accepts.

import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { isGradedType, POINTS_MAX, TIME_LIMIT_MAX_SEC, TIME_LIMIT_MIN_SEC } from '@quiz/shared';

import { Button, Field, Switch } from '../../../design-system/index.ts';
import { ApiErrorThrown, uploadFile } from '../../../lib/api-client.ts';
import { formatNumber } from '../../../lib/format.ts';
import { Num } from '../AdminLayout.tsx';
import { BlockError, NumberInput } from './fields.tsx';
import type { EditorQuestion, Issue } from './model.ts';

export interface QuestionSettingsProps {
  q: EditorQuestion;
  locked: boolean;
  issues: Issue[];
  onChange: (next: EditorQuestion) => void;
}

export function QuestionSettings({ q, locked, issues, onChange }: QuestionSettingsProps) {
  const { t } = useTranslation('admin');
  const issueFor = (path: Issue['path']): string | undefined => {
    const issue = issues.find((i) => i.path === path);
    return issue ? t(`validation.${issue.key}`, issue.values) : undefined;
  };
  const patch = (partial: Partial<EditorQuestion>) => onChange({ ...q, ...partial });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const poll = !isGradedType(q.type);
  const noTime = q.timeLimitSec === null;

  // An upload lasts seconds: what was typed meanwhile must survive, so the media lands on the
  // question as it is when the upload resolves, not as it was when the file was picked.
  const latest = useRef(q);
  useEffect(() => {
    latest.current = q;
  }, [q]);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const media = await uploadFile(file);
      onChange({
        ...(latest.current.key === q.key ? latest.current : q),
        mediaId: media.id,
        mediaUrl: media.url,
        mediaKind: media.kind,
        mediaOnParticipants: media.kind === 'IMAGE',
      });
    } catch (e) {
      setUploadError(e instanceof ApiErrorThrown ? e.message : t('editor.uploadError'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <section
        aria-label={t('editor.scoringLabel')}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {poll ? (
          <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
            {t('editor.pollNoPoints')}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <Field label={t('editor.pointsCorrect')} htmlFor={`q-pc-${q.key}`} error={issueFor('points')}>
              <NumberInput
                id={`q-pc-${q.key}`}
                integer
                value={q.pointsCorrect}
                disabled={locked}
                onCommit={(n) => patch({ pointsCorrect: n ?? 0 })}
              />
            </Field>
            <Field
              label={t('editor.pointsWrong')}
              htmlFor={`q-pw-${q.key}`}
              hint={t('editor.pointsWrongHint')}
            >
              <NumberInput
                id={`q-pw-${q.key}`}
                integer
                value={q.pointsWrong}
                disabled={locked}
                onCommit={(n) => patch({ pointsWrong: n ?? 0 })}
              />
            </Field>
          </div>
        )}
      </section>

      <section
        aria-label={t('editor.timeLabel')}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}
      >
        <Field
          label={t('editor.timeLimit')}
          htmlFor={`q-time-${q.key}`}
          error={issueFor('timeLimitSec')}
          hint={
            <Trans
              i18nKey="editor.timeLimitHint"
              ns="admin"
              values={{ min: formatNumber(TIME_LIMIT_MIN_SEC), max: formatNumber(TIME_LIMIT_MAX_SEC) }}
              components={{ num: <Num /> }}
            />
          }
        >
          {/* Time and bonus feed the score: frozen on a played question like the points (423 otherwise). */}
          <NumberInput
            id={`q-time-${q.key}`}
            integer
            allowEmpty
            placeholder={t('editor.timeLimitPlaceholder')}
            value={q.timeLimitSec}
            disabled={locked}
            onCommit={(n) => patch({ timeLimitSec: n, speedBonusMax: n === null ? 0 : q.speedBonusMax })}
          />
        </Field>
        {!poll && (
          <Field
            label={t('editor.speedBonus')}
            htmlFor={`q-bonus-${q.key}`}
            error={issueFor('speedBonusMax')}
            hint={noTime ? t('editor.speedBonusNoTime') : t('editor.speedBonusHint')}
          >
            <NumberInput
              id={`q-bonus-${q.key}`}
              integer
              value={q.speedBonusMax}
              disabled={noTime || locked}
              onCommit={(n) => patch({ speedBonusMax: Math.min(POINTS_MAX, Math.max(0, n ?? 0)) })}
            />
          </Field>
        )}
      </section>

      <section
        aria-label={t('editor.mediaLabel')}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <span style={{ font: 'var(--text-label)', color: 'var(--text-primary)' }}>{t('editor.media')}</span>
        {/* Native file picker: the kit has no « fichier » field. Hidden and driven by the kit
            button; the server detects the type from the bytes, not from the extension. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {q.mediaUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {q.mediaKind === 'AUDIO' ? (
              <audio controls src={q.mediaUrl} preload="none" style={{ width: '100%' }} />
            ) : (
              <img
                src={q.mediaUrl}
                alt=""
                style={{
                  width: '100%',
                  maxHeight: 180,
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--gray-50)',
                }}
              />
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon="upload"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {t('editor.mediaReplace')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon="x"
                onClick={() =>
                  patch({ mediaId: null, mediaUrl: null, mediaKind: null, mediaOnParticipants: true })
                }
              >
                {t('editor.mediaRemove')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            icon="upload"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('editor.mediaAdd')}
          </Button>
        )}
        {uploadError && <BlockError>{uploadError}</BlockError>}
        <Switch
          checked={q.mediaOnParticipants}
          disabled={!q.mediaUrl}
          onChange={(checked) => patch({ mediaOnParticipants: checked })}
          label={t('editor.mediaOnPhones')}
        />
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
          {t('editor.mediaOnPhonesHint')}
        </p>
      </section>
    </div>
  );
}
