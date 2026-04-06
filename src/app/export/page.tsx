"use client";

import { useState, useEffect } from "react";
import { User, getCurrentMonthYear } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import UserSearch from "@/components/UserSearch";

interface Project { id: string; name: string; color: string; }

export default function ExportPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [slackStatus, setSlackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const { month: initialMonth, year: initialYear } = getCurrentMonthYear();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  // Project export state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectExportLoading, setProjectExportLoading] = useState(false);
  const [projectExportMsg, setProjectExportMsg] = useState("");
  const [projectExportError, setProjectExportError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jira/me");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load user");
        setCurrentUser(data.user);
      } catch {
        // Non-critical on export page
      }
    })();
    fetch("/api/projects").then(r => r.json()).then(d => setProjects(d.projects ?? [])).catch(() => {});
  }, []);

  const targetUser = selectedUser?.accountId ? selectedUser : currentUser;

  const sendExportToSlack = async (accountId: string, displayName: string) => {
    setSlackStatus("sending");
    try {
      const ticketsRes = await fetch(
        `/api/jira/tickets?userId=${encodeURIComponent(accountId)}&month=${month}&year=${year}`
      );
      const ticketsData = await ticketsRes.json();
      const tickets: Array<{ key: string; summary: string; hours: number; status: string }> = ticketsData.tickets ?? [];

      const done       = tickets.filter((t) => t.status.toLowerCase() === "done" || t.status.toLowerCase() === "closed");
      const inProgress = tickets.filter((t) => t.status.toLowerCase().includes("progress"));
      const inReview   = tickets.filter((t) => t.status.toLowerCase().includes("review"));
      const totalHours = tickets.reduce((s, t) => s + t.hours, 0);

      const periodLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", {
        month: "long", year: "numeric",
      });
      const ticketLine = (t: { key: string; summary: string; hours: number }) =>
        `• *${t.key}* — ${t.summary} _(${t.hours}h)_`;

      const lines = [
        `📤 *Export — ${displayName} — ${periodLabel}*`,
        "",
        `✅ *Done — ${done.length} ticket${done.length !== 1 ? "s" : ""}*`,
        ...(done.length > 0 ? done.map(ticketLine) : ["• None"]),
        "",
        `🔄 *In Progress — ${inProgress.length} ticket${inProgress.length !== 1 ? "s" : ""}*`,
        ...(inProgress.length > 0 ? inProgress.map(ticketLine) : ["• None"]),
      ];

      if (inReview.length > 0) {
        lines.push(
          "",
          `👀 *In Review — ${inReview.length} ticket${inReview.length !== 1 ? "s" : ""}*`,
          ...inReview.map(ticketLine)
        );
      }

      lines.push("", `⏱ *Total hours logged: ${totalHours}h*`);

      const slackRes = await fetch("/api/standup/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lines.join("\n") }),
      });
      if (!slackRes.ok) throw new Error("Slack error");
      setSlackStatus("sent");
      setTimeout(() => setSlackStatus("idle"), 5000);
    } catch {
      setSlackStatus("error");
      setTimeout(() => setSlackStatus("idle"), 5000);
    }
  };

  const handleExport = async () => {
    if (!targetUser?.accountId) return;
    setExportLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const url = `/api/export?userId=${encodeURIComponent(targetUser.accountId)}&month=${month}&year=${year}&name=${encodeURIComponent(targetUser.displayName)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = targetUser.displayName.replace(/\s+/g, "_").toLowerCase();
      link.download = `${safeName}_${year}_${month}_tickets.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setSuccessMsg(`CSV exported for ${targetUser.displayName}`);
      setTimeout(() => setSuccessMsg(""), 5000);

      // Send Slack notification after export
      sendExportToSlack(targetUser.accountId, targetUser.displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportLoading(false);
    }
  };

  const handleProjectExport = async () => {
    if (!selectedProjectId) return;
    setProjectExportLoading(true);
    setProjectExportMsg("");
    setProjectExportError("");
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/export`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const proj = projects.find(p => p.id === selectedProjectId);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${(proj?.name ?? "project").replace(/\s+/g, "_")}_export.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setProjectExportMsg(`CSV exported for ${proj?.name ?? "project"}`);
      setTimeout(() => setProjectExportMsg(""), 5000);
    } catch (err) {
      setProjectExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setProjectExportLoading(false);
    }
  };

  const handleUserSelect = (user: User) => {
    if (!user.accountId) {
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-6 py-4">
          <h1 className="text-lg font-bold text-gray-900">Export</h1>
          <p className="text-sm text-gray-500 mt-0.5">Download ticket data as CSV</p>
        </div>
      </header>

      <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Project Export card */}
        {projects.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Project Export</h2>
              <p className="text-xs text-gray-400">Download all tasks and time logs for a project as CSV.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Select Project</label>
              <div className="flex items-center gap-3">
                {selectedProjectId && (() => {
                  const proj = projects.find(p => p.id === selectedProjectId);
                  return proj ? <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }} /> : null;
                })()}
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Choose a project…</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedProjectId && (() => {
              const proj = projects.find(p => p.id === selectedProjectId);
              return proj ? (
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs border border-gray-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Project</span>
                    <span className="font-medium text-gray-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color }} />
                      {proj.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Contents</span>
                    <span className="font-medium text-gray-700">Tasks + Time Logs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Format</span>
                    <span className="font-medium text-gray-700">CSV (UTF-8)</span>
                  </div>
                </div>
              ) : null;
            })()}

            {projectExportError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{projectExportError}</div>
            )}
            {projectExportMsg && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {projectExportMsg}
              </div>
            )}

            <button
              onClick={handleProjectExport}
              disabled={projectExportLoading || !selectedProjectId}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {projectExportLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating CSV…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Project CSV
                </>
              )}
            </button>
          </div>
        )}

        {/* Jira Export card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Export Configuration</h2>
            <p className="text-xs text-gray-400">
              Select a user and time period, then download the CSV file.
            </p>
          </div>

          {/* User selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">User</label>
            <UserSearch onSelect={handleUserSelect} selectedUser={selectedUser} />
            {!selectedUser?.accountId && currentUser && (
              <p className="text-xs text-gray-400 mt-1.5">
                Defaults to your account: <span className="font-medium text-gray-600">{currentUser.displayName}</span>
              </p>
            )}
          </div>

          {/* Month picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Period</label>
            <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 border border-gray-100">
            <p className="font-medium text-gray-700 mb-1">Export preview</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">User</span>
                <span className="font-medium">
                  {targetUser?.displayName ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Period</span>
                <span className="font-medium">
                  {new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Format</span>
                <span className="font-medium">CSV (UTF-8)</span>
              </div>
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMsg}
            </div>
          )}
          {slackStatus !== "idle" && (
            <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
              slackStatus === "sent"   ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : slackStatus === "error" ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-indigo-50 border border-indigo-200 text-indigo-700"}`}
            >
              {slackStatus === "sending" ? (
                <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : slackStatus === "sent" ? (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {slackStatus === "sending" && "Sending summary to Slack..."}
              {slackStatus === "sent"    && "Summary sent to Slack!"}
              {slackStatus === "error"   && "Failed to send to Slack"}
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exportLoading || !targetUser?.accountId}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating CSV...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
