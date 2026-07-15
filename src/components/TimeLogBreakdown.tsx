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
    <div className="card-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="eyebrow">
          <span className="eyebrow-dot" />
          Time Logged Breakdown
        </h2>
        <span className="text-[12px] text-charcoal/40 font-medium">{formatDuration(totalSeconds)} total</span>
      </div>

      {/* Progress bar */}
      <div className="flex h-2 rounded-pill overflow-hidden mb-5 bg-mint">
        {jiraSeconds > 0 && (
          <div
            className="bg-teal-deep transition-all"
            style={{ width: `${jiraPct}%` }}
          />
        )}
        {meetingSeconds > 0 && (
          <div
            className="bg-rose transition-all"
            style={{ width: `${meetingPct}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-16">
        {/* Jira */}
        <div>
          <p className="text-[12px] text-charcoal/50 font-medium">Jira tickets</p>
          <p className="font-display text-heading-sm text-teal-deep mt-0.5">{formatDuration(jiraSeconds)}</p>
          <p className="text-[12px] text-charcoal/40 mt-0.5">
            {jiraSessions.length} session{jiraSessions.length !== 1 ? "s" : ""} · {jiraPct}%
          </p>
        </div>

        {/* Meetings */}
        <div>
          <p className="text-[12px] text-charcoal/50 font-medium">Meeting tasks</p>
          <p className="font-display text-heading-sm text-[#a8697d] mt-0.5">{formatDuration(meetingSeconds)}</p>
          <p className="text-[12px] text-charcoal/40 mt-0.5">
            {meetingSessions.length} session{meetingSessions.length !== 1 ? "s" : ""} · {meetingPct}%
          </p>
        </div>
      </div>
    </div>
  );
}
