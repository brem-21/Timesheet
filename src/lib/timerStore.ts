// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSession {
  id: string;
  ticketKey: string;
  ticketSummary: string;
  startTime: number;   // Unix ms
  endTime: number;     // Unix ms
  duration: number;    // seconds
  autoStopped: boolean;
  projectId?: string;        // linked project
  projectTimeLogId?: string; // corresponding time_logs.id in DB
}

export interface ActiveTimer {
  ticketKey: string;
  ticketSummary: string;
  startTime: number;   // Unix ms
  lastActivity: number; // Unix ms
}

const SESSIONS_KEY = "clockit_sessions";
const ACTIVE_KEY = "clockit_active_timer";

// ─── Active Timer ─────────────────────────────────────────────────────────────

export function loadActiveTimer(): ActiveTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveTimer) : null;
  } catch {
    return null;
  }
}

export function saveActiveTimer(timer: ActiveTimer): void {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(timer));
}

export function clearActiveTimer(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function loadSessions(): TimeSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as TimeSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: TimeSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function appendSession(session: TimeSession): void {
  const sessions = loadSessions();
  sessions.unshift(session); // newest first
  saveSessions(sessions);
}

export function updateSession(id: string, patch: Partial<TimeSession>): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...patch };
    saveSessions(sessions);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? `${h}h` : null,
    m > 0 ? `${String(m).padStart(h > 0 ? 2 : 1, "0")}m` : null,
    h === 0 ? `${String(s).padStart(m > 0 ? 2 : 1, "0")}s` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Total seconds logged across all sessions for a given ticket key */
export function totalSecondsForTicket(sessions: TimeSession[], ticketKey: string): number {
  return sessions
    .filter((s) => s.ticketKey === ticketKey)
    .reduce((acc, s) => acc + s.duration, 0);
}
