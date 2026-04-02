"use client";

import { Ticket } from "@/lib/utils";

interface Props {
  tickets: Ticket[];
}

function BarSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-right text-sm text-gray-600 font-medium">{label}</div>
      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full flex items-center px-2 transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
        >
          {pct > 8 && <span className="text-white text-xs font-semibold">{value}</span>}
        </div>
      </div>
      <div className="w-12 text-sm text-gray-500">{pct}%</div>
    </div>
  );
}

function PriorityDot({ color }: { color: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

export default function OverviewCharts({ tickets }: Props) {
  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusGroups: Record<string, number> = {};
  for (const t of tickets) {
    statusGroups[t.status] = (statusGroups[t.status] ?? 0) + 1;
  }
  const statusEntries = Object.entries(statusGroups).sort((a, b) => b[1] - a[1]);

  const statusColorMap: Record<string, string> = {
    Done: "bg-emerald-500",
    "In Progress": "bg-blue-500",
    Review: "bg-amber-400",
    "To Do": "bg-gray-400",
    Blocked: "bg-red-500",
  };
  function statusColor(s: string) {
    return statusColorMap[s] ?? "bg-indigo-400";
  }

  // ── Priority breakdown ────────────────────────────────────────────────────
  const priorityOrder = ["Highest", "High", "Medium", "Low", "Lowest"];
  const priorityGroups: Record<string, number> = {};
  for (const t of tickets) {
    priorityGroups[t.priority] = (priorityGroups[t.priority] ?? 0) + 1;
  }

  const priorityColorMap: Record<string, { bar: string; dot: string }> = {
    Highest: { bar: "bg-red-600", dot: "bg-red-600" },
    High: { bar: "bg-orange-500", dot: "bg-orange-500" },
    Medium: { bar: "bg-amber-400", dot: "bg-amber-400" },
    Low: { bar: "bg-blue-400", dot: "bg-blue-400" },
    Lowest: { bar: "bg-gray-300", dot: "bg-gray-300" },
  };

  // ── Hours by week ─────────────────────────────────────────────────────────
  const weekMap: Record<string, number> = {};
  for (const t of tickets) {
    const d = new Date(t.updated);
    // ISO week label: "Week of Mar 3"
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    const label = mon.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    weekMap[label] = (weekMap[label] ?? 0) + t.hours;
  }
  const weekEntries = Object.entries(weekMap).slice(-8); // last 8 weeks
  const maxWeekHours = Math.max(...weekEntries.map(([, h]) => h), 1);

  const totalTickets = tickets.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Status Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Tickets by Status</h3>
        {statusEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="space-y-3">
            {statusEntries.map(([status, count]) => (
              <BarSegment
                key={status}
                label={status}
                value={count}
                total={totalTickets}
                color={statusColor(status)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Priority Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Tickets by Priority</h3>
        {Object.keys(priorityGroups).length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="space-y-3">
            {priorityOrder
              .filter((p) => priorityGroups[p])
              .map((p) => (
                <BarSegment
                  key={p}
                  label={p}
                  value={priorityGroups[p]}
                  total={totalTickets}
                  color={priorityColorMap[p]?.bar ?? "bg-gray-400"}
                />
              ))}
          </div>
        )}
        {/* Legend */}
        <div className="mt-5 flex flex-wrap gap-3 pt-4 border-t border-gray-50">
          {priorityOrder.filter((p) => priorityGroups[p]).map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <PriorityDot color={priorityColorMap[p]?.dot ?? "bg-gray-400"} />
              <span className="text-xs text-gray-500">{p} ({priorityGroups[p]})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hours by Week */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Hours by Week</h3>
        {weekEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="flex items-end gap-2 h-36">
            {weekEntries.map(([label, hours]) => {
              const heightPct = Math.max((hours / maxWeekHours) * 100, 4);
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {hours}h
                    </div>
                    <div
                      className="w-full bg-indigo-500 rounded-t-md transition-all duration-300 hover:bg-indigo-600"
                      style={{ height: `${heightPct}%`, minHeight: "4px" }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 text-center leading-tight">{label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 text-xs text-gray-400 text-right">
          Total: {tickets.reduce((s, t) => s + t.hours, 0)}h
        </div>
      </div>
    </div>
  );
}
