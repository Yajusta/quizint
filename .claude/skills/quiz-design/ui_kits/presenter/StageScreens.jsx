const { Button, IconButton, Badge, JoinCode, PlayerChip, QuestionDisplay, AnswerOption, Timer, ProgressBar, LeaderboardRow, StatTile } = window.QuizDesignSystem_2d5b8b;

const PLAYERS = ['Camille', 'Théo', 'Nour', 'Alex', 'Inès', 'Mehdi', 'Léa', 'Jonas', 'Sarah', 'Yann', 'Chloé', 'Rémi'];

function StageFrame({ children, footer }) {
  return (
    <div style={{ background: 'var(--stage-bg)', color: 'var(--stage-ink)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, padding: 'var(--space-10) var(--space-12)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
      {footer && <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', padding: 'var(--space-5) var(--space-12)', display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>{footer}</div>}
    </div>
  );
}

function LobbyStage({ onStart, onQuit }) {
  return (
    <StageFrame footer={<>
      <Badge tone="live" dot>Salle ouverte</Badge>
      <span style={{ flex: 1, font: 'var(--text-body-sm)', color: 'rgba(239,234,246,.7)' }}>Les participants rejoignent depuis quiz.app avec le code affiché.</span>
      <Button variant="inverse" icon="x" onClick={onQuit}>Annuler</Button>
      <Button icon="play" size="lg" onClick={onStart}>Démarrer le quiz</Button>
    </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-12)', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
          <div>
            <span style={{ font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'rgba(239,234,246,.66)' }}>Culture générale — niveau 2</span>
            <h1 style={{ font: 'var(--text-h1)', marginTop: 6, letterSpacing: 'var(--tracking-tight)' }}>Rejoignez la session</h1>
          </div>
          <JoinCode code="482 913" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', font: 'var(--text-body)', color: 'rgba(239,234,246,.8)' }}>
            <span style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ display: 'inline-block', width: 30, height: 30, background: 'var(--stage-ink)', WebkitMask: 'url(https://unpkg.com/lucide-static@0.441.0/icons/qr-code.svg) center/contain no-repeat', mask: 'url(https://unpkg.com/lucide-static@0.441.0/icons/qr-code.svg) center/contain no-repeat' }} />
            </span>
            <span>Ou scannez le code —<br />quiz.app/482913</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ font: 'var(--text-numeric)', fontSize: 40 }}>{PLAYERS.length}</span>
            <span style={{ font: 'var(--text-body-lg)', color: 'rgba(239,234,246,.75)' }}>participants connectés</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {PLAYERS.map((p, i) => <PlayerChip key={p} name={p} seed={i} tone="dark" />)}
          </div>
        </div>
      </div>
    </StageFrame>
  );
}

function QuestionStage({ revealed, onNext, onReveal }) {
  const [sec, setSec] = React.useState(14);
  React.useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [revealed]);
  const dist = { A: 12, B: 58, C: 21, D: 9 };
  const answers = [['A', 'La Seine'], ['B', 'La Loire'], ['C', 'Le Rhône'], ['D', 'La Garonne']];
  return (
    <StageFrame footer={<>
      <ProgressBar value={7} max={12} tone="inverse" style={{ width: 240 }} />
      <span style={{ font: 'var(--text-body-sm)', color: 'rgba(239,234,246,.7)' }}>18 / 24 réponses reçues</span>
      <span style={{ flex: 1 }} />
      {revealed
        ? <Button size="lg" iconRight="arrow-right" onClick={onNext}>Question suivante</Button>
        : <Button size="lg" variant="inverse" icon="eye" onClick={onReveal}>Révéler la réponse</Button>}
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-9)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)' }}>
          <QuestionDisplay index={7} total={12} tone="dark" style={{ flex: 1, textAlign: 'left' }}>Quel est le plus long fleuve de France ?</QuestionDisplay>
          <Timer seconds={revealed ? 0 : sec} total={20} size="lg" tone={revealed ? 'inverse' : 'auto'} style={{ color: 'var(--stage-ink)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
          {answers.map(([l, v]) => (
            <AnswerOption key={l} letter={l} size="md"
              state={revealed ? (l === 'B' ? 'correct' : 'muted') : 'default'}
              distribution={revealed ? dist[l] : undefined}>{v}</AnswerOption>
          ))}
        </div>
      </div>
    </StageFrame>
  );
}

function ResultsStage({ onRestart }) {
  const rows = [['Camille', 8420, 2], ['Théo', 7980, -1], ['Nour', 7310, 1], ['Alex', 6890, -2], ['Inès', 6120, 0]];
  return (
    <StageFrame footer={<>
      <Badge tone="neutral" style={{ background: 'rgba(255,255,255,.12)', color: 'var(--stage-ink)', borderColor: 'rgba(255,255,255,.2)' }}>Session terminée</Badge>
      <span style={{ flex: 1 }} />
      <Button variant="inverse" icon="download">Exporter les résultats</Button>
      <Button icon="rotate-ccw" onClick={onRestart}>Retour à la bibliothèque</Button>
    </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 'var(--space-12)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <h1 style={{ font: 'var(--text-display-2)', letterSpacing: 'var(--tracking-tight)' }}>Classement final</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {rows.map(([n, s, d], i) => <LeaderboardRow key={n} rank={i + 1} name={n} score={s} delta={d} tone="dark" highlight={i === 0} />)}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
          <StatTile tone="dark" icon="users" label="Participants" value="24" />
          <StatTile tone="dark" icon="check" label="Réussite" value="68" unit="%" />
          <StatTile tone="dark" icon="timer" label="Temps moyen" value="6,4" unit="s" />
          <StatTile tone="dark" icon="circle-help" label="Question la plus ratée" value="Q9" trend="31 % de bonnes réponses" />
        </div>
      </div>
    </StageFrame>
  );
}
Object.assign(window, { LobbyStage, QuestionStage, ResultsStage });
