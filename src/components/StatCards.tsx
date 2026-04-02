"use client";

import { Ticket } from "@/lib/utils";

interface StatCardsProps {
  tickets?: Ticket[];
  totalTickets?: number;
  totalHours?: number;
  doneCount?: number;
  inReviewCount?: number;
  inProgressCount?: number;
}

export default function StatCards({
  tickets,
  totalTickets: totalTicketsProp,
  totalHours: totalHoursProp,
  doneCount: doneCountProp,
  inReviewCount: inReviewCountProp,
  inProgressCount: inProgressCountProp,
}: StatCardsProps) {
  const t = tickets ?? [];
  const totalTickets = totalTicketsProp ?? t.length;
  const totalHours = totalHoursProp ?? t.reduce((sum, tk) => sum + tk.hours, 0);
  const doneCount = doneCountProp ?? t.filter(
    (tk) =>
      tk.status.toLowerCase() === "done" ||
      tk.status.toLowerCase() === "closed" ||
      tk.status.toLowerCase() === "resolved"
  ).length;
  const inReviewCount = inReviewCountProp ?? t.filter(
    (tk) =>
      tk.status.toLowerCase().includes("review") ||
      tk.status.toLowerCase().includes("testing") ||
      tk.status.toLowerCase().includes("qa")
  ).length;
  const inProgressCount = inProgressCountProp ?? t.filter(
    (tk) => tk.status.toLowerCase().includes("progress")
  ).length;

  const cards = [
    {
      label: "Total Tickets",
      value: totalTickets,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      bg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      valueColor: "text-indigo-700",
    },
    {
      label: "Total Hours",
      value: totalHours,
      suffix: "h",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
    {
      label: "Done",
      value: doneCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
    {
      label: "In Review",
      value: inReviewCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      bg: "bg-amber-50",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    {
      label: "In Progress",
      value: inProgressCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      bg: "bg-violet-50",
      iconColor: "text-violet-600",
      valueColor: "text-violet-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3"
        >
          <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center ${card.iconColor}`}>
            {card.icon}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${card.valueColor}`}>
              {card.value}
              {card.suffix && <span className="text-base font-medium">{card.suffix}</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
