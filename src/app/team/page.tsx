"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticket, User, buildStandupSummary, getCurrentMonthYear } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import TicketTable from "@/components/TicketTable";
import StandupSummaryCard from "@/components/StandupSummary";
import StatCards from "@/components/StatCards";
import UserSearch from "@/components/UserSearch";

const RECENT_KEY = "clockit_recent_searches";
const MAX_RECENT = 5;

function loadRecentSearches(): User[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch { return []; }
}

function saveRecentSearch(user: User) {
  const existing = loadRecentSearches().filter((u) => u.accountId !== user.accountId);
  localStorage.setItem(RECENT_KEY, JSON.stringify([user, ...existing].slice(0, MAX_RECENT)));
}

function removeRecentSearch(accountId: string) {
  const updated = loadRecentSearches().filter((u) => u.accountId !== accountId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

export default function TeamPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<User[]>([]);
  const [slackStatus, setSlackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const { month: initialMonth, year: initialYear } = getCurrentMonthYear();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!selectedUser?.accountId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/jira/tickets?userId=${encodeURIComponent(selectedUser.accountId)}&month=${month}&year=${year}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tickets");
      const fetched: Ticket[] = data.tickets ?? [];
      setTickets(fetched);
      // Only save to recent searches if the user actually has tickets
      if (fetched.length > 0) {
        saveRecentSearch(selectedUser);
        setRecentSearches(loadRecentSearches());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [selectedUser, month, year]);

  useEffect(() => {
    if (selectedUser?.accountId) {
      fetchTickets();
    } else {
      setTickets([]);
    }
  }, [fetchTickets, selectedUser]);

  const handleUserSelect = (user: User) => {
    if (!user.accountId) {
      setSelectedUser(null);
      setTickets([]);
      return;
    }
    setSelectedUser(user);
  };

  const handleRemoveRecent = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    removeRecentSearch(accountId);
    setRecentSearches(loadRecentSearches());
  };

  const handleSendToSlack = async () => {
    if (!selectedUser || tickets.length === 0) return;
    setSlackStatus("sending");

    const done       = tickets.filter((t) => t.status.toLowerCase() === "done" || t.status.toLowerCase() === "closed");
    const inProgress = tickets.filter((t) => t.status.toLowerCase().includes("progress"));
    const inReview   = tickets.filter((t) => t.status.toLowerCase().includes("review"));

    const periodLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", { month: "long", year: "numeric" });
    const ticketLine = (t: { key: string; summary: string; hours: number }) => `• *${t.key}* — ${t.summary} _(${t.hours}h)_`;

    const lines = [
      `📋 *Team Update — ${selectedUser.displayName} — ${periodLabel}*`,
      "",
      `✅ *Done — ${done.length} ticket${done.length !== 1 ? "s" : ""}*`,
      ...(done.length > 0 ? done.map(ticketLine) : ["• None"]),
      "",
      `🔄 *In Progress — ${inProgress.length} ticket${inProgress.length !== 1 ? "s" : ""}*`,
      ...(inProgress.length > 0 ? inProgress.map(ticketLine) : ["• None"]),
    ];

    if (inReview.length > 0) {
      lines.push("", `👀 *In Review — ${inReview.length} ticket${inReview.length !== 1 ? "s" : ""}*`, ...inReview.map(ticketLine));
    }

    const totalHours = tickets.reduce((s, t) => s + t.hours, 0);
    lines.push("", `⏱ *Total hours logged: ${totalHours}h*`);

    try {
      const res = await fetch("/api/standup/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lines.join("\n") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Slack error");
      setSlackStatus("sent");
      setTimeout(() => setSlackStatus("idle"), 4000);
    } catch {
      setSlackStatus("error");
      setTimeout(() => setSlackStatus("idle"), 4000);
    }
  };

  const handleMonthChange = (m: string, y: string) => {
    setMonth(m);
    setYear(y);
  };

  const handleExport = async () => {
    if (!selectedUser?.accountId) return;
    setExportLoading(true);
    try {
      const url = `/api/export?userId=${encodeURIComponent(selectedUser.accountId)}&month=${month}&year=${year}&name=${encodeURIComponent(selectedUser.displayName)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = selectedUser.displayName.replace(/\s+/g, "_").toLowerCase();
      link.download = `${safeName}_${year}_${month}_tickets.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportLoading(false);
    }
  };

  const standupSummary =
    selectedUser && tickets.length > 0
      ? buildStandupSummary(tickets, selectedUser.displayName)
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Team View</h1>
            <p className="text-sm text-gray-500 mt-0.5">Browse any team member&apos;s Jira activity</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <UserSearch onSelect={handleUserSelect} selectedUser={selectedUser} />
            <MonthPicker month={month} year={year} onChange={handleMonthChange} />

            {selectedUser?.accountId && (
              <button
                onClick={handleExport}
                disabled={exportLoading || tickets.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Export CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 max-w-screen-xl mx-auto">
        {/* Empty state — no user selected */}
        {!selectedUser?.accountId && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-base font-medium text-gray-500">Search for a team member</p>
            <p className="text-sm mt-1">Use the search box above to find and select a user</p>

            {recentSearches.length > 0 && (
              <div className="mt-8 w-full max-w-md">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 text-center">Recent</p>
                <div className="flex flex-col gap-2">
                  {recentSearches.map((u) => (
                    <button
                      key={u.accountId}
                      onClick={() => handleUserSelect(u)}
                      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group text-left"
                    >
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt={u.displayName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
                          {u.displayName[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.displayName}</p>
                        <p className="text-xs text-gray-400 truncate">{u.emailAddress}</p>
                      </div>
                      <button
                        onClick={(e) => handleRemoveRecent(e, u.accountId)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0 p-1"
                        title="Remove from recent"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Error loading data</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-500 hover:text-red-700 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl" />
              ))}
            </div>
            <div className="h-48 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        )}

        {!loading && selectedUser?.accountId && (
          <>
            {/* User profile banner */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
              {selectedUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedUser.avatarUrl}
                  alt={selectedUser.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold">
                  {selectedUser.displayName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-gray-900">{selectedUser.displayName}</p>
                <p className="text-sm text-gray-500">{selectedUser.emailAddress}</p>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Viewing period</p>
                  <p className="text-sm font-medium text-gray-700">
                    {new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  onClick={handleSendToSlack}
                  disabled={slackStatus === "sending" || tickets.length === 0}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${slackStatus === "sent" ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                    : slackStatus === "error" ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                    : "bg-[#4A154B] text-white hover:bg-[#611f69]"}`}
                >
                  {slackStatus === "sending" ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : slackStatus === "sent" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : slackStatus === "error" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                    </svg>
                  )}
                  {slackStatus === "sent" ? "Sent!" : slackStatus === "error" ? "Failed" : "Send to Slack"}
                </button>
              </div>
            </div>

            {/* Stat cards */}
            <StatCards tickets={tickets} />

            {/* Standup summary */}
            {standupSummary && (
              <div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Standup Summary
                </h2>
                <StandupSummaryCard summary={standupSummary} />
              </div>
            )}

            {/* Tickets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Tickets — {new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", { month: "long", year: "numeric" })}
                </h2>
                <span className="text-xs text-gray-400">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
              </div>
              <TicketTable tickets={tickets} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
