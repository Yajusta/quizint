// Live engine integration test: real API on :3000, presenter + 3 participants.
import { readFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const API = 'http://localhost:3000';
const log = (...a) => console.log(...a);

// Login + create session via REST
const login = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.fr', password: 'admin-password-12' }),
});
const setCookieRaw =
  login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie') ?? ''].filter(Boolean);
const cookie = setCookieRaw.map((c) => c.split(';')[0]).join('; ');
const quizId = readFileSync('/tmp/quiz-id.txt', 'utf8').trim();

const created = await (
  await fetch(`${API}/api/v1/quizzes/${quizId}/sessions`, {
    method: 'POST',
    headers: { cookie },
  })
).json();
log('session created:', created.code);

const sessionId = created.sessionId;

// Presenter socket (with JWT cookie)
const presenter = io(`${API}/presenter`, { auth: { sessionId }, extraHeaders: { cookie } });
presenter.on('state:snapshot', (s) => log('[presenter] snapshot phase:', s.phase, '| joinUrl:', s.joinUrl));
presenter.on('participants:list', (e) => log('[presenter] participants:', e.count));
presenter.on('question:open', (e) => log('[presenter] Q' + e.questionIndex, 'open —', e.view.type));
presenter.on('answers:progress', (e) => log('[presenter] progress:', e.answered, '/', e.total));
presenter.on('question:closed', (e) => {
  if (e.audience === 'presenter') {
    log(
      '[presenter] Q' + e.result.questionIndex,
      'closed — correct:',
      e.result.correctCount,
      '/',
      e.result.answersCount,
      '| top:',
      e.result.top5.map((t) => `${t.nickname}:${t.score}`).join(' '),
    );
  }
});
presenter.on('session:final', (e) => {
  if (e.audience === 'presenter') {
    log('[presenter] FINAL — podium:', e.final.podium.map((p) => `${p.nickname}:${p.score}`).join(' '));
    log('[presenter] stats:', JSON.stringify(e.final.stats).slice(0, 200));
  }
});

await new Promise((r) => presenter.on('connect', r));
log('presenter connected');

// 3 participants join
const participants = [];
for (const nick of ['Marie', 'Karim', 'Louise']) {
  const socket = io(`${API}/participant`, {});
  const answers = { correct: 0 };
  socket.on('question:open', (e) => {
    // Marie answers correctly fast, Karim correctly slow, Louise wrong
    const q = e.view;
    setTimeout(
      () => {
        let answer;
        if (q.type === 'NUMERIC') answer = { value: nick === 'Louise' ? '99' : '8' };
        else {
          // Pick choice index by nickname role — we can't see isCorrect (leak-proof) so we
          // rely on position: the editor created correct choice at index 1 for MCQ q0, q2 (TRUE_FALSE 'Faux' idx1), poll any.
          const idx = nick === 'Louise' ? 0 : q.choices.length > 1 ? 1 : 0;
          answer = { choiceId: q.choices[idx]?.id };
        }
        socket.emit('answer:submit', { questionIndex: e.questionIndex, answer }, (ack) => {
          if (ack?.ok) answers.correct++;
        });
      },
      nick === 'Marie' ? 300 : nick === 'Karim' ? 1500 : 800,
    );
  });
  socket.on('question:closed', (e) => {
    if (e.audience === 'participant') {
      log(
        `[${nick}] Q${e.result.questionIndex}: correct=${e.result.isCorrect} +${e.result.pointsAwarded}pts total=${e.result.totalScore} rank=${e.result.rank}/${e.result.participantCount}`,
      );
    }
  });
  socket.on('session:final', (e) => {
    if (e.audience === 'participant')
      log(`[${nick}] FINAL rank ${e.final.yourRank}/${e.final.participantCount} score ${e.final.yourScore}`);
  });
  await new Promise((r) => socket.on('connect', r));
  await new Promise((resolve) => {
    socket.emit('participant:join', { code: created.code, nickname: nick }, (ack) => {
      if (ack?.ok) {
        participants.push({ nick, socket, token: ack.token });
        resolve();
      } else {
        log(`[${nick}] JOIN FAILED:`, JSON.stringify(ack));
        resolve();
      }
    });
  });
}
log('all joined:', participants.map((p) => p.nick).join(', '));

// Double-join with same nickname → NICKNAME_TAKEN
await new Promise((resolve) => {
  const dup = io(`${API}/participant`, {});
  dup.on('connect', () => {
    dup.emit('participant:join', { code: created.code, nickname: 'Marie' }, (ack) => {
      log('duplicate nickname ack:', ack?.code, '(expect NICKNAME_TAKEN)');
      dup.close();
      resolve();
    });
  });
});

// Start
await new Promise((r) => setTimeout(r, 500));
await new Promise((resolve) => presenter.emit('session:start', {}, resolve));
log('session started');

// Drive through all 6 questions of the fixture? The API quiz has only 2 questions.
// q0: MCQ timer 20s — close manually after answers. q1: NUMERIC.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await wait(2500);
presenter.emit('question:close', { expectedIndex: 0 }, (ack) => log('close q0:', JSON.stringify(ack)));
await wait(1000);
presenter.emit('question:next', { expectedIndex: 0 }, (ack) => log('next:', JSON.stringify(ack)));
// Double-click next → INDEX_MISMATCH on the second
presenter.emit('question:next', { expectedIndex: 0 }, (ack) =>
  log('double next (expect INDEX_MISMATCH):', ack?.code),
);
await wait(3500);
presenter.emit('question:close', { expectedIndex: 1 }, (ack) => log('close q1:', JSON.stringify(ack)));
await wait(800);
presenter.emit('question:next', { expectedIndex: 1 }, (ack) => log('next (→ final):', JSON.stringify(ack)));
await wait(1200);
presenter.emit('session:end', {}, (ack) => log('end:', JSON.stringify(ack)));
await wait(600);

// Kick-flow smoke: not tested here (session ended). Covered in unit scope later.
log('--- TEST DONE ---');
process.exit(0);
