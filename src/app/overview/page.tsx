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
const STATUS_TAG: Record<string, string> = {
  "todo": "tag-neutral",
  "in-progress": "tag-progress",
  "in-review": "tag-review",
  "done": "tag-done",
};
const STATUS_LABEL: Record<string, string> = {
  "todo": "To Do", "in-progress": "In Progress", "in-review": "In Review", "done": "Done",
};
const PRIORITY_TAG: Record<string, string> = {
  high: "tag-blocked", medium: "tag-review", low: "tag-neutral",
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
    <div className="p-8 lg:p-12 max-w-page mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1"><span className="eyebrow-dot" />Analytics</p>
          <h1 className="headline">Overview</h1>
          <p className="text-[13px] text-charcoal/50 mt-1">
            {selectedProject
              ? <><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-pill inline-block" style={{ backgroundColor: selectedProject.color }} />{selectedProject.name}</span>{" · "}</>
              : user ? `${user.displayName} · ` : ""}
            {range.label}
            {range.startDate !== range.endDate ? ` (${range.startDate} → ${range.endDate})` : ""}
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={!selectedProjectId && (!user || loading)}
          className="btn-primary-sm disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Date Range Filter + Project Filter */}
      <div className="card-white space-y-3">
        <DateRangeFilter onChange={handleRangeChange} defaultPreset="this-month" />
        {projects.length > 0 && (
          <div className="flex items-center gap-3 pt-3 border-t border-mint">
            <span className="font-mono text-[11px] font-semibold text-charcoal/40 uppercase tracking-eyebrow shrink-0">Project</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedProjectId("")}
                className={`filter-pill ${!selectedProjectId ? "active" : ""}`}
              >
                All (Jira)
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className="filter-pill"
                  style={selectedProjectId === p.id ? { backgroundColor: p.color, color: "#fff" } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-pill shrink-0" style={{ backgroundColor: selectedProjectId === p.id ? "rgba(255,255,255,0.7)" : p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && !selectedProjectId && (
        <div className="card-blush text-[14px] text-charcoal">{error}</div>
      )}

      {/* ── PROJECT VIEW ─────────────────────────────────────────────────────── */}
      {selectedProjectId && (
        <>
          {projectLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-24 bg-mint rounded-card animate-pulse" />
                ))}
              </div>
              <div className="h-48 bg-mint rounded-card animate-pulse" />
              <div className="h-64 bg-mint rounded-card animate-pulse" />
            </div>
          ) : (
            <>
              {/* Project stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Time Logged", value: projTotalMins >= 60 ? `${Math.floor(projTotalMins/60)}h ${projTotalMins%60}m` : `${projTotalMins}m` },
                  { label: "Total Tasks",  value: String(projectTasks.length) },
                  { label: "Done",         value: String(projDone) },
                  { label: "In Review",    value: String(projInReview) },
                  { label: "In Progress",  value: String(projInProgress) },
                  { label: "To Do",        value: String(projTodo) },
                ].map(({ label, value }) => (
                  <div key={label} className="card-mint !p-4 flex flex-col gap-1">
                    <p className="font-mono text-[11px] text-charcoal/50 uppercase tracking-eyebrow">{label}</p>
                    <p className="text-[24px] font-semibold text-charcoal">{value}</p>
                  </div>
                ))}
              </div>

              {/* Stacked completion bar */}
              {projectTasks.length > 0 && (
                <div className="card-white">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-[14px] text-charcoal">Task Completion — {selectedProject?.name}</p>
                    <span className="text-[13px] text-charcoal/40">{Math.round((projDone / projectTasks.length) * 100)}% complete</span>
                  </div>
                  <div className="flex h-3 rounded-pill overflow-hidden gap-px bg-mint">
                    {projDone > 0      && <div className="bg-teal-sage transition-all" style={{ flex: projDone }} title={`Done: ${projDone}`} />}
                    {projInReview > 0  && <div className="bg-rose transition-all" style={{ flex: projInReview }} title={`In Review: ${projInReview}`} />}
                    {projInProgress > 0 && <div className="bg-navy transition-all" style={{ flex: projInProgress }} title={`In Progress: ${projInProgress}`} />}
                    {projTodo > 0      && <div className="bg-mint-mist transition-all" style={{ flex: projTodo }} title={`To Do: ${projTodo}`} />}
                  </div>
                  <div className="flex gap-4 mt-3 text-[11px] text-charcoal/50">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-pill bg-teal-sage" />Done</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-pill bg-rose" />In Review</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-pill bg-navy" />In Progress</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-pill bg-mint-mist" />To Do</span>
                  </div>
                </div>
              )}

              {/* Time logged chart */}
              {timeChartData.length > 0 ? (
                <div className="card-white">
                  <p className="font-medium text-[14px] text-charcoal mb-4">
                    Time Logged by Date — {selectedProject?.name}
                    <span className="ml-2 text-[13px] font-normal text-charcoal/40">{range.label}</span>
                  </p>
                  <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
                    {timeChartData.map(({ date, minutes }) => {
                      const maxM = Math.max(...timeChartData.map(d => d.minutes), 1);
                      const h = Math.floor(minutes / 60), m = minutes % 60;
                      const lbl = h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
                      return (
                        <div key={date} className="flex flex-col items-center gap-1 min-w-[32px] flex-1">
                          <span className="text-[9px] text-charcoal/40">{lbl}</span>
                          <div className="w-full rounded-sm"
                            style={{ height: `${(minutes / maxM) * 108}px`, backgroundColor: selectedProject?.color ?? "#1c5d5f", opacity: 0.85 }} />
                          <span className="text-[8px] text-charcoal/40 truncate w-full text-center">{date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="card-white p-16 text-center">
                  <p className="text-charcoal/50 text-[14px]">No time logged for {selectedProject?.name} in this period.</p>
                  <p className="text-charcoal/30 text-[13px] mt-1">Log time from the Time Log page or the project's Time Log tab.</p>
                </div>
              )}

              {/* Project tasks table */}
              <div className="card-white !p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-mint">
                  <p className="font-medium text-[14px] text-charcoal">
                    Tasks — {selectedProject?.name}
                    <span className="ml-2 text-[13px] font-normal text-charcoal/40">({projectTasks.length})</span>
                  </p>
                </div>
                {projectTasks.length === 0 ? (
                  <p className="px-6 py-8 text-[14px] text-charcoal/40 text-center">No tasks linked to this project yet.</p>
                ) : (
                  <table className="table-clean">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th className="text-right">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...projectTasks]
                        .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
                        .map(task => (
                          <tr key={task.id}>
                            <td className="max-w-xs">
                              <span className={task.status === "done" ? "line-through text-charcoal/40" : ""}>{task.text}</span>
                            </td>
                            <td>
                              <span className={STATUS_TAG[task.status] ?? "tag-neutral"}>
                                {STATUS_LABEL[task.status] ?? task.status}
                              </span>
                            </td>
                            <td>
                              <span className={PRIORITY_TAG[task.priority] ?? "tag-neutral"}>
                                {task.priority}
                              </span>
                            </td>
                            <td className="text-charcoal/50">{task.assignee ?? "—"}</td>
                            <td className="text-right text-charcoal/40 truncate max-w-[120px]">{task.source}</td>
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
                  <div key={i} className="h-24 bg-mint rounded-card animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-56 bg-mint rounded-card animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-mint rounded-card animate-pulse" />
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
                    <SummaryBadge label="Avg hours/ticket" value={tickets.length > 0 ? `${Math.round(totalHours / tickets.length)}h` : "—"} surface="mint" />
                    <SummaryBadge label="Completion rate"  value={tickets.length > 0 ? `${Math.round((doneCount / tickets.length) * 100)}%` : "—"} surface="blush" />
                    <SummaryBadge label="In-flight tickets" value={String(inProgressCount + inReviewCount)} surface="mint" />
                  </div>
                  <div className="card-white !p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-mint">
                      <p className="font-medium text-[14px] text-charcoal">
                        All Tickets <span className="ml-2 text-[13px] font-normal text-charcoal/40">({tickets.length})</span>
                      </p>
                    </div>
                    <TicketTable tickets={tickets} />
                  </div>
                </>
              ) : (
                <div className="card-white p-16 text-center">
                  <p className="text-charcoal/60 font-medium">No tickets found for this period</p>
                  <p className="text-charcoal/40 text-[13px] mt-1">Try adjusting the date range</p>
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
  surface,
}: {
  label: string;
  value: string;
  surface: "mint" | "blush";
}) {
  return (
    <div className={surface === "mint" ? "card-mint flex items-center gap-4" : "card-blush flex items-center gap-4"}>
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-eyebrow text-charcoal/50">{label}</p>
        <p className="text-[22px] font-semibold text-charcoal">{value}</p>
      </div>
    </div>
  );
}
