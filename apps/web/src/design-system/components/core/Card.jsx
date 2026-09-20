import React from 'react';

export function Card({ padding = 'md', interactive, selected, elevation = 1, header, footer, children, style, ...rest }) {
  const pad = { none: 0, sm: 'var(--space-5)', md: 'var(--space-7)', lg: 'var(--space-8)' }[padding] ?? padding;
  const [hover, setHover] = React.useState(false);
  return (
    <section
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      {...rest}
      style={{
        background: 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: selected ? '0 0 0 3px var(--brand-50)' : hover ? 'var(--shadow-2)' : elevation === 0 ? 'none' : 'var(--shadow-1)',
        transition: 'box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
        cursor: interactive ? 'pointer' : undefined,
        overflow: 'hidden',
        ...style,
      }}
    >
      {header && (
        <header style={{ padding: '14px var(--space-7)', borderBottom: '1px solid var(--border-subtle)', font: 'var(--text-h3)' }}>{header}</header>
      )}
      <div style={{ padding: pad }}>{children}</div>
      {footer && (
        <footer style={{ padding: '14px var(--space-7)', borderTop: '1px solid var(--border-subtle)', background: 'var(--gray-50)' }}>{footer}</footer>
      )}
    </section>
  );
}
