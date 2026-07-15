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
  "todo":        { label: "To Do",       badge: "bg-mint text-charcoal/80",    ring: "border-charcoal/25",           dot: "bg-charcoal/40" },
  "in-progress": { label: "In Progress", badge: "bg-navy/10 text-navy",    ring: "border-navy",           dot: "bg-navy" },
  "in-review":   { label: "In Review",   badge: "bg-rose/30 text-charcoal",ring: "border-rose bg-rose/20", dot: "bg-rose" },
  "done":        { label: "Done",        badge: "bg-teal-sage/20 text-teal-pine", ring: "bg-teal-deep border-teal-deep text-white", dot: "bg-teal-deep" },
};

const PRIORITY_STYLES = {
  high:   "bg-[#e07a5f]/20 text-[#b3492f]",
  medium: "bg-rose/25 text-charcoal",
  low:    "bg-mint text-charcoal/50",
};

const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in-progress", "in-review", "done"];
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  "todo": "in-progress",
  "in-progress": "in-review",
  "in-review": "done",
  "done": "todo",
};

type Tab = "overview" | "tasks" | "timelogs" | "milestones" | "meetings" | "notes" | "export";

type ProficiencyLevel = "Owner" | "Lead" | "Practitioner" | "Emerging";

interface MilestoneSkill {
  id: string;
  milestoneId: string;
  domain: string;
  skillCategory: string;
  specificSkills: string[];
  proficiencyLevel: ProficiencyLevel;
  evidenceTickets: string[];
  resumeBullet?: string;
}

interface ProjectMilestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  completedAt?: string;
  status: "pending" | "in-progress" | "completed";
  category: string;
  whyItMatters?: string;
  keyDeliverables?: string[];
  careerImpact?: string;
  relatedTickets?: string[];
  skills?: MilestoneSkill[];
}

interface ProjectNote {
  id: string;
  projectId: string;
  title: string | null;
  body: string;
  createdAt: number;
  updatedAt: number;
}

interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  createdAt: number;
}

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

function NoProjectState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-mint/40 p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-mint flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-teal-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h2 className="font-display text-[24px] text-charcoal mb-2">No project selected</h2>
        <p className="text-sm text-charcoal/50 leading-relaxed mb-6">
          Select a project from the sidebar, or create a new one to get started.
        </p>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-deep text-white text-sm font-medium rounded-button hover:bg-teal-forest active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
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

  // Create project modal
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit project
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [taskDesc, setTaskDesc] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Task comments (keyed by taskId)
  const [taskCommentsMap, setTaskCommentsMap] = useState<Record<string, TaskComment[]>>({});
  const [taskCommentsLoading, setTaskCommentsLoading] = useState<Record<string, boolean>>({});
  const [newTaskComment, setNewTaskComment] = useState("");

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

  // Notes
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteBody, setEditNoteBody] = useState("");

  // Milestones
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestonesLoaded, setMilestonesLoaded] = useState(false);
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // ── Load project data ───────────────────────────────────────────────────────

  const loadProjectData = useCallback(async (id: string) => {
    setLoading(true);
    // Clear all lazy-loaded tab state so switching projects always re-fetches
    setMilestones([]); setMilestonesLoaded(false); setExpandedMilestoneId(null);
    setNotes([]);      setNotesLoaded(false);
    setLinkedMeetings([]); setAllMeetings([]);
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
        setActiveProject({ id: pd.project.id, name: pd.project.name, color: pd.project.color, description: pd.project.description });
      }
    } finally {
      setLoading(false);
    }
  }, [setActiveProject]);

  const loadNotes = useCallback(async (id: string) => {
    const r = await fetch(`/api/projects/${id}/notes`);
    const d = await r.json();
    setNotes(d.notes ?? []);
    setNotesLoaded(true);
  }, []);

  const loadMilestones = useCallback(async (id: string) => {
    const r = await fetch(`/api/projects/${id}/milestones`);
    const d = await r.json();
    setMilestones(d.milestones ?? []);
    setMilestonesLoaded(true);
  }, []);

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

  // Open create modal when sidebar signals it via sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem("clockit_open_create_project") === "1") {
      sessionStorage.removeItem("clockit_open_create_project");
      setShowCreateProject(true);
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
      setNotes([]); setNotesLoaded(false);
      setMilestones([]); setMilestonesLoaded(false); setExpandedMilestoneId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  // Load meetings lazily when tab is opened
  useEffect(() => {
    if (activeTab === "meetings" && activeProject?.id) loadMeetings(activeProject.id);
  }, [activeTab, activeProject?.id, loadMeetings]);

  // Load notes lazily when tab is opened
  useEffect(() => {
    if (activeTab === "notes" && activeProject?.id && !notesLoaded) loadNotes(activeProject.id);
  }, [activeTab, activeProject?.id, notesLoaded, loadNotes]);

  // Load milestones lazily when tab is opened
  useEffect(() => {
    if (activeTab === "milestones" && activeProject?.id && !milestonesLoaded) loadMilestones(activeProject.id);
  }, [activeTab, activeProject?.id, milestonesLoaded, loadMilestones]);

  // Load comments when a task is expanded
  useEffect(() => {
    if (!expandedTaskId) return;
    if (taskCommentsMap[expandedTaskId] !== undefined) return;
    setTaskCommentsLoading(prev => ({ ...prev, [expandedTaskId]: true }));
    fetch(`/api/tasks/${expandedTaskId}/comments`)
      .then(r => r.json())
      .then(d => {
        setTaskCommentsMap(prev => ({ ...prev, [expandedTaskId]: d.comments ?? [] }));
        setTaskCommentsLoading(prev => ({ ...prev, [expandedTaskId]: false }));
      })
      .catch(() => {
        setTaskCommentsMap(prev => ({ ...prev, [expandedTaskId]: [] }));
        setTaskCommentsLoading(prev => ({ ...prev, [expandedTaskId]: false }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedTaskId]);

  // ── Project CRUD ────────────────────────────────────────────────────────────

  const handleCreateProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || undefined, color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      const p: Project = data.project;
      setActiveProject({ id: p.id, name: p.name, color: p.color, description: p.description });
      setShowCreateProject(false);
      setNewName(""); setNewDescription(""); setNewColor(PROJECT_COLORS[0]);
      window.dispatchEvent(new Event("projects-updated"));
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

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

  // ── Task Comments ───────────────────────────────────────────────────────────

  const handleAddTaskComment = async (taskId: string) => {
    if (!newTaskComment.trim()) return;
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newTaskComment.trim() }),
    });
    const data = await res.json();
    if (data.comment) {
      setTaskCommentsMap(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), data.comment] }));
      setNewTaskComment("");
    }
  };

  const handleDeleteTaskComment = async (taskId: string, commentId: string) => {
    await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
    setTaskCommentsMap(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(c => c.id !== commentId) }));
  };

  // ── Notes ───────────────────────────────────────────────────────────────────

  const handleCreateNote = async () => {
    if (!activeProject?.id || !noteBody.trim()) return;
    setSavingNote(true);
    const res = await fetch(`/api/projects/${activeProject.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: noteTitle.trim() || undefined, body: noteBody.trim() }),
    });
    const data = await res.json();
    if (data.note) {
      setNotes(prev => [data.note, ...prev]);
      setNoteTitle(""); setNoteBody(""); setShowNewNote(false);
    }
    setSavingNote(false);
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!activeProject?.id || !editNoteBody.trim()) return;
    const res = await fetch(`/api/projects/${activeProject.id}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editNoteTitle.trim() || undefined, body: editNoteBody.trim() }),
    });
    const data = await res.json();
    if (data.note) {
      setNotes(prev => prev.map(n => n.id === noteId ? data.note : n));
      setEditingNoteId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeProject?.id) return;
    await fetch(`/api/projects/${activeProject.id}/notes/${noteId}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== noteId));
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

  if (!activeProject) return (
    <>
      <NoProjectState onCreate={() => setShowCreateProject(true)} />
      {showCreateProject && <CreateProjectModal />}
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  function CreateProjectModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] text-charcoal">New Project</h2>
            <button onClick={() => setShowCreateProject(false)} className="text-charcoal/40 hover:text-charcoal">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal/50 mb-1 uppercase tracking-wide">Project Name *</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="e.g. Coupa Integration"
                className="w-full px-3 py-2 text-sm border border-mint-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-sage/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal/50 mb-1 uppercase tracking-wide">Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional short description"
                className="w-full px-3 py-2 text-sm border border-mint-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-sage/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal/50 mb-2 uppercase tracking-wide">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${newColor === c ? "border-charcoal scale-110" : "border-transparent hover:scale-105"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {createError && <p className="text-xs text-[#b3492f]">{createError}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowCreateProject(false); setCreateError(null); }}
              className="flex-1 py-2.5 text-sm text-charcoal/70 border border-mint-mist rounded-button hover:bg-mint/40"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creating || !newName.trim()}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-teal-deep rounded-button hover:bg-teal-forest disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating…" : "Create Project"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mint/40 overflow-hidden">
      {showCreateProject && <CreateProjectModal />}

      {/* ── Project Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-mint-mist px-6 py-4 shrink-0">
        {editingProject ? (
          <div className="space-y-2">
            <input value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
              className="text-base font-bold border border-mint-mist rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-teal-sage/50" />
            <input value={editingProject.description ?? ""} onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
              placeholder="Description" className="text-sm border border-mint-mist rounded px-2 py-1 w-full focus:outline-none" />
            <div className="flex gap-1 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setEditingProject({ ...editingProject, color: c })}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border-2 ${editingProject.color === c ? "border-charcoal" : "border-transparent"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpdateProject} className="text-xs bg-teal-deep text-white px-3.5 py-1.5 rounded-button hover:bg-teal-forest">Save</button>
              <button onClick={() => setEditingProject(null)} className="text-xs border border-mint-mist px-3.5 py-1.5 rounded-button hover:bg-mint/40">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: activeProject.color }} />
              <div>
                <h1 className="font-display text-[22px] leading-tight text-charcoal">{activeProject.name}</h1>
                {activeProject.description && <p className="text-sm text-charcoal/50 mt-0.5">{activeProject.description}</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowCreateProject(true)}
                className="text-xs text-teal-pine hover:text-teal-deep border border-teal-sage/40 rounded-button px-3.5 py-1.5 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
              {project && (
                <button onClick={() => setEditingProject(project)} className="text-xs text-charcoal/40 hover:text-teal-deep border border-mint-mist rounded-button px-3 py-1.5">Edit</button>
              )}
              <button onClick={handleDeleteProject} className="text-xs text-charcoal/25 hover:text-[#b3492f] border border-[#e07a5f]/30 rounded-button px-3 py-1.5">Delete</button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {stats && (
          <div className="flex gap-5 mt-4 pt-3 border-t border-mint flex-wrap">
            <div>
              <p className="text-base font-bold text-teal-pine">{fmtMins(stats.totalMinutes)}</p>
              <p className="text-[10px] text-charcoal/40 uppercase">Time Logged</p>
            </div>
            <div>
              <p className="text-base font-bold text-charcoal/70">{stats.taskCount}</p>
              <p className="text-[10px] text-charcoal/40 uppercase">Total Tasks</p>
            </div>
            <div>
              <p className="text-base font-bold text-charcoal">{stats.inProgressCount}</p>
              <p className="text-[10px] text-charcoal/40 uppercase">In Progress</p>
            </div>
            <div>
              <p className="text-base font-bold text-charcoal">{stats.inReviewCount}</p>
              <p className="text-[10px] text-charcoal/40 uppercase">In Review</p>
            </div>
            <div>
              <p className="text-base font-bold text-teal-pine">{stats.doneCount}</p>
              <p className="text-[10px] text-charcoal/40 uppercase">Done</p>
            </div>
            <div>
              <p className="text-base font-bold text-charcoal/70">
                {stats.taskCount > 0 ? Math.round((stats.doneCount / stats.taskCount) * 100) : 0}%
              </p>
              <p className="text-[10px] text-charcoal/40 uppercase">Complete</p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {(["overview", "tasks", "timelogs", "milestones", "meetings", "notes", "export"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 text-sm rounded-nav transition-colors whitespace-nowrap ${
                activeTab === t ? "bg-teal-deep text-white font-medium" : "text-charcoal/50 hover:bg-mint hover:text-teal-pine"
              }`}>
              {t === "timelogs" ? "Time Log" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-16 text-charcoal/40 text-sm gap-3">
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
                <div className="bg-white rounded-xl border border-mint p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: activeProject.color + "20" }}>
                      <span className="w-4 h-4 rounded-full block" style={{ backgroundColor: activeProject.color }} />
                    </div>
                    <div>
                      <h2 className="font-bold text-charcoal">{activeProject.name}</h2>
                      {activeProject.description
                        ? <p className="text-sm text-charcoal/50 mt-0.5">{activeProject.description}</p>
                        : <p className="text-sm text-charcoal/25 mt-0.5 italic">No description</p>}
                    </div>
                  </div>
                  {project && <p className="text-xs text-charcoal/40">Created {fmtDate(project.createdAt)}</p>}
                </div>

                {/* Task status breakdown */}
                {stats && stats.taskCount > 0 && (
                  <div className="bg-white rounded-xl border border-mint p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-charcoal/80 mb-4">Task Distribution</h3>
                    <div className="space-y-3">
                      {[
                        { label: "To Do",       count: stats.todoCount,        color: "bg-charcoal/30",    textColor: "text-charcoal/70" },
                        { label: "In Progress", count: stats.inProgressCount,  color: "bg-navy",    textColor: "text-navy" },
                        { label: "In Review",   count: stats.inReviewCount,    color: "bg-rose",  textColor: "text-charcoal" },
                        { label: "Done",        count: stats.doneCount,        color: "bg-teal-sage", textColor: "text-teal-pine" },
                      ].map(({ label, count, color, textColor }) => (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-charcoal/50">{label}</span>
                            <span className={`text-xs font-semibold ${textColor}`}>{count} / {stats.taskCount}</span>
                          </div>
                          <div className="h-2 bg-mint rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all`}
                              style={{ width: `${(count / stats.taskCount) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Completion progress */}
                    <div className="mt-4 pt-4 border-t border-mint flex items-center gap-3">
                      <div className="flex-1 h-3 bg-mint rounded-full overflow-hidden">
                        <div className="h-full bg-teal-sage rounded-full transition-all"
                          style={{ width: `${(stats.doneCount / stats.taskCount) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-charcoal/80 shrink-0">
                        {Math.round((stats.doneCount / stats.taskCount) * 100)}% complete
                      </span>
                    </div>
                  </div>
                )}

                {/* Time logged by date */}
                {timeByDateSorted.length > 0 && (
                  <div className="bg-white rounded-xl border border-mint p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-charcoal/80">Time Logged by Date</h3>
                      <span className="text-xs text-charcoal/40">{fmtMins(stats?.totalMinutes ?? 0)} total</span>
                    </div>
                    <div className="flex items-end gap-1.5 h-32">
                      {timeByDateSorted.map(([date, mins]) => (
                        <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <span className="text-[9px] text-charcoal/40 font-medium">{fmtMins(mins)}</span>
                          <div className="w-full rounded-sm transition-all"
                            style={{ height: `${(mins / maxMins) * 96}px`, backgroundColor: activeProject.color, opacity: 0.8 }} />
                          <span className="text-[8px] text-charcoal/40 truncate w-full text-center">{date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats && stats.taskCount === 0 && timeLogs.length === 0 && (
                  <div className="text-center py-16 text-charcoal/40">
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
                  <div className="bg-white rounded-xl border border-teal-sage/30 p-4 space-y-3 shadow-sm">
                    <input value={taskText} onChange={(e) => setTaskText(e.target.value)}
                      placeholder="Task name" autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                      className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-sage/40" />
                    <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Description (optional)" rows={2}
                      className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none resize-none" />
                    <div className="flex items-center gap-3">
                      <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as "high" | "medium" | "low")}
                        className="text-xs border border-mint-mist rounded-lg px-2 py-1.5">
                        <option value="high">High priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="low">Low priority</option>
                      </select>
                      <div className="flex gap-2 ml-auto">
                        <button onClick={handleCreateTask} className="text-sm bg-teal-deep text-white px-4 py-1.5 rounded-button hover:bg-teal-forest">Add Task</button>
                        <button onClick={() => { setShowNewTask(false); setTaskText(""); }} className="text-sm text-charcoal/50 hover:text-charcoal">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNewTask(true)}
                    className="w-full text-sm text-teal-pine border-2 border-dashed border-teal-sage/40 rounded-xl py-3 hover:border-teal-deep hover:bg-mint transition-colors">
                    + Add Task
                  </button>
                )}

                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-charcoal/40">
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
                            <p className="text-xs font-semibold text-charcoal/50 uppercase tracking-wide">{cfg.label} ({filtered.length})</p>
                          </div>
                          <div className="space-y-2">
                            {filtered.map((task) => {
                              const isExpanded = expandedTaskId === task.id;
                              const doneItems = task.checklist.filter((c) => c.done).length;
                              return (
                                <div key={task.id} className={`bg-white rounded-xl border shadow-sm transition-all ${task.status === "done" ? "opacity-70 border-mint" : "border-mint"}`}>
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
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose block" />
                                      )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start gap-2 flex-wrap">
                                        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-charcoal/40" : "text-charcoal"}`}>
                                          {task.text}
                                        </p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}>
                                          {task.priority}
                                        </span>
                                      </div>
                                      {task.description && <p className="text-xs text-charcoal/50 mt-0.5 line-clamp-2">{task.description}</p>}
                                      {task.checklist.length > 0 && (
                                        <p className="text-xs text-charcoal/40 mt-1">{doneItems}/{task.checklist.length} checklist items</p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => { setExpandedTaskId(isExpanded ? null : task.id); setNewTaskComment(""); }}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                          isExpanded ? "bg-mint text-teal-pine" : "bg-mint text-charcoal/50 hover:bg-mint hover:text-teal-deep"
                                        }`}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        {isExpanded ? "Close" : "Comment"}
                                      </button>
                                      <button onClick={() => handleDeleteTask(task.id)} className="text-charcoal/25 hover:text-[#b3492f] text-sm p-1">✕</button>
                                    </div>
                                  </div>

                                  {isExpanded && (() => {
                                    const comments = taskCommentsMap[task.id] ?? [];
                                    const commentsLoading = taskCommentsLoading[task.id] ?? false;
                                    return (
                                    <div className="border-t border-mint px-4 pb-4 pt-3 space-y-4">
                                      {task.description && <p className="text-sm text-charcoal/70 leading-relaxed">{task.description}</p>}
                                      {task.checklist.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-charcoal/40 uppercase mb-2">Checklist</p>
                                          <div className="space-y-1.5">
                                            {task.checklist.map((item) => (
                                              <button key={item.id} onClick={() => handleToggleChecklist(task, item.id)}
                                                className="flex items-center gap-2 w-full text-left">
                                                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${item.done ? "bg-teal-deep border-teal-deep" : "border-charcoal/25"}`}>
                                                  {item.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </span>
                                                <span className={`text-xs ${item.done ? "line-through text-charcoal/40" : "text-charcoal/80"}`}>{item.text}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Manual status picker */}
                                      <div className="flex gap-2 flex-wrap">
                                        {TASK_STATUS_ORDER.map((s) => (
                                          <button key={s} onClick={() => handleUpdateTaskStatus(task.id, s)}
                                            className={`text-xs px-2.5 py-1 rounded-tag ${task.status === s ? STATUS_CONFIG[s].badge + " font-semibold" : "border border-mint-mist text-charcoal/50 hover:bg-mint/40"}`}>
                                            {STATUS_CONFIG[s].label}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Comments */}
                                      <div>
                                        <p className="text-xs font-semibold text-charcoal/40 uppercase mb-2">
                                          Comments {comments.length > 0 && <span className="normal-case font-normal ml-1">{comments.length}</span>}
                                        </p>
                                        {commentsLoading && <div className="h-8 bg-mint rounded-lg animate-pulse" />}
                                        {!commentsLoading && comments.length > 0 && (
                                          <ul className="space-y-2 mb-2">
                                            {comments.map(c => (
                                              <li key={c.id} className="bg-mint/40 rounded-lg px-3 py-2.5 flex items-start gap-2.5 group/cmt">
                                                <div className="w-6 h-6 rounded-full bg-mint flex items-center justify-center shrink-0 mt-0.5">
                                                  <svg className="w-3 h-3 text-teal-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                  </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs text-charcoal leading-relaxed whitespace-pre-wrap">{c.body}</p>
                                                  <p className="text-[10px] text-charcoal/40 mt-0.5">
                                                    {new Date(c.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                  </p>
                                                </div>
                                                <button
                                                  onClick={() => handleDeleteTaskComment(task.id, c.id)}
                                                  className="opacity-0 group-hover/cmt:opacity-100 text-charcoal/25 hover:text-[#b3492f] transition-all shrink-0"
                                                >
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                  </svg>
                                                </button>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                        {!commentsLoading && comments.length === 0 && (
                                          <p className="text-xs text-charcoal/40 mb-2">No comments yet.</p>
                                        )}
                                        <div className="flex gap-2">
                                          <textarea
                                            value={newTaskComment}
                                            onChange={e => setNewTaskComment(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddTaskComment(task.id); }}
                                            placeholder="Add a comment… (Ctrl+Enter to post)"
                                            rows={2}
                                            className="flex-1 border border-mint-mist bg-white rounded-lg px-3 py-2 text-xs text-charcoal/80 resize-none focus:outline-none focus:ring-2 focus:ring-teal-sage/40 placeholder:text-charcoal/25"
                                          />
                                          <button
                                            onClick={() => handleAddTaskComment(task.id)}
                                            disabled={!newTaskComment.trim()}
                                            className="px-3 py-1.5 bg-teal-deep text-white rounded-button text-xs font-medium hover:bg-teal-forest disabled:opacity-40 transition-colors self-end"
                                          >
                                            Post
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    );
                                  })()}
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
                  <div className="bg-white rounded-xl border border-teal-sage/30 p-4 space-y-3 shadow-sm">
                    <input value={logDesc} onChange={(e) => setLogDesc(e.target.value)}
                      placeholder="What did you work on?" autoFocus
                      className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-sage/40" />
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-charcoal/50">Hours</label>
                        <input type="number" min="0" max="24" value={logHours} onChange={(e) => setLogHours(e.target.value)}
                          className="w-16 text-sm border border-mint-mist rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-teal-sage/40" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-charcoal/50">Minutes</label>
                        <select value={logMins} onChange={(e) => setLogMins(e.target.value)}
                          className="w-20 text-sm border border-mint-mist rounded-lg px-2 py-1.5 focus:outline-none">
                          {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-charcoal/50">Date</label>
                        <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                          className="text-sm border border-mint-mist rounded-lg px-2 py-1.5 focus:outline-none" />
                      </div>
                    </div>
                    {tasks.length > 0 && (
                      <select value={logTaskId} onChange={(e) => setLogTaskId(e.target.value)}
                        className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none">
                        <option value="">No linked task</option>
                        {tasks.map((t) => <option key={t.id} value={t.id}>{t.text.slice(0, 60)}</option>)}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleCreateLog} className="text-sm bg-teal-deep text-white px-4 py-1.5 rounded-button hover:bg-teal-forest">Log Time</button>
                      <button onClick={() => setShowNewLog(false)} className="text-sm text-charcoal/50 hover:text-charcoal">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowNewLog(true)}
                    className="w-full text-sm text-teal-pine border-2 border-dashed border-teal-sage/40 rounded-xl py-3 hover:border-teal-deep hover:bg-mint transition-colors">
                    + Log Time
                  </button>
                )}

                {timeLogs.length > 0 && stats && (
                  <div className="bg-mint rounded-xl p-4 flex gap-6">
                    <div><p className="text-lg font-bold text-teal-pine">{fmtMins(stats.totalMinutes)}</p><p className="text-xs text-teal-sage">Total logged</p></div>
                    <div><p className="text-lg font-bold text-teal-pine">{timeLogs.length}</p><p className="text-xs text-teal-sage">Log entries</p></div>
                  </div>
                )}

                {timeLogs.length === 0 ? (
                  <div className="text-center py-12 text-charcoal/40">
                    <p className="text-3xl mb-2">⏱️</p>
                    <p className="text-sm">No time logged yet for this project.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timeLogs.map((log) => {
                      const linkedTask = tasks.find((t) => t.id === log.taskId);
                      return (
                        <div key={log.id} className="bg-white rounded-xl border border-mint p-4 flex items-start gap-3 shadow-sm">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                            style={{ backgroundColor: activeProject.color + "20", color: activeProject.color }}>
                            {fmtMins(log.durationMin)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-charcoal">{log.description}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-xs text-charcoal/40">{log.loggedDate}</span>
                              {linkedTask && <span className="text-xs text-teal-pine truncate">→ {linkedTask.text.slice(0, 40)}</span>}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteLog(log.id, log.durationMin)} className="text-charcoal/25 hover:text-[#b3492f] shrink-0 text-sm">✕</button>
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
                  <p className="text-sm text-charcoal/40 py-8 text-center">Loading meetings…</p>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
                        Linked to this project ({linkedMeetings.length})
                      </h3>
                      {linkedMeetings.length === 0 ? (
                        <p className="text-sm text-charcoal/40 text-center py-6 bg-white rounded-xl border border-mint">
                          No meetings linked yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {linkedMeetings.map((m) => (
                            <div key={m.id} className="bg-white rounded-xl border border-mint p-4 flex items-center gap-3 shadow-sm">
                              <div className="w-8 h-8 rounded-lg bg-mint flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-teal-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-charcoal truncate">{m.label ?? "Untitled meeting"}</p>
                                <p className="text-xs text-charcoal/40">{m.date ?? fmtDate(m.saved_at)}</p>
                              </div>
                              <button onClick={() => handleUnlinkMeeting(m.id)}
                                className="text-xs text-charcoal/40 hover:text-[#b3492f] border border-mint-mist rounded-button px-2.5 py-1 shrink-0">Unlink</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {unlinkableMeetings.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-3">
                          Available meetings — link to this project
                        </h3>
                        <div className="space-y-2">
                          {unlinkableMeetings.map((m) => (
                            <div key={m.id} className="bg-mint/40 rounded-xl border border-mint p-4 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-charcoal/80 truncate">{m.label ?? "Untitled meeting"}</p>
                                <p className="text-xs text-charcoal/40">{m.date ?? fmtDate(m.savedAt)}</p>
                              </div>
                              <button onClick={() => handleLinkMeeting(m.id)}
                                className="text-xs text-teal-pine hover:text-teal-deep border border-teal-sage/40 rounded-button px-2.5 py-1 shrink-0">+ Link</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {allMeetings.length === 0 && (
                      <div className="text-center py-12 text-charcoal/40">
                        <p className="text-3xl mb-2">💬</p>
                        <p className="text-sm">No meetings in history. Create one from the Meetings page.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── NOTES ──────────────────────────────────────────────────── */}
            {activeTab === "notes" && (
              <div className="max-w-3xl space-y-4">
                {/* New note form */}
                {showNewNote ? (
                  <div className="bg-white rounded-xl border border-teal-sage/30 p-4 space-y-3 shadow-sm">
                    <input
                      value={noteTitle}
                      onChange={e => setNoteTitle(e.target.value)}
                      placeholder="Title (optional)"
                      autoFocus
                      className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-sage/40"
                    />
                    <textarea
                      value={noteBody}
                      onChange={e => setNoteBody(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreateNote(); }}
                      placeholder="Write your note… (Ctrl+Enter to save)"
                      rows={5}
                      className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-sage/40 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateNote}
                        disabled={savingNote || !noteBody.trim()}
                        className="text-sm bg-teal-deep text-white px-4 py-1.5 rounded-button hover:bg-teal-forest disabled:opacity-50"
                      >
                        {savingNote ? "Saving…" : "Save Note"}
                      </button>
                      <button
                        onClick={() => { setShowNewNote(false); setNoteTitle(""); setNoteBody(""); }}
                        className="text-sm text-charcoal/50 hover:text-charcoal"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewNote(true)}
                    className="w-full text-sm text-teal-pine border-2 border-dashed border-teal-sage/40 rounded-xl py-3 hover:border-teal-deep hover:bg-mint transition-colors"
                  >
                    + New Note
                  </button>
                )}

                {!notesLoaded && (
                  <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-24 bg-mint rounded-xl animate-pulse" />)}
                  </div>
                )}

                {notesLoaded && notes.length === 0 && (
                  <div className="text-center py-16 text-charcoal/40">
                    <p className="text-3xl mb-2">📝</p>
                    <p className="text-sm">No notes yet for this project.</p>
                    <p className="text-xs mt-1">Use notes to capture decisions, context, or anything worth remembering.</p>
                  </div>
                )}

                {notesLoaded && notes.length > 0 && (
                  <div className="space-y-3">
                    {notes.map(note => (
                      <div key={note.id} className="bg-white rounded-xl border border-mint shadow-sm overflow-hidden group/note">
                        {editingNoteId === note.id ? (
                          <div className="p-4 space-y-3">
                            <input
                              value={editNoteTitle}
                              onChange={e => setEditNoteTitle(e.target.value)}
                              placeholder="Title (optional)"
                              autoFocus
                              className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-sage/40"
                            />
                            <textarea
                              value={editNoteBody}
                              onChange={e => setEditNoteBody(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleUpdateNote(note.id); }}
                              rows={6}
                              className="w-full text-sm border border-mint-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-sage/40 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateNote(note.id)}
                                disabled={!editNoteBody.trim()}
                                className="text-sm bg-teal-deep text-white px-4 py-1.5 rounded-button hover:bg-teal-forest disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="text-sm text-charcoal/50 hover:text-charcoal"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                {note.title && (
                                  <h4 className="text-sm font-semibold text-charcoal mb-1">{note.title}</h4>
                                )}
                                <p className="text-sm text-charcoal/80 leading-relaxed whitespace-pre-wrap">{note.body}</p>
                              </div>
                              <div className="flex gap-1 shrink-0 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditNoteTitle(note.title ?? "");
                                    setEditNoteBody(note.body);
                                  }}
                                  className="p-1.5 rounded-lg text-charcoal/40 hover:text-teal-deep hover:bg-mint transition-colors"
                                  title="Edit note"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1.5 rounded-lg text-charcoal/40 hover:text-[#b3492f] hover:bg-[#e07a5f]/15 transition-colors"
                                  title="Delete note"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-charcoal/40">
                              {note.updatedAt !== note.createdAt ? "Updated " : ""}
                              {new Date(note.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── MILESTONES ─────────────────────────────────────────────── */}
            {activeTab === "milestones" && (
              <div className="max-w-3xl space-y-4">
                {milestones.length === 0 && milestonesLoaded && (
                  <div className="bg-white rounded-xl border border-mint p-10 text-center shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-rose/10 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-charcoal/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-charcoal/80">No milestones yet</p>
                    <p className="text-xs text-charcoal/40 mt-1">Milestones linked to this project will appear here.</p>
                  </div>
                )}

                {!milestonesLoaded && (
                  <div className="flex items-center justify-center py-16 text-charcoal/40 text-sm gap-3">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading milestones…
                  </div>
                )}

                {/* Summary strip */}
                {milestones.length > 0 && (
                  <div className="flex gap-6 bg-white rounded-xl border border-mint px-5 py-3 shadow-sm">
                    {[
                      { label: "Total",       value: milestones.length,                                            color: "text-charcoal/80" },
                      { label: "Completed",   value: milestones.filter(m => m.status === "completed").length,      color: "text-teal-pine" },
                      { label: "In Progress", value: milestones.filter(m => m.status === "in-progress").length,    color: "text-navy" },
                      { label: "Skills",      value: milestones.reduce((s,m)=>s+(m.skills?.length??0),0),          color: "text-charcoal" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className={`text-lg font-bold ${color}`}>{value}</p>
                        <p className="text-[10px] text-charcoal/40 uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Milestone cards */}
                {milestones.map((m) => {
                  const isOpen = expandedMilestoneId === m.id;
                  // Strip "First " from the front of the title
                  const displayTitle = m.title.replace(/^First\s+/i, "");
                  const skills = m.skills ?? [];
                  const delivers = m.keyDeliverables ?? [];
                  const tickets = m.relatedTickets ?? [];

                  const statusStyles: Record<string, { badge: string; dot: string; label: string }> = {
                    completed:   { badge: "bg-teal-sage/20 text-teal-pine border-teal-sage/40", dot: "bg-teal-deep", label: "Completed" },
                    "in-progress": { badge: "bg-navy/10 text-navy border-navy/30",          dot: "bg-navy",   label: "In Progress" },
                    pending:     { badge: "bg-mint text-charcoal/70 border-mint-mist",            dot: "bg-charcoal/40",   label: "Pending" },
                  };
                  const ss = statusStyles[m.status] ?? statusStyles.pending;

                  const profColors: Record<string, string> = {
                    Owner:        "bg-teal-sage/20 text-teal-pine border-teal-sage/40",
                    Lead:         "bg-navy/10 text-navy border-navy/30",
                    Practitioner: "bg-rose/30 text-charcoal border-rose/50",
                    Emerging:     "bg-rose/25 text-charcoal border-rose/40",
                  };

                  return (
                    <div key={m.id} className={`bg-white rounded-xl border transition-all ${isOpen ? "border-teal-sage/40" : "border-mint"}`}>
                      {/* Card header — always visible */}
                      <button
                        onClick={() => setExpandedMilestoneId(isOpen ? null : m.id)}
                        className="w-full text-left px-5 py-4 flex items-start gap-4"
                      >
                        {/* Status dot + completion line */}
                        <div className="flex flex-col items-center pt-0.5 gap-1 shrink-0">
                          <span className={`w-3 h-3 rounded-full border-2 ${m.status === "completed" ? "bg-teal-deep border-teal-deep" : m.status === "in-progress" ? "bg-navy border-navy" : "bg-white border-charcoal/25"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-charcoal leading-snug">{displayTitle}</h3>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ss.badge}`}>{ss.label}</span>
                            {m.careerImpact && (
                              <span className="text-[10px] text-teal-pine bg-mint border border-teal-sage/30 px-2 py-0.5 rounded-full font-medium">
                                {m.careerImpact}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-charcoal/40">
                            {m.completedAt && (
                              <span>✓ {m.completedAt.slice(0, 10)}</span>
                            )}
                            {m.targetDate && !m.completedAt && (
                              <span>Target: {m.targetDate}</span>
                            )}
                            {tickets.length > 0 && (
                              <span>{tickets.slice(0, 3).join(", ")}{tickets.length > 3 ? ` +${tickets.length - 3}` : ""}</span>
                            )}
                            {skills.length > 0 && (
                              <span className="text-charcoal">{skills.length} skill area{skills.length > 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>

                        <svg className={`w-4 h-4 text-charcoal/40 shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="px-5 pb-5 space-y-5 border-t border-mint pt-4">
                          {/* Why it matters */}
                          {m.whyItMatters && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 mb-1.5">Why It Matters</p>
                              <p className="text-sm text-charcoal/70 leading-relaxed">{m.whyItMatters}</p>
                            </div>
                          )}

                          {/* Key deliverables + tickets side by side */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {delivers.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 mb-2">Key Deliverables</p>
                                <ul className="space-y-1.5">
                                  {delivers.map((d, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-charcoal/70">
                                      <svg className="w-3.5 h-3.5 text-teal-pine shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                      {d}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {tickets.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 mb-2">Related Tickets</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {tickets.map((t) => (
                                    <span key={t} className="text-[10px] font-mono px-2 py-0.5 bg-mint text-charcoal/70 rounded border border-mint-mist">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Skills gained */}
                          {skills.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 mb-3">Skills Gained</p>
                              <div className="space-y-3">
                                {skills.map((s) => (
                                  <div key={s.id} className="rounded-lg border border-mint bg-mint/40 p-3">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div>
                                        <p className="text-xs font-semibold text-charcoal">{s.skillCategory}</p>
                                        <p className="text-[10px] text-charcoal/40 mt-0.5">{s.domain}</p>
                                      </div>
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${profColors[s.proficiencyLevel] ?? "bg-mint text-charcoal/70 border-mint-mist"}`}>
                                        {s.proficiencyLevel}
                                      </span>
                                    </div>

                                    {/* Specific skills */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {s.specificSkills.map((sk, i) => (
                                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white border border-mint-mist text-charcoal/50 rounded">
                                          {sk}
                                        </span>
                                      ))}
                                    </div>

                                    {/* Resume bullet */}
                                    {s.resumeBullet && (
                                      <div className="mt-2 pt-2 border-t border-mint-mist">
                                        <p className="text-[10px] font-semibold text-charcoal/40 uppercase tracking-wide mb-1">Resume Bullet</p>
                                        <p className="text-[11px] text-charcoal/70 italic leading-relaxed">{s.resumeBullet}</p>
                                      </div>
                                    )}

                                    {/* Evidence tickets */}
                                    {s.evidenceTickets.length > 0 && (
                                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] text-charcoal/40">Evidence:</span>
                                        {s.evidenceTickets.map((t) => (
                                          <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 bg-mint text-teal-pine rounded border border-teal-sage/30">{t}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── EXPORT ─────────────────────────────────────────────────── */}
            {activeTab === "export" && (
              <div className="max-w-xl space-y-4">
                <div className="bg-white rounded-xl border border-mint p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold text-charcoal/80">Export Project Data</h3>
                  <p className="text-sm text-charcoal/50 leading-relaxed">
                    Downloads a CSV with all tasks and time logs strictly scoped to{" "}
                    <span className="font-semibold text-charcoal/80">{activeProject.name}</span>.
                  </p>
                  <div className="bg-mint/40 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-charcoal/50">Tasks</span>
                      <span className="font-medium text-charcoal/80">{stats?.taskCount ?? 0} rows</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-charcoal/50">Time log entries</span>
                      <span className="font-medium text-charcoal/80">{timeLogs.length} rows</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-charcoal/50">Total time logged</span>
                      <span className="font-medium text-charcoal/80">{stats ? fmtMins(stats.totalMinutes) : "—"}</span>
                    </div>
                  </div>
                  <button onClick={handleExport} disabled={exporting}
                    className="w-full py-2.5 text-sm bg-teal-deep text-white rounded-button hover:bg-teal-forest disabled:opacity-50 font-medium">
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
