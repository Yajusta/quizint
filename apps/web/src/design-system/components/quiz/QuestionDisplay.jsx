import React from 'react';

export function QuestionDisplay({ index, total, children, media, tone = 'light', meta, style, ...rest }) {
  const dark = tone === 'dark';
  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', textAlign: 'center', ...style }}>
      {(index != null || meta) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-5)',
          font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
          color: dark ? 'var(--stage-ink-2)' : 'var(--text-muted)' }}>
          {index != null && <span>Question {index}{total ? ` / ${total}` : ''}</span>}
          {meta}
        </div>
      )}
      <h1 style={{ font: 'var(--text-question)', letterSpacing: 'var(--tracking-tight)', textWrap: 'pretty',
        color: dark ? 'var(--stage-ink)' : 'var(--text-primary)', margin: 0 }}>{children}</h1>
      {media}
    </div>
  );
}
