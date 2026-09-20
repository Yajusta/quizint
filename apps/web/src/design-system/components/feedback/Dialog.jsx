import React from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../core/IconButton.jsx';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* Patch local (§ 4.2) : le kit rend la modale en `position: absolute` dans son parent.
   Ici : portail sur <body>, `position: fixed`, piège à focus et fermeture sur Échap. */
export function Dialog({ open = true, title, description, footer, onClose, width = 480, children, style, ...rest }) {
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector(FOCUSABLE);
      (first || panel).focus();
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', zIndex: 40 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} {...rest}
        style={{ width, maxWidth: '100%', background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-3)', overflow: 'hidden', outline: 'none', ...style }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', padding: 'var(--space-7) var(--space-7) var(--space-5)' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ font: 'var(--text-h2)', letterSpacing: 'var(--tracking-tight)' }}>{title}</h2>
            {description && <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 6 }}>{description}</p>}
          </div>
          {onClose && <IconButton icon="x" label="Fermer" variant="ghost" size="sm" onClick={onClose} />}
        </header>
        {children && <div style={{ padding: '0 var(--space-7) var(--space-7)' }}>{children}</div>}
        {footer && <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-7)', borderTop: '1px solid var(--border-subtle)', background: 'var(--gray-50)' }}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
