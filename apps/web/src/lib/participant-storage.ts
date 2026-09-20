// Participant storage helpers (§6.6): token is the ONLY thing kept locally.

const key = (code: string) => `quiz:participant:${code.toUpperCase()}`;

export interface StoredParticipant {
  token: string;
  participantId: string;
  nickname: string;
}

export function loadParticipant(code: string): StoredParticipant | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as StoredParticipant) : null;
  } catch {
    return null;
  }
}

export function saveParticipant(code: string, p: StoredParticipant): void {
  try {
    localStorage.setItem(key(code), JSON.stringify(p));
  } catch {
    // storage unavailable (private mode) — resume simply won't work
  }
}

export function clearParticipant(code: string): void {
  try {
    localStorage.removeItem(key(code));
  } catch {
    // ignore
  }
}
