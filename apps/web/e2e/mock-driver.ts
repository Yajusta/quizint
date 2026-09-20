// Driver of the mock server (`pnpm mock:live`, :4001), shared by the specs that play a live
// session: participant, stage, reduced-motion.
//
// Lots 1 and 2 duplicated this driver in each `.spec.ts` for lack of a place to put it (a .spec
// file cannot be imported). Lot 5 extracts it here: `mock-driver.ts` is not a spec, Playwright
// does not collect it, and the three specs share the same version of the protocol.
//
// Contract:
//   createSession(quiz)  — opens a session on the mock and returns its detail (code, questions).
//   Presenter.attach(id) — /presenter socket: start, close, next, kick, end.
//   Bot.join(code, name) — /participant socket: answer (by strategy), choose, correct, wrong, value.
//   mockJson(path, init) — mock administration calls (ack-delay, settings, disconnect…).

import { io, type Socket } from 'socket.io-client';

export const MOCK_URL = process.env.MOCK_URL ?? 'http://127.0.0.1:4001';

export interface MockChoice {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface MockQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'NUMERIC' | 'POLL' | 'TEXT_POLL';
  prompt: string;
  choices: MockChoice[];
  numericAnswer: { value: number } | null;
}

export interface MockSessionDetail {
  id: string;
  code: string;
  quiz: { questions: MockQuestion[] };
}

export async function mockJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MOCK_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** `createSession('showcase')` or `createSession({ quiz: 'showcase', pointsScale: 40 })`. */
export async function createSession(
  spec: 'demo' | 'showcase' | Record<string, unknown>,
): Promise<MockSessionDetail> {
  const body = typeof spec === 'string' ? { quiz: spec } : spec;
  const created = await mockJson<{ id: string }>('/mock/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mockJson<MockSessionDetail>(`/mock/sessions/${created.id}`);
}

/** `baseUrl`: the mock by default; the admin spec passes the real API (and the cookie via `extraHeaders`). */
export function connect(
  namespace: string,
  options: { auth?: Record<string, string>; extraHeaders?: Record<string, string> } = {},
  baseUrl = MOCK_URL,
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // forceNew: without it socket.io-client multiplexes driver and bots over a single connection,
    // and the server-side cut of one participant (« reconnexion » state) would take everyone down.
    const socket = io(`${baseUrl}${namespace}`, {
      ...options,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err: Error) => reject(err));
  });
}

export interface Ack {
  ok: boolean;
  code?: string;
  participantId?: string;
}

export function emitAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve, reject) =>
    socket.timeout(10_000).emit(event, payload, (err: Error | null, ack: Ack) => {
      if (err) reject(new Error(`${event}: ack timeout`));
      else resolve(ack);
    }),
  );
}

export class Presenter {
  private constructor(private readonly socket: Socket) {}

  static async attach(sessionId: string): Promise<Presenter> {
    return new Presenter(await connect('/presenter', { auth: { sessionId } }));
  }

  async start(): Promise<void> {
    const ack = await emitAck(this.socket, 'session:start', {});
    if (!ack.ok) throw new Error(`session:start → ${ack.code}`);
  }
  /** Tolerates INVALID_PHASE: the mock's timer may have closed the question before us. */
  async close(index: number): Promise<void> {
    const ack = await emitAck(this.socket, 'question:close', { expectedIndex: index });
    if (!ack.ok && ack.code !== 'INVALID_PHASE') throw new Error(`question:close → ${ack.code}`);
  }
  async next(index: number): Promise<void> {
    const ack = await emitAck(this.socket, 'question:next', { expectedIndex: index });
    if (!ack.ok) throw new Error(`question:next → ${ack.code}`);
  }
  async kick(participantId: string): Promise<void> {
    const ack = await emitAck(this.socket, 'participant:kick', { participantId });
    if (!ack.ok) throw new Error(`participant:kick → ${ack.code}`);
  }
  async end(): Promise<void> {
    const ack = await emitAck(this.socket, 'session:end', {});
    if (!ack.ok) throw new Error(`session:end → ${ack.code}`);
  }
  dispose(): void {
    this.socket.close();
  }
}

export type BotStrategy = 'correct' | 'wrong' | 'silent';

export class Bot {
  private constructor(
    private readonly socket: Socket,
    readonly nickname: string,
    readonly participantId: string,
    readonly strategy: BotStrategy,
  ) {}

  static async join(code: string, nickname: string, strategy: BotStrategy = 'correct'): Promise<Bot> {
    const socket = await connect('/participant');
    const ack = await emitAck(socket, 'participant:join', { code, nickname });
    if (!ack.ok || !ack.participantId) throw new Error(`join ${nickname} → ${ack.code}`);
    return new Bot(socket, nickname, ack.participantId, strategy);
  }

  private pick(q: MockQuestion): { choiceId: string } | { value: string } | { text: string } | null {
    if (q.type === 'TEXT_POLL') {
      // Spellings that group together on the result (« Rapide » x3) next to single answers.
      const words = ['Rapide', 'rapide !', 'Fiable', 'RAPIDE', 'Complexe', 'Fiable', 'Éparpillé'];
      const hash = [...this.nickname].reduce((h, c) => h + c.charCodeAt(0), 0);
      return { text: words[hash % words.length] ?? 'Rapide' };
    }
    if (q.type === 'NUMERIC') {
      return this.strategy === 'correct' && q.numericAnswer
        ? { value: String(q.numericAnswer.value) }
        : { value: '1' };
    }
    if (q.type === 'POLL') return q.choices[0] ? { choiceId: q.choices[0].id } : null;
    const choice = q.choices.find((c) => (this.strategy === 'correct' ? c.isCorrect : !c.isCorrect));
    return choice ? { choiceId: choice.id } : null;
  }

  /** Answers according to the bot's strategy (nothing if `silent`). */
  async answer(index: number, q: MockQuestion): Promise<void> {
    if (this.strategy === 'silent') return;
    const answer = this.pick(q);
    if (!answer) return;
    await emitAck(this.socket, 'answer:submit', { questionIndex: index, answer });
  }

  /** Answers with proposition `choiceIndex` (MCQ, true/false, poll). */
  async choose(index: number, q: MockQuestion, choiceIndex: number): Promise<void> {
    const choice = q.choices[choiceIndex];
    if (!choice) return;
    await emitAck(this.socket, 'answer:submit', { questionIndex: index, answer: { choiceId: choice.id } });
  }
  async correct(index: number, q: MockQuestion): Promise<void> {
    if (q.type === 'NUMERIC') {
      if (q.numericAnswer) await this.value(index, String(q.numericAnswer.value));
      return;
    }
    const i = q.choices.findIndex((c) => c.isCorrect);
    await this.choose(index, q, i >= 0 ? i : 0);
  }
  async wrong(index: number, q: MockQuestion): Promise<void> {
    if (q.type === 'NUMERIC') {
      await this.value(index, '1');
      return;
    }
    const i = q.choices.findIndex((c) => !c.isCorrect);
    await this.choose(index, q, i >= 0 ? i : 0);
  }
  async value(index: number, value: string): Promise<void> {
    await emitAck(this.socket, 'answer:submit', { questionIndex: index, answer: { value } });
  }

  dispose(): void {
    this.socket.close();
  }
}
