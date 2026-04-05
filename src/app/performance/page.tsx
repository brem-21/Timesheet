"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  startOfYear,
  format,
} from "date-fns";
import { useTimer } from "@/components/TimerContext";
import type { Milestone, MilestoneStatus, MilestoneCategory } from "@/lib/milestoneStore";
import type { ProfDevEntry, ProfDevType } from "@/lib/profDevStore";
import type { SavedPerformance } from "@/lib/performanceStore";

// ─── Insights Renderer ────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, string> = {
  "Time Management": "⏱",
  "Delivery & Efficiency": "🚀",
  "Leadership & Collaboration": "🤝",
  "Communication & Influence": "💬",
  "Professional Growth": "📈",
  "Key Recommendations": "✅",
};

const SECTION_COLORS: Record<string, string> = {
  "Time Management": "border-indigo-200 bg-indigo-50/60",
  "Delivery & Efficiency": "border-emerald-200 bg-emerald-50/60",
  "Leadership & Collaboration": "border-violet-200 bg-violet-50/60",
  "Communication & Influence": "border-blue-200 bg-blue-50/60",
  "Professional Growth": "border-amber-200 bg-amber-50/60",
  "Key Recommendations": "border-rose-200 bg-rose-50/60",
};

const TITLE_COLORS: Record<string, string> = {
  "Time Management": "text-indigo-700",
  "Delivery & Efficiency": "text-emerald-700",
  "Leadership & Collaboration": "text-violet-700",
  "Communication & Influence": "text-blue-700",
  "Professional Growth": "text-amber-700",
  "Key Recommendations": "text-rose-700",
};

function InsightsRenderer({ text }: { text: string }) {
  // Split on ## headings
  const rawSections = text.split(/\n(?=##\s)/);
  const sections = rawSections
    .map((block) => {
      const match = block.match(/^##\s+(.+)\n?([\s\S]*)/);
      if (!match) return null;
      const title = match[1].trim();
      const body = match[2].trim();
      return { title, body };
    })
    .filter(Boolean) as { title: string; body: string }[];

  // If no ## sections found, render plain
  if (sections.length === 0) {
    return <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{text}</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map(({ title, body }) => {
        const icon = SECTION_ICONS[title] ?? "•";
        const colorClass = SECTION_COLORS[title] ?? "border-gray-200 bg-gray-50";
        const titleColor = TITLE_COLORS[title] ?? "text-gray-700";

        // For Key Recommendations, try to render numbered list items
        const isRecs = title.toLowerCase().includes("recommendation");
        const recItems = isRecs
          ? body.split(/\n/).filter((l) => /^\d+[\.\)]/.test(l.trim()))
          : [];
        const hasRecItems = recItems.length > 0;

        return (
          <div key={title} className={`rounded-xl border p-4 ${colorClass}`}>
            <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${titleColor}`}>
              <span>{icon}</span>
              {title}
            </h3>
            {hasRecItems ? (
              <ol className="space-y-1.5">
                {recItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 bg-rose-100 text-rose-700`}>
                      {i + 1}
                    </span>
                    <span>{item.replace(/^\d+[\.\)]\s*/, "")}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{body}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isJiraKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]+-\d+$/.test(key);
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Date Range Presets ───────────────────────────────────────────────────────

const PRESETS = [
  "This Week",
  "Last Week",
  "This Month",
  "Last Month",
  "This Quarter",
  "Last Quarter",
  "This Year",
] as const;

type PresetLabel = (typeof PRESETS)[number];

function computeRange(label: PresetLabel): { startDate: string; endDate: string } {
  const today = new Date();

  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  switch (label) {
    case "This Week": {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case "Last Week": {
      const lastWeekDay = subWeeks(today, 1);
      const start = startOfWeek(lastWeekDay, { weekStartsOn: 1 });
      const end = endOfWeek(lastWeekDay, { weekStartsOn: 1 });
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case "This Month": {
      const start = startOfMonth(today);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case "Last Month": {
      const lastMonth = subMonths(today, 1);
      return {
        startDate: fmt(startOfMonth(lastMonth)),
        endDate: fmt(endOfMonth(lastMonth)),
      };
    }
    case "This Quarter": {
      const start = startOfQuarter(today);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case "Last Quarter": {
      const lastQ = subQuarters(today, 1);
      return {
        startDate: fmt(startOfQuarter(lastQ)),
        endDate: fmt(endOfQuarter(lastQ)),
      };
    }
    case "This Year": {
      const start = startOfYear(today);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerformanceStats {
  jiraTotal: number;
  jiraDone: number;
  jiraInProgress: number;
  jiraInReview: number;
  jiraTodo: number;
  jiraHours: number;
  jiraDoneHours: number;
  completionRate: number;
  meetingTasksTotal: number;
  meetingTasksDone: number;
  meetingTasksActive: number;
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesInProgress: number;
  profDevCount: number;
  profDevHours: number;
  meetingsCount: number;
  jiraLoggedSeconds: number;
  meetingLoggedSeconds: number;
  sessionCount: number;
  rangeLabel: string;
}

// ─── Color maps ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  technical: "bg-indigo-100 text-indigo-700",
  leadership: "bg-emerald-100 text-emerald-700",
  delivery: "bg-amber-100 text-amber-700",
  growth: "bg-violet-100 text-violet-700",
  communication: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-600",
};

const PROFDEV_TYPE_COLORS: Record<ProfDevType, string> = {
  course: "bg-blue-100 text-blue-700",
  certification: "bg-emerald-100 text-emerald-700",
  book: "bg-violet-100 text-violet-700",
  workshop: "bg-amber-100 text-amber-700",
  conference: "bg-indigo-100 text-indigo-700",
  mentoring: "bg-rose-100 text-rose-700",
  presentation: "bg-orange-100 text-orange-700",
  shadowing: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  "in-progress": "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: "emerald" | "indigo" | "violet" | "amber" | "blue" | "rose";
  icon: React.ReactNode;
}

const COLOR_MAP = {
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", value: "text-emerald-700" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", value: "text-indigo-700" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600", value: "text-violet-700" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", value: "text-amber-700" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", value: "text-blue-700" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600", value: "text-rose-700" },
};

function KpiCard({ title, value, subtitle, color, icon }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-500">{title}</p>
        <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center`}>
          <span className={`w-4 h-4 ${c.icon}`}>{icon}</span>
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

// ─── Growth Summary Panel ─────────────────────────────────────────────────────

interface TopicGrowthStat {
  topicId: string;
  label: string;
  attemptCount: number;
  avgScore: number;
  bestScore: number;
  latestScore: number | null;
  lastAttempt: string | null;
  uniqueActiveDays: number;
  trend: "improving" | "declining" | "stable" | "insufficient_data";
}

interface GrowthStats {
  topicStats: TopicGrowthStat[];
  overallAvgScore: number;
  totalAttempts: number;
  topicsAttempted: number;
  topicsTotal: number;
  mostEngagedTopic: string | null;
  weakestTopic: string | null;
  strongestTopic: string | null;
  quizCompletionRate: number;
  growthPageVisits: number;
}

function GrowthTrendIcon({ trend }: { trend: TopicGrowthStat["trend"] }) {
  if (trend === "improving") return <span className="text-emerald-500 text-xs font-bold">↑</span>;
  if (trend === "declining") return <span className="text-red-400 text-xs font-bold">↓</span>;
  if (trend === "stable") return <span className="text-amber-400 text-xs font-bold">→</span>;
  return <span className="text-gray-300 text-xs">—</span>;
}

function GrowthScoreBadge({ score }: { score: number }) {
  const cls = score >= 80 ? "bg-emerald-100 text-emerald-700"
    : score >= 60 ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-600";
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls}`}>{score}%</span>;
}

function GrowthSummaryPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/growth/stats?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.stats) setGrowthStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-3 text-gray-400 text-sm">
        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading growth data…
      </div>
    );
  }

  if (!growthStats || growthStats.totalAttempts === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Professional Growth — Quiz Analytics</h2>
          <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">No quiz data yet</span>
        </div>
        <p className="text-sm text-gray-400">
          Complete quizzes on the{" "}
          <a href="/growth" className="text-indigo-500 hover:underline">Professional Growth page</a>{" "}
          to see analytics here.
        </p>
      </div>
    );
  }

  const attempted = growthStats.topicStats.filter((t) => t.attemptCount > 0);
  const showTopics = expanded ? attempted : attempted.slice(0, 6);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Professional Growth — Quiz Analytics</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">📈 Growth</span>
        </div>
        <a href="/growth" className="text-xs text-indigo-500 hover:underline">Open Growth page ↗</a>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Overall Avg Score", value: `${growthStats.overallAvgScore}%`, sub: `${growthStats.totalAttempts} quiz sessions`,
            cls: growthStats.overallAvgScore >= 80 ? "text-emerald-600" : growthStats.overallAvgScore >= 60 ? "text-amber-600" : "text-red-600" },
          { label: "Topic Coverage", value: `${growthStats.topicsAttempted} / ${growthStats.topicsTotal}`,
            sub: `${growthStats.quizCompletionRate}% topics attempted`, cls: "text-indigo-600" },
          { label: "Strongest Topic", value: growthStats.strongestTopic ?? "—",
            sub: `${growthStats.topicStats.find(t => t.label === growthStats.strongestTopic)?.avgScore ?? 0}% avg`, cls: "text-emerald-600" },
          { label: "Needs Attention", value: growthStats.weakestTopic ?? "—",
            sub: `${growthStats.topicStats.find(t => t.label === growthStats.weakestTopic)?.avgScore ?? 0}% avg`, cls: "text-red-600" },
        ].map(({ label, value, sub, cls }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-sm font-bold truncate ${cls}`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Per-topic table */}
      {attempted.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Per-Topic Breakdown</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Topic</th>
                  <th className="text-center px-3 py-2 font-semibold">Sessions</th>
                  <th className="text-center px-3 py-2 font-semibold">Avg Score</th>
                  <th className="text-center px-3 py-2 font-semibold">Best</th>
                  <th className="text-center px-3 py-2 font-semibold">Latest</th>
                  <th className="text-center px-3 py-2 font-semibold">Trend</th>
                  <th className="text-right px-3 py-2 font-semibold">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {showTopics.map((t) => (
                  <tr key={t.topicId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-gray-700">{t.label}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{t.attemptCount}</td>
                    <td className="px-3 py-2 text-center"><GrowthScoreBadge score={t.avgScore} /></td>
                    <td className="px-3 py-2 text-center text-gray-500">{t.bestScore}%</td>
                    <td className="px-3 py-2 text-center">
                      {t.latestScore !== null ? <GrowthScoreBadge score={t.latestScore} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center"><GrowthTrendIcon trend={t.trend} /></td>
                    <td className="px-3 py-2 text-right text-gray-400">{t.lastAttempt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attempted.length > 6 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-indigo-500 hover:underline w-full text-center"
            >
              {expanded ? "Show less" : `Show all ${attempted.length} topics`}
            </button>
          )}
        </div>
      )}

      {/* Topics not yet attempted */}
      {growthStats.topicsAttempted < growthStats.topicsTotal && (
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-600">{growthStats.topicsTotal - growthStats.topicsAttempted} topics</span> not yet attempted —{" "}
          {growthStats.topicStats.filter(t => t.attemptCount === 0).map(t => t.label).slice(0, 5).join(", ")}
          {growthStats.topicsTotal - growthStats.topicsAttempted > 5 ? ` and ${growthStats.topicsTotal - growthStats.topicsAttempted - 5} more` : ""}
        </div>
      )}
    </div>
  );
}

// ─── Projects Summary Panel ────────────────────────────────────────────────────

interface ProjectSummaryItem {
  id: string; name: string; color: string;
  totalMinutes: number; taskCount: number; tasksDone: number;
  tasksInProgress: number; tasksTodo: number; completionRate: number; logEntries: number;
}

function fmtMinsLocal(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ProjectsSummaryPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([]);
  const [totals, setTotals] = useState<{ totalMinutes: number; taskCount: number; tasksDone: number; completionRate: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    fetch(`/api/performance/projects-summary?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.projects) { setProjects(d.projects); setTotals(d.totals ?? null); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-3 text-gray-400 text-sm">
        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading project data…
      </div>
    );
  }

  if (projects.length === 0) return null;

  const withTime = projects.filter((p) => p.totalMinutes > 0 || p.taskCount > 0);
  if (withTime.length === 0) return null;

  const maxMins = Math.max(...projects.map((p) => p.totalMinutes), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Projects — Performance Summary</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">📁 Projects</span>
        </div>
        <a href="/projects" className="text-xs text-indigo-500 hover:underline">Open Projects ↗</a>
      </div>

      {/* Totals KPI row */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Time Logged", value: fmtMinsLocal(totals.totalMinutes), cls: "text-indigo-600" },
            { label: "Total Tasks", value: String(totals.taskCount), cls: "text-gray-700" },
            { label: "Tasks Done", value: String(totals.tasksDone), cls: "text-emerald-600" },
            { label: "Overall Completion", value: `${totals.completionRate}%`, cls: totals.completionRate >= 70 ? "text-emerald-600" : totals.completionRate >= 40 ? "text-amber-600" : "text-red-500" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-sm font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-project rows */}
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm font-medium text-gray-700">{p.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="font-semibold text-indigo-600">{fmtMinsLocal(p.totalMinutes)}</span>
                <span>{p.tasksDone}/{p.taskCount} done</span>
                <span className={`font-semibold ${p.completionRate >= 70 ? "text-emerald-600" : p.completionRate >= 40 ? "text-amber-600" : "text-gray-400"}`}>{p.completionRate}%</span>
              </div>
            </div>
            {/* Time bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(p.totalMinutes / maxMins) * 100}%`, backgroundColor: p.color }}
              />
            </div>
            {/* Task mini-bars */}
            {p.taskCount > 0 && (
              <div className="flex h-1 rounded-full overflow-hidden gap-px">
                {p.tasksDone > 0 && <div className="bg-emerald-400" style={{ flex: p.tasksDone }} />}
                {p.tasksInProgress > 0 && <div className="bg-blue-400" style={{ flex: p.tasksInProgress }} />}
                {p.tasksTodo > 0 && <div className="bg-gray-200" style={{ flex: p.tasksTodo }} />}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Done</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> In Progress</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /> To Do</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const { sessions } = useTimer();

  // Range
  const [rangeLabel, setRangeLabel] = useState<PresetLabel>("This Month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Insights
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [insights, setInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Slack
  const [slackStatus, setSlackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [slackError, setSlackError] = useState<string | null>(null);
  const [lastSlackSentAt, setLastSlackSentAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem("clockit_perf_slack_sent");
    return v ? Number(v) : null;
  });

  // History
  const [history, setHistory] = useState<SavedPerformance[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msCategory, setMsCategory] = useState<MilestoneCategory>("technical");
  const [msTargetDate, setMsTargetDate] = useState("");
  const [msDescription, setMsDescription] = useState("");
  const [msStatus, setMsStatus] = useState<MilestoneStatus>("pending");
  const [msSaving, setMsSaving] = useState(false);

  // ProfDev
  const [profdev, setProfdev] = useState<ProfDevEntry[]>([]);
  const [showProfDevForm, setShowProfDevForm] = useState(false);
  const [pdTitle, setPdTitle] = useState("");
  const [pdType, setPdType] = useState<ProfDevType>("course");
  const [pdProvider, setPdProvider] = useState("");
  const [pdCompletedDate, setPdCompletedDate] = useState("");
  const [pdDurationHours, setPdDurationHours] = useState("");
  const [pdSkills, setPdSkills] = useState("");
  const [pdNotes, setPdNotes] = useState("");
  const [pdSaving, setPdSaving] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"overall" | "project">("overall");

  // Project performance
  const [perfProjects, setPerfProjects] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectPerfStats, setProjectPerfStats] = useState<Record<string, number | string> | null>(null);
  const [projectInsights, setProjectInsights] = useState<string>("");
  const [projectInsightsLoading, setProjectInsightsLoading] = useState(false);
  const [projectInsightsError, setProjectInsightsError] = useState<string | null>(null);
  const [projectTimeByDate, setProjectTimeByDate] = useState<{ date: string; minutes: number }[]>([]);
  const [projectName, setProjectName] = useState<string>("");

  // ── Initialise date range ──────────────────────────────────────────────────
  useEffect(() => {
    const range = computeRange(rangeLabel);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, [rangeLabel]);

  // ── Load milestones and profdev on mount ──────────────────────────────────
  const loadMilestones = useCallback(async () => {
    try {
      const res = await fetch("/api/milestones");
      if (res.ok) setMilestones(await res.json());
    } catch {
      // silently fail
    }
  }, []);

  const loadProfDev = useCallback(async () => {
    try {
      const res = await fetch("/api/profdev");
      if (res.ok) setProfdev(await res.json());
    } catch {
      // silently fail
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/performance/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadMilestones();
    loadProfDev();
    loadHistory();
    // Load projects for project performance view
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => { if (d.projects) setPerfProjects(d.projects); })
      .catch(() => {});
  }, [loadMilestones, loadProfDev, loadHistory]);

  // ── Generate Insights ─────────────────────────────────────────────────────
  const generateInsights = useCallback(async () => {
    if (!startDate || !endDate) return;
    setInsightsLoading(true);
    setInsightsError(null);

    try {
      // Filter sessions to date range
      const rangeStart = new Date(startDate).getTime();
      const rangeEnd = new Date(endDate + "T23:59:59").getTime();
      const rangeSessions = sessions.filter(
        (s) => s.startTime >= rangeStart && s.startTime <= rangeEnd
      );

      const jiraSeconds = rangeSessions
        .filter((s) => isJiraKey(s.ticketKey))
        .reduce((acc, s) => acc + s.duration, 0);

      const meetingSeconds = rangeSessions
        .filter((s) => !isJiraKey(s.ticketKey))
        .reduce((acc, s) => acc + s.duration, 0);

      const sessionCount = rangeSessions.length;

      const res = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          rangeLabel,
          jiraSeconds,
          meetingSeconds,
          sessionCount,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate insights");
      }

      const data = await res.json();
      setStats(data.stats);
      setInsights(data.insights);
      if (data.savedId) {
        setSavedId(data.savedId);
        setLabelDraft(`${rangeLabel} — ${format(new Date(), "MMM yyyy")}`);
        await loadHistory();
      }
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setInsightsLoading(false);
    }
  }, [startDate, endDate, rangeLabel, sessions, loadHistory]);

  // ── Send to Slack ─────────────────────────────────────────────────────────
  const sendToSlack = useCallback(async () => {
    if (!insights) return;
    setSlackStatus("sending");
    setSlackError(null);
    try {
      const res = await fetch("/api/performance/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insights, rangeLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setSlackStatus("sent");
      const now = Date.now();
      localStorage.setItem("clockit_perf_slack_sent", String(now));
      setLastSlackSentAt(now);
      setTimeout(() => setSlackStatus("idle"), 3000);
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : "Unknown error");
      setSlackStatus("error");
      setTimeout(() => setSlackStatus("idle"), 4000);
    }
  }, [insights, rangeLabel]);

  // ── Milestone CRUD ────────────────────────────────────────────────────────
  const submitMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    setMsSaving(true);
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: msTitle.trim(),
          category: msCategory,
          targetDate: msTargetDate || undefined,
          description: msDescription.trim() || undefined,
          status: msStatus,
        }),
      });
      if (res.ok) {
        setMsTitle("");
        setMsCategory("technical");
        setMsTargetDate("");
        setMsDescription("");
        setMsStatus("pending");
        setShowMilestoneForm(false);
        await loadMilestones();
      }
    } finally {
      setMsSaving(false);
    }
  };

  const cycleMilestoneStatus = async (m: Milestone) => {
    const next: MilestoneStatus =
      m.status === "pending"
        ? "in-progress"
        : m.status === "in-progress"
        ? "completed"
        : "pending";
    const patch: Partial<Milestone> = {
      status: next,
      completedAt: next === "completed" ? new Date().toISOString() : undefined,
    };
    await fetch(`/api/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadMilestones();
  };

  const deleteMilestone = async (id: string) => {
    await fetch(`/api/milestones/${id}`, { method: "DELETE" });
    await loadMilestones();
  };

  // ── ProfDev CRUD ───────────────────────────────────────────────────────────
  const submitProfDev = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdTitle.trim() || !pdCompletedDate) return;
    setPdSaving(true);
    try {
      const skills = pdSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/profdev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pdTitle.trim(),
          type: pdType,
          provider: pdProvider.trim() || undefined,
          completedDate: pdCompletedDate,
          durationHours: pdDurationHours ? Number(pdDurationHours) : undefined,
          skills,
          notes: pdNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setPdTitle("");
        setPdType("course");
        setPdProvider("");
        setPdCompletedDate("");
        setPdDurationHours("");
        setPdSkills("");
        setPdNotes("");
        setShowProfDevForm(false);
        await loadProfDev();
      }
    } finally {
      setPdSaving(false);
    }
  };

  const deleteProfDev = async (id: string) => {
    await fetch(`/api/profdev/${id}`, { method: "DELETE" });
    await loadProfDev();
  };

  // ── Generate Project Insights ─────────────────────────────────────────────
  const generateProjectInsights = useCallback(async () => {
    if (!selectedProjectId || !startDate || !endDate) return;
    setProjectInsightsLoading(true);
    setProjectInsightsError(null);
    try {
      const res = await fetch("/api/performance/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, startDate, endDate, rangeLabel }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate project insights");
      }
      const data = await res.json();
      setProjectPerfStats(data.stats);
      setProjectInsights(data.insights);
      setProjectTimeByDate(data.timeByDate ?? []);
      setProjectName(data.projectName ?? "");
    } catch (err) {
      setProjectInsightsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProjectInsightsLoading(false);
    }
  }, [selectedProjectId, startDate, endDate, rangeLabel]);

  // ── Derived: group milestones ─────────────────────────────────────────────
  const inProgressMilestones = milestones.filter((m) => m.status === "in-progress");
  const pendingMilestones = milestones.filter((m) => m.status === "pending");
  const completedMilestones = milestones.filter((m) => m.status === "completed");

  // ── ProfDev totals ────────────────────────────────────────────────────────
  const totalPdHours = profdev.reduce((s, e) => s + (e.durationHours ?? 0), 0);

  // ── Icons (inline SVG) ────────────────────────────────────────────────────
  const TickIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
  const ClockIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  const TaskIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7l2 2 4-4" />
    </svg>
  );
  const FlagIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V5l9-2 9 2v16M3 7h18M3 13h18" />
    </svg>
  );
  const BookIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
  const CalIcon = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your delivery, growth, and professional milestones
          </p>
        </div>
      </div>

      {/* ── View Mode Toggle ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["overall", "project"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {mode === "overall" ? "Overall" : "By Project"}
          </button>
        ))}
      </div>

      {/* ── Range Presets ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => setRangeLabel(preset)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              rangeLabel === preset
                ? "bg-indigo-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* ── Project Performance View ────────────────────────────────────────── */}
      {viewMode === "project" && (
        <div className="space-y-5">
          {/* Project selector */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); setProjectPerfStats(null); setProjectInsights(""); setProjectTimeByDate([]); }}
              className="text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white min-w-[200px]"
            >
              <option value="">Select a project…</option>
              {perfProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={generateProjectInsights}
              disabled={!selectedProjectId || projectInsightsLoading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {projectInsightsLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing…
                </>
              ) : (
                <>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analyse Project
                </>
              )}
            </button>
            {selectedProjectId && startDate && endDate && (
              <span className="text-sm text-gray-400">{startDate} → {endDate}</span>
            )}
          </div>

          {projectInsightsError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{projectInsightsError}</div>
          )}

          {projectPerfStats && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[
                  { title: "Time Logged", value: String(projectPerfStats.timeLogged), sub: `${projectPerfStats.logEntries} entries`, color: "indigo" as const },
                  { title: "Tasks Total", value: String(projectPerfStats.taskCount), sub: `this project`, color: "blue" as const },
                  { title: "Done", value: String(projectPerfStats.tasksDone), sub: `${projectPerfStats.completionRate}% completion`, color: "emerald" as const },
                  { title: "In Progress", value: String(projectPerfStats.tasksInProgress), sub: `active tasks`, color: "amber" as const },
                  { title: "Velocity", value: `${projectPerfStats.velocity}/wk`, sub: `tasks done per week`, color: "violet" as const },
                  { title: "Avg/Active Day", value: String(projectPerfStats.avgDailyTime), sub: `${projectPerfStats.activeDays} days with logs`, color: "rose" as const },
                ].map(({ title, value, sub, color }) => (
                  <KpiCard key={title} title={title} value={value} subtitle={sub} color={color} icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  } />
                ))}
              </div>

              {/* Task status breakdown */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Task Status — {projectName}</h3>
                <div className="space-y-3">
                  {[
                    { label: "To Do", count: Number(projectPerfStats.tasksTodo), color: "bg-gray-300", textColor: "text-gray-600" },
                    { label: "In Progress", count: Number(projectPerfStats.tasksInProgress), color: "bg-blue-400", textColor: "text-blue-600" },
                    { label: "Done", count: Number(projectPerfStats.tasksDone), color: "bg-emerald-400", textColor: "text-emerald-600" },
                  ].map(({ label, count, color, textColor }) => {
                    const total = Number(projectPerfStats.taskCount);
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{label}</span>
                          <span className={`text-xs font-semibold ${textColor}`}>{count} / {total}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color} transition-all`}
                            style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time by date chart */}
              {projectTimeByDate.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Time Logged by Date — {projectName}</h3>
                  <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
                    {projectTimeByDate.map(({ date, minutes }) => {
                      const maxM = Math.max(...projectTimeByDate.map((d) => d.minutes), 1);
                      const h = Math.floor(minutes / 60);
                      const m = minutes % 60;
                      const label = h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
                      return (
                        <div key={date} className="flex flex-col items-center gap-1 min-w-[32px] flex-1">
                          <span className="text-[9px] text-gray-400">{label}</span>
                          <div className="w-full rounded-sm"
                            style={{ height: `${(minutes / maxM) * 108}px`, backgroundColor: "#6366f1", opacity: 0.8 }} />
                          <span className="text-[8px] text-gray-400 truncate w-full text-center">{date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Project AI insights */}
          {(projectInsights || projectInsightsLoading) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Project Insights — {projectName || "..."}</h2>
                {projectInsights && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">✨ AI</span>
                )}
              </div>
              {projectInsightsLoading && (
                <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Analysing project performance…</span>
                </div>
              )}
              {!projectInsightsLoading && projectInsights && <InsightsRenderer text={projectInsights} />}
            </div>
          )}

          {!selectedProjectId && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-sm">Select a project above, then click <span className="font-semibold text-indigo-500">Analyse Project</span> to see performance metrics.</p>
            </div>
          )}
        </div>
      )}

      {viewMode === "overall" && (<>
      {/* ── Generate + Slack row ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Generate */}
        <button
          onClick={generateInsights}
          disabled={insightsLoading}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {insightsLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Insights
            </>
          )}
        </button>

        {/* Send to Slack */}
        <button
          onClick={sendToSlack}
          disabled={!insights || slackStatus === "sending"}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            slackStatus === "sent"
              ? "bg-emerald-100 text-emerald-700"
              : slackStatus === "error"
              ? "bg-red-100 text-red-700"
              : "bg-[#4A154B] text-white hover:bg-[#3d1040]"
          }`}
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
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          )}
          {slackStatus === "sent" ? "Sent!" : slackStatus === "sending" ? "Sending…" : slackStatus === "error" ? "Error" : "Send to Slack"}
        </button>

        <span className="text-sm text-gray-400">
          {startDate && endDate ? `${startDate} → ${endDate}` : "Select a range"}
        </span>

        {/* Automated schedule badges */}
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {[
            { label: "Weekly", desc: "Fri 4 PM", color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
            { label: "Monthly", desc: "Last Fri 4 PM", color: "bg-violet-50 text-violet-600 border-violet-100" },
            { label: "Quarterly", desc: "3rd Fri 4 PM", color: "bg-amber-50 text-amber-600 border-amber-100" },
          ].map(({ label, desc, color }) => (
            <span key={label} className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold border rounded-full ${color}`}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {label} · {desc}
            </span>
          ))}
        </div>
      </div>

      {/* Slack feedback */}
      {(slackError || lastSlackSentAt) && (
        <div className="flex items-center gap-3 text-xs">
          {slackError && <p className="text-red-500">{slackError}</p>}
          {lastSlackSentAt && !slackError && (
            <p className="text-gray-400">
              Last sent to Slack: <span className="font-medium text-gray-600">{format(new Date(lastSlackSentAt), "HH:mm, MMM d")}</span>
            </p>
          )}
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            title="Tickets Completed"
            value={`${stats.jiraDone} / ${stats.jiraTotal}`}
            subtitle={`completion rate: ${stats.completionRate}%`}
            color="emerald"
            icon={TickIcon}
          />
          <KpiCard
            title="Jira Time"
            value={formatSeconds(stats.jiraLoggedSeconds)}
            subtitle={`${stats.jiraInProgress} in progress`}
            color="indigo"
            icon={ClockIcon}
          />
          <KpiCard
            title="Meeting Productivity"
            value={`${stats.meetingTasksDone} done`}
            subtitle={`${stats.meetingTasksActive} active`}
            color="violet"
            icon={TaskIcon}
          />
          <KpiCard
            title="Milestones"
            value={`${stats.milestonesCompleted} / ${stats.milestonesTotal}`}
            subtitle={`${stats.milestonesInProgress} in progress`}
            color="amber"
            icon={FlagIcon}
          />
          <KpiCard
            title="Learning"
            value={`${stats.profDevCount} activities`}
            subtitle={`${stats.profDevHours}h this period`}
            color="blue"
            icon={BookIcon}
          />
          <KpiCard
            title="Meetings"
            value={`${stats.meetingsCount} meetings`}
            subtitle={`${stats.sessionCount} sessions attended`}
            color="rose"
            icon={CalIcon}
          />
        </div>
      )}

      {/* ── AI Insights Panel ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Performance Insights
              {rangeLabel ? ` — ${rangeLabel}` : ""}
            </h2>
            {insights && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">
                ✨ AI Insights
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save / rename label */}
            {insights && savedId && (
              editingLabel ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={labelInputRef}
                    type="text"
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2.5 py-1 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="Label e.g. Q1 2026 Review"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        await fetch("/api/performance/history", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: savedId, dateLabel: labelDraft }),
                        });
                        await loadHistory();
                        setEditingLabel(false);
                      } else if (e.key === "Escape") {
                        setEditingLabel(false);
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      await fetch("/api/performance/history", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: savedId, dateLabel: labelDraft }),
                      });
                      await loadHistory();
                      setEditingLabel(false);
                    }}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingLabel(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingLabel(true); setTimeout(() => labelInputRef.current?.focus(), 50); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Rename
                </button>
              )
            )}

            {/* History toggle */}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-lg transition-colors ${
                  showHistory ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History ({history.length})
              </button>
            )}
          </div>
        </div>

        {/* History panel */}
        {showHistory && history.length > 0 && (
          <div className="mb-5 border border-gray-100 rounded-xl overflow-hidden">
            <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">
              Previous generations (last {history.length})
            </p>
            <ul className="divide-y divide-gray-50">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 group">
                  <button
                    onClick={() => {
                      setInsights(h.insights);
                      setStats(h.stats as unknown as PerformanceStats);
                      setSavedId(h.id);
                      setLabelDraft(h.dateLabel);
                      setShowHistory(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600">{h.dateLabel}</p>
                    <p className="text-xs text-gray-400">{h.rangeLabel} · {format(new Date(h.savedAt), "MMM d, yyyy HH:mm")}</p>
                  </button>
                  <button
                    onClick={async () => {
                      await fetch("/api/performance/history", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: h.id }),
                      });
                      await loadHistory();
                    }}
                    className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {insightsError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {insightsError}
          </div>
        )}

        {insightsLoading && (
          <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Analysing your performance data…</span>
          </div>
        )}

        {!insightsLoading && !insights && !insightsError && (
          <div className="py-10 text-center text-gray-400 text-sm">
            Click <span className="font-semibold text-indigo-500">Generate Insights</span> to get a personalised performance summary for this period.
          </div>
        )}

        {!insightsLoading && insights && <InsightsRenderer text={insights} />}
      </div>

      {/* ── Growth Summary ───────────────────────────────────────────────── */}
      <GrowthSummaryPanel startDate={startDate} endDate={endDate} />

      {/* ── Projects Summary ─────────────────────────────────────────────────── */}
      <ProjectsSummaryPanel startDate={startDate} endDate={endDate} />

      {/* ── Bottom Grid: Milestones + ProfDev ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Milestones ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Milestones</h2>
            <button
              onClick={() => setShowMilestoneForm((v) => !v)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              {showMilestoneForm ? "Cancel" : "+ Add"}
            </button>
          </div>

          {showMilestoneForm && (
            <form
              onSubmit={submitMilestone}
              className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3"
            >
              <input
                type="text"
                placeholder="Milestone title *"
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={msCategory}
                  onChange={(e) => setMsCategory(e.target.value as MilestoneCategory)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="technical">Technical</option>
                  <option value="leadership">Leadership</option>
                  <option value="delivery">Delivery</option>
                  <option value="growth">Growth</option>
                  <option value="communication">Communication</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={msStatus}
                  onChange={(e) => setMsStatus(e.target.value as MilestoneStatus)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <input
                type="date"
                value={msTargetDate}
                onChange={(e) => setMsTargetDate(e.target.value)}
                placeholder="Target date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <textarea
                placeholder="Description (optional)"
                value={msDescription}
                onChange={(e) => setMsDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button
                type="submit"
                disabled={msSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                {msSaving ? "Saving…" : "Save Milestone"}
              </button>
            </form>
          )}

          {milestones.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              No milestones yet. Add one to start tracking your goals.
            </p>
          )}

          {/* In-Progress */}
          {inProgressMilestones.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">In Progress</p>
              <div className="space-y-2">
                {inProgressMilestones.map((m) => (
                  <MilestoneItem
                    key={m.id}
                    milestone={m}
                    onCycle={cycleMilestoneStatus}
                    onDelete={deleteMilestone}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending */}
          {pendingMilestones.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pending</p>
              <div className="space-y-2">
                {pendingMilestones.map((m) => (
                  <MilestoneItem
                    key={m.id}
                    milestone={m}
                    onCycle={cycleMilestoneStatus}
                    onDelete={deleteMilestone}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedMilestones.length > 0 && (
            <details className="group">
              <summary className="text-xs font-semibold text-emerald-600 uppercase tracking-wide cursor-pointer select-none flex items-center gap-1 mb-2">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  className="w-3.5 h-3.5 transition-transform group-open:rotate-90"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Completed ({completedMilestones.length})
              </summary>
              <div className="space-y-2 mt-2">
                {completedMilestones.map((m) => (
                  <MilestoneItem
                    key={m.id}
                    milestone={m}
                    onCycle={cycleMilestoneStatus}
                    onDelete={deleteMilestone}
                  />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* ── Professional Development ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Professional Development</h2>
            <button
              onClick={() => setShowProfDevForm((v) => !v)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              {showProfDevForm ? "Cancel" : "+ Add"}
            </button>
          </div>

          {showProfDevForm && (
            <form
              onSubmit={submitProfDev}
              className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3"
            >
              <input
                type="text"
                placeholder="Title *"
                value={pdTitle}
                onChange={(e) => setPdTitle(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={pdType}
                  onChange={(e) => setPdType(e.target.value as ProfDevType)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="course">Course</option>
                  <option value="certification">Certification</option>
                  <option value="book">Book</option>
                  <option value="workshop">Workshop</option>
                  <option value="conference">Conference</option>
                  <option value="mentoring">Mentoring</option>
                  <option value="presentation">Presentation</option>
                  <option value="shadowing">Shadowing</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Provider (e.g. Coursera)"
                  value={pdProvider}
                  onChange={(e) => setPdProvider(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={pdCompletedDate}
                  onChange={(e) => setPdCompletedDate(e.target.value)}
                  required
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="number"
                  placeholder="Duration (hours)"
                  value={pdDurationHours}
                  onChange={(e) => setPdDurationHours(e.target.value)}
                  min={0}
                  step={0.5}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <input
                type="text"
                placeholder="Skills (comma-separated, e.g. TypeScript, Leadership)"
                value={pdSkills}
                onChange={(e) => setPdSkills(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <textarea
                placeholder="Notes (optional)"
                value={pdNotes}
                onChange={(e) => setPdNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button
                type="submit"
                disabled={pdSaving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                {pdSaving ? "Saving…" : "Save Entry"}
              </button>
            </form>
          )}

          {profdev.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              No professional development entries yet. Add a course, book, or certification.
            </p>
          )}

          <div className="space-y-3">
            {profdev.map((e) => (
              <ProfDevItem key={e.id} entry={e} onDelete={deleteProfDev} />
            ))}
          </div>

          {profdev.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
              {profdev.length} {profdev.length === 1 ? "activity" : "activities"} ·{" "}
              {totalPdHours}h total learning
            </div>
          )}
        </div>
      </div>
      </>)}
    </div>
  );
}

// ─── Milestone Item ───────────────────────────────────────────────────────────

function MilestoneItem({
  milestone: m,
  onCycle,
  onDelete,
}: {
  milestone: Milestone;
  onCycle: (m: Milestone) => void;
  onDelete: (id: string) => void;
}) {
  const isCompleted = m.status === "completed";

  const NEXT_STATUS_LABEL: Record<MilestoneStatus, string> = {
    pending: "Start",
    "in-progress": "Complete",
    completed: "Re-open",
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border ${
        isCompleted
          ? "bg-gray-50 border-gray-100 opacity-70"
          : "bg-white border-gray-100"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              CATEGORY_COLORS[m.category]
            }`}
          >
            {m.category}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              STATUS_COLORS[m.status]
            }`}
          >
            {isCompleted && (
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                className="w-3 h-3 mr-0.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {m.status}
          </span>
        </div>
        <p
          className={`text-sm font-medium ${
            isCompleted ? "text-gray-400 line-through" : "text-gray-800"
          }`}
        >
          {m.title}
        </p>
        {m.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{m.description}</p>
        )}
        <div className="flex flex-wrap gap-x-3 mt-1">
          {m.targetDate && (
            <p className="text-xs text-gray-400">
              Target: {m.targetDate}
            </p>
          )}
          {m.completedAt && (
            <p className="text-xs text-emerald-600">
              Completed: {new Date(m.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onCycle(m)}
          title={NEXT_STATUS_LABEL[m.status]}
          className="px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {NEXT_STATUS_LABEL[m.status]}
        </button>
        <button
          onClick={() => onDelete(m.id)}
          title="Delete"
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── ProfDev Item ─────────────────────────────────────────────────────────────

function ProfDevItem({
  entry: e,
  onDelete,
}: {
  entry: ProfDevEntry;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              PROFDEV_TYPE_COLORS[e.type]
            }`}
          >
            {e.type}
          </span>
          {e.provider && (
            <span className="text-xs text-gray-400">{e.provider}</span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-800">{e.title}</p>
        <div className="flex flex-wrap gap-x-3 mt-0.5">
          <p className="text-xs text-gray-400">{e.completedDate}</p>
          {e.durationHours !== undefined && (
            <p className="text-xs text-gray-400">{e.durationHours}h</p>
          )}
        </div>
        {e.skills && e.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {e.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onDelete(e.id)}
        title="Delete"
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
