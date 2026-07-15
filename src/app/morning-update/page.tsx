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
  done: "bg-teal-sage/20 text-teal-pine",
  "in-progress": "bg-navy/10 text-navy",
  "in-review": "bg-rose/30 text-charcoal",
  todo: "bg-charcoal/10 text-charcoal/70",
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
      className="mt-2 border border-mint rounded-card bg-white overflow-hidden z-10"
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="input-field w-full !py-1.5"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-mint px-3">
        <button
          onClick={() => setTab("tasks")}
          className={`pb-2 px-3 text-[13px] font-semibold border-b-2 transition-colors ${
            tab === "tasks"
              ? "border-teal-deep text-teal-pine"
              : "border-transparent text-charcoal/40 hover:text-charcoal/70"
          }`}
        >
          My Tasks
          {tasks.length > 0 && (
            <span className="ml-1.5 bg-mint text-charcoal/60 rounded-pill px-1.5 py-0.5 text-[10px]">
              {tasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("jira")}
          className={`pb-2 px-3 text-[13px] font-semibold border-b-2 transition-colors ${
            tab === "jira"
              ? "border-teal-deep text-teal-pine"
              : "border-transparent text-charcoal/40 hover:text-charcoal/70"
          }`}
        >
          Jira Tickets
          {jiraTickets.length > 0 && (
            <span className="ml-1.5 bg-mint text-charcoal/60 rounded-pill px-1.5 py-0.5 text-[10px]">
              {jiraTickets.length}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="max-h-52 overflow-y-auto divide-y divide-mint">
        {!hasItems && (
          <p className="text-[13px] text-charcoal/40 text-center py-6">
            {search ? "No matches" : tab === "tasks" ? "No tasks" : "No Jira tickets"}
          </p>
        )}

        {tab === "tasks" &&
          filteredTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onAdd(t.text)}
              className="w-full text-left px-3 py-2.5 hover:bg-mint/50 transition-colors flex items-start gap-2 group"
            >
              <span className="mt-0.5 flex-1 text-[13px] text-charcoal group-hover:text-teal-pine leading-snug">
                {t.text}
              </span>
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-pill font-medium ${
                  STATUS_COLORS[t.status] ?? "bg-charcoal/10 text-charcoal/60"
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
              className="w-full text-left px-3 py-2.5 hover:bg-mint/50 transition-colors flex items-start gap-2 group"
            >
              <span className="shrink-0 font-mono text-[10px] font-semibold text-teal-pine mt-0.5 bg-mint px-1.5 py-0.5 rounded">
                {t.key}
              </span>
              <span className="flex-1 text-[13px] text-charcoal group-hover:text-teal-pine leading-snug">
                {t.summary}
              </span>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-pill bg-charcoal/10 text-charcoal/60 font-medium">
                {t.status}
              </span>
            </button>
          ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-mint flex justify-end">
        <button
          onClick={onClose}
          className="text-[13px] text-charcoal/40 hover:text-charcoal/70 transition-colors"
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
      <label className="block text-[14px] font-medium text-charcoal mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2.5 text-teal-sage text-[14px] shrink-0">•</span>
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="input-field flex-1"
            />
            <button
              onClick={() => remove(i)}
              className="mt-2 text-charcoal/30 hover:text-[#b3492f] transition-colors"
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
          className="flex items-center gap-1.5 text-[13px] text-teal-pine hover:text-teal-deep font-medium transition-colors"
        >
          + Add item
        </button>

        <button
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-1.5 text-[13px] text-charcoal/40 hover:text-teal-pine font-medium transition-colors"
        >
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
    <div className="min-h-screen bg-paper p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" />Daily Update</p>
          <h1 className="headline mt-1">Daily Update</h1>
          <p className="text-[13px] text-charcoal/50 mt-1">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="tag-neutral !text-[12px]">
            Auto-sends 8:00 AM
          </span>

          {existing?.sentAt && (
            <span className="tag-done !text-[12px]">
              Sent {format(new Date(existing.sentAt), "HH:mm")}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <svg className="w-7 h-7 animate-spin text-teal-deep" fill="none" viewBox="0 0 24 24">
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
              <div className="card-mint !py-3">
                <p className="text-[14px] font-medium text-teal-pine">Daily Update ({displayDate})</p>
                {displayProject && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {matched && <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: matched.color }} />}
                    <p className="text-[13px] text-teal-pine/80">{displayProject}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Project */}
          <div className="card-white">
            <label className="block text-[14px] font-medium text-charcoal mb-2">Project / Team</label>
            <div className="flex items-center gap-2">
              {(() => {
                const matched = project && project !== "__custom__" ? projects.find((p) => p.name === project) : null;
                return matched ? (
                  <span className="w-3 h-3 rounded-pill shrink-0" style={{ backgroundColor: matched.color }} />
                ) : null;
              })()}
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="input-field flex-1"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
                <option value="__custom__">Other (type manually)…</option>
              </select>
            </div>
            {project === "__custom__" && (
              <input
                autoFocus
                type="text"
                value={customProject}
                onChange={(e) => setCustomProject(e.target.value)}
                placeholder="e.g. Coupa Team"
                className="input-field mt-2 w-full"
              />
            )}
          </div>

          {/* What was done */}
          <div className="card-white">
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
          <div className="card-white">
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
          <div className="card-white">
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
              className={`flex-1 flex items-center justify-center gap-2 rounded-button px-4 py-3 text-[14px] font-medium transition-all border ${
                saveStatus === "saved"
                  ? "bg-teal-sage/10 border-teal-sage/40 text-teal-pine"
                  : saveStatus === "error"
                  ? "bg-[#e07a5f]/10 border-[#e07a5f]/40 text-[#b3492f]"
                  : "bg-white border-teal-pine text-teal-pine hover:bg-teal-pine hover:text-white"
              }`}
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save Draft"}
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={sendStatus === "sending"}
              className={`flex-1 flex items-center justify-center gap-2 rounded-button px-4 py-3 text-[14px] font-medium transition-all ${
                sendStatus === "sent"
                  ? "bg-teal-sage text-white"
                  : sendStatus === "error"
                  ? "bg-[#e07a5f] text-white"
                  : sendStatus === "sending"
                  ? "bg-teal-sage text-white cursor-not-allowed"
                  : "bg-teal-deep text-white hover:bg-teal-forest"
              }`}
            >
              {sendStatus === "sending" ? "Sending…" : sendStatus === "sent" ? "Sent to Slack!" : "Send to Slack Now"}
            </button>
          </div>

          {sendStatus === "error" && sendError && (
            <p className="text-[12px] text-[#b3492f] text-center">{sendError}</p>
          )}
        </div>
      )}
    </div>
  );
}
