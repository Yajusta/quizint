// Grouped answers of a TEXT_POLL, on the stage ground: the projected result and the participant's
// round result render the same list. Entries arrive normalised (upper case, no accent) and sorted,
// most given first; a repeated answer carries its count (« x2 »). The capitals are the data itself,
// normalised server-side by the shared rule, not a text transform.

import { useTranslation } from 'react-i18next';

import type { TextDistEntry } from '@quiz/shared';

import { formatNumber } from '../../lib/format.ts';

export interface TextAnswerListProps {
  entries: TextDistEntry[];
  /** `lg` on the projected stage, `md` on a phone. */
  size?: 'md' | 'lg';
}

export function TextAnswerList({ entries, size = 'md' }: TextAnswerListProps) {
  const { t } = useTranslation('common');
  const lg = size === 'lg';
  if (entries.length === 0) {
    return (
      <p style={{ font: lg ? 'var(--text-body-lg)' : 'var(--text-body)', color: 'var(--stage-ink-2)' }}>
        {t('textAnswers.empty')}
      </p>
    );
  }
  return (
    <ul
      aria-label={t('textAnswers.listLabel')}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexWrap: 'wrap',
        // The stage reads left-aligned like its heading; a phone centres the list under the verdict.
        justifyContent: lg ? 'flex-start' : 'center',
        gap: lg ? 'var(--space-4)' : 'var(--space-3)',
      }}
    >
      {entries.map((e) => (
        <li
          key={e.text}
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 'var(--space-3)',
            maxWidth: '100%',
            padding: lg ? 'var(--space-3) var(--space-5)' : 'var(--space-2) var(--space-4)',
            background: e.count > 1 ? 'var(--stage-brand-soft)' : 'var(--stage-panel)',
            border: `1px solid ${e.count > 1 ? 'var(--stage-brand-border)' : 'var(--stage-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--stage-ink)',
          }}
        >
          <span
            style={{
              font: lg ? 'var(--text-h2)' : 'var(--text-h3)',
              overflowWrap: 'anywhere',
            }}
          >
            {e.text}
          </span>
          {e.count > 1 && (
            <span
              aria-label={t('textAnswers.countAria', { count: e.count })}
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: lg ? 20 : 15,
                color: 'var(--stage-ink-2)',
              }}
            >
              x{formatNumber(e.count)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
