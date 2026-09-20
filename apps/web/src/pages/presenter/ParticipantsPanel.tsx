// Participants panel (plan § 5.2, shortcut P) — 360 px column docked to the right of the stage,
// outside the StageFrame: the stage shrinks beside it instead of being covered, so its footer
// buttons stay reachable. One row per participant with score and connection state; while a
// question is open, who answered (first answer first) then who has not, without scores. At the
// bottom, the QR code and the session code. « Retirer » opens the confirmation Dialog owned by the page.

import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ParticipantInfo } from '@quiz/shared';

import { IconButton, JoinCode } from '../../design-system/index.ts';
import { formatNumber } from '../../lib/format.ts';
import { Num } from '../participant/shells.tsx';
import { groupCode, StageBadge, useQrSrc } from './stage-shared.tsx';

/** Width of the docked panel, also reserved on the stage (`StageInsetContext`). */
export const PARTICIPANTS_PANEL_WIDTH = 360;

export interface ParticipantsPanelProps {
  open: boolean;
  participants: ParticipantInfo[];
  /**
   * While a question is open: who answered, first answer first. The panel then splits into
   * « Ont répondu » (in that order) and « En attente », without scores.
   */
  answeredIds?: string[];
  /** Session code and join URL, kept at the bottom so latecomers can still join. */
  code: string;
  joinUrl: string | null;
  onClose: () => void;
  onKick: (participant: ParticipantInfo) => void;
}

const LIST_STYLE = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
} as const;

function GroupTitle({ children, count }: { children: string; count: number }) {
  return (
    <h3
      style={{
        font: 'var(--text-overline)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-wide)',
        color: 'var(--stage-ink-2)',
      }}
    >
      {children} <Num>{count}</Num>
    </h3>
  );
}

// Memoised: up to 500 rows, and the page above re-renders on every `answers:progress`.
const ParticipantRow = memo(function ParticipantRow({
  participant: p,
  showScore,
  onKick,
}: {
  participant: ParticipantInfo;
  showScore: boolean;
  onKick: (participant: ParticipantInfo) => void;
}) {
  const { t } = useTranslation('presenter');
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        minHeight: 48,
        padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)',
        background: 'var(--stage-panel)',
        border: '1px solid var(--stage-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          font: 'var(--text-body-lg)',
          color: p.connected ? 'var(--stage-ink)' : 'var(--stage-ink-2)',
        }}
      >
        {p.nickname}
      </span>
      {!p.connected && <StageBadge icon="wifi-off">{t('panel.offline')}</StageBadge>}
      {showScore && (
        <Num style={{ font: 'var(--text-numeric)', fontSize: 17, minWidth: 48, textAlign: 'right' }}>
          {formatNumber(p.score)}
        </Num>
      )}
      <IconButton
        icon="x"
        label={t('panel.kick', { name: p.nickname })}
        variant="inverse"
        size="sm"
        onClick={() => onKick(p)}
      />
    </li>
  );
});

const QR_PX = 176;

/** White join panel, the lobby's in small: QR code over the 40 px session code. */
function JoinPanel({ code, joinUrl }: { code: string; joinUrl: string | null }) {
  const { t } = useTranslation('presenter');
  const qrSrc = useQrSrc(joinUrl);
  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-5)',
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--text-primary)',
      }}
    >
      {qrSrc ? (
        <img
          src={qrSrc}
          alt={t('panel.qrAlt')}
          width={QR_PX}
          height={QR_PX}
          style={{ display: 'block', width: QR_PX, height: QR_PX }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: QR_PX,
            height: QR_PX,
            borderRadius: 'var(--radius-md)',
            background: 'var(--gray-100)',
          }}
        />
      )}
      <JoinCode tone="brand" size="md" code={groupCode(code)} style={{ alignItems: 'center' }} />
    </div>
  );
}

export function ParticipantsPanel({
  open,
  participants,
  answeredIds,
  code,
  joinUrl,
  onClose,
  onKick,
}: ParticipantsPanelProps) {
  const { t } = useTranslation('presenter');
  if (!open) return null;

  const byId = new Map(participants.map((p) => [p.id, p]));
  const answered = answeredIds?.flatMap((id) => byId.get(id) ?? []) ?? [];
  const answeredSet = new Set(answeredIds);
  const waiting = participants.filter((p) => !answeredSet.has(p.id));

  return (
    <aside
      aria-label={t('panel.title')}
      style={{
        position: 'sticky',
        top: 0,
        height: '100dvh',
        flex: `0 0 ${PARTICIPANTS_PANEL_WIDTH}px`,
        width: PARTICIPANTS_PANEL_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        padding: 'var(--space-7)',
        background: 'var(--stage-panel)',
        borderLeft: '1px solid var(--stage-border)',
        color: 'var(--stage-ink)',
        animation: 'qiSlideIn var(--dur-base) var(--ease-out) both',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <h2 style={{ flex: 1 }}>
          {t('panel.title')}{' '}
          <Num style={{ color: 'var(--stage-ink-2)', fontWeight: 500 }}>{participants.length}</Num>
        </h2>
        {/* Focus lands on the close control when the panel opens (keyboard: P then Tab through the rows). */}
        <IconButton
          autoFocus
          icon="x"
          label={t('panel.close')}
          variant="inverse"
          size="md"
          onClick={onClose}
        />
      </header>

      {participants.length === 0 ? (
        <p style={{ flex: '1 1 auto', font: 'var(--text-body)', color: 'var(--stage-ink-2)' }}>
          {t('panel.empty')}
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)',
            overflowY: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
          }}
        >
          {answeredIds ? (
            <>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <GroupTitle count={answered.length}>{t('panel.answered')}</GroupTitle>
                {answered.length > 0 && (
                  <ol style={LIST_STYLE} aria-label={t('panel.answeredListAria')}>
                    {answered.map((p) => (
                      <ParticipantRow key={p.id} participant={p} showScore={false} onKick={onKick} />
                    ))}
                  </ol>
                )}
              </section>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <GroupTitle count={waiting.length}>{t('panel.waiting')}</GroupTitle>
                {waiting.length > 0 && (
                  <ul style={LIST_STYLE} aria-label={t('panel.waitingListAria')}>
                    {waiting.map((p) => (
                      <ParticipantRow key={p.id} participant={p} showScore={false} onKick={onKick} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <ul style={LIST_STYLE}>
              {participants.map((p) => (
                <ParticipantRow key={p.id} participant={p} showScore onKick={onKick} />
              ))}
            </ul>
          )}
        </div>
      )}

      <JoinPanel code={code} joinUrl={joinUrl} />
    </aside>
  );
}
