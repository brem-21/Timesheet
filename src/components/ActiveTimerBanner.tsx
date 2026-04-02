"use client";

import { useTimer } from "./TimerContext";
import { formatDuration } from "@/lib/timerStore";

export default function ActiveTimerBanner() {
  const { activeTimer, elapsed, stopTimer, inactivityWarning, dismissWarning } = useTimer();

  if (inactivityWarning) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-80 bg-amber-50 border border-amber-300 rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Timer auto-stopped</p>
            <p className="text-xs text-amber-600 mt-0.5">
              No activity detected for 15 minutes. Your session has been saved.
            </p>
          </div>
          <button onClick={dismissWarning} className="text-amber-400 hover:text-amber-600 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!activeTimer) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-white border border-indigo-200 rounded-2xl shadow-xl overflow-hidden">
      {/* Pulsing top bar */}
      <div className="h-1 bg-indigo-500 animate-pulse" />

      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Timer Running</span>
          </div>
          <button
            onClick={() => stopTimer(false)}
            className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <span className="w-2 h-2 rounded-sm bg-red-500 shrink-0" />
            Stop
          </button>
        </div>

        {/* Ticket info */}
        <p className="text-sm font-semibold text-gray-800 truncate mt-2">
          {activeTimer.ticketKey}
        </p>
        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
          {activeTimer.ticketSummary}
        </p>

        {/* Elapsed */}
        <div className="mt-3 bg-indigo-50 rounded-xl px-3 py-2 text-center">
          <span className="text-2xl font-bold text-indigo-700 tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-1.5">
          Auto-stops after 15 min of inactivity
        </p>
      </div>
    </div>
  );
}
