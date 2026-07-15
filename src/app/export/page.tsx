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
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-mint sticky top-0 z-10">
        <div className="px-6 py-5">
          <p className="eyebrow"><span className="eyebrow-dot" />Export</p>
          <h1 className="headline mt-1">Export data</h1>
          <p className="text-[14px] text-charcoal/60 mt-1">Download ticket and project data as CSV</p>
        </div>
      </header>

      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        {/* Project Export card */}
        {projects.length > 0 && (
          <div className="card-white space-y-5">
            <div>
              <h2 className="text-[16px] font-medium text-charcoal mb-1">Project Export</h2>
              <p className="text-[13px] text-charcoal/50">Download all tasks and time logs for a project as CSV.</p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-charcoal/70 mb-2">Select Project</label>
              <div className="flex items-center gap-3">
                {selectedProjectId && (() => {
                  const proj = projects.find(p => p.id === selectedProjectId);
                  return proj ? <span className="w-3 h-3 rounded-pill shrink-0" style={{ backgroundColor: proj.color }} /> : null;
                })()}
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="input-field flex-1"
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
                <div className="card-mint !p-4 text-[13px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-charcoal/50">Project</span>
                    <span className="font-medium text-charcoal flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-pill" style={{ backgroundColor: proj.color }} />
                      {proj.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-charcoal/50">Contents</span>
                    <span className="font-medium text-charcoal">Tasks + Time Logs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-charcoal/50">Format</span>
                    <span className="font-medium text-charcoal">CSV (UTF-8)</span>
                  </div>
                </div>
              ) : null;
            })()}

            {projectExportError && (
              <div className="bg-[#e07a5f]/10 border border-[#e07a5f]/40 rounded-card px-3 py-2 text-[13px] text-[#b3492f]">{projectExportError}</div>
            )}
            {projectExportMsg && (
              <div className="bg-teal-sage/10 border border-teal-sage/40 rounded-card px-3 py-2 text-[13px] text-teal-pine flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {projectExportMsg}
              </div>
            )}

            <button
              onClick={handleProjectExport}
              disabled={projectExportLoading || !selectedProjectId}
              className="btn-primary w-full"
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
                "Download Project CSV"
              )}
            </button>
          </div>
        )}

        {/* Jira Export card */}
        <div className="card-white space-y-6">
          <div>
            <h2 className="text-[16px] font-medium text-charcoal mb-1">Export Configuration</h2>
            <p className="text-[13px] text-charcoal/50">
              Select a user and time period, then download the CSV file.
            </p>
          </div>

          {/* User selection */}
          <div>
            <label className="block text-[13px] font-medium text-charcoal/70 mb-2">User</label>
            <UserSearch onSelect={handleUserSelect} selectedUser={selectedUser} />
            {!selectedUser?.accountId && currentUser && (
              <p className="text-[13px] text-charcoal/50 mt-1.5">
                Defaults to your account: <span className="font-medium text-charcoal/70">{currentUser.displayName}</span>
              </p>
            )}
          </div>

          {/* Month picker */}
          <div>
            <label className="block text-[13px] font-medium text-charcoal/70 mb-2">Period</label>
            <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          </div>

          {/* Preview */}
          <div className="card-mint !p-4 text-[14px] text-charcoal/70">
            <p className="font-medium text-charcoal mb-1.5">Export preview</p>
            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-charcoal/50">User</span>
                <span className="font-medium">
                  {targetUser?.displayName ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/50">Period</span>
                <span className="font-medium">
                  {new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/50">Format</span>
                <span className="font-medium">CSV (UTF-8)</span>
              </div>
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-[#e07a5f]/10 border border-[#e07a5f]/40 rounded-card px-3 py-2 text-[13px] text-[#b3492f]">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-teal-sage/10 border border-teal-sage/40 rounded-card px-3 py-2 text-[13px] text-teal-pine flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMsg}
            </div>
          )}
          {slackStatus !== "idle" && (
            <div className={`rounded-card px-3 py-2 text-[13px] flex items-center gap-2 ${
              slackStatus === "sent"   ? "bg-teal-sage/10 border border-teal-sage/40 text-teal-pine"
            : slackStatus === "error" ? "bg-[#e07a5f]/10 border border-[#e07a5f]/40 text-[#b3492f]"
            : "bg-mint border border-mint-mist text-navy"}`}
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
            className="btn-primary w-full"
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
              "Download CSV"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
