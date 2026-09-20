// LOBBY (plan § 5.2) — one object to look at from the back of the room: a white panel holding the
// QR code and the 72 px session code. Right: the participant counter and the chips as they arrive.

import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { ParticipantInfo } from '@quiz/shared';

import { LanguageSwitcher } from '../../components/LanguageSwitcher.tsx';
import { Badge, Button, JoinCode, PlayerChip, StageFrame } from '../../design-system/index.ts';
import { NBSP } from '../../lib/format.ts';
import { Num } from '../participant/shells.tsx';
import { useMediaQuery } from '../../lib/useMediaQuery.ts';
import {
  groupCode,
  SHORT_STAGE,
  StageOverline,
  useFooterSlots,
  useQrSrc,
  useStageKbd,
} from './stage-shared.tsx';

export interface StageLobbyProps {
  quizTitle: string;
  code: string;
  joinUrl: string | null;
  totalQuestions: number;
  participants: ParticipantInfo[];
  onStart: () => void;
  onStartEmpty: () => void;
  onEnd: () => void;
}

const QR_PX = 320;

export function StageLobby({
  quizTitle,
  code,
  joinUrl,
  totalQuestions,
  participants,
  onStart,
  onStartEmpty,
  onEnd,
}: StageLobbyProps) {
  const { t } = useTranslation(['presenter', 'common']);
  const qrSrc = useQrSrc(joinUrl);
  const short = useMediaQuery(SHORT_STAGE);
  const qrPx = short ? 240 : QR_PX;
  const host = joinUrl ? new URL(joinUrl).host : '';
  const count = participants.length;

  // Chips present at first render enter in a 40 ms cascade; later arrivals rise immediately.
  const initialIds = useRef<Set<string> | null>(null);
  if (initialIds.current === null) initialIds.current = new Set(participants.map((p) => p.id));

  const kbd = useStageKbd(t('lobby.kbd'));
  const slots = useFooterSlots(
    <Badge tone="live" dot>
      {t('lobby.badge')}
    </Badge>,
    <span style={{ font: 'var(--text-body-lg)' }}>
      <Num>{totalQuestions}</Num>
      {NBSP}
      {t('common:units.question', { count: totalQuestions })}
    </span>,
  );

  return (
    <StageFrame
      progress={slots.progress}
      status={slots.status}
      kbd={kbd}
      actions={
        <>
          {/* The lobby is the one stage screen where a language change is harmless: nothing is
              running yet, and the presenter sets the room's language from here. */}
          <LanguageSwitcher tone="dark" />
          <Button variant="inverse" size="lg" onClick={onEnd}>
            {t('stage.end')}
          </Button>
          {count === 0 && (
            <Button variant="inverse" size="lg" onClick={onStartEmpty}>
              {t('lobby.startEmpty')}
            </Button>
          )}
          <Button size="xl" icon="play" onClick={onStart} disabled={count === 0}>
            {t('lobby.start')}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '440px minmax(0, 1fr)',
          gap: 'var(--space-12)',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <StageOverline>{quizTitle}</StageOverline>
            <h1 style={{ font: 'var(--text-question)', letterSpacing: 'var(--tracking-tight)' }}>
              {t('lobby.title')}
            </h1>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-6)',
              padding: 'var(--space-7)',
              background: 'var(--white)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-stage)',
              color: 'var(--text-primary)',
            }}
          >
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={t('lobby.qrAlt')}
                width={qrPx}
                height={qrPx}
                style={{ display: 'block', width: qrPx, height: qrPx }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  width: qrPx,
                  height: qrPx,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--gray-100)',
                }}
              />
            )}
            <JoinCode tone="brand" size="lg" code={groupCode(code)} style={{ alignItems: 'center' }} />
          </div>

          {host && (
            <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)' }}>
              <Trans
                i18nKey="lobby.orType"
                ns="presenter"
                values={{ host }}
                components={{ num: <Num style={{ color: 'var(--stage-ink)' }} /> }}
              />
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)', minWidth: 0 }}>
          <p style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)' }}>
            <span
              style={{ font: 'var(--text-numeric-xl)', fontSize: 64, letterSpacing: 'var(--tracking-tight)' }}
            >
              {count}
            </span>
            <span style={{ font: 'var(--text-body-lg)', fontSize: 22, color: 'var(--stage-ink-2)' }}>
              {t('common:units.participant', { count })}
            </span>
          </p>
          {count === 0 ? (
            <p style={{ font: 'var(--text-body-lg)', color: 'var(--stage-ink-2)' }}>{t('lobby.empty')}</p>
          ) : (
            <ul
              aria-label={t('lobby.listLabel')}
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexWrap: 'wrap',
                alignContent: 'flex-start',
                gap: 'var(--space-3)',
                maxHeight: 'calc(100dvh - 88px - 2 * var(--space-11) - 120px)',
                overflow: 'hidden',
              }}
            >
              {participants.map((p, i) => (
                <li key={p.id} style={{ display: 'flex', maxWidth: '100%' }}>
                  <PlayerChip
                    name={p.nickname}
                    tone="dark"
                    seed={i}
                    style={{
                      maxWidth: '100%',
                      animation: 'qiRise var(--dur-base) var(--ease-out) both',
                      animationDelay: initialIds.current?.has(p.id) ? `${Math.min(i, 15) * 40}ms` : '0ms',
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StageFrame>
  );
}
