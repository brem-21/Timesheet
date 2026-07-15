"use client";

import { useEffect, useState, useRef } from "react";
import { MeetingTask, ChecklistItem, TaskStatus, TaskPriority } from "@/lib/taskStoreServer";
import TimerButton from "@/components/TimerButton";
import { useTimer } from "@/components/TimerContext";
import { formatDurationShort } from "@/lib/timerStore";

const RECENT_KEY = "clockit_recent_searches";
const TASK_FILTER_KEY = "clockit_task_filters";

interface RecentUser { accountId: string; displayName: string; }

interface Project { id: string; name: string; color: string; }

/** Names saved specifically for the task filter (independent of team search history) */
function loadTaskFilters(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TASK_FILTER_KEY) ?? "[]"); }
  catch { return []; }
}

function saveTaskFilters(names: string[]) {
  localStorage.setItem(TASK_FILTER_KEY, JSON.stringify(names));
}

function loadTeamSearchNames(): string[] {
  try {
    const recent: RecentUser[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return recent.map((u) => u.displayName).filter(Boolean);
  } catch { return []; }
}

/** Merge new names from team recent searches into task filters (one-way sync, no deletions back) */
function syncFromTeamSearches(): string[] {
  const teamNames = loadTeamSearchNames();
  const existing = loadTaskFilters();
  const merged = [...existing];
  for (const name of teamNames) {
    if (!merged.includes(name)) merged.push(name);
  }
  saveTaskFilters(merged);
  return merged;
}

const STATUS_STYLES: Record<string, string> = {
  "todo": "tag-neutral",
  "in-progress": "tag-progress",
  "in-review": "tag-review",
  "done": "tag-done",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "tag-blocked",
  medium: "tag-review",
  low: "tag-neutral",
};

type FilterStatus = TaskStatus | "all";
type FilterPriority = TaskPriority | "all";

function newChecklistId() {
  return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Stable, human-readable key used for timer sessions — first 60 chars of task text */
function taskTimerKey(task: MeetingTask) {
  return task.text.slice(0, 60).trim();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskFilterNames, setTaskFilterNames] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  async function loadTasks() {
    setLoading(true);
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }

  function removeFilterName(name: string) {
    const updated = taskFilterNames.filter((n) => n !== name);
    saveTaskFilters(updated);
    setTaskFilterNames(updated);
    if (filterAssignee === name) setFilterAssignee("all");
  }

  function addFilterName(name: string) {
    if (taskFilterNames.includes(name)) return;
    const updated = [...taskFilterNames, name];
    saveTaskFilters(updated);
    setTaskFilterNames(updated);
  }

  useEffect(() => {
    loadTasks();
    const synced = syncFromTeamSearches();
    setTaskFilterNames(synced);
    setTeamNames(loadTeamSearchNames());
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? [])).catch(() => {});
  }, []);

  async function patch(id: string, update: Partial<MeetingTask>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const data = await res.json();
    setTasks(data.tasks ?? []);
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    const data = await res.json();
    setTasks(data.tasks ?? []);
    if (expandedId === id) setExpandedId(null);
  }

  async function clearAll() {
    if (!confirm("Clear all meeting tasks? This cannot be undone.")) return;
    await fetch("/api/tasks", { method: "DELETE" });
    setTasks([]);
  }


  // ── Filtered ────────────────────────────────────────────────────────────────
  // A task belongs to a person if their name matches the assignee field or appears in the task text
  const taskBelongsTo = (t: MeetingTask, name: string) => {
    const n = name.toLowerCase();
    if (t.assignee?.toLowerCase().includes(n)) return true;
    return t.text.toLowerCase().includes(n);
  };

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterSource !== "all" && t.source !== filterSource) return false;
    if (filterAssignee !== "all" && !taskBelongsTo(t, filterAssignee)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches =
        t.text.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q) ||
        (t.assignee ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const allSources = Array.from(new Set(tasks.map((t) => t.source)));

  const sources = Array.from(new Set(filtered.map((t) => t.source)));

  const todoCount       = tasks.filter((t) => t.status === "todo").length;
  const inProgressCount = tasks.filter((t) => t.status === "in-progress").length;
  const doneCount       = tasks.filter((t) => t.status === "done").length;
  const highCount       = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" />tasks</p>
          <h1 className="headline mt-1">Meeting Tasks</h1>
          <p className="text-body-sm text-charcoal/60 mt-1">Tasks extracted from meeting transcripts</p>
        </div>
        {tasks.length > 0 && (
          <button onClick={clearAll} className="rounded-button border border-charcoal/20 text-charcoal/50 text-[13px] font-medium px-4 py-2 hover:border-rose hover:text-charcoal transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Stat pills */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatPill label="To Do" count={todoCount} color="neutral" onClick={() => setFilterStatus(filterStatus === "todo" ? "all" : "todo")} active={filterStatus === "todo"} />
          <StatPill label="In Progress" count={inProgressCount} color="progress" onClick={() => setFilterStatus(filterStatus === "in-progress" ? "all" : "in-progress")} active={filterStatus === "in-progress"} />
          <StatPill label="Done" count={doneCount} color="done" onClick={() => setFilterStatus(filterStatus === "done" ? "all" : "done")} active={filterStatus === "done"} />
          {highCount > 0 && <StatPill label="High Priority" count={highCount} color="blocked" onClick={() => setFilterPriority(filterPriority === "high" ? "all" : "high")} active={filterPriority === "high"} />}
        </div>
      )}

      {/* Filters */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-field w-56" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="input-field text-charcoal/70">
            <option value="all">All statuses</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as FilterPriority)}
            className="input-field text-charcoal/70">
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
            className="input-field text-charcoal/70 max-w-[200px] truncate">
            <option value="all">All meetings</option>
            {allSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {teamNames.length > 0 && (
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="input-field text-charcoal/70"
            >
              <option value="all">All assignees</option>
              {teamNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          {/* Name chips with × to remove */}
          {taskFilterNames.map((name) => (
            <span
              key={name}
              className={`filter-pill cursor-pointer ${filterAssignee === name ? "active" : ""}`}
              onClick={() => setFilterAssignee(filterAssignee === name ? "all" : name)}
            >
              {name}
              <button
                onClick={(e) => { e.stopPropagation(); removeFilterName(name); }}
                title="Remove from filter"
                className={`w-4 h-4 rounded-pill flex items-center justify-center transition-colors ${
                  filterAssignee === name ? "hover:bg-white/20 text-white/80 hover:text-white" : "text-charcoal/30 hover:text-charcoal hover:bg-charcoal/10"
                }`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {(filterStatus !== "all" || filterPriority !== "all" || filterSource !== "all" || filterAssignee !== "all" || search) && (
            <button
              onClick={() => { setFilterStatus("all"); setFilterPriority("all"); setFilterSource("all"); setFilterAssignee("all"); setSearch(""); }}
              className="text-[13px] text-teal-pine hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-16 bg-mint rounded-card animate-pulse" />)}
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="card-white p-16 text-center">
          <p className="text-charcoal/60 font-medium">No meeting tasks yet</p>
          <p className="text-charcoal/40 text-[14px] mt-1">
            Go to <a href="/meetings" className="text-teal-pine hover:underline">Meetings</a>, paste a transcript and summarise to extract tasks.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {sources.map((source) => {
            const sourceTasks = filtered.filter((t) => t.source === source);
            return (
              <div key={source} className="card-white !p-0 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-mint flex items-center gap-2">
                  <span className="eyebrow text-[11px]"><span className="eyebrow-dot" />{source}</span>
                  <span className="text-[12px] text-charcoal/40">{sourceTasks.length} task{sourceTasks.length !== 1 ? "s" : ""}</span>
                </div>

                <ul className="divide-y divide-mint">
                  {sourceTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      expanded={expandedId === task.id}
                      onToggleExpand={() => setExpandedId(expandedId === task.id ? null : task.id)}
                      onPatch={(update) => patch(task.id, update)}
                      onDelete={() => deleteTask(task.id)}
                      projects={projects}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tasks.length > 0 && filtered.length === 0 && (
        <div className="card-white p-10 text-center">
          <p className="text-charcoal/40 text-[14px]">No tasks match your filters.</p>
        </div>
      )}
    </div>
  );
}

// ── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  expanded,
  onToggleExpand,
  onPatch,
  onDelete,
  projects,
}: {
  task: MeetingTask;
  expanded: boolean;
  onToggleExpand: () => void;
  onPatch: (update: Partial<MeetingTask>) => void;
  onDelete: () => void;
  projects: Project[];
}) {
  const { getTicketLoggedSeconds } = useTimer();
  const loggedSeconds = getTicketLoggedSeconds(taskTimerKey(task));
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditText(task.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) onPatch({ text: trimmed });
    setEditing(false);
  }

  function cancelEdit() {
    setEditText(task.text);
    setEditing(false);
  }

  return (
    <>
      {/* Compact row */}
      <li className="px-5 py-3.5 group">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => onPatch({ status: task.status === "done" ? "todo" : "done" })}
            className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
              task.status === "done" ? "bg-teal-deep border-teal-deep" : "border-charcoal/25 hover:border-teal-deep"
            }`}
          >
            {task.status === "done" && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Text + meta */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="w-full text-[14px] text-charcoal border-b border-teal-deep bg-transparent focus:outline-none pb-0.5"
              />
            ) : (
              <p
                onClick={startEdit}
                title="Click to edit"
                className={`text-[14px] cursor-text ${task.status === "done" ? "line-through text-charcoal/40" : "text-charcoal hover:text-teal-pine"}`}
              >
                {task.text}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={PRIORITY_STYLES[task.priority]}>
                {task.priority}
              </span>
              <span className={STATUS_STYLES[task.status] ?? STATUS_STYLES["todo"]}>
                {task.status === "in-progress" ? "In Progress" : task.status === "in-review" ? "In Review" : task.status === "todo" ? "To Do" : "Done"}
              </span>
              {loggedSeconds > 0 && (
                <span className="tag-progress">
                  {formatDurationShort(loggedSeconds)} logged
                </span>
              )}
              {task.assignee && (
                <span className="tag-neutral">
                  {task.assignee}
                </span>
              )}
              {task.checklist && task.checklist.length > 0 && (
                <span className="text-[11px] text-charcoal/40">
                  {task.checklist.filter(c => c.done).length}/{task.checklist.length} subtasks
                </span>
              )}
              {task.projectId && (() => {
                const proj = projects.find(p => p.id === task.projectId);
                return proj ? (
                  <span className="inline-flex items-center gap-1 rounded-tag px-2.5 py-1 text-[12px] font-medium" style={{ backgroundColor: proj.color + "22", color: proj.color }}>
                    <span className="w-1.5 h-1.5 rounded-pill shrink-0" style={{ backgroundColor: proj.color }} />
                    {proj.name}
                  </span>
                ) : null;
              })()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <TimerButton ticketKey={taskTimerKey(task)} ticketSummary={task.text} />

            <button
              onClick={onToggleExpand}
              title={expanded ? "Collapse" : "Details & comments"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-tag text-[12px] font-medium transition-colors ${
                expanded
                  ? "bg-teal-deep text-white"
                  : "bg-mint text-charcoal/60 hover:bg-mint-mist hover:text-teal-pine"
              }`}
            >
              {expanded ? "Close" : "Comment"}
            </button>

            <button onClick={onDelete} className="text-charcoal/15 hover:text-[#b3492f] opacity-0 group-hover:opacity-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </li>

      {/* Detail panel */}
      {expanded && (
        <li className="bg-blush/50 border-t border-mint px-5 py-5">
          <TaskDetailPanel task={task} onPatch={onPatch} projects={projects} />
        </li>
      )}
    </>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  createdAt: number;
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function TaskDetailPanel({ task, onPatch, projects }: { task: MeetingTask; onPatch: (u: Partial<MeetingTask>) => void; projects: Project[] }) {
  const [description, setDescription] = useState(task.description ?? "");
  const [newItem, setNewItem] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);
  const checklist = task.checklist ?? [];

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/comments`)
      .then(r => r.json())
      .then(d => { setComments(d.comments ?? []); setCommentsLoaded(true); })
      .catch(() => setCommentsLoaded(true));
  }, [task.id]);

  async function addComment() {
    if (!newComment.trim()) return;
    setSavingComment(true);
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment.trim() }),
    });
    const data = await res.json();
    if (data.comment) {
      setComments(prev => [...prev, data.comment]);
      setNewComment("");
    }
    setSavingComment(false);
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/tasks/${task.id}/comments/${commentId}`, { method: "DELETE" });
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  function fmtCommentDate(ts: number) {
    return new Date(ts).toLocaleString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  const { activeTimer, elapsed, startTimer, stopTimer, getTicketLoggedSeconds } = useTimer();
  const timerKey = taskTimerKey(task);
  const isActive = activeTimer?.ticketKey === timerKey;
  const loggedSeconds = getTicketLoggedSeconds(timerKey);

  function saveDescription() {
    onPatch({ description });
  }

  function toggleChecklist(id: string) {
    const updated = checklist.map(c => c.id === id ? { ...c, done: !c.done } : c);
    onPatch({ checklist: updated });
  }

  function addChecklistItem() {
    if (!newItem.trim()) return;
    const updated = [...checklist, { id: newChecklistId(), text: newItem.trim(), done: false }];
    onPatch({ checklist: updated });
    setNewItem("");
    newItemRef.current?.focus();
  }

  function deleteChecklistItem(id: string) {
    onPatch({ checklist: checklist.filter(c => c.id !== id) });
  }

  const doneItems = checklist.filter(c => c.done).length;

  return (
    <div className="space-y-5">
      {/* Status + Priority + Project row */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-charcoal/40 uppercase tracking-eyebrow mb-1.5">Status</label>
          <select
            value={task.status}
            onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}
            className={`border-0 cursor-pointer ${STATUS_STYLES[task.status] ?? STATUS_STYLES["todo"]}`}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="in-review">In Review</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-charcoal/40 uppercase tracking-eyebrow mb-1.5">Priority</label>
          <select
            value={task.priority}
            onChange={(e) => onPatch({ priority: e.target.value as TaskPriority })}
            className={`border-0 cursor-pointer ${PRIORITY_STYLES[task.priority]}`}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        {projects.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold text-charcoal/40 uppercase tracking-eyebrow mb-1.5">Project</label>
            <div className="relative flex items-center gap-1.5">
              {task.projectId && (() => {
                const proj = projects.find(p => p.id === task.projectId);
                return proj ? <span className="w-2.5 h-2.5 rounded-pill shrink-0" style={{ backgroundColor: proj.color }} /> : null;
              })()}
              <select
                value={task.projectId ?? ""}
                onChange={(e) => onPatch({ projectId: e.target.value || null })}
                className="input-field !py-1.5 text-[13px] font-medium"
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Description */}
        <div>
          <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-eyebrow mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Add more context, acceptance criteria, or notes..."
            rows={5}
            className="input-field w-full resize-none placeholder:text-charcoal/25"
          />
        </div>

        {/* Checklist */}
        <div>
          <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-eyebrow mb-2">
            Subtasks {checklist.length > 0 && <span className="normal-case font-normal text-charcoal/40 ml-1">{doneItems}/{checklist.length} done</span>}
          </label>
          <ul className="space-y-1.5 mb-2">
            {checklist.map((item) => (
              <li key={item.id} className="check-item group/cl">
                <button
                  onClick={() => toggleChecklist(item.id)}
                  className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                    item.done ? "bg-teal-deep border-teal-deep" : "border-charcoal/25 hover:border-teal-deep"
                  }`}
                >
                  {item.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`text-[14px] flex-1 ${item.done ? "line-through text-charcoal/40" : "text-charcoal"}`}>{item.text}</span>
                <button
                  onClick={() => deleteChecklistItem(item.id)}
                  className="opacity-0 group-hover/cl:opacity-100 text-charcoal/25 hover:text-[#b3492f] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              ref={newItemRef}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(); }}
              placeholder="Add subtask..."
              className="input-field flex-1 !py-1.5"
            />
            <button
              onClick={addChecklistItem}
              disabled={!newItem.trim()}
              className="btn-primary-sm"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Timer section */}
      <div className="card-white flex items-center justify-between gap-4 !p-4">
        <div>
          <p className="eyebrow text-[11px] mb-1"><span className="eyebrow-dot" />Time Tracker</p>
          {isActive ? (
            <p className="text-[24px] font-semibold text-teal-deep tabular-nums">
              {formatDurationShort(elapsed)}
            </p>
          ) : loggedSeconds > 0 ? (
            <p className="text-[14px] font-semibold text-charcoal">
              {formatDurationShort(loggedSeconds)} <span className="text-charcoal/40 font-normal">logged</span>
            </p>
          ) : (
            <p className="text-[14px] text-charcoal/40">No time logged yet</p>
          )}
        </div>
        <button
          onClick={() => isActive ? stopTimer(false) : startTimer(timerKey, task.text)}
          className={isActive ? "btn-ghost-sm" : "btn-primary-sm"}
        >
          {isActive ? "Stop Timer" : "Start Timer"}
        </button>
      </div>

      {/* Comments section */}
      <div>
        <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-eyebrow mb-3">
          Comments {commentsLoaded && comments.length > 0 && <span className="normal-case font-normal text-charcoal/40 ml-1">{comments.length}</span>}
        </label>

        {!commentsLoaded && (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-mint rounded-card animate-pulse" />)}
          </div>
        )}

        {commentsLoaded && comments.length > 0 && (
          <ul className="space-y-2 mb-3">
            {comments.map(c => (
              <li key={c.id} className="card-white !p-3 flex items-start gap-3 group/cmt">
                <div className="w-7 h-7 rounded-pill bg-mint flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[12px] font-semibold text-teal-pine">{c.body.trim().charAt(0).toUpperCase() || "?"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-charcoal leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  <p className="text-[11px] text-charcoal/40 mt-1">{fmtCommentDate(c.createdAt)}</p>
                </div>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="opacity-0 group-hover/cmt:opacity-100 text-charcoal/25 hover:text-[#b3492f] transition-all shrink-0 mt-0.5"
                  title="Delete comment"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {commentsLoaded && comments.length === 0 && (
          <p className="text-[13px] text-charcoal/40 mb-3">No comments yet.</p>
        )}

        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }}
            placeholder="Add a comment… (Ctrl+Enter to submit)"
            rows={2}
            className="input-field flex-1 resize-none placeholder:text-charcoal/25"
          />
          <button
            onClick={addComment}
            disabled={!newComment.trim() || savingComment}
            className="btn-primary-sm self-end"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ label, count, color, onClick, active }: { label: string; count: number; color: string; onClick: () => void; active: boolean }) {
  const colors: Record<string, string> = {
    neutral: active ? "bg-charcoal text-white" : "bg-charcoal/10 text-charcoal/70 hover:bg-charcoal/20",
    progress: active ? "bg-navy text-white" : "bg-navy/10 text-navy hover:bg-navy/20",
    done: active ? "bg-teal-deep text-white" : "bg-teal-sage/20 text-teal-pine hover:bg-teal-sage/30",
    blocked: active ? "bg-[#b3492f] text-white" : "bg-[#e07a5f]/20 text-[#b3492f] hover:bg-[#e07a5f]/30",
  };
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-tag text-[13px] font-semibold transition-all ${colors[color] ?? colors.neutral}`}>
      {label} <span className="ml-1 opacity-75">{count}</span>
    </button>
  );
}
