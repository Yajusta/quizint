// Right pane, « Aperçu » tab (plan § 5.3, deviation § 7-9): a 390 × 780 phone frame at scale 0.75,
// stage ground, the very same `QuestionCard` the participant sees (`preview`), with `index` /
// `total` feeding its top bar. The preview lives in the editor, never in a modal.

import { Trans, useTranslation } from 'react-i18next';

import { CHOICE_LETTERS, type ParticipantQuestionView } from '@quiz/shared';

import { QuestionCard } from '../../../features/shared-live/QuestionCard.tsx';
import { Num } from '../AdminLayout.tsx';
import type { EditorQuestion } from './model.ts';

const PHONE_W = 390;
const PHONE_H = 780;
const SCALE = 0.75;

/** Placeholder wording of the preview — the editor's UI language, never stored. */
export interface PreviewLabels {
  prompt: string;
  choice: (letter: string) => string;
}

export function toPreviewView(
  q: EditorQuestion,
  index: number,
  labels: PreviewLabels,
): ParticipantQuestionView {
  const media: ParticipantQuestionView['media'] =
    q.mediaUrl && q.mediaKind
      ? q.mediaOnParticipants
        ? { kind: q.mediaKind, url: q.mediaUrl, width: null, height: null, durationSec: null }
        : { kind: q.mediaKind, hidden: true }
      : null;
  return {
    id: `preview-${q.key}`,
    position: index,
    type: q.type,
    prompt: q.prompt.trim() || labels.prompt,
    media,
    mediaOnParticipants: q.mediaOnParticipants,
    pointsCorrect: q.pointsCorrect,
    pointsWrong: q.pointsWrong,
    timeLimitSec: q.timeLimitSec,
    speedBonusMax: q.speedBonusMax,
    choices: q.choices.map((c, i) => ({
      id: `preview-${c.key}`,
      position: i,
      label: c.label.trim() || labels.choice(String(CHOICE_LETTERS[i] ?? i + 1)),
      media: null,
    })),
  };
}

export function QuestionPreview({ q, index, total }: { q: EditorQuestion; index: number; total: number }) {
  const { t } = useTranslation('admin');
  const labels: PreviewLabels = {
    prompt: t('editor.previewPrompt'),
    choice: (letter) => t('editor.previewChoice', { letter }),
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
      <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', alignSelf: 'stretch' }}>
        <Trans
          i18nKey="editor.previewCaption"
          ns="admin"
          values={{ index: index + 1, total }}
          components={{ num: <Num /> }}
        />
      </p>
      <div
        aria-label={t('editor.previewLabel')}
        role="img"
        style={{
          width: PHONE_W * SCALE,
          height: PHONE_H * SCALE,
          flex: '0 0 auto',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          background: 'var(--stage-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          // Unscaled phone viewport; scaled as a whole so text and controls keep their proportions.
          style={{
            width: PHONE_W,
            height: PHONE_H,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            background: 'var(--stage-bg)',
          }}
        >
          <QuestionCard
            key={q.key}
            preview
            view={toPreviewView(q, index, labels)}
            closesAt={null}
            index={index}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}
