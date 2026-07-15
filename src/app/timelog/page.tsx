"use client";

import { useState, useEffect, useCallback } from "react";
import { useTimer } from "@/components/TimerContext";
import { formatDuration, formatDurationShort, updateSession } from "@/lib/timerStore";
import { format, startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths, isWithinInterval } from "date-fns";

interface Project { id: string; name: string; color: string; }

type DateRange = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month" | "all";

function getRange(range: DateRange): { start: Date; end: Date } | null {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "yesterday": {
      const d = subDays(now, 1);
      return { start: startOfDay(d), end: startOfDay(now) };
    }
    case "this-week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
    case "last-week": {
      const start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const end = startOfWeek(now, { weekStartsOn: 1 });
      return { start, end };
    }
    case "this-month":
      return { start: startOfMonth(now), end: now };
    case "last-month": {
      const start = startOfMonth(subMonths(now, 1));
      const end = startOfMonth(now);
      return { start, end };
    }
    default:
      return null;
  }
}

const RANGE_LABELS: Record<DateRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This week",
  "last-week": "Last week",
  "this-month": "This month",
  "last-month": "Last month",
  all: "All time",
};

const RECENT_KEY = "clockit_recent_searches";
const TIMELOG_ASSIGNEE_KEY = "clockit_timelog_assignee";
const TIMELOG_REPORTS_TO_KEY = "clockit_timelog_reports_to";

interface RecentSearch {
  accountId: string;
  displayName: string;
  avatarUrl?: string;
}

function loadRecentSearches(): RecentSearch[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function TimeLogPage() {
  const { sessions, deleteSession, clearAllSessions, activeTimer, elapsed, stopTimer, refreshSessions } = useTimer();
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [teamNames, setTeamNames] = useState<RecentSearch[]>([]);
  const [assignee, setAssignee] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [filterName, setFilterName] = useState("");
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null); // session being linked

  useEffect(() => {
    const names = loadRecentSearches();
    setTeamNames(names);
    setAssignee(localStorage.getItem(TIMELOG_ASSIGNEE_KEY) ?? "");
    setReportsTo(localStorage.getItem(TIMELOG_REPORTS_TO_KEY) ?? "");
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? [])).catch(() => {});
  }, []);

  const linkSessionToProject = useCallback(async (sessionId: string, projectId: string | null) => {
    setLinkingId(sessionId);
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      // Remove old DB entry if it existed
      if (session.projectTimeLogId && session.projectId) {
        await fetch(`/api/projects/${session.projectId}/timelogs`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: session.projectTimeLogId }),
        });
      }

      if (projectId) {
        const loggedDate = format(new Date(session.startTime), "yyyy-MM-dd");
        const durationMin = Math.max(1, Math.round(session.duration / 60));
        const res = await fetch(`/api/projects/${projectId}/timelogs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: `${session.ticketKey} — ${session.ticketSummary}`,
            durationMin,
            loggedDate,
          }),
        });
        const data = await res.json();
        updateSession(sessionId, { projectId, projectTimeLogId: data.log?.id });
      } else {
        updateSession(sessionId, { projectId: undefined, projectTimeLogId: undefined });
      }
      refreshSessions();
    } finally {
      setLinkingId(null);
    }
  }, [sessions, refreshSessions]);

  function saveAssignee(val: string) {
    setAssignee(val);
    localStorage.setItem(TIMELOG_ASSIGNEE_KEY, val);
  }

  function saveReportsTo(val: string) {
    setReportsTo(val);
    localStorage.setItem(TIMELOG_REPORTS_TO_KEY, val);
  }

  // Filter sessions
  const range = getRange(dateRange);
  const filtered = sessions.filter((s) => {
    if (range && !isWithinInterval(new Date(s.startTime), range)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.ticketKey.toLowerCase().includes(q) && !s.ticketSummary.toLowerCase().includes(q)) return false;
    }
    if (filterName) {
      const q = filterName.toLowerCase();
      if (!s.ticketKey.toLowerCase().includes(q) && !s.ticketSummary.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalSeconds = filtered.reduce((s, t) => s + t.duration, 0);

  // Group filtered sessions by ticket key
  const grouped: Record<string, typeof sessions> = {};
  for (const s of filtered) {
    if (!grouped[s.ticketKey]) grouped[s.ticketKey] = [];
    grouped[s.ticketKey].push(s);
  }

  function exportCSV() {
    const metaRows = [
      assignee ? `Assignee,${assignee}` : null,
      reportsTo ? `Reports To,${reportsTo}` : null,
      `Date Range,${RANGE_LABELS[dateRange]}`,
      `Exported,${format(new Date(), "MMM d yyyy HH:mm")}`,
      "",
    ].filter((r) => r !== null);

    const header = ["Task / Ticket", "Description", "Sessions", "Total Hours", "First Logged", "Last Logged"];
    const lines = Object.entries(grouped)
      .sort((a, b) => b[1].reduce((s, x) => s + x.duration, 0) - a[1].reduce((s, x) => s + x.duration, 0))
      .map(([key, ticketSessions]) => {
        const total = ticketSessions.reduce((s, x) => s + x.duration, 0);
        const hours = (total / 3600).toFixed(2);
        const first = format(new Date(Math.min(...ticketSessions.map(s => s.startTime))), "MMM d, yyyy");
        const last  = format(new Date(Math.max(...ticketSessions.map(s => s.endTime))), "MMM d, yyyy");
        const desc = ticketSessions[0].ticketSummary;
        return [
          `"${key.replace(/"/g, '""')}"`,
          `"${desc.replace(/"/g, '""')}"`,
          ticketSessions.length,
          hours,
          first,
          last,
        ].join(",");
      });
    const csv = [...metaRows, header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const rangeLabel = dateRange === "all" ? "all-time" : dateRange;
    link.download = `timelog_${rangeLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function formatTs(ms: number) {
    return format(new Date(ms), "MMM d, yyyy HH:mm");
  }

  const hasFilters = dateRange !== "all" || search || filterName;

  return (
    <div className="p-8 lg:p-12 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1"><span className="eyebrow-dot" />Work</p>
          <h1 className="headline">Time Log</h1>
          <p className="text-[13px] text-charcoal/50 mt-1">
            {filtered.length} session{filtered.length !== 1 ? "s" : ""}
            {dateRange !== "all" && ` · ${RANGE_LABELS[dateRange]}`}
            {" · "}{formatDuration(totalSeconds)} total
          </p>
        </div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="btn-ghost-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => {
                if (confirm("Clear all time log sessions? This cannot be undone.")) clearAllSessions();
              }}
              className="rounded-button border border-[#b3492f] text-[#b3492f] text-[13px] font-medium px-3.5 py-1.5 hover:bg-[#b3492f] hover:text-white transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Assignee + Reports To */}
      <div className="card-white space-y-4">
        <p className="font-mono text-[11px] font-semibold text-charcoal/50 uppercase tracking-eyebrow">Export metadata</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Assignee dropdown */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-charcoal/70">Assignee</label>
            {teamNames.length > 0 ? (
              <select
                value={assignee}
                onChange={(e) => saveAssignee(e.target.value)}
                className="input-field w-full"
              >
                <option value="">— select person —</option>
                {teamNames.map((n) => (
                  <option key={n.accountId} value={n.displayName}>{n.displayName}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. Brempong Appiah"
                value={assignee}
                onChange={(e) => saveAssignee(e.target.value)}
                className="input-field w-full"
              />
            )}
          </div>

          {/* Reports To */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-charcoal/70">Reports To</label>
            <input
              type="text"
              placeholder="e.g. Jane Smith"
              value={reportsTo}
              onChange={(e) => saveReportsTo(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>
      </div>

      {/* Date range + search + name filters */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Range pills */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`filter-pill ${dateRange === r ? "active" : ""}`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search ticket or task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-52"
          />

          {/* Name filter dropdown */}
          {teamNames.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setNameDropdownOpen((o) => !o)}
                className={filterName ? "filter-pill active" : "filter-pill"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {filterName || "Filter by person"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {nameDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-mint rounded-card z-20 py-1 overflow-hidden">
                  <button
                    onClick={() => { setFilterName(""); setNameDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-charcoal/40 hover:bg-mint"
                  >
                    — all people —
                  </button>
                  {teamNames.map((n) => (
                    <button
                      key={n.accountId}
                      onClick={() => { setFilterName(n.displayName); setNameDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[14px] hover:bg-mint flex items-center gap-2 ${
                        filterName === n.displayName ? "text-teal-pine font-semibold bg-mint" : "text-charcoal/70"
                      }`}
                    >
                      {n.avatarUrl && (
                        <img src={n.avatarUrl} alt="" className="w-5 h-5 rounded-pill" />
                      )}
                      {n.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasFilters && (
            <button onClick={() => { setDateRange("all"); setSearch(""); setFilterName(""); }} className="text-[13px] text-teal-pine hover:underline">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Active timer card */}
      {activeTimer && (
        <div className="card-mint flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-pill bg-[#b3492f] animate-pulse" />
            <div>
              <p className="font-mono text-[11px] font-semibold text-teal-pine uppercase tracking-eyebrow">Currently tracking</p>
              <p className="text-[14px] font-semibold text-charcoal">{activeTimer.ticketKey}</p>
              <p className="text-[13px] text-charcoal/50 line-clamp-1">{activeTimer.ticketSummary}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-semibold text-teal-deep tabular-nums">{formatDuration(elapsed)}</span>
            <button
              onClick={() => stopTimer(false)}
              className="rounded-button bg-[#b3492f] text-white px-3.5 py-1.5 text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Summary by ticket */}
      {Object.keys(grouped).length > 0 && (
        <div className="card-white !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-mint">
            <p className="font-medium text-[14px] text-charcoal">Summary by Ticket</p>
          </div>
          <table className="table-clean">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Summary</th>
                {projects.length > 0 && <th>Project</th>}
                <th className="text-right">Sessions</th>
                <th className="text-right">Total Time</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped)
                .sort((a, b) => b[1].reduce((s, x) => s + x.duration, 0) - a[1].reduce((s, x) => s + x.duration, 0))
                .map(([key, ticketSessions]) => {
                  const total = ticketSessions.reduce((s, x) => s + x.duration, 0);
                  // Show the project if all sessions for this ticket share the same project
                  const projIdSet: Record<string, true> = {};
                  ticketSessions.forEach(s => { if (s.projectId) projIdSet[s.projectId] = true; });
                  const projIds = Object.keys(projIdSet);
                  const sharedProj = projIds.length === 1 ? projects.find(p => p.id === projIds[0]) : null;
                  return (
                    <tr key={key}>
                      <td className="font-mono text-[13px] font-semibold text-teal-deep">{key}</td>
                      <td className="max-w-xs truncate">{ticketSessions[0].ticketSummary}</td>
                      {projects.length > 0 && (
                        <td>
                          {sharedProj ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: sharedProj.color }}>
                              <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: sharedProj.color }} />
                              {sharedProj.name}
                            </span>
                          ) : projIds.length > 1 ? (
                            <span className="text-[13px] text-charcoal/40">Mixed</span>
                          ) : (
                            <span className="text-[13px] text-charcoal/30">—</span>
                          )}
                        </td>
                      )}
                      <td className="text-right text-charcoal/50">{ticketSessions.length}</td>
                      <td className="text-right">
                        <span className="tag-done">{formatDuration(total)}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="font-semibold text-charcoal/70">
                  {filtered.length} session{filtered.length !== 1 ? "s" : ""} across {Object.keys(grouped).length} ticket{Object.keys(grouped).length !== 1 ? "s" : ""}
                </td>
                <td className="text-right">
                  <span className="inline-flex items-center rounded-tag bg-teal-deep text-white text-[12px] font-semibold px-2.5 py-1">
                    {formatDuration(totalSeconds)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* All sessions */}
      {sessions.length > 0 ? (
        <div className="card-white !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-mint">
            <p className="font-medium text-[14px] text-charcoal">Sessions</p>
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-[14px] text-charcoal/40 text-center">No sessions for this period.</p>
          ) : (
            <ul className="divide-y divide-mint">
              {filtered.map((s) => {
                const linkedProj = projects.find(p => p.id === s.projectId);
                const isLinking = linkingId === s.id;
                return (
                  <li key={s.id} className="px-5 py-3 hover:bg-mint/40 group">
                    <div className="flex items-center gap-4">
                      <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: linkedProj ? linkedProj.color : "#65b8a2" }} />
                      <span className="font-mono text-[13px] font-semibold text-teal-deep w-24 shrink-0 truncate">{s.ticketKey}</span>
                      <span className="text-[14px] text-charcoal flex-1 truncate">{s.ticketSummary}</span>
                      <div className="text-[12px] text-charcoal/40 shrink-0 hidden sm:block">
                        <span>{formatTs(s.startTime)}</span>
                        <span className="mx-1">→</span>
                        <span>{format(new Date(s.endTime), "HH:mm")}</span>
                      </div>
                      <span className="tag-neutral w-20 justify-center tabular-nums">
                        {formatDurationShort(s.duration)}
                      </span>
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-charcoal/20 hover:text-[#b3492f] transition-all shrink-0"
                        title="Delete session"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    {projects.length > 0 && (
                      <div className="flex items-center gap-2 mt-1.5 pl-6">
                        {isLinking ? (
                          <span className="text-[11px] text-charcoal/40">Saving…</span>
                        ) : (
                          <>
                            {linkedProj && (
                              <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: linkedProj.color }} />
                            )}
                            <select
                              value={s.projectId ?? ""}
                              onChange={(e) => linkSessionToProject(s.id, e.target.value || null)}
                              className="text-[11px] border border-mint-mist rounded-card px-2 py-0.5 bg-white text-charcoal/60 cursor-pointer focus:outline-none focus:border-teal-deep"
                            >
                              <option value="">{linkedProj ? "Remove from project" : "Log to project…"}</option>
                              {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            {linkedProj && (
                              <span className="text-[11px] font-medium" style={{ color: linkedProj.color }}>
                                {linkedProj.name}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="card-white p-16 text-center">
          <p className="text-charcoal/60 font-medium">No time logged yet</p>
          <p className="text-charcoal/40 text-[13px] mt-1">
            Start a timer from any ticket in the Dashboard or Overview to record time here.
          </p>
        </div>
      )}
    </div>
  );
}
