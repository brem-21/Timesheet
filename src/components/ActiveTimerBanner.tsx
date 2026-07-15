"use client";

import { useTimer } from "./TimerContext";
import { formatDuration } from "@/lib/timerStore";

export default function ActiveTimerBanner() {
  const { activeTimer, elapsed, stopTimer, inactivityWarning, dismissWarning } = useTimer();

  if (inactivityWarning) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-80 card-blush">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-charcoal">Timer auto-stopped</p>
            <p className="text-[12px] text-charcoal/60 mt-0.5">
              No activity detected for 15 minutes. Your session has been saved.
            </p>
          </div>
          <button onClick={dismissWarning} className="text-charcoal/40 hover:text-charcoal shrink-0">
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
    <div className="fixed bottom-6 right-6 z-50 w-72 card-white overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow text-[11px]">
          <span className="eyebrow-dot" />
          Timer Running
        </p>
        <button onClick={() => stopTimer(false)} className="btn-ghost-sm">
          Stop
        </button>
      </div>

      {/* Ticket info */}
      <p className="text-[14px] font-semibold text-charcoal truncate mt-2">
        {activeTimer.ticketKey}
      </p>
      <p className="text-[12px] text-charcoal/60 line-clamp-2 mt-0.5">
        {activeTimer.ticketSummary}
      </p>

      {/* Elapsed */}
      <div className="mt-3 bg-mint rounded-card px-3 py-2 text-center">
        <span className="font-display text-heading-sm text-teal-deep tabular-nums">
          {formatDuration(elapsed)}
        </span>
      </div>

      <p className="text-[11px] text-charcoal/40 text-center mt-1.5">
        Auto-stops after 15 min of inactivity
      </p>
    </div>
  );
}
