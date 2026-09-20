// Load smoke (§13.10): 200 concurrent socket.io participants on one live session.
// Measures join latency, answer broadcast fan-out, memory. Run against dev API.

import { io } from 'socket.io-client';

const API = 'http://localhost:3000';
const N = Number(process.argv[2] ?? '200');

const login = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email: 'admin@example.fr', password: 'admin-password-12' }),
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');

const quizzes = await (await fetch(`${API}/api/v1/quizzes`, { headers: { cookie } })).json();
const quiz = quizzes.quizzes.find((q) => q.questionCount >= 2);
if (!quiz) throw new Error('need a quiz with >= 2 questions');
const created = await (
  await fetch(`${API}/api/v1/quizzes/${quiz.id}/sessions`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: '{}',
  })
).json();
console.log(`session ${created.code} — quiz "${quiz.title}" (${quiz.questionCount} q)`);
console.log(`load target: ${N} concurrent participants`);

// Presenter socket
const presenter = io(`${API}/presenter`, {
  auth: { sessionId: created.sessionId },
  extraHeaders: { cookie },
});
await new Promise((r) => presenter.on('connect', r));

// N participants
const sockets = [];
const joinLatencies = [];
const t0 = Date.now();
let joined = 0;
let errors = 0;

for (let i = 0; i < N; i++) {
  const s = io(`${API}/participant`, { transports: ['websocket'] });
  sockets.push(s);
  const jt0 = Date.now();
  s.on('connect', () => {
    s.emit('participant:join', { code: created.code, nickname: `Bot${i}` }, (ack) => {
      if (ack?.ok) {
        joined++;
        joinLatencies.push(Date.now() - jt0);
      } else {
        errors++;
        if (errors <= 3) console.log(`  join error: ${ack?.code}`);
      }
    });
  });
}

// Wait for all joins (max 30s)
await new Promise((resolve) => {
  const check = setInterval(() => {
    if (joined + errors >= N || Date.now() - t0 > 30000) {
      clearInterval(check);
      resolve();
    }
  }, 200);
});
const joinMs = Date.now() - t0;
joinLatencies.sort((a, b) => a - b);
const p = (q) => joinLatencies[Math.floor((q / 100) * joinLatencies.length)] ?? 0;
console.log(
  `joins: ${joined}/${N} ok, ${errors} errors, wall ${joinMs}ms | latency p50=${p(50)}ms p95=${p(95)}ms p99=${p(99)}ms`,
);

// Answer storm: all bots answer q0 as soon as it opens
let opensReceived = 0;
let answersDone = 0;
const answerT0 = { v: 0 };
for (const s of sockets) {
  s.on('question:open', (e) => {
    opensReceived++;
    if (e.view.type === 'NUMERIC') {
      s.emit('answer:submit', { questionIndex: e.view.position, answer: { value: '8' } }, () => {
        answersDone++;
        if (answersDone === 1) answerT0.v = Date.now();
      });
    } else {
      const choice = e.view.choices?.[1] ?? e.view.choices?.[0];
      s.emit(
        'answer:submit',
        { questionIndex: e.view.position, answer: { choiceId: choice?.id } },
        () => answersDone++,
      );
    }
  });
}

// Start the session and drive it
presenter.emit('session:start', {}, async (ack) => {
  console.log('session:start ack:', ack?.ok === true ? 'ok' : ack);
  await sleep(2000);
  presenter.emit('question:close', { expectedIndex: 0 }, async () => {
    // wait for everyone's question:closed
    let closed = 0;
    for (const s of sockets) s.on('question:closed', () => closed++);
    await sleep(3000);
    const rss = process.memoryUsage().rss / 1024 / 1024;
    console.log(`q0: opens received by clients: ${opensReceived}/${N} | answers acked: ${answersDone}`);
    console.log(
      `close→broadcast: received ${closed}/${N} closed events in window | client RSS: ${rss.toFixed(0)} MB`,
    );
    presenter.emit('session:end', {}, () => {
      console.log('--- LOAD SMOKE DONE ---');
      cleanup();
      process.exit(joined === N && opensReceived === N ? 0 : 1);
    });
  });
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function cleanup() {
  for (const s of sockets) s.close();
  presenter.close();
}
