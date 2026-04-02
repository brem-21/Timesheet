"use client";

import { useEffect, useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import DateRangeFilter, { DateRange, getPresetRange } from "@/components/DateRangeFilter";
import OverviewCharts from "@/components/OverviewCharts";
import TimeLogStackedChart from "@/components/TimeLogStackedChart";
import TicketTable from "@/components/TicketTable";
import StatCards from "@/components/StatCards";
import { Ticket } from "@/lib/utils";

interface CurrentUser {
  accountId: string;
  displayName: string;
  avatarUrl: string;
}

export default function OverviewPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(getPresetRange("this-month"));

  // Fetch current user on mount
  useEffect(() => {
    fetch("/api/jira/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setUser(data.user ?? data);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Fetch tickets whenever user or date range changes
  const fetchTickets = useCallback(async (accountId: string, dateRange: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        userId: accountId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/jira/tickets-range?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTickets(data.tickets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.accountId) {
      fetchTickets(user.accountId, range);
    }
  }, [user, range, fetchTickets]);

  function handleRangeChange(newRange: DateRange) {
    setRange(newRange);
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const totalHours = tickets.reduce((s, t) => s + t.hours, 0);
  const doneCount = tickets.filter((t) => t.status.toLowerCase() === "done").length;
  const inReviewCount = tickets.filter((t) => t.status.toLowerCase().includes("review")).length;
  const inProgressCount = tickets.filter((t) => t.status.toLowerCase().includes("progress")).length;

  // Export CSV
  function handleExport() {
    if (!user) return;
    const params = new URLSearchParams({
      userId: user.accountId,
      startDate: range.startDate,
      endDate: range.endDate,
      name: user.displayName,
    });
    window.open(`/api/export/range?${params}`, "_blank");
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user ? `${user.displayName} · ` : ""}
            {range.label}
            {range.startDate !== range.endDate
              ? ` (${range.startDate} → ${range.endDate})`
              : ""}
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={!user || loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <DateRangeFilter onChange={handleRangeChange} defaultPreset="this-month" />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stat Cards */}
          <StatCards
            totalTickets={tickets.length}
            totalHours={totalHours}
            doneCount={doneCount}
            inReviewCount={inReviewCount}
            inProgressCount={inProgressCount}
          />

          {/* Time log stacked chart */}
          <TimeLogStackedChart startDate={range.startDate} endDate={range.endDate} />

          {/* Charts */}
          {tickets.length > 0 ? (
            <>
              <OverviewCharts tickets={tickets} />

              {/* Summary row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryBadge
                  label="Avg hours/ticket"
                  value={tickets.length > 0 ? `${Math.round(totalHours / tickets.length)}h` : "—"}
                  icon="⏱"
                  color="indigo"
                />
                <SummaryBadge
                  label="Completion rate"
                  value={tickets.length > 0 ? `${Math.round((doneCount / tickets.length) * 100)}%` : "—"}
                  icon="✅"
                  color="emerald"
                />
                <SummaryBadge
                  label="In-flight tickets"
                  value={String(inProgressCount + inReviewCount)}
                  icon="🔄"
                  color="amber"
                />
              </div>

              {/* Ticket Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">
                    All Tickets
                    <span className="ml-2 text-xs font-normal text-gray-400">({tickets.length})</span>
                  </h2>
                </div>
                <TicketTable tickets={tickets} />
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 font-medium">No tickets found for this period</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting the date range</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: "indigo" | "emerald" | "amber";
}) {
  const colorMap = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 ${colorMap[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
