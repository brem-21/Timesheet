"use client";

import { Ticket } from "@/lib/utils";

interface Props {
  tickets: Ticket[];
}

function BarSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-right text-[13px] text-charcoal/70 font-medium">{label}</div>
      <div className="flex-1 h-5 bg-mint rounded-pill overflow-hidden">
        <div
          className={`h-full rounded-pill flex items-center px-2 transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
        >
          {pct > 8 && <span className="text-white text-[11px] font-semibold">{value}</span>}
        </div>
      </div>
      <div className="w-12 text-[13px] text-charcoal/50">{pct}%</div>
    </div>
  );
}

function PriorityDot({ color }: { color: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-pill ${color}`} />;
}

export default function OverviewCharts({ tickets }: Props) {
  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusGroups: Record<string, number> = {};
  for (const t of tickets) {
    statusGroups[t.status] = (statusGroups[t.status] ?? 0) + 1;
  }
  const statusEntries = Object.entries(statusGroups).sort((a, b) => b[1] - a[1]);

  const statusColorMap: Record<string, string> = {
    Done: "bg-teal-deep",
    "In Progress": "bg-navy",
    Review: "bg-rose",
    "To Do": "bg-charcoal/30",
    Blocked: "bg-[#b3492f]",
  };
  function statusColor(s: string) {
    return statusColorMap[s] ?? "bg-teal-sage";
  }

  // ── Priority breakdown ────────────────────────────────────────────────────
  const priorityOrder = ["Highest", "High", "Medium", "Low", "Lowest"];
  const priorityGroups: Record<string, number> = {};
  for (const t of tickets) {
    priorityGroups[t.priority] = (priorityGroups[t.priority] ?? 0) + 1;
  }

  const priorityColorMap: Record<string, { bar: string; dot: string }> = {
    Highest: { bar: "bg-[#b3492f]", dot: "bg-[#b3492f]" },
    High: { bar: "bg-rose", dot: "bg-rose" },
    Medium: { bar: "bg-navy", dot: "bg-navy" },
    Low: { bar: "bg-teal-sage", dot: "bg-teal-sage" },
    Lowest: { bar: "bg-charcoal/20", dot: "bg-charcoal/20" },
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-24">

      {/* Status Breakdown */}
      <div className="card-white lg:col-span-1">
        <h3 className="eyebrow mb-4">
          <span className="eyebrow-dot" />
          Tickets by Status
        </h3>
        {statusEntries.length === 0 ? (
          <p className="text-[14px] text-charcoal/40">No data</p>
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
      <div className="card-white lg:col-span-1">
        <h3 className="eyebrow mb-4">
          <span className="eyebrow-dot" />
          Tickets by Priority
        </h3>
        {Object.keys(priorityGroups).length === 0 ? (
          <p className="text-[14px] text-charcoal/40">No data</p>
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
                  color={priorityColorMap[p]?.bar ?? "bg-charcoal/30"}
                />
              ))}
          </div>
        )}
        {/* Legend */}
        <div className="mt-5 flex flex-wrap gap-3 pt-4 border-t border-mint">
          {priorityOrder.filter((p) => priorityGroups[p]).map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <PriorityDot color={priorityColorMap[p]?.dot ?? "bg-charcoal/30"} />
              <span className="text-[12px] text-charcoal/50">{p} ({priorityGroups[p]})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hours by Week */}
      <div className="card-white lg:col-span-1">
        <h3 className="eyebrow mb-4">
          <span className="eyebrow-dot" />
          Hours by Week
        </h3>
        {weekEntries.length === 0 ? (
          <p className="text-[14px] text-charcoal/40">No data</p>
        ) : (
          <div className="flex items-end gap-2 h-36">
            {weekEntries.map(([label, hours]) => {
              const heightPct = Math.max((hours / maxWeekHours) * 100, 4);
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-charcoal text-white text-[11px] rounded-card px-2 py-1 whitespace-nowrap z-10">
                      {hours}h
                    </div>
                    <div
                      className="w-full bg-teal-deep rounded-t-card transition-all duration-300 hover:bg-teal-forest"
                      style={{ height: `${heightPct}%`, minHeight: "4px" }}
                    />
                  </div>
                  <span className="text-[10px] text-charcoal/40 text-center leading-tight">{label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 text-[12px] text-charcoal/40 text-right">
          Total: {tickets.reduce((s, t) => s + t.hours, 0)}h
        </div>
      </div>
    </div>
  );
}
