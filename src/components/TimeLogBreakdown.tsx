"use client";

import { useTimer } from "@/components/TimerContext";
import { formatDuration } from "@/lib/timerStore";

/** A ticketKey that looks like a Jira issue key, e.g. AMALI-123 or PROJ-4 */
function isJiraKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(key.trim());
}

export default function TimeLogBreakdown() {
  const { sessions } = useTimer();

  if (sessions.length === 0) return null;

  const jiraSessions = sessions.filter((s) => isJiraKey(s.ticketKey));
  const meetingSessions = sessions.filter((s) => !isJiraKey(s.ticketKey));

  const jiraSeconds = jiraSessions.reduce((a, s) => a + s.duration, 0);
  const meetingSeconds = meetingSessions.reduce((a, s) => a + s.duration, 0);
  const totalSeconds = jiraSeconds + meetingSeconds;

  const jiraPct = totalSeconds > 0 ? Math.round((jiraSeconds / totalSeconds) * 100) : 0;
  const meetingPct = totalSeconds > 0 ? 100 - jiraPct : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Time Logged Breakdown</h2>
        <span className="text-xs text-gray-400 font-medium">{formatDuration(totalSeconds)} total</span>
      </div>

      {/* Progress bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden mb-5 bg-gray-100">
        {jiraSeconds > 0 && (
          <div
            className="bg-indigo-500 transition-all"
            style={{ width: `${jiraPct}%` }}
          />
        )}
        {meetingSeconds > 0 && (
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${meetingPct}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Jira */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-indigo-600 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Jira tickets</p>
            <p className="text-xl font-bold text-indigo-700 mt-0.5">{formatDuration(jiraSeconds)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {jiraSessions.length} session{jiraSessions.length !== 1 ? "s" : ""} · {jiraPct}%
            </p>
          </div>
        </div>

        {/* Meetings */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Meeting tasks</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{formatDuration(meetingSeconds)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {meetingSessions.length} session{meetingSessions.length !== 1 ? "s" : ""} · {meetingPct}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
