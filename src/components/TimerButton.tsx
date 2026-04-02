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
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleClick}
        title={isActive ? "Stop timer" : "Start timer"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          isActive
            ? "bg-red-100 text-red-700 hover:bg-red-200 ring-1 ring-red-300 animate-pulse"
            : "bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700"
        }`}
      >
        {isActive ? (
          <>
            <span className="w-2 h-2 rounded-sm bg-red-500 shrink-0" />
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
        <span className="text-[10px] text-gray-400 font-medium">
          {formatDurationShort(loggedSeconds)} logged
        </span>
      )}
    </div>
  );
}
