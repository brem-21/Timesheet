"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  ActiveTimer,
  TimeSession,
  appendSession,
  clearActiveTimer,
  generateId,
  loadActiveTimer,
  loadSessions,
  saveActiveTimer,
  saveSessions,
  totalSecondsForTicket,
} from "@/lib/timerStore";

interface TimerContextValue {
  activeTimer: ActiveTimer | null;
  sessions: TimeSession[];
  elapsed: number; // seconds since timer started
  startTimer: (ticketKey: string, ticketSummary: string) => void;
  stopTimer: (autoStopped?: boolean) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
  getTicketLoggedSeconds: (ticketKey: string) => number;
  inactivityWarning: boolean;
  dismissWarning: () => void;
  refreshSessions: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [inactivityWarning, setInactivityWarning] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTimerRef = useRef<ActiveTimer | null>(null);

  // Keep ref in sync with state so stopTimer can read it without functional updater
  useEffect(() => { activeTimerRef.current = activeTimer; }, [activeTimer]);

  // ── Hydrate from localStorage on mount ─────────────────────────────────────
  useEffect(() => {
    setSessions(loadSessions());
    const saved = loadActiveTimer();
    if (saved) {
      activeTimerRef.current = saved;
      setActiveTimer(saved);
      const sec = Math.floor((Date.now() - saved.startTime) / 1000);
      setElapsed(sec);
    }
  }, []);

  // ── Tick: update elapsed every second ──────────────────────────────────────
  useEffect(() => {
    if (activeTimer) {
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeTimer.startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeTimer]);

  // ── Stop timer ────────────────────────────────────────────────────────────
  const stopTimer = useCallback((autoStopped = false) => {
    const current = activeTimerRef.current;
    if (!current) return;

    const endTime = Date.now();
    const duration = Math.floor((endTime - current.startTime) / 1000);
    if (duration > 0) {
      const session: TimeSession = {
        id: generateId(),
        ticketKey: current.ticketKey,
        ticketSummary: current.ticketSummary,
        startTime: current.startTime,
        endTime,
        duration,
        autoStopped,
      };
      appendSession(session);
    }
    clearActiveTimer();
    activeTimerRef.current = null;
    setActiveTimer(null);
    setSessions(loadSessions());
    setInactivityWarning(false);
  }, []);


  // ── Start timer ────────────────────────────────────────────────────────────
  const startTimer = useCallback(
    (ticketKey: string, ticketSummary: string) => {
      // Stop any running timer first
      if (activeTimer) stopTimer(false);

      const now = Date.now();
      const timer: ActiveTimer = {
        ticketKey,
        ticketSummary,
        startTime: now,
        lastActivity: now,
      };
      saveActiveTimer(timer);
      activeTimerRef.current = timer;
      setActiveTimer(timer);
      setInactivityWarning(false);
    },
    [activeTimer, stopTimer]
  );

  // ── Delete a single session ────────────────────────────────────────────────
  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
  }, []);

  // ── Clear all sessions ────────────────────────────────────────────────────
  const clearAllSessions = useCallback(() => {
    saveSessions([]);
    setSessions([]);
  }, []);

  const getTicketLoggedSeconds = useCallback(
    (ticketKey: string) => totalSecondsForTicket(sessions, ticketKey),
    [sessions]
  );

  const dismissWarning = useCallback(() => setInactivityWarning(false), []);

  const refreshSessions = useCallback(() => {
    setSessions(loadSessions());
  }, []);

  return (
    <TimerContext.Provider
      value={{
        activeTimer,
        sessions,
        elapsed,
        startTimer,
        stopTimer,
        deleteSession,
        clearAllSessions,
        getTicketLoggedSeconds,
        inactivityWarning,
        dismissWarning,
        refreshSessions,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}
