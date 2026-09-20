// E2E-style smoke test of the mock live server protocol.
import { readFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const base = 'http://localhost:4001';
const code = /session ([A-Z0-9]{6})/.exec(readFileSync('/tmp/mock-server.log', 'utf8'))[1];
const nickname = 'Test' + Math.floor(Math.random() * 100000);
console.log('code:', code, '| nickname:', nickname);

const pres = io(base + '/presenter', {});
const p1 = io(base + '/participant', {});
let sessionId = null;

p1.on('state:snapshot', (snap) => {
  sessionId = snap.sessionId;
  console.log(
    'participant snapshot: phase',
    snap.phase,
    '| you:',
    snap.you?.nickname,
    '| count:',
    snap.participantCount,
  );
});

p1.emit('participant:join', { code, nickname }, (ack) => {
  console.log('join ack ok:', ack?.ok === true, '| token received:', typeof ack?.token === 'string');
});

p1.on('lobby:count', (e) => console.log('lobby:count ->', e.count));

p1.on('question:open', (e) => {
  const leaked =
    JSON.stringify(e.view).includes('isCorrect') || JSON.stringify(e.view).includes('numericAnswer');
  console.log(
    `question:open idx ${e.questionIndex} (${e.view.type}) — answer leaked to participant: ${leaked}`,
  );
  setTimeout(() => {
    const answer = e.view.type === 'NUMERIC' ? { value: '8' } : { choiceId: e.view.choices[0].id };
    p1.emit('answer:submit', { questionIndex: e.questionIndex, answer }, (ack) => {
      console.log('answer ack ok:', ack?.ok === true, ack?.ok ? '' : JSON.stringify(ack));
    });
  }, 200);
});

p1.on('question:closed', (e) => {
  console.log('question:closed ->', JSON.stringify(e.result).slice(0, 140));
});

pres.on('participants:list', (e) => console.log('participants:list count:', e.count));
pres.on('question:open', (e) => console.log('[presenter] question:open idx', e.questionIndex));
pres.on('answers:progress', (e) => console.log('[presenter] answers:progress:', e.answered, '/', e.total));

setTimeout(() => {
  if (!sessionId) {
    console.error('no sessionId captured');
    process.exit(1);
  }
  // attach presenter to the session
  const pres2 = io(base + '/presenter', { auth: { sessionId } });
  pres2.on('state:snapshot', (snap) => {
    console.log('[presenter2] attached, phase:', snap.phase, '| joinUrl:', snap.joinUrl);
    pres2.emit('session:start', {}, (ack) => console.log('session:start ack:', JSON.stringify(ack)));
    setTimeout(
      () =>
        pres2.emit('question:close', { expectedIndex: 0 }, (ack) =>
          console.log('close q0:', JSON.stringify(ack)),
        ),
      1200,
    );
    setTimeout(
      () =>
        pres2.emit('question:next', { expectedIndex: 0 }, (ack) => console.log('next:', JSON.stringify(ack))),
      2000,
    );
    setTimeout(
      () =>
        pres2.emit('question:next', { expectedIndex: 0 }, (ack) =>
          console.log('double next (should INDEX_MISMATCH):', JSON.stringify(ack)),
        ),
      2400,
    );
    setTimeout(() => {
      console.log('--- done ---');
      process.exit(0);
    }, 3200);
  });
}, 1500);

setTimeout(() => {
  console.error('TIMEOUT');
  process.exit(1);
}, 10000);
