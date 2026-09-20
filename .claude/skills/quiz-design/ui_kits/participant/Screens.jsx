const { Button, Field, Input, Badge, AnswerOption, QuestionDisplay, Timer, ProgressBar, LeaderboardRow, StatTile, PlayerChip, Icon } = window.QuizDesignSystem_2d5b8b;

function Phone({ children, tone = 'light' }) {
  return (
    <div style={{ width: 390, height: 780, borderRadius: 'var(--radius-2xl)', overflow: 'hidden',
      background: tone === 'dark' ? 'var(--stage-bg)' : 'var(--surface-page)',
      border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-3)',
      display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: 44, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 22px', font: 'var(--text-numeric)', fontSize: 12,
        color: tone === 'dark' ? 'rgba(239,234,246,.8)' : 'var(--text-secondary)' }}>
        <span>9:41</span><span>quiz.app</span>
      </div>
      {children}
    </div>
  );
}

function JoinScreen({ onJoin }) {
  const [code, setCode] = React.useState('482 913');
  const [name, setName] = React.useState('');
  return (
    <Phone>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-8)', padding: 'var(--space-8) var(--space-7)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: '700 22px/1 var(--font-display)', letterSpacing: '-0.03em' }}>Quiz</span>
          <h1 style={{ font: 'var(--text-h1)', letterSpacing: 'var(--tracking-tight)' }}>Rejoindre une session</h1>
          <p style={{ font: 'var(--text-body)', color: 'var(--text-secondary)' }}>Saisissez le code affiché à l'écran.</p>
        </div>
        <Field label="Code de session">
          <Input size="lg" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
            style={{ font: 'var(--text-numeric)', fontSize: 26, letterSpacing: 'var(--tracking-code)', textAlign: 'center', height: 'var(--control-h-xl)' }} />
        </Field>
        <Field label="Votre pseudonyme" hint="Visible par les autres participants">
          <Input size="lg" placeholder="Camille" value={name} onChange={(e) => setName(e.target.value)} style={{ height: 'var(--control-h-lg)' }} />
        </Field>
        <Button size="lg" block iconRight="arrow-right" onClick={() => onJoin(name || 'Camille')} style={{ height: 'var(--control-h-xl)' }}>Rejoindre</Button>
      </div>
    </Phone>
  );
}

function WaitingScreen({ name }) {
  return (
    <Phone tone="dark">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-7)', padding: 'var(--space-8)', color: 'var(--stage-ink)' }}>
        <PlayerChip name={name} tone="dark" />
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ font: 'var(--text-h1)', letterSpacing: 'var(--tracking-tight)' }}>Vous êtes dans la salle</h1>
          <p style={{ font: 'var(--text-body-lg)', color: 'rgba(239,234,246,.75)' }}>Culture générale — niveau 2<br />12 questions · 20 s par question</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--text-body-sm)', color: 'rgba(239,234,246,.7)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-300)' }} />
          En attente du présentateur
        </div>
      </div>
    </Phone>
  );
}

function QuestionScreen({ onAnswer }) {
  const [sec, setSec] = React.useState(14);
  const [picked, setPicked] = React.useState(null);
  React.useEffect(() => { const t = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000); return () => clearInterval(t); }, []);
  return (
    <Phone>
      <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-5)', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <ProgressBar value={7} max={12} style={{ flex: 1 }} />
        <Timer seconds={sec} total={20} size="sm" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-7) var(--space-6)' }}>
        <QuestionDisplay index={7} total={12} style={{ textAlign: 'left' }}>
          <span style={{ font: '600 26px/1.25 var(--font-display)' }}>Quel est le plus long fleuve de France ?</span>
        </QuestionDisplay>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[['A', 'La Seine'], ['B', 'La Loire'], ['C', 'Le Rhône'], ['D', 'La Garonne']].map(([l, v]) => (
            <AnswerOption key={l} letter={l} state={picked === l ? 'selected' : picked ? 'muted' : 'default'}
              onClick={() => { setPicked(l); setTimeout(() => onAnswer(l), 450); }}>{v}</AnswerOption>
          ))}
        </div>
      </div>
    </Phone>
  );
}

function FeedbackScreen({ picked, onNext }) {
  const right = picked === 'B';
  return (
    <Phone tone="dark">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-7)', padding: 'var(--space-8)', color: 'var(--stage-ink)', textAlign: 'center' }}>
        <span style={{ width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: right ? 'var(--state-success)' : 'var(--state-danger)' }}>
          <Icon name={right ? 'check' : 'x'} size={44} color="var(--white)" />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ font: 'var(--text-display-2)', fontSize: 40, letterSpacing: 'var(--tracking-tight)' }}>{right ? 'Bonne réponse' : 'Raté'}</h1>
          <p style={{ font: 'var(--text-body-lg)', color: 'rgba(239,234,246,.78)' }}>La Loire mesure 1 006 km, contre 777 km pour la Seine.</p>
        </div>
        {right && <span style={{ font: 'var(--text-numeric)', fontSize: 32, color: 'var(--brand-300)' }}>+ 940</span>}
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <StatTile tone="dark" label="Score" value="5 100" style={{ minWidth: 120 }} />
          <StatTile tone="dark" label="Rang" value="7" unit="/ 24" style={{ minWidth: 120 }} />
        </div>
        <Button variant="inverse" iconRight="arrow-right" onClick={onNext}>Voir le classement</Button>
      </div>
    </Phone>
  );
}

function RankScreen({ onRestart }) {
  const rows = [['Camille', 8420, 2], ['Théo', 7980, -1], ['Nour', 7310, 1], ['Alex', 6890, -2], ['Inès', 6120, 0]];
  return (
    <Phone>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-7) var(--space-6)', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ font: 'var(--text-h1)', letterSpacing: 'var(--tracking-tight)', flex: 1 }}>Classement</h1>
          <Badge tone="live" dot>Question 7</Badge>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {rows.map(([n, s, d], i) => <LeaderboardRow key={n} rank={i + 1} name={n} score={s} delta={d} />)}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
          <LeaderboardRow rank={7} name="Vous" score={5100} delta={1} highlight />
        </div>
        <Button variant="ghost" block icon="rotate-ccw" onClick={onRestart}>Recommencer la démo</Button>
      </div>
    </Phone>
  );
}
Object.assign(window, { Phone, JoinScreen, WaitingScreen, QuestionScreen, FeedbackScreen, RankScreen });
