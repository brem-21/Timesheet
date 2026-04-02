"use client";

import { useTimer } from "@/components/TimerContext";
import { isWithinInterval, startOfDay, startOfWeek, addDays, addWeeks, format, differenceInDays } from "date-fns";

interface Props {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
}

/** Jira issue key: e.g. AMALI-123 */
function isJiraKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(key.trim());
}

interface Bucket {
  label: string;
  jiraSeconds: number;
  meetingSeconds: number;
}

export default function TimeLogStackedChart({ startDate, endDate }: Props) {
  const { sessions } = useTimer();

  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  const spanDays = differenceInDays(end, start) + 1;
  const byDay = spanDays <= 14;

  // Build time buckets
  const buckets: Bucket[] = [];
  if (byDay) {
    for (let i = 0; i < spanDays; i++) {
      const day = addDays(start, i);
      buckets.push({ label: format(day, "MMM d"), jiraSeconds: 0, meetingSeconds: 0 });
    }
  } else {
    // Weekly buckets — Monday-aligned
    const firstMon = startOfWeek(start, { weekStartsOn: 1 });
    let cur = firstMon;
    while (cur <= end) {
      buckets.push({ label: `w/c ${format(cur, "MMM d")}`, jiraSeconds: 0, meetingSeconds: 0 });
      cur = addWeeks(cur, 1);
    }
  }

  // Fill buckets from sessions
  for (const s of sessions) {
    const sDate = startOfDay(new Date(s.startTime));
    if (sDate < start || sDate > end) continue;

    let bucketIdx: number;
    if (byDay) {
      bucketIdx = differenceInDays(sDate, start);
    } else {
      const sMon = startOfWeek(sDate, { weekStartsOn: 1 });
      const firstMon = startOfWeek(start, { weekStartsOn: 1 });
      bucketIdx = Math.floor(differenceInDays(sMon, firstMon) / 7);
    }

    if (bucketIdx < 0 || bucketIdx >= buckets.length) continue;

    if (isJiraKey(s.ticketKey)) {
      buckets[bucketIdx].jiraSeconds += s.duration;
    } else {
      buckets[bucketIdx].meetingSeconds += s.duration;
    }
  }

  const nonEmpty = buckets.filter((b) => b.jiraSeconds > 0 || b.meetingSeconds > 0);
  if (nonEmpty.length === 0) return null;

  const maxSeconds = Math.max(...buckets.map((b) => b.jiraSeconds + b.meetingSeconds), 1);

  const totalJira = buckets.reduce((s, b) => s + b.jiraSeconds, 0);
  const totalMeeting = buckets.reduce((s, b) => s + b.meetingSeconds, 0);
  const totalAll = totalJira + totalMeeting;

  function fmt(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Header + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Time Logged Breakdown</h3>
          <p className="text-xs text-gray-400 mt-0.5">{byDay ? "Daily" : "Weekly"} · {fmt(totalAll)} total</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-500 shrink-0" />
            <span className="text-xs text-gray-600 font-medium">Jira</span>
            <span className="text-xs text-gray-400">({fmt(totalJira)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
            <span className="text-xs text-gray-600 font-medium">Meeting tasks</span>
            <span className="text-xs text-gray-400">({fmt(totalMeeting)})</span>
          </div>
        </div>
      </div>

      {/* Stacked bar chart */}
      <div className="flex items-end gap-1.5 h-44 overflow-x-auto pb-1">
        {buckets.map((b, i) => {
          const total = b.jiraSeconds + b.meetingSeconds;
          const totalPct = (total / maxSeconds) * 100;
          const jiraPct = total > 0 ? (b.jiraSeconds / total) * 100 : 0;
          const meetingPct = total > 0 ? (b.meetingSeconds / total) * 100 : 0;
          const isEmpty = total === 0;

          return (
            <div
              key={i}
              className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group relative"
            >
              {/* Tooltip */}
              {!isEmpty && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-start bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-20 shadow-lg gap-0.5">
                  <span className="font-semibold text-gray-200 mb-1">{b.label}</span>
                  {b.jiraSeconds > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm bg-indigo-400 shrink-0" />
                      Jira: {fmt(b.jiraSeconds)}
                    </span>
                  )}
                  {b.meetingSeconds > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm bg-amber-400 shrink-0" />
                      Meetings: {fmt(b.meetingSeconds)}
                    </span>
                  )}
                  <span className="text-gray-400 text-[10px] mt-0.5">Total: {fmt(total)}</span>
                </div>
              )}

              {/* Bar column */}
              <div
                className="w-full flex flex-col-reverse rounded-t-md overflow-hidden transition-all duration-300"
                style={{ height: `${Math.max(isEmpty ? 2 : (totalPct / 100) * 152, isEmpty ? 2 : 4)}px` }}
              >
                {b.jiraSeconds > 0 && (
                  <div
                    className="w-full bg-indigo-500 shrink-0"
                    style={{ height: `${jiraPct}%` }}
                  />
                )}
                {b.meetingSeconds > 0 && (
                  <div
                    className="w-full bg-amber-400 shrink-0"
                    style={{ height: `${meetingPct}%` }}
                  />
                )}
                {isEmpty && <div className="w-full bg-gray-100 h-full rounded-t-md" />}
              </div>

              <span className="text-[9px] text-gray-400 text-center leading-tight w-full text-center truncate px-0.5">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Y-axis hint */}
      <div className="flex justify-between mt-2 text-[10px] text-gray-300">
        <span>0</span>
        <span>{fmt(maxSeconds)}</span>
      </div>
    </div>
  );
}
