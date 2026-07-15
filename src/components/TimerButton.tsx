"use client";

import { useTimer } from "./TimerContext";
import { formatDurationShort } from "@/lib/timerStore";

interface Props {
  ticketKey: string;
  ticketSummary: string;
}

export default function TimerButton({ ticketKey, ticketSummary }: Props) {
  const { activeTimer, elapsed, startTimer, stopTimer, getTicketLoggedSeconds } = useTimer();

  const isActive = activeTimer?.ticketKey === ticketKey;
  const loggedSeconds = getTicketLoggedSeconds(ticketKey);
  const displayElapsed = isActive ? elapsed : null;

  function handleClick() {
    if (isActive) {
      stopTimer(false);
    } else {
      startTimer(ticketKey, ticketSummary);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        title={isActive ? "Stop timer" : "Start timer"}
        className={isActive ? "btn-ghost-sm" : "btn-primary-sm"}
      >
        {isActive ? (
          <>
            <span className="w-1.5 h-1.5 rounded-pill bg-teal-pine shrink-0" />
            {formatDurationShort(elapsed)}
          </>
        ) : (
          <>
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start
          </>
        )}
      </button>

      {loggedSeconds > 0 && (
        <span className="text-[11px] text-charcoal/40 font-medium">
          {formatDurationShort(loggedSeconds)} logged
        </span>
      )}
    </div>
  );
}
