"use client";

import { useEffect, useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import DateRangeFilter, { DateRange, getPresetRange } from "@/components/DateRangeFilter";
import OverviewCharts from "@/components/OverviewCharts";
import TimeLogStackedChart from "@/components/TimeLogStackedChart";
import TicketTable from "@/components/TicketTable";
import StatCards from "@/components/StatCards";
import { Ticket } from "@/lib/utils";

interface CurrentUser {
  accountId: string;
  displayName: string;
  avatarUrl: string;
}

interface Project { id: string; name: string; color: string; }

interface ProjectTask {
  id: string; text: string; status: string; priority: string;
  assignee?: string; createdAt: number; source: string;
}

interface ProjectTimeLog {
  id: string; description: string; durationMin: number; loggedDate: string;
}

const STATUS_ORDER: Record<string, number> = {
  "in-progress": 0, "in-review": 1, "todo": 2, "done": 3,
};
const STATUS_STYLE: Record<string, string> = {
  "todo":        "bg-gray-100 text-gray-600",
  "in-progress": "bg-blue-100 text-blue-700",
  "in-review":   "bg-violet-100 text-violet-700",
  "done":        "bg-emerald-100 text-emerald-700",
};
const STATUS_LABEL: Record<string, string> = {
  "todo": "To Do", "in-progress": "In Progress", "in-review": "In Review", "done": "Done",
};
const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-gray-100 text-gray-500",
};

export default function OverviewPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(getPresetRange("this-month"));

  // Project filter
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectTimeLogs, setProjectTimeLogs] = useState<ProjectTimeLog[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);

  // Fetch current user + projects on mount
  useEffect(() => {
    fetch("/api/jira/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setUser(data.user ?? data);
      })
      .catch((e) => setError(e.message));
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  // Fetch tickets whenever user or date range changes
  const fetchTickets = useCallback(async (accountId: string, dateRange: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        userId: accountId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/jira/tickets-range?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTickets(data.tickets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.accountId) {
      fetchTickets(user.accountId, range);
    }
  }, [user, range, fetchTickets]);

  // Fetch project tasks + timelogs when project or range changes
  useEffect(() => {
    if (!selectedProjectId) return;
    setProjectLoading(true);
    Promise.all([
      fetch(`/api/projects/${selectedProjectId}/tasks`).then(r => r.json()),
      fetch(`/api/projects/${selectedProjectId}/timelogs`).then(r => r.json()),
    ])
      .then(([taskData, logData]) => {
        setProjectTasks(taskData.tasks ?? []);
        setProjectTimeLogs(logData.logs ?? []);
      })
      .catch(() => {})
      .finally(() => setProjectLoading(false));
  }, [selectedProjectId, range]);

  function handleRangeChange(newRange: DateRange) {
    setRange(newRange);
  }

  // ── Jira computed stats ─────────────────────────────────────────────────────
  const totalHours = tickets.reduce((s, t) => s + t.hours, 0);
  const doneCount = tickets.filter((t) => t.status.toLowerCase() === "done").length;
  const inReviewCount = tickets.filter((t) => t.status.toLowerCase().includes("review")).length;
  const inProgressCount = tickets.filter((t) => t.status.toLowerCase().includes("progress")).length;

  // ── Project computed stats ───────────────────────────────────────────────────
  const filteredLogs = projectTimeLogs.filter(
    l => l.loggedDate >= range.startDate && l.loggedDate <= range.endDate
  );
  const projTotalMins = filteredLogs.reduce((s, l) => s + l.durationMin, 0);
  const projDone       = projectTasks.filter(t => t.status === "done").length;
  const projInProgress = projectTasks.filter(t => t.status === "in-progress").length;
  const projInReview   = projectTasks.filter(t => t.status === "in-review").length;
  const projTodo       = projectTasks.filter(t => t.status === "todo").length;

  // Time chart data for project
  const logsByDate: Record<string, number> = {};
  for (const l of filteredLogs) {
    logsByDate[l.loggedDate] = (logsByDate[l.loggedDate] ?? 0) + l.durationMin;
  }
  const timeChartData = Object.entries(logsByDate).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({ date, minutes }));

  // Selected project object
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Export CSV
  function handleExport() {
    if (selectedProjectId) {
      window.open(`/api/projects/${selectedProjectId}/export`, "_blank");
      return;
    }
    if (!user) return;
    const params = new URLSearchParams({
      userId: user.accountId,
      startDate: range.startDate,
      endDate: range.endDate,
      name: user.displayName,
    });
    window.open(`/api/export/range?${params}`, "_blank");
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedProject
              ? <><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: selectedProject.color }} />{selectedProject.name}</span>{" · "}</>
              : user ? `${user.displayName} · ` : ""}
            {range.label}
            {range.startDate !== range.endDate ? ` (${range.startDate} → ${range.endDate})` : ""}
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={!selectedProjectId && (!user || loading)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Date Range Filter + Project Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <DateRangeFilter onChange={handleRangeChange} defaultPreset="this-month" />
        {projects.length > 0 && (
          <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">Project</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedProjectId("")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedProjectId ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All (Jira)
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedProjectId === p.id ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={selectedProjectId === p.id ? { backgroundColor: p.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedProjectId === p.id ? "rgba(255,255,255,0.7)" : p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && !selectedProjectId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ── PROJECT VIEW ─────────────────────────────────────────────────────── */}
      {selectedProjectId && (
        <>
          {projectLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
              <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          ) : (
            <>
              {/* Project stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Time Logged", value: projTotalMins >= 60 ? `${Math.floor(projTotalMins/60)}h ${projTotalMins%60}m` : `${projTotalMins}m`, bg: "bg-indigo-50", ic: "text-indigo-600", vc: "text-indigo-700" },
                  { label: "Total Tasks",  value: String(projectTasks.length), bg: "bg-blue-50",    ic: "text-blue-600",    vc: "text-blue-700" },
                  { label: "Done",         value: String(projDone),            bg: "bg-emerald-50", ic: "text-emerald-600", vc: "text-emerald-700" },
                  { label: "In Review",    value: String(projInReview),        bg: "bg-violet-50",  ic: "text-violet-600",  vc: "text-violet-700" },
                  { label: "In Progress",  value: String(projInProgress),      bg: "bg-amber-50",   ic: "text-amber-600",   vc: "text-amber-700" },
                  { label: "To Do",        value: String(projTodo),            bg: "bg-gray-50",    ic: "text-gray-500",    vc: "text-gray-700" },
                ].map(({ label, value, bg, ic, vc }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${ic}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                      <p className={`text-2xl font-bold mt-0.5 ${vc}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stacked completion bar */}
              {projectTasks.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">Task Completion — {selectedProject?.name}</h2>
                    <span className="text-xs text-gray-400">{Math.round((projDone / projectTasks.length) * 100)}% complete</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden gap-px">
                    {projDone > 0      && <div className="bg-emerald-400 transition-all" style={{ flex: projDone }} title={`Done: ${projDone}`} />}
                    {projInReview > 0  && <div className="bg-violet-400 transition-all" style={{ flex: projInReview }} title={`In Review: ${projInReview}`} />}
                    {projInProgress > 0 && <div className="bg-blue-400 transition-all" style={{ flex: projInProgress }} title={`In Progress: ${projInProgress}`} />}
                    {projTodo > 0      && <div className="bg-gray-200 transition-all" style={{ flex: projTodo }} title={`To Do: ${projTodo}`} />}
                  </div>
                  <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Done</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" />In Review</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />In Progress</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />To Do</span>
                  </div>
                </div>
              )}

              {/* Time logged chart */}
              {timeChartData.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">
                    Time Logged by Date — {selectedProject?.name}
                    <span className="ml-2 text-xs font-normal text-gray-400">{range.label}</span>
                  </h2>
                  <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
                    {timeChartData.map(({ date, minutes }) => {
                      const maxM = Math.max(...timeChartData.map(d => d.minutes), 1);
                      const h = Math.floor(minutes / 60), m = minutes % 60;
                      const lbl = h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
                      return (
                        <div key={date} className="flex flex-col items-center gap-1 min-w-[32px] flex-1">
                          <span className="text-[9px] text-gray-400">{lbl}</span>
                          <div className="w-full rounded-sm"
                            style={{ height: `${(minutes / maxM) * 108}px`, backgroundColor: selectedProject?.color ?? "#6366f1", opacity: 0.8 }} />
                          <span className="text-[8px] text-gray-400 truncate w-full text-center">{date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                  <p className="text-gray-400 text-sm">No time logged for {selectedProject?.name} in this period.</p>
                  <p className="text-gray-300 text-xs mt-1">Log time from the Time Log page or the project's Time Log tab.</p>
                </div>
              )}

              {/* Project tasks table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Tasks — {selectedProject?.name}
                    <span className="ml-2 text-xs font-normal text-gray-400">({projectTasks.length})</span>
                  </h2>
                </div>
                {projectTasks.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-400 text-center">No tasks linked to this project yet.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-50">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Task</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignee</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...projectTasks]
                        .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
                        .map(task => (
                          <tr key={task.id} className="hover:bg-gray-50/60">
                            <td className="px-5 py-3 text-sm text-gray-700 max-w-xs">
                              <span className={task.status === "done" ? "line-through text-gray-400" : ""}>{task.text}</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[task.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {STATUS_LABEL[task.status] ?? task.status}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_STYLE[task.priority] ?? "bg-gray-100 text-gray-500"}`}>
                                {task.priority}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs text-gray-500">{task.assignee ?? "—"}</td>
                            <td className="px-5 py-3 text-right text-xs text-gray-400 truncate max-w-[120px]">{task.source}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── JIRA / ALL VIEW ──────────────────────────────────────────────────── */}
      {!selectedProjectId && (
        <>
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          )}

          {!loading && (
            <>
              <StatCards
                totalTickets={tickets.length}
                totalHours={totalHours}
                doneCount={doneCount}
                inReviewCount={inReviewCount}
                inProgressCount={inProgressCount}
              />
              <TimeLogStackedChart startDate={range.startDate} endDate={range.endDate} />

              {tickets.length > 0 ? (
                <>
                  <OverviewCharts tickets={tickets} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <SummaryBadge label="Avg hours/ticket" value={tickets.length > 0 ? `${Math.round(totalHours / tickets.length)}h` : "—"} icon="⏱" color="indigo" />
                    <SummaryBadge label="Completion rate"  value={tickets.length > 0 ? `${Math.round((doneCount / tickets.length) * 100)}%` : "—"} icon="✅" color="emerald" />
                    <SummaryBadge label="In-flight tickets" value={String(inProgressCount + inReviewCount)} icon="🔄" color="amber" />
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50">
                      <h2 className="text-sm font-semibold text-gray-700">
                        All Tickets <span className="ml-2 text-xs font-normal text-gray-400">({tickets.length})</span>
                      </h2>
                    </div>
                    <TicketTable tickets={tickets} />
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-500 font-medium">No tickets found for this period</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting the date range</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: "indigo" | "emerald" | "amber";
}) {
  const colorMap = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 ${colorMap[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
