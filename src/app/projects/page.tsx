"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveProject } from "@/components/ActiveProjectContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = "todo" | "in-progress" | "in-review" | "done";

interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
}

interface ProjectTask {
  id: string;
  text: string;
  source: string;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
  assignee?: string;
  notes?: string;
  description?: string;
  checklist: ChecklistItem[];
  projectId: string;
  createdAt: number;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface TimeLog {
  id: string;
  projectId: string;
  taskId?: string;
  description: string;
  durationMin: number;
  loggedDate: string;
  createdAt: number;
}

interface ProjectStats {
  totalMinutes: number;
  taskCount: number;
  doneCount: number;
  inProgressCount: number;
  inReviewCount: number;
  todoCount: number;
}

interface LinkedMeeting {
  id: string;
  saved_at: number;
  label: string | null;
  date: string | null;
}

interface AllMeeting {
  id: string;
  savedAt: number;
  label: string | null;
  date: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#64748b",
];

const STATUS_CONFIG: Record<TaskStatus, { label: string; badge: string; ring: string; dot: string }> = {
  "todo":        { label: "To Do",       badge: "bg-gray-100 text-gray-700",    ring: "border-gray-300",           dot: "bg-gray-400" },
  "in-progress": { label: "In Progress", badge: "bg-blue-100 text-blue-700",    ring: "border-blue-400",           dot: "bg-blue-400" },
  "in-review":   { label: "In Review",   badge: "bg-violet-100 text-violet-700",ring: "border-violet-400 bg-violet-50", dot: "bg-violet-400" },
  "done":        { label: "Done",        badge: "bg-emerald-100 text-emerald-700", ring: "bg-emerald-500 border-emerald-500 text-white", dot: "bg-emerald-500" },
};

const PRIORITY_STYLES = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-gray-100 text-gray-500",
};

const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in-progress", "in-review", "done"];
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  "todo": "in-progress",
  "in-progress": "in-review",
  "in-review": "done",
  "done": "todo",
};

type Tab = "overview" | "tasks" | "timelogs" | "meetings" | "export";

function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtMins(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Empty State ───────────────────────────────────────────────────────────────

function NoProjectState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">No project selected</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Select a project from the <span className="font-semibold text-indigo-600">Projects</span> menu
          in the sidebar to view tasks, time logs, and project insights.
        </p>
        <p className="text-xs text-gray-400">
          No project selected · Tasks, time logs and exports are hidden
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { activeProject, setActiveProject } = useActiveProject();

  // Project data
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);

  // Edit project
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [taskDesc, setTaskDesc] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Time log form
  const [showNewLog, setShowNewLog] = useState(false);
  const [logDesc, setLogDesc] = useState("");
  const [logHours, setLogHours] = useState("1");
  const [logMins, setLogMins] = useState("0");
  const [logDate, setLogDate] = useState(todayStr());
  const [logTaskId, setLogTaskId] = useState("");

  // Meetings
  const [linkedMeetings, setLinkedMeetings] = useState<LinkedMeeting[]>([]);
  const [allMeetings, setAllMeetings] = useState<AllMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // ── Load project data ───────────────────────────────────────────────────────

  const loadProjectData = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [tasksRes, logsRes, projRes] = await Promise.all([
        fetch(`/api/projects/${id}/tasks`),
        fetch(`/api/projects/${id}/timelogs`),
        fetch(`/api/projects/${id}`),
      ]);
      const [td, ld, pd] = await Promise.all([tasksRes.json(), logsRes.json(), projRes.json()]);
      setTasks(td.tasks ?? []);
      setTimeLogs(ld.logs ?? []);
      setStats(pd.stats ?? null);
      if (pd.project) {
        setProject(pd.project);
        // Keep global context in sync
        setActiveProject({ id: pd.project.id, name: pd.project.name, color: pd.project.color, description: pd.project.description });
      }
    } finally {
      setLoading(false);
    }
  }, [setActiveProject]);

  const loadMeetings = useCallback(async (id: string) => {
    setMeetingsLoading(true);
    try {
      const [linkedRes, allRes] = await Promise.all([
        fetch(`/api/projects/${id}/meetings`),
        fetch("/api/meetings/history"),
      ]);
      const [ld, ad] = await Promise.all([linkedRes.json(), allRes.json()]);
      setLinkedMeetings(ld.meetings ?? []);
      const normalized: AllMeeting[] = (ad.summaries ?? []).map(
        (s: { id: string; savedAt: number; summary: { meetingLabel?: string; date?: string } }) => ({
          id: s.id, savedAt: s.savedAt,
          label: s.summary?.meetingLabel ?? null,
          date: s.summary?.date ?? null,
        })
      );
      setAllMeetings(normalized);
    } finally {
      setMeetingsLoading(false);
    }
  }, []);

  // On mount: restore tab from sidebar navigation or keep existing context
  useEffect(() => {
    const ssTab = sessionStorage.getItem("clockit_project_tab") as Tab | null;
    if (ssTab) {
      setActiveTab(ssTab);
      sessionStorage.removeItem("clockit_project_tab");
    }
  }, []);

  // Load data whenever active project changes
  useEffect(() => {
    if (activeProject?.id) {
      loadProjectData(activeProject.id);
    } else {
      setProject(null); setTasks([]); setTimeLogs([]); setStats(null);
      setLinkedMeetings([]); setAllMeetings([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  // Load meetings lazily when tab is opened
  useEffect(() => {
    if (activeTab === "meetings" && activeProject?.id) loadMeetings(activeProject.id);
  }, [activeTab, activeProject?.id, loadMeetings]);

  // ── Project CRUD ────────────────────────────────────────────────────────────

  const handleUpdateProject = async () => {
    if (!editingProject || !activeProject) return;
    const res = await fetch(`/api/projects/${activeProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingProject.name, description: editingProject.description, color: editingProject.color }),
    });
    const data = await res.json();
    if (data.project) {
      setProject(data.project);
      setActiveProject({ id: data.project.id, name: data.project.name, color: data.project.color, description: data.project.description });
      setEditingProject(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProject || !confirm(`Delete "${activeProject.name}" and all its time logs?`)) return;
    await fetch("/api/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeProject.id }) });
    setActiveProject(null);
    setProject(null); setTasks([]); setTimeLogs([]); setStats(null);
  };

  // ── Task CRUD ───────────────────────────────────────────────────────────────

  const handleCreateTask = async () => {
    if (!activeProject?.id || !taskText.trim()) return;
    const res = await fetch(`/api/projects/${activeProject.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: taskText.trim(), priority: taskPriority, description: taskDesc.trim() || undefined }),
    });
    const data = await res.json();
    if (data.task) {
      setTasks((prev) => [data.task, ...prev]);
      setTaskText(""); setTaskDesc(""); setTaskPriority("medium"); setShowNewTask(false);
      if (stats) setStats({ ...stats, taskCount: stats.taskCount + 1, todoCount: stats.todoCount + 1 });
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!activeProject?.id) return;
    const res = await fetch(`/api/projects/${activeProject.id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.task) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? data.task : t));
      // Recompute stats from updated task list
      const updated = tasks.map((t) => t.id === taskId ? { ...t, status } : t);
      if (stats) setStats({
        ...stats,
        todoCount: updated.filter((t) => t.status === "todo").length,
        inProgressCount: updated.filter((t) => t.status === "in-progress").length,
        inReviewCount: updated.filter((t) => t.status === "in-review").length,
        doneCount: updated.filter((t) => t.status === "done").length,
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeProject?.id) return;
    await fetch(`/api/projects/${activeProject.id}/tasks/${taskId}`, { method: "DELETE" });
    const removed = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (stats && removed) setStats({
      ...stats,
      taskCount: Math.max(0, stats.taskCount - 1),
      todoCount: removed.status === "todo" ? Math.max(0, stats.todoCount - 1) : stats.todoCount,
      inProgressCount: removed.status === "in-progress" ? Math.max(0, stats.inProgressCount - 1) : stats.inProgressCount,
      inReviewCount: removed.status === "in-review" ? Math.max(0, stats.inReviewCount - 1) : stats.inReviewCount,
      doneCount: removed.status === "done" ? Math.max(0, stats.doneCount - 1) : stats.doneCount,
    });
  };

  const handleToggleChecklist = async (task: ProjectTask, itemId: string) => {
    if (!activeProject?.id) return;
    const updated = task.checklist.map((c) => c.id === itemId ? { ...c, done: !c.done } : c);
    const res = await fetch(`/api/projects/${activeProject.id}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: updated }),
    });
    const data = await res.json();
    if (data.task) setTasks((prev) => prev.map((t) => t.id === task.id ? data.task : t));
  };

  // ── Time Log CRUD ───────────────────────────────────────────────────────────

  const handleCreateLog = async () => {
    if (!activeProject?.id || !logDesc.trim()) return;
    const durationMin = parseInt(logHours) * 60 + parseInt(logMins || "0");
    if (durationMin <= 0) return;
    const res = await fetch(`/api/projects/${activeProject.id}/timelogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: logDesc.trim(), durationMin, loggedDate: logDate, taskId: logTaskId || undefined }),
    });
    const data = await res.json();
    if (data.log) {
      setTimeLogs((prev) => [data.log, ...prev]);
      setLogDesc(""); setLogHours("1"); setLogMins("0"); setLogDate(todayStr()); setLogTaskId(""); setShowNewLog(false);
      if (stats) setStats({ ...stats, totalMinutes: stats.totalMinutes + durationMin });
    }
  };

  const handleDeleteLog = async (logId: string, durationMin: number) => {
    if (!activeProject?.id) return;
    await fetch(`/api/projects/${activeProject.id}/timelogs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: logId }),
    });
    setTimeLogs((prev) => prev.filter((l) => l.id !== logId));
    if (stats) setStats({ ...stats, totalMinutes: Math.max(0, stats.totalMinutes - durationMin) });
  };

  // ── Meetings ────────────────────────────────────────────────────────────────

  const handleLinkMeeting = async (meetingId: string) => {
    if (!activeProject?.id) return;
    await fetch(`/api/projects/${activeProject.id}/meetings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    });
    if (activeProject.id) await loadMeetings(activeProject.id);
  };

  const handleUnlinkMeeting = async (meetingId: string) => {
    if (!activeProject?.id) return;
    await fetch(`/api/projects/${activeProject.id}/meetings`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    });
    setLinkedMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!activeProject?.id) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/export`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : "export.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const linkedIds = new Set(linkedMeetings.map((m) => m.id));
  const unlinkableMeetings = allMeetings.filter((m) => !linkedIds.has(m.id));

  const timeByDate = timeLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.loggedDate] = (acc[l.loggedDate] ?? 0) + l.durationMin;
    return acc;
  }, {});
  const timeByDateSorted = Object.entries(timeByDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const maxMins = Math.max(...timeByDateSorted.map((e) => e[1]), 1);

  // ── No project selected ───────────────────────────────────────────────────

  if (!activeProject) return <NoProjectState />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">

      {/* ── Project Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        {editingProject ? (
          <div className="space-y-2">
            <input value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
              className="text-base font-bold border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            <input value={editingProject.description ?? ""} onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
              placeholder="Description" className="text-sm border border-gray-200 rounded px-2 py-1 w-full focus:outline-none" />
            <div className="flex gap-1 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setEditingProject({ ...editingProject, color: c })}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border-2 ${editingProject.color === c ? "border-gray-800" : "border-transparent"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpdateProject} className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600">Save</button>
              <button onClick={() => setEditingProject(null)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: activeProject.color }} />
              <div>
                <h1 className="text-lg font-bold text-gray-900">{activeProject.name}</h1>
                {activeProject.description && <p className="text-sm text-gray-500 mt-0.5">{activeProject.description}</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {project && (
                <button onClick={() => setEditingProject(project)} className="text-xs text-gray-400 hover:text-indigo-500 border border-gray-200 rounded-lg px-3 py-1.5">Edit</button>
              )}
              <button onClick={handleDeleteProject} className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-3 py-1.5">Delete</button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {stats && (
          <div className="flex gap-5 mt-4 pt-3 border-t border-gray-50 flex-wrap">
            <div>
              <p className="text-base font-bold text-indigo-600">{fmtMins(stats.totalMinutes)}</p>
              <p className="text-[10px] text-gray-400 uppercase">Time Logged</p>
            </div>
            <div>
              <p className="text-base font-bold text-gray-600">{stats.taskCount}</p>
              <p className="text-[10px] text-gray-400 uppercase">Total Tasks</p>
            </div>
            <div>
              <p className="text-base font-bold text-amber-600">{stats.inProgressCount}</p>
              <p className="text-[10px] text-gray-400 uppercase">In Progress</p>
            </div>
            <div>
              <p className="text-base font-bold text-violet-600">{stats.inReviewCount}</p>
              <p className="text-[10px] text-gray-400 uppercase">In Review</p>
            </div>
            <div>
              <p className="text-base font-bold text-emerald-600">{stats.doneCount}</p>
              <p className="text-[10px] text-gray-400 uppercase">Done</p>
            </div>
            <div>
              <p className="text-base font-bold text-gray-600">
                {stats.taskCount > 0 ? Math.round((stats.doneCount / stats.taskCount) * 100) : 0}%
              </p>
              <p className="text-[10px] text-gray-400 uppercase">Complete</p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {(["overview", "tasks", "timelogs", "meetings", "export"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                activeTab === t ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t === "timelogs" ? "Time Log" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-3">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading project data…
          </div>
        )}

        {!loading && (
          <>
            {/* ── OVERVIEW ───────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="max-w-3xl space-y-6">
                {/* Project info */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: activeProject.color + "20" }}>
                      <span className="w-4 h-4 rounded-full block" style={{ backgroundColor: activeProject.color }} />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">{activeProject.name}</h2>
                      {activeProject.description
                        ? <p className="text-sm text-gray-500 mt-0.5">{activeProject.description}</p>
                        : <p className="text-sm text-gray-300 mt-0.5 italic">No description</p>}
                    </div>
                  </div>
                  {project && <p className="text-xs text-gray-400">Created {fmtDate(project.createdAt)}</p>}
                </div>

                {/* Task status breakdown */}
                {stats && stats.taskCount > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Task Distribution</h3>
                    <div className="space-y-3">
                      {[
                        { label: "To Do",       count: stats.todoCount,        color: "bg-gray-300",    textColor: "text-gray-600" },
                        { label: "In Progress", count: stats.inProgressCount,  color: "bg-blue-400",    textColor: "text-blue-600" },
                        { label: "In Review",   count: stats.inReviewCount,    color: "bg-violet-400",  textColor: "text-violet-600" },
                        { label: "Done",        count: stats.doneCount,        color: "bg-emerald-400", textColor: "text-emerald-600" },
                      ].map(({ label, count, color, textColor }) => (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">{label}</span>
                            <span className={`text-xs font-semibold ${textColor}`}>{count} / {stats.taskCount}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all`}
                              style={{ width: `${(count / stats.taskCount) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Completion progress */}
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-3">
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${(stats.doneCount / stats.taskCount) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 shrink-0">
                        {Math.round((stats.doneCount / stats.taskCount) * 100)}% complete
                      </span>
                    </div>
                  </div>
                )}

                {/* Time logged by date */}
                {timeByDateSorted.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-700">Time Logged by Date</h3>
                      <span className="text-xs text-gray-400">{fmtMins(stats?.totalMinutes ?? 0)} total</span>
                    </div>
                    <div className="flex items-end gap-1.5 h-32">
                      {timeByDateSorted.map(([date, mins]) => (
                        <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <span className="text-[9px] text-gray-400 font-medium">{fmtMins(mins)}</span>
                          <div className="w-full rounded-sm transition-all"
                            style={{ height: `${(mins / maxMins) * 96}px`, backgroundColor: activeProject.color, opacity: 0.8 }} />
                          <span className="text-[8px] text-gray-400 truncate w-full text-center">{date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats && stats.taskCount === 0 && timeLogs.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-3xl mb-3">📊</p>
                    <p className="text-sm">No data yet. Add tasks or log time to see your project overview.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TASKS ──────────────────────────────────────────────────── */}
            {activeTab === "tasks" && (
              <div className="max-w-3xl space-y-4">
                {/* Add task */}
                {showNewTask ? (
                  <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3 shadow-sm">
                    <input value={taskText} onChange={(e) => setTaskText(e.target.value)}
                      placeholder="Task name" autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Description (optional)" rows={2}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none resize-none" />
                    <div className="flex items-center gap-3">
                      <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as "high" | "medium" | "low")}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                        <option value="high">High priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="low">Low priority</option>
                      </select>
                      <div className="flex gap-2 ml-auto">
                        <button onClick={handleCreateTask} className="text-sm bg-indigo-500 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-600">Add Task</button>
                        <button onClick={() => { setShowNewTask(false); setTaskText(""); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNewTask(true)}
                    className="w-full text-sm text-indigo-500 border-2 border-dashed border-indigo-200 rounded-xl py-3 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    + Add Task
                  </button>
                )}

                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm">No tasks yet for this project.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {TASK_STATUS_ORDER.map((status) => {
                      const filtered = tasks.filter((t) => t.status === status);
                      if (filtered.length === 0) return null;
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <div key={status}>
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cfg.label} ({filtered.length})</p>
                          </div>
                          <div className="space-y-2">
                            {filtered.map((task) => {
                              const isExpanded = expandedTaskId === task.id;
                              const doneItems = task.checklist.filter((c) => c.done).length;
                              return (
                                <div key={task.id} className={`bg-white rounded-xl border shadow-sm transition-all ${task.status === "done" ? "opacity-70 border-gray-100" : "border-gray-100"}`}>
                                  <div className="flex items-start gap-3 p-4">
                                    {/* Status cycle button */}
                                    <button
                                      onClick={() => handleUpdateTaskStatus(task.id, NEXT_STATUS[task.status])}
                                      title={`Mark as ${STATUS_CONFIG[NEXT_STATUS[task.status]].label}`}
                                      className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${cfg.ring}`}
                                    >
                                      {task.status === "done" && (
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                      {task.status === "in-review" && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 block" />
                                      )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start gap-2 flex-wrap">
                                        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
                                          {task.text}
                                        </p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}>
                                          {task.priority}
                                        </span>
                                      </div>
                                      {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>}
                                      {task.checklist.length > 0 && (
                                        <p className="text-xs text-gray-400 mt-1">{doneItems}/{task.checklist.length} checklist items</p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                        className="text-gray-300 hover:text-gray-500 text-xs p-1">{isExpanded ? "▲" : "▼"}</button>
                                      <button onClick={() => handleDeleteTask(task.id)} className="text-gray-300 hover:text-red-400 text-sm p-1">✕</button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                                      {task.description && <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>}
                                      {task.checklist.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Checklist</p>
                                          <div className="space-y-1.5">
                                            {task.checklist.map((item) => (
                                              <button key={item.id} onClick={() => handleToggleChecklist(task, item.id)}
                                                className="flex items-center gap-2 w-full text-left">
                                                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${item.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                                                  {item.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </span>
                                                <span className={`text-xs ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>{item.text}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Manual status picker */}
                                      <div className="flex gap-2 flex-wrap">
                                        {TASK_STATUS_ORDER.map((s) => (
                                          <button key={s} onClick={() => handleUpdateTaskStatus(task.id, s)}
                                            className={`text-xs px-2.5 py-1 rounded-lg ${task.status === s ? STATUS_CONFIG[s].badge + " font-semibold" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                                            {STATUS_CONFIG[s].label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TIME LOG ───────────────────────────────────────────────── */}
            {activeTab === "timelogs" && (
              <div className="max-w-3xl space-y-4">
                {showNewLog ? (
                  <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3 shadow-sm">
                    <input value={logDesc} onChange={(e) => setLogDesc(e.target.value)}
                      placeholder="What did you work on?" autoFocus
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Hours</label>
                        <input type="number" min="0" max="24" value={logHours} onChange={(e) => setLogHours(e.target.value)}
                          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Minutes</label>
                        <select value={logMins} onChange={(e) => setLogMins(e.target.value)}
                          className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                          {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Date</label>
                        <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
                      </div>
                    </div>
                    {tasks.length > 0 && (
                      <select value={logTaskId} onChange={(e) => setLogTaskId(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none">
                        <option value="">No linked task</option>
                        {tasks.map((t) => <option key={t.id} value={t.id}>{t.text.slice(0, 60)}</option>)}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleCreateLog} className="text-sm bg-indigo-500 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-600">Log Time</button>
                      <button onClick={() => setShowNewLog(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNewLog(true)}
                    className="w-full text-sm text-indigo-500 border-2 border-dashed border-indigo-200 rounded-xl py-3 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    + Log Time
                  </button>
                )}

                {timeLogs.length > 0 && stats && (
                  <div className="bg-indigo-50 rounded-xl p-4 flex gap-6">
                    <div><p className="text-lg font-bold text-indigo-700">{fmtMins(stats.totalMinutes)}</p><p className="text-xs text-indigo-400">Total logged</p></div>
                    <div><p className="text-lg font-bold text-indigo-700">{timeLogs.length}</p><p className="text-xs text-indigo-400">Log entries</p></div>
                  </div>
                )}

                {timeLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-3xl mb-2">⏱️</p>
                    <p className="text-sm">No time logged yet for this project.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timeLogs.map((log) => {
                      const linkedTask = tasks.find((t) => t.id === log.taskId);
                      return (
                        <div key={log.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                            style={{ backgroundColor: activeProject.color + "20", color: activeProject.color }}>
                            {fmtMins(log.durationMin)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{log.description}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400">{log.loggedDate}</span>
                              {linkedTask && <span className="text-xs text-indigo-500 truncate">→ {linkedTask.text.slice(0, 40)}</span>}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteLog(log.id, log.durationMin)} className="text-gray-300 hover:text-red-400 shrink-0 text-sm">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── MEETINGS ───────────────────────────────────────────────── */}
            {activeTab === "meetings" && (
              <div className="max-w-3xl space-y-5">
                {meetingsLoading ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Loading meetings…</p>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Linked to this project ({linkedMeetings.length})
                      </h3>
                      {linkedMeetings.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-100">
                          No meetings linked yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {linkedMeetings.map((m) => (
                            <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{m.label ?? "Untitled meeting"}</p>
                                <p className="text-xs text-gray-400">{m.date ?? fmtDate(m.saved_at)}</p>
                              </div>
                              <button onClick={() => handleUnlinkMeeting(m.id)}
                                className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-2.5 py-1 shrink-0">Unlink</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {unlinkableMeetings.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Available meetings — link to this project
                        </h3>
                        <div className="space-y-2">
                          {unlinkableMeetings.map((m) => (
                            <div key={m.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 truncate">{m.label ?? "Untitled meeting"}</p>
                                <p className="text-xs text-gray-400">{m.date ?? fmtDate(m.savedAt)}</p>
                              </div>
                              <button onClick={() => handleLinkMeeting(m.id)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-2.5 py-1 shrink-0">+ Link</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {allMeetings.length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <p className="text-3xl mb-2">💬</p>
                        <p className="text-sm">No meetings in history. Create one from the Meetings page.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── EXPORT ─────────────────────────────────────────────────── */}
            {activeTab === "export" && (
              <div className="max-w-xl space-y-4">
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">Export Project Data</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Downloads a CSV with all tasks and time logs strictly scoped to{" "}
                    <span className="font-semibold text-gray-700">{activeProject.name}</span>.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Tasks</span>
                      <span className="font-medium text-gray-700">{stats?.taskCount ?? 0} rows</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Time log entries</span>
                      <span className="font-medium text-gray-700">{timeLogs.length} rows</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Total time logged</span>
                      <span className="font-medium text-gray-700">{stats ? fmtMins(stats.totalMinutes) : "—"}</span>
                    </div>
                  </div>
                  <button onClick={handleExport} disabled={exporting}
                    className="w-full py-2.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 font-medium">
                    {exporting ? "Preparing download…" : "Download CSV"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
