// Terminal states (plan § 5.1 « Terminaux ») — introuvable / terminée / retiré, light ground.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button, EmptyState } from '../../design-system/index.ts';
import { LightShell } from './shells.tsx';

export type TerminalKind = 'notfound' | 'ended' | 'kicked';

const CONTENT = {
  notfound: {
    icon: 'circle-help',
    title: 'terminal.notFoundTitle',
    description: 'terminal.notFoundDescription',
  },
  ended: { icon: 'square', title: 'terminal.endedTitle', description: 'terminal.endedDescription' },
  kicked: { icon: 'user-x', title: 'terminal.kickedTitle', description: 'terminal.kickedDescription' },
} as const satisfies Record<TerminalKind, { icon: string; title: string; description: string }>;

export function TerminalScreen({ kind }: { kind: TerminalKind }) {
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
          <Button variant="secondary" size="lg" onClick={() => navigate('/')}>
            {t('terminal.action')}
          </Button>
        }
        style={{ padding: 0 }}
      />
    </LightShell>
  );
}
