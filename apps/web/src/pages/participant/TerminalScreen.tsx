// Terminal states (plan § 5.1 « Terminaux ») — not found / ended / removed / seat taken elsewhere,
// light ground.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button, EmptyState } from '../../design-system/index.ts';
import { LightShell } from './shells.tsx';

export type TerminalKind = 'notfound' | 'ended' | 'kicked' | 'replaced';

const CONTENT = {
  notfound: {
    icon: 'circle-help',
    title: 'terminal.notFoundTitle',
    description: 'terminal.notFoundDescription',
  },
  ended: { icon: 'square', title: 'terminal.endedTitle', description: 'terminal.endedDescription' },
  kicked: { icon: 'user-x', title: 'terminal.kickedTitle', description: 'terminal.kickedDescription' },
  replaced: {
    icon: 'monitor-smartphone',
    title: 'terminal.replacedTitle',
    description: 'terminal.replacedDescription',
  },
} as const satisfies Record<TerminalKind, { icon: string; title: string; description: string }>;

/** `onReclaim`: the `replaced` screen's action, which takes the seat back on this tab. */
export function TerminalScreen({ kind, onReclaim }: { kind: TerminalKind; onReclaim?: () => void }) {
  const { t } = useTranslation('participant');
  const navigate = useNavigate();
  const c = CONTENT[kind];
  return (
    <LightShell>
      <EmptyState
        icon={c.icon}
        title={t(c.title)}
        description={t(c.description)}
        action={
          kind === 'replaced' && onReclaim ? (
            <Button variant="primary" size="lg" onClick={onReclaim}>
              {t('terminal.reclaimAction')}
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => navigate('/')}>
              {t('terminal.action')}
            </Button>
          )
        }
        style={{ padding: 0 }}
      />
    </LightShell>
  );
}
