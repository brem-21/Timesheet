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
    { label: "Total Tickets", value: totalTickets },
    { label: "Total Hours", value: totalHours, suffix: "h" },
    { label: "Done", value: doneCount },
    { label: "In Review", value: inReviewCount },
    { label: "In Progress", value: inProgressCount },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-16">
      {cards.map((card) => (
        <div key={card.label} className="card-white">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            {card.label}
          </p>
          <p className="font-display text-heading-sm text-charcoal mt-2">
            {card.value}
            {card.suffix && <span className="text-body font-sans font-medium">{card.suffix}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}
