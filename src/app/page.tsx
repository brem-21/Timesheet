"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticket, User, buildStandupSummary, getCurrentMonthYear } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import TicketTable from "@/components/TicketTable";
import StandupSummaryCard from "@/components/StandupSummary";
import StatCards from "@/components/StatCards";
import TimeLogBreakdown from "@/components/TimeLogBreakdown";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { month: initialMonth, year: initialYear } = getCurrentMonthYear();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  const [exportLoading, setExportLoading] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jira/me");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load user");
        setCurrentUser(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
        setLoading(false);
      }
    })();
  }, []);

  // Fetch tickets when user or month/year changes
  const fetchTickets = useCallback(async () => {
    if (!currentUser?.accountId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/jira/tickets?userId=${encodeURIComponent(currentUser.accountId)}&month=${month}&year=${year}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tickets");
      setTickets(data.tickets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [currentUser, month, year]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleMonthChange = (m: string, y: string) => {
    setMonth(m);
    setYear(y);
  };

  const handleExport = async () => {
    if (!currentUser) return;
    setExportLoading(true);
    try {
      const url = `/api/export?userId=${encodeURIComponent(currentUser.accountId)}&month=${month}&year=${year}&name=${encodeURIComponent(currentUser.displayName)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = currentUser.displayName.replace(/\s+/g, "_").toLowerCase();
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
    currentUser && tickets.length > 0
      ? buildStandupSummary(tickets, currentUser.displayName)
      : null;

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="bg-white border-b border-mint sticky top-0 z-10">
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1"><span className="eyebrow-dot" />Work</p>
            <h1 className="headline">Dashboard</h1>
            {currentUser && (
              <p className="text-[13px] text-charcoal/50 mt-0.5">
                Welcome back,{" "}
                <span className="font-medium text-charcoal/80">{currentUser.displayName}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <MonthPicker month={month} year={year} onChange={handleMonthChange} />

            <button
              onClick={handleExport}
              disabled={exportLoading || tickets.length === 0}
              className="btn-primary-sm"
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
          </div>
        </div>
      </header>

      <div className="px-8 py-8 space-y-8 max-w-screen-xl mx-auto">
        {/* Error state */}
        {error && (
          <div className="card-blush flex items-start gap-3">
            <svg className="w-5 h-5 text-[#b3492f] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-[14px] font-medium text-charcoal">Error loading data</p>
              <p className="text-[13px] text-charcoal/60 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => { setError(""); fetchTickets(); }}
              className="ml-auto text-charcoal/40 hover:text-charcoal shrink-0"
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
                <div key={i} className="h-24 bg-mint rounded-card" />
              ))}
            </div>
            <div className="h-48 bg-mint rounded-card" />
            <div className="h-64 bg-mint rounded-card" />
          </div>
        )}

        {!loading && currentUser && (
          <>
            {/* Stat cards */}
            <StatCards tickets={tickets} />

            {/* Time log breakdown */}
            <TimeLogBreakdown />

            {/* Standup summary */}
            {standupSummary && (
              <div>
                <p className="eyebrow mb-3"><span className="eyebrow-dot" />Standup Summary</p>
                <StandupSummaryCard summary={standupSummary} />
              </div>
            )}

            {/* Tickets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="eyebrow">
                  <span className="eyebrow-dot" />
                  Tickets — {new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", { month: "long", year: "numeric" })}
                </p>
                <span className="text-[13px] text-charcoal/40">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
              </div>
              <TicketTable tickets={tickets} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
