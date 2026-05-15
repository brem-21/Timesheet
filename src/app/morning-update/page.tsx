"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";

interface DailyUpdate {
  id: string;
  dateKey: string;
  project: string;
  done: string[];
  today: string[];
  blockers: string[];
  sentAt: number | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface AppTask {
  id: string;
  text: string;
  status: string;
  priority: string;
  projectId?: string | null;
}

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-100 text-green-700",
  "in-progress": "bg-blue-100 text-blue-700",
  "in-review": "bg-purple-100 text-purple-700",
  todo: "bg-gray-100 text-gray-600",
};

function TaskPicker({
  tasks,
  jiraTickets,
  onAdd,
  onClose,
}: {
  tasks: AppTask[];
  jiraTickets: JiraTicket[];
  onAdd: (text: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"tasks" | "jira">("tasks");
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filteredTasks = tasks.filter((t) =>
    t.text.toLowerCase().includes(search.toLowerCase())
  );

  const filteredJira = jiraTickets.filter(
    (t) =>
      t.summary.toLowerCase().includes(search.toLowerCase()) ||
      t.key.toLowerCase().includes(search.toLowerCase())
  );

  const hasItems = tab === "tasks" ? filteredTasks.length > 0 : filteredJira.length > 0;

  return (
    <div
      ref={ref}
      className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden z-10"
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-3">
        <button
          onClick={() => setTab("tasks")}
          className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
            tab === "tasks"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          My Tasks
          {tasks.length > 0 && (
            <span className="ml-1.5 bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-[10px]">
              {tasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("jira")}
          className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
            tab === "jira"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Jira Tickets
          {jiraTickets.length > 0 && (
            <span className="ml-1.5 bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-[10px]">
              {jiraTickets.length}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
        {!hasItems && (
          <p className="text-xs text-gray-400 text-center py-6">
            {search ? "No matches" : tab === "tasks" ? "No tasks" : "No Jira tickets"}
          </p>
        )}

        {tab === "tasks" &&
          filteredTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onAdd(t.text)}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-start gap-2 group"
            >
              <span className="mt-0.5 flex-1 text-xs text-gray-700 group-hover:text-indigo-700 leading-snug">
                {t.text}
              </span>
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {t.status}
              </span>
            </button>
          ))}

        {tab === "jira" &&
          filteredJira.map((t) => (
            <button
              key={t.id}
              onClick={() => onAdd(`[${t.key}] ${t.summary}`)}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-start gap-2 group"
            >
              <span className="shrink-0 text-[10px] font-mono font-semibold text-indigo-500 mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded">
                {t.key}
              </span>
              <span className="flex-1 text-xs text-gray-700 group-hover:text-indigo-700 leading-snug">
                {t.summary}
              </span>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                {t.status}
              </span>
            </button>
          ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-100 flex justify-end">
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function BulletEditor({
  label,
  items,
  onChange,
  placeholder,
  tasks,
  jiraTickets,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  tasks: AppTask[];
  jiraTickets: JiraTicket[];
}) {
  const [showPicker, setShowPicker] = useState(false);

  function update(i: number, val: string) {
    const next = [...items];
    next[i] = val;
    onChange(next);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function add() {
    onChange([...items, ""]);
  }

  function addFromPicker(text: string) {
    onChange([...items.filter((s) => s.trim() !== ""), text]);
    setShowPicker(false);
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2.5 text-gray-400 text-sm shrink-0">•</span>
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            />
            <button
              onClick={() => remove(i)}
              className="mt-2 text-gray-300 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add item
        </button>

        <button
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Pick from tasks
        </button>
      </div>

      {showPicker && (
        <TaskPicker
          tasks={tasks}
          jiraTickets={jiraTickets}
          onAdd={addFromPicker}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export default function MorningUpdatePage() {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const [project, setProject] = useState("");
  const [customProject, setCustomProject] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [done, setDone] = useState<string[]>([""]);
  const [today, setToday] = useState<string[]>([""]);
  const [blockers, setBlockers] = useState<string[]>(["None."]);
  const [existing, setExisting] = useState<DailyUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [appTasks, setAppTasks] = useState<AppTask[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);

  const loadUpdate = useCallback(async () => {
    setLoading(true);
    try {
      const [updateRes, projectsRes, tasksRes, meRes] = await Promise.all([
        fetch(`/api/morning-update?date=${todayKey}`),
        fetch("/api/projects"),
        fetch("/api/tasks"),
        fetch("/api/jira/me"),
      ]);

      const [updateData, projectsData, tasksData, meData] = await Promise.all([
        updateRes.json(),
        projectsRes.json(),
        tasksRes.json(),
        meRes.json(),
      ]);

      const loadedProjects: Project[] = projectsData.projects ?? [];
      setProjects(loadedProjects);
      setAppTasks(tasksData.tasks ?? []);

      // Fetch Jira tickets for the past 30 days
      if (meData.user?.accountId) {
        try {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          const jiraRes = await fetch(
            `/api/jira/tickets?userId=${meData.user.accountId}&month=${month}&year=${year}`
          );
          if (jiraRes.ok) {
            const jiraData = await jiraRes.json();
            setJiraTickets(jiraData.tickets ?? []);
          }
        } catch {
          // Jira unavailable — silently skip
        }
      }

      if (updateData.update) {
        const u: DailyUpdate = updateData.update;
        setExisting(u);
        const savedName = u.project ?? "";
        const isKnown = loadedProjects.some((p) => p.name === savedName);
        if (isKnown || savedName === "") {
          setProject(savedName);
        } else {
          setProject("__custom__");
          setCustomProject(savedName);
        }
        setDone(u.done.length > 0 ? u.done : [""]);
        setToday(u.today.length > 0 ? u.today : [""]);
        setBlockers(u.blockers.length > 0 ? u.blockers : ["None."]);
      }
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    loadUpdate();
  }, [loadUpdate]);

  function cleanItems(items: string[]) {
    return items.map((s) => s.trim()).filter(Boolean);
  }

  async function handleSave(andSend = false) {
    const status = andSend ? setSendStatus : setSaveStatus;
    status("saving" as never);
    setSendError(null);
    try {
      const res = await fetch("/api/morning-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKey: todayKey,
          project: project === "__custom__" ? customProject.trim() : project,
          done: cleanItems(done),
          today: cleanItems(today),
          blockers: cleanItems(blockers),
          send: andSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setExisting(data.update);
      status("saved" as never);
    } catch (err) {
      status("error" as never);
      if (andSend) setSendError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTimeout(() => status("idle" as never), 3000);
    }
  }

  const dateLabel = format(new Date(), "EEEE, MMMM d, yyyy");
  const [year, month, day] = todayKey.split("-");
  const displayDate = `${day}-${month}-${year}`;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Update</h1>
          <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-500 shadow-sm">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto-sends 8:00 AM
          </span>

          {existing?.sentAt && (
            <span className="flex items-center gap-1 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs font-medium text-green-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Sent {format(new Date(existing.sentAt), "HH:mm")}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <svg className="w-7 h-7 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preview header */}
          {(() => {
            const displayProject = project === "__custom__" ? customProject : project;
            const matched = projects.find((p) => p.name === displayProject);
            return (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3">
                <p className="text-sm font-semibold text-indigo-700">Daily Update ({displayDate})</p>
                {displayProject && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {matched && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: matched.color }} />}
                    <p className="text-xs text-indigo-500">{displayProject}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Project */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Project / Team</label>
            <div className="flex items-center gap-2">
              {(() => {
                const matched = project && project !== "__custom__" ? projects.find((p) => p.name === project) : null;
                return matched ? (
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: matched.color }} />
                ) : null;
              })()}
              <div className="relative flex-1">
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white appearance-none pr-8"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  <option value="__custom__">Other (type manually)…</option>
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {project === "__custom__" && (
              <input
                autoFocus
                type="text"
                value={customProject}
                onChange={(e) => setCustomProject(e.target.value)}
                placeholder="e.g. Coupa Team"
                className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            )}
          </div>

          {/* What was done */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <BulletEditor
              label="What was done"
              items={done}
              onChange={setDone}
              placeholder="Describe what was accomplished..."
              tasks={appTasks}
              jiraTickets={jiraTickets}
            />
          </div>

          {/* What I will be doing today */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <BulletEditor
              label="What I will be doing today"
              items={today}
              onChange={setToday}
              placeholder="Describe what you plan to work on..."
              tasks={appTasks}
              jiraTickets={jiraTickets}
            />
          </div>

          {/* Blockers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <BulletEditor
              label="Blockers"
              items={blockers}
              onChange={setBlockers}
              placeholder="Describe any blockers (or type None.)"
              tasks={appTasks}
              jiraTickets={jiraTickets}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saveStatus === "saving"}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                saveStatus === "saved"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : saveStatus === "error"
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {saveStatus === "saving" ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Saving…</>
              ) : saveStatus === "saved" ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save Draft</>
              )}
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={sendStatus === "sending"}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                sendStatus === "sent"
                  ? "bg-green-500 text-white"
                  : sendStatus === "error"
                  ? "bg-red-500 text-white"
                  : sendStatus === "sending"
                  ? "bg-indigo-400 text-white cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
              }`}
            >
              {sendStatus === "sending" ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Sending…</>
              ) : sendStatus === "sent" ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Sent to Slack!</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Send to Slack Now</>
              )}
            </button>
          </div>

          {sendStatus === "error" && sendError && (
            <p className="text-xs text-red-500 text-center">{sendError}</p>
          )}
        </div>
      )}
    </div>
  );
}
