"use client";

import { Ticket, formatDate, getStatusColor, getPriorityColor } from "@/lib/utils";
import TimerButton from "./TimerButton";

interface TicketTableProps {
  tickets: Ticket[];
}

const statusTag: Record<string, string> = {
  done: "tag-done",
  "in-progress": "tag-progress",
  review: "tag-review",
  blocked: "tag-blocked",
  todo: "tag-neutral",
};

const priorityTag: Record<string, string> = {
  highest: "tag-blocked",
  high: "tag-review",
  medium: "tag-progress",
  low: "tag-neutral",
  lowest: "tag-neutral",
};

export default function TicketTable({ tickets }: TicketTableProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-charcoal/40">
        <p className="text-[14px] font-medium">No tickets found for this period</p>
        <p className="text-[13px] mt-1">Try selecting a different month or user</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-mint">
      <table className="table-clean min-w-full">
        <thead>
          <tr>
            <th className="w-28">Key</th>
            <th>Summary</th>
            <th className="w-32">Priority</th>
            <th className="w-36">Status</th>
            <th className="w-28">Created</th>
            <th className="w-28">Updated</th>
            <th className="w-24 text-right">Est. Hours</th>
            <th className="w-32 text-right">Timer</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const statusKey = getStatusColor(ticket.status);
            const priorityKey = getPriorityColor(ticket.priority);
            return (
              <tr key={ticket.id} className="group">
                <td>
                  <a
                    href={ticket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-pine font-mono text-[12px] font-semibold hover:underline"
                  >
                    {ticket.key}
                  </a>
                </td>
                <td>
                  <p className="text-[14px] text-charcoal line-clamp-2">
                    {ticket.summary}
                  </p>
                </td>
                <td>
                  <span className={priorityTag[priorityKey] ?? priorityTag.low}>
                    {ticket.priority}
                  </span>
                </td>
                <td>
                  <span className={statusTag[statusKey] ?? statusTag.todo}>
                    {ticket.status}
                  </span>
                </td>
                <td className="text-[12px] text-charcoal/50">{formatDate(ticket.created)}</td>
                <td className="text-[12px] text-charcoal/50">{formatDate(ticket.updated)}</td>
                <td className="text-right">
                  <span className="filter-pill">{ticket.hours}h</span>
                </td>
                <td className="text-right">
                  <TimerButton ticketKey={ticket.key} ticketSummary={ticket.summary} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="font-semibold text-charcoal/70 border-b-0">
              {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
            </td>
            <td className="text-right border-b-0">
              <span className="filter-pill active">
                {tickets.reduce((sum, t) => sum + t.hours, 0)}h
              </span>
            </td>
            <td className="border-b-0" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
