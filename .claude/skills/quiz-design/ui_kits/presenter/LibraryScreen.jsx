const { Button, IconButton, Badge, Card, Tag, Input, Tabs, EmptyState } = window.QuizDesignSystem_2d5b8b;

const QUIZZES = [
  { title: 'Culture générale — niveau 2', q: 12, dur: '20 s', tags: ['Histoire', 'Géographie'], state: 'Prêt', sessions: 4 },
  { title: 'Onboarding produit', q: 8, dur: '30 s', tags: ['Interne'], state: 'Prêt', sessions: 11 },
  { title: 'Sécurité informatique', q: 15, dur: '20 s', tags: ['Formation'], state: 'Brouillon', sessions: 0 },
  { title: 'Quiz de fin de trimestre', q: 20, dur: '25 s', tags: ['Scolaire'], state: 'Prêt', sessions: 2 },
];

function QuizRow({ q, onLaunch, onEdit }) {
  return (
    <Card padding="sm" interactive style={{ display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: 'var(--text-h3)' }}>{q.title}</span>
            <Badge tone={q.state === 'Prêt' ? 'success' : 'warning'}>{q.state}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, font: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
            <span>{q.q} questions</span><span>·</span><span>{q.dur} par question</span><span>·</span>
            <span>{q.sessions} session{q.sessions === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>{q.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconButton icon="pencil" label="Modifier" onClick={onEdit} />
          <Button icon="play" onClick={onLaunch}>Lancer</Button>
        </div>
      </div>
    </Card>
  );
}

function LibraryScreen({ onLaunch, onEdit }) {
  const [tab, setTab] = React.useState('tous');
  const list = tab === 'brouillons' ? QUIZZES.filter((q) => q.state === 'Brouillon') : tab === 'archives' ? [] : QUIZZES;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)', padding: 'var(--space-8) var(--gutter-page)', maxWidth: 'var(--max-content)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ font: 'var(--text-h1)', letterSpacing: 'var(--tracking-tight)' }}>Mes quiz</h1>
          <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 4 }}>4 quiz · dernière session il y a 2 jours</p>
        </div>
        <Input icon="search" placeholder="Rechercher" style={{ width: 220 }} />
        <Button icon="plus" onClick={onEdit}>Nouveau quiz</Button>
      </header>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tous', label: 'Tous', count: 4 }, { value: 'brouillons', label: 'Brouillons', count: 1 }, { value: 'archives', label: 'Archivés' }]} />
      {list.length === 0
        ? <EmptyState icon="archive" title="Aucun quiz archivé" description="Les quiz archivés restent consultables mais ne peuvent plus être lancés." />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {list.map((q) => <QuizRow key={q.title} q={q} onLaunch={onLaunch} onEdit={onEdit} />)}
          </div>}
    </div>
  );
}
Object.assign(window, { LibraryScreen });
