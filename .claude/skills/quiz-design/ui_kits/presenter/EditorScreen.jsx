const { Button, IconButton, Badge, Card, Field, Input, Textarea, Select, Checkbox, Switch, Tabs, Stepper, AnswerOption } = window.QuizDesignSystem_2d5b8b;

const QS = ['Quel est le plus long fleuve de France ?', 'En quelle année la tour Eiffel a-t-elle été inaugurée ?', 'Combien de régions compte la France métropolitaine ?'];

function EditorScreen({ onLaunch, onBack }) {
  const [sel, setSel] = React.useState(0);
  const [tab, setTab] = React.useState('q');
  const [correct, setCorrect] = React.useState('B');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', padding: 'var(--space-5) var(--gutter-page)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
        <IconButton icon="arrow-left" label="Retour" variant="ghost" onClick={onBack} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: 'var(--text-h3)' }}>Culture générale — niveau 2</span>
            <Badge tone="warning">Non enregistré</Badge>
          </div>
        </div>
        <Stepper steps={['Informations', 'Questions', 'Lancement']} current={1} />
        <Button variant="secondary" icon="eye">Aperçu</Button>
        <Button icon="play" onClick={onLaunch}>Lancer la session</Button>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', flex: 1, minHeight: 0 }}>
        <aside style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-card)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Questions</span>
            <IconButton icon="plus" label="Ajouter une question" variant="ghost" size="sm" />
          </div>
          {QS.map((q, i) => (
            <Card key={q} padding="sm" interactive selected={sel === i} elevation={0} onClick={() => setSel(i)}>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ font: 'var(--text-numeric)', fontSize: 13, color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-primary)' }}>{q}</span>
              </div>
            </Card>
          ))}
          <Button variant="secondary" icon="plus" block>Ajouter</Button>
        </aside>
        <main style={{ padding: 'var(--space-8)', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'q', label: 'Question' }, { value: 'm', label: 'Média' }, { value: 'e', label: 'Explication' }]} />
          <Field label="Énoncé" required>
            <Input size="lg" defaultValue={QS[sel]} />
          </Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <span style={{ font: 'var(--text-label)' }}>Propositions — cochez la bonne réponse</span>
            {[['A', 'La Seine'], ['B', 'La Loire'], ['C', 'Le Rhône'], ['D', 'La Garonne']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <AnswerOption letter={l} size="sm" state={correct === l ? 'correct' : 'default'} onClick={() => setCorrect(l)}>{v}</AnswerOption>
                <IconButton icon="trash-2" label="Supprimer la proposition" variant="ghost" size="sm" />
              </div>
            ))}
          </div>
          <Field label="Explication affichée après la réponse">
            <Textarea rows={2} defaultValue="La Loire mesure 1 006 km, contre 777 km pour la Seine." />
          </Field>
        </main>
        <aside style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-card)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <span style={{ font: 'var(--text-overline)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Réglages de la question</span>
          <Field label="Durée"><Select defaultValue="20" options={[{ value: '15', label: '15 secondes' }, { value: '20', label: '20 secondes' }, { value: '30', label: '30 secondes' }]} /></Field>
          <Field label="Points"><Select defaultValue="1000" options={[{ value: '500', label: '500 points' }, { value: '1000', label: '1 000 points' }]} /></Field>
          <Checkbox label="Mélanger les propositions" />
          <Checkbox label="Réponses multiples" description="Plusieurs propositions cochables" />
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />
          <Switch checked label="Bonus de rapidité" />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { EditorScreen });
