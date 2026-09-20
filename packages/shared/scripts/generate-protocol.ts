// Generates docs/PROTOCOL.md (socket events) and docs/quiz-import-schema.json
// from the Zod schemas. Run: pnpm docs:protocol

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import {
  AnswersProgressEvent,
  JoinCommand,
  AnswerSubmitCommand,
  SessionStartCommand,
  QuestionCloseCommand,
  QuestionNextCommand,
  QuestionBackCommand,
  QuestionReopenCommand,
  ParticipantKickCommand,
  SettingsUpdateCommand,
  LobbyCountEvent,
  ParticipantKickedEvent,
  ParticipantsListEvent,
  PhaseEvent,
  QuestionOpenEvent,
  SessionEndedEvent,
  SessionSnapshotForParticipant,
  SessionSnapshotForPresenter,
  SettingsChangedEvent,
} from '../src/schemas/events.js';
import { QuizExportV1 } from '../src/schemas/domain.js';

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(here, '../../../docs');

function jsonSchema(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema, { io: 'output' }), null, 2);
}

// [event name, schema, note, heading qualifier]. The qualifier keeps the two `state:snapshot`
// headings distinct: one event name, one payload per audience.
const serverEvents: Array<[string, z.ZodType, string, string?]> = [
  [
    'state:snapshot',
    SessionSnapshotForParticipant,
    'Full participant snapshot sent on every (re)connection',
    'participant',
  ],
  [
    'state:snapshot',
    SessionSnapshotForPresenter,
    'Full presenter snapshot sent on every (re)connection',
    'presenter',
  ],
  ['session:phase', PhaseEvent, 'On every phase transition'],
  ['question:open', QuestionOpenEvent, 'On question opening (view depends on audience)'],
  ['participants:list', ParticipantsListEvent, 'Presenter only — debounced 200 ms, every change, all phases'],
  ['answers:progress', AnswersProgressEvent, 'Presenter only — throttled 250 ms per answer'],
  ['settings:changed', SettingsChangedEvent, 'After settings:update'],
  ['lobby:count', LobbyCountEvent, 'Participant only — debounced 500 ms, LOBBY phase'],
  ['participant:kicked', ParticipantKickedEvent, 'Participant only — on kick'],
];

const clientCommands: Array<[string, z.ZodType, string]> = [
  ['participant:join', JoinCommand, 'Participant namespace — join with code + nickname'],
  ['answer:submit', AnswerSubmitCommand, 'Participant namespace — submit an answer'],
  ['session:start', SessionStartCommand, 'Presenter namespace'],
  ['question:close', QuestionCloseCommand, 'Presenter namespace — idempotent via expectedIndex'],
  ['question:next', QuestionNextCommand, 'Presenter namespace — idempotent via expectedIndex'],
  [
    'question:back',
    QuestionBackCommand,
    'Presenter namespace — QUESTION_OPEN (index ≥ 1) → previous QUESTION_CLOSED; discards the open question’s answers',
  ],
  [
    'question:reopen',
    QuestionReopenCommand,
    'Presenter namespace — QUESTION_CLOSED → same QUESTION_OPEN, fresh timer; discards its answers and result',
  ],
  ['participant:kick', ParticipantKickCommand, 'Presenter namespace — any phase'],
  ['settings:update', SettingsUpdateCommand, 'Presenter namespace'],
];

let md = `# Protocole temps réel (Socket.IO)

> Généré automatiquement depuis les schémas Zod de \`@quiz/shared\` — \`pnpm docs:protocol\`.

Deux namespaces : \`/presenter\` (cookie JWT admin) et \`/participant\` (token de participant ou join).

Toute commande client → serveur reçoit un ack \`{ ok: true, ...data } | { ok: false, code, message }\`.
Chaque événement serveur porte \`serverTime\` (epoch ms) pour la synchronisation d'horloge.

## Événements serveur → clients

`;
for (const [name, schema, note, qualifier] of serverEvents) {
  const heading = qualifier ? `\`${name}\` — ${qualifier}` : `\`${name}\``;
  md += `### ${heading}\n\n${note}\n\n\`\`\`json\n${jsonSchema(schema)}\n\`\`\`\n\n`;
}

md += `## Commandes clients → serveur\n\n`;
for (const [name, schema, note] of clientCommands) {
  md += `### \`${name}\`\n\n${note}\n\n\`\`\`json\n${jsonSchema(schema)}\n\`\`\`\n\n`;
}

md += `## Fin de session\n\n### \`session:ended\`\n\n\`\`\`json\n${jsonSchema(SessionEndedEvent)}\n\`\`\`\n`;

mkdirSync(docsDir, { recursive: true });
writeFileSync(resolve(docsDir, 'PROTOCOL.md'), md);
writeFileSync(
  resolve(docsDir, 'quiz-import-schema.json'),
  JSON.stringify(z.toJSONSchema(QuizExportV1, { io: 'input' }), null, 2),
);
console.log(`Wrote ${docsDir}/PROTOCOL.md and quiz-import-schema.json`);
