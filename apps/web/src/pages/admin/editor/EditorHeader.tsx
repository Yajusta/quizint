// Editor header (plan § 5.3 « Éditeur »): white band under the admin bar — back, inline title,
// state badge, actions. Sticky, so « Enregistrer » stays reachable while a long list scrolls.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QUIZ_TITLE_MAX_LENGTH } from '@quiz/shared';

import { Badge, Button, IconButton, Input } from '../../../design-system/index.ts';

export type EditorState = 'new' | 'saved' | 'dirty';

export interface EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  titleError: boolean;
  state: EditorState;
  locked: boolean;
  saving: boolean;
  launching: boolean;
  /** Export / duplicate need a persisted quiz. */
  persisted: boolean;
  canLaunch: boolean;
  onBack: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onSave: () => void;
  onLaunch: () => void;
}

export function EditorHeader(p: EditorHeaderProps) {
  const { t } = useTranslation('admin');
  // The inline title has no frame at rest; on focus (brand border + ring) and on error (danger
  // border) the kit's own frame must show through, so the transparent border is only set at rest.
  const [titleFocused, setTitleFocused] = useState(false);
  const titleFrame = p.titleError || titleFocused ? {} : { border: '1px solid transparent' };

  return (
    <header
      style={{
        position: 'sticky',
        top: 56, // height of the AdminLayout top bar
        zIndex: 9,
        // Full width without touching the AdminLayout template: the white background and the bottom
        // rule are painted by two spread shadows (white, then gray 1 px wider), clipped by a
        // polygon at the band's height + 1 px. The box itself does not widen, so no stray
        // horizontal scroll (a `vw` width would create one).
        boxShadow: '0 0 0 100vmax var(--surface-card), 0 0 0 calc(100vmax + 1px) var(--border-subtle)',
        clipPath:
          'polygon(-100vw 0, calc(100% + 100vw) 0, calc(100% + 100vw) calc(100% + 1px), -100vw calc(100% + 1px))',
        background: 'var(--surface-card)',
        margin: 'calc(-1 * var(--space-9)) calc(-1 * var(--gutter-page)) 0',
        padding: 'var(--space-4) var(--gutter-page)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-5) var(--space-7)',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flex: '1 1 360px',
          minWidth: 0,
        }}
      >
        <IconButton variant="ghost" icon="arrow-left" label={t('editor.back')} onClick={p.onBack} />
        <Input
          aria-label={t('editor.titleLabel')}
          placeholder={t('editor.titlePlaceholder')}
          title={p.title || undefined}
          value={p.title}
          error={p.titleError}
          onChange={(e) => p.onTitleChange(e.target.value.slice(0, QUIZ_TITLE_MAX_LENGTH))}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          style={{
            font: 'var(--text-h2)',
            letterSpacing: 'var(--tracking-tight)',
            height: 'var(--control-h-lg)',
            padding: '0 var(--space-3)',
            marginLeft: 'calc(-1 * var(--space-3))',
            background: 'transparent',
            ...titleFrame,
          }}
        />
        <StateBadge state={p.state} locked={p.locked} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Button variant="secondary" icon="download" onClick={p.onExport} disabled={!p.persisted}>
          {t('editor.export')}
        </Button>
        <Button variant="secondary" icon="copy" onClick={p.onDuplicate} disabled={!p.persisted}>
          {t('editor.duplicate')}
        </Button>
        <Button icon="check" loading={p.saving} onClick={p.onSave} title="Ctrl+S">
          {t('editor.save')}
        </Button>
        <Button icon="play" loading={p.launching} onClick={p.onLaunch} disabled={!p.canLaunch}>
          {t('editor.launch')}
        </Button>
      </div>
    </header>
  );
}

function StateBadge({ state, locked }: { state: EditorState; locked: boolean }) {
  const { t } = useTranslation('admin');
  return (
    <span style={{ display: 'inline-flex', gap: 'var(--space-3)', flex: '0 0 auto' }}>
      {locked && (
        <Badge tone="neutral" icon="lock">
          {t('editor.badgeLocked')}
        </Badge>
      )}
      {/* « Non enregistré » rather than « Modifications non enregistrées » (plan § 5.3): at 1440 px,
          four action buttons plus a 230 px badge left only 180 px to the title, which truncated
          from twenty characters on. Same tone (warning, dot), same meaning, two words. */}
      {state === 'dirty' && (
        <Badge tone="warning" dot>
          {t('editor.badgeDirty')}
        </Badge>
      )}
      {state === 'saved' && !locked && <Badge tone="success">{t('editor.badgeSaved')}</Badge>}
      {state === 'new' && <Badge tone="neutral">{t('editor.badgeNew')}</Badge>}
    </span>
  );
}
