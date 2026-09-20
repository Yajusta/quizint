// Réexports du design system — les composants .jsx gardent leur runtime, TypeScript lit les
// contrats .d.ts co-localisés. Icon, Wordmark, StageFrame, Podium et CountUp sont locaux (.tsx).
// Les patchs appliqués au kit du skill sont listés dans ./README.md.
export { Button } from './components/core/Button.jsx';
export { IconButton } from './components/core/IconButton.jsx';
export { Icon } from './components/core/Icon.tsx';
export { Badge } from './components/core/Badge.jsx';
export { Tag } from './components/core/Tag.jsx';
export { Card } from './components/core/Card.jsx';
export { Wordmark } from './components/core/Wordmark.tsx';

export { Field } from './components/forms/Field.jsx';
export { Input } from './components/forms/Input.jsx';
export { Textarea } from './components/forms/Textarea.jsx';
export { Select } from './components/forms/Select.jsx';
export { Checkbox } from './components/forms/Checkbox.jsx';
export { Radio } from './components/forms/Radio.jsx';
export { Switch } from './components/forms/Switch.jsx';

export { Dialog } from './components/feedback/Dialog.jsx';
export { ProgressBar } from './components/feedback/ProgressBar.jsx';
export { Timer } from './components/feedback/Timer.jsx';
export { EmptyState } from './components/feedback/EmptyState.jsx';

export { Tabs } from './components/navigation/Tabs.jsx';

export { AnswerOption } from './components/quiz/AnswerOption.jsx';
export { QuestionDisplay } from './components/quiz/QuestionDisplay.jsx';
export { JoinCode } from './components/quiz/JoinCode.jsx';
export { PlayerChip } from './components/quiz/PlayerChip.jsx';
export { LeaderboardRow } from './components/quiz/LeaderboardRow.jsx';
export { StatTile } from './components/quiz/StatTile.jsx';
export { StageFrame, StageInsetContext, type StageKbd } from './components/quiz/StageFrame.tsx';
export { Podium } from './components/quiz/Podium.tsx';
export type { PodiumEntry } from './components/quiz/Podium.tsx';

export { CountUp } from './components/motion/CountUp.tsx';
