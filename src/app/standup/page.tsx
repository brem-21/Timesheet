"use client";

import { useState, useEffect, useCallback } from "react";
import { useTimer } from "@/components/TimerContext";
import { formatDurationShort } from "@/lib/timerStore";
import TimerButton from "@/components/TimerButton";
import { format } from "date-fns";

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  hours: number;
  url: string;
}

interface MeetingTask {
  id: string;
  text: string;
  status: "todo" | "in-progress" | "done";
  priority: "high" | "medium" | "low";
  source: string;
}

const LS_KEY = "clockit_standup_last_sent";

function statusBadge(status: string) {
  const s = status.toLowerCase();
  let cls = "bg-gray-100 text-gray-600";
  if (s.includes("progress")) cls = "bg-blue-100 text-blue-700";
  else if (s.includes("review") || s.includes("testing") || s.includes("qa")) cls = "bg-amber-100 text-amber-700";
  else if (s.includes("done") || s.includes("closed") || s.includes("resolved")) cls = "bg-green-100 text-green-700";
  else if (s.includes("todo") || s.includes("to do") || s.includes("open")) cls = "bg-purple-100 text-purple-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function priorityBadge(priority: string) {
  const p = priority.toLowerCase();
  let cls = "bg-gray-100 text-gray-500";
  if (p === "high" || p === "highest" || p === "critical") cls = "bg-red-100 text-red-600";
  else if (p === "medium") cls = "bg-orange-100 text-orange-600";
  else if (p === "low" || p === "lowest") cls = "bg-sky-100 text-sky-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {priority}
    </span>
  );
}

export default function StandupPage() {
  const [user, setUser] = useState<{ accountId: string; displayName: string } | null>(null);
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [meetingTasks, setMeetingTasks] = useState<MeetingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [slackStatus, setSlackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [slackError, setSlackError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const reminderTime = "4:00 PM";

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setLastSentAt(Number(stored));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/jira/me");
      const meData = await meRes.json();
      const { accountId, displayName } = meData;
      setUser({ accountId, displayName });

      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = String(now.getFullYear());

      const [ticketsRes, tasksRes] = await Promise.all([
        fetch(`/api/jira/tickets?userId=${accountId}&month=${month}&year=${year}`),
        fetch("/api/tasks"),
      ]);

      const ticketsData = await ticketsRes.json();
      const tasksData = await tasksRes.json();

      setTickets(Array.isArray(ticketsData) ? ticketsData : ticketsData.tickets ?? []);
      setMeetingTasks(Array.isArray(tasksData) ? tasksData : tasksData.tasks ?? []);
    } catch (err) {
      console.error("[standup] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data
  const jiraActive = tickets.filter((t) => {
    const s = t.status.toLowerCase();
    return (
      !s.includes("done") &&
      !s.includes("closed") &&
      !s.includes("resolved") &&
      !s.includes("review") &&
      !s.includes("testing")
    );
  });

  const jiraReview = tickets.filter((t) => {
    const s = t.status.toLowerCase();
    return s.includes("review") || s.includes("testing") || s.includes("qa");
  });

  const jiraDone = tickets.filter((t) => {
    const s = t.status.toLowerCase();
    return s.includes("done") || s.includes("closed") || s.includes("resolved");
  });

  const taskActive = meetingTasks.filter((t) => t.status === "todo" || t.status === "in-progress");
  const taskDone = meetingTasks.filter((t) => t.status === "done");

  async function handleSendToSlack() {
    setSlackStatus("sending");
    setSlackError(null);
    try {
      const res = await fetch("/api/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setSlackStatus("sent");
      const now = Date.now();
      localStorage.setItem(LS_KEY, String(now));
      setLastSentAt(now);
    } catch (err) {
      setSlackStatus("error");
      setSlackError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTimeout(() => setSlackStatus("idle"), 3000);
    }
  }

  const today = new Date();

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user ? (
              <>
                <span className="font-medium text-gray-700">{user.displayName}</span>
                {" · "}
              </>
            ) : null}
            {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendToSlack}
              disabled={slackStatus === "sending"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                slackStatus === "sent"
                  ? "bg-green-500 text-white"
                  : slackStatus === "error"
                  ? "bg-red-500 text-white"
                  : slackStatus === "sending"
                  ? "bg-indigo-400 text-white cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
              }`}
            >
              {slackStatus === "sending" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending…
                </>
              ) : slackStatus === "sent" ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sent!
                </>
              ) : slackStatus === "error" ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Error
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send to Slack
                </>
              )}
            </button>

            <span className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-500 shadow-sm">
              Daily {reminderTime} ⏰
            </span>
          </div>

          {slackStatus === "error" && slackError && (
            <p className="text-xs text-red-500">{slackError}</p>
          )}
          {lastSentAt && (
            <p className="text-xs text-gray-400">
              Last sent: {format(new Date(lastSentAt), "HH:mm, MMM d")}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-400">Loading tasks…</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left col — Active work */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="text-base">🔄</span>
                <h2 className="font-semibold text-gray-800">In Progress &amp; To Do</h2>
              </div>

              <div className="divide-y divide-gray-50">
                {/* Jira subsection */}
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Jira</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                      {jiraActive.length}
                    </span>
                  </div>

                  {jiraActive.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No active Jira tickets</p>
                  ) : (
                    <ul className="space-y-3">
                      {jiraActive.map((ticket) => (
                        <li key={ticket.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs font-bold text-indigo-600 shrink-0">
                                {ticket.key}
                              </span>
                              {statusBadge(ticket.status)}
                              {priorityBadge(ticket.priority)}
                            </div>
                            <p className="text-sm text-gray-700 leading-snug">{ticket.summary}</p>
                            {ticket.hours > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">{ticket.hours}h logged</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            <TimerButton ticketKey={ticket.key} ticketSummary={ticket.summary} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Meeting Tasks subsection */}
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Meeting Tasks</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                      {taskActive.length}
                    </span>
                  </div>

                  {taskActive.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No active meeting tasks</p>
                  ) : (
                    <ul className="space-y-3">
                      {taskActive.map((task) => {
                        const timerKey = task.text.slice(0, 60).trim();
                        return (
                          <li key={task.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50/40 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-semibold">
                                  {task.source}
                                </span>
                                {statusBadge(task.status)}
                              </div>
                              <p className="text-sm text-gray-700 leading-snug">{task.text}</p>
                            </div>
                            <div className="shrink-0">
                              <TimerButton ticketKey={timerKey} ticketSummary={task.text} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right col — Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Done & In Review card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="text-base">✅</span>
                <h2 className="font-semibold text-gray-800">Done &amp; In Review</h2>
              </div>

              <div className="px-6 py-4 space-y-5">
                {/* Jira done/review */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Jira</p>

                  {jiraDone.length === 0 && jiraReview.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No completed tickets yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {jiraDone.slice(0, 10).map((ticket) => (
                        <li key={ticket.id} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-gray-500">{ticket.key}</span>
                            <span className="text-xs text-gray-600 ml-1 leading-snug">{ticket.summary}</span>
                          </div>
                        </li>
                      ))}
                      {jiraDone.length > 10 && (
                        <li className="text-xs text-gray-400 pl-6">+{jiraDone.length - 10} more</li>
                      )}

                      {jiraReview.slice(0, 5).map((ticket) => (
                        <li key={ticket.id} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-gray-500">{ticket.key}</span>
                            <span className="text-xs text-gray-600 ml-1 leading-snug">{ticket.summary}</span>
                          </div>
                        </li>
                      ))}
                      {jiraReview.length > 5 && (
                        <li className="text-xs text-gray-400 pl-6">+{jiraReview.length - 5} more in review</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Meeting tasks done */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Meeting Tasks</p>

                  {taskDone.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No completed tasks</p>
                  ) : (
                    <ul className="space-y-2">
                      {taskDone.slice(0, 8).map((task) => (
                        <li key={task.id} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-600 leading-snug">{task.text}</p>
                            <span className="text-[10px] text-gray-400">{task.source}</span>
                          </div>
                        </li>
                      ))}
                      {taskDone.length > 8 && (
                        <li className="text-xs text-gray-400 pl-6">+{taskDone.length - 8} more</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">{jiraDone.length + taskDone.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Done</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">
                      {jiraDone.reduce((s, t) => s + t.hours, 0)}h
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hours Logged</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600">{jiraReview.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">In Review</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
