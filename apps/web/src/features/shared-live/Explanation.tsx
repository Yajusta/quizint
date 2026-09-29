// Explanation of a closed question, on the stage ground: the projected result (under the answers and
// the top 5, full width) and the participant's round result render the same panel. Plain text, the
// author's line breaks kept, no visible heading (the name is for assistive tech only); it only ever
// arrives with the round result, never with the open question.

import { useTranslation } from 'react-i18next';

export interface ExplanationProps {
  text: string;
  /** `lg` on the projected stage, `md` on a phone. */
  size?: 'md' | 'lg';
}

export function Explanation({ text, size = 'md' }: ExplanationProps) {
  const { t } = useTranslation('common');
  const lg = size === 'lg';
  return (
    <section
      aria-label={t('explanation.label')}
      style={{
        width: '100%',
        minWidth: 0,
        padding: lg ? 'var(--space-6) var(--space-7)' : 'var(--space-5)',
        background: 'var(--stage-panel)',
        border: '1px solid var(--stage-border)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'left',
        animation: 'qiRise var(--dur-slow) var(--ease-out) both',
      }}
    >
      <p
        style={{
          font: lg ? 'var(--text-body-lg)' : 'var(--text-body)',
          fontSize: lg ? 22 : undefined,
          color: 'var(--stage-ink)',
          whiteSpace: 'pre-line',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </p>
    </section>
  );
}
