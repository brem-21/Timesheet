"use client";

import { Ticket, formatDate, getStatusColor, getPriorityColor } from "@/lib/utils";
import TimerButton from "./TimerButton";

interface TicketTableProps {
  tickets: Ticket[];
}

const statusBadge: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  "in-progress": "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  review: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  blocked: "bg-red-100 text-red-800 ring-1 ring-red-200",
  todo: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

const priorityBadge: Record<string, string> = {
  highest: "bg-red-100 text-red-900 ring-1 ring-red-300",
  high: "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
  medium: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  low: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  lowest: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

const priorityDot: Record<string, string> = {
  highest: "bg-red-600",
  high: "bg-rose-500",
  medium: "bg-orange-400",
  low: "bg-gray-400",
  lowest: "bg-slate-300",
};

export default function TicketTable({ tickets }: TicketTableProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm font-medium">No tickets found for this period</p>
        <p className="text-xs mt-1">Try selecting a different month or user</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Key</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Priority</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Created</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Updated</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Est. Hours</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Timer</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {tickets.map((ticket) => {
            const statusKey = getStatusColor(ticket.status);
            const priorityKey = getPriorityColor(ticket.priority);
            return (
              <tr key={ticket.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <a
                    href={ticket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-mono text-xs font-semibold hover:underline"
                  >
                    {ticket.key}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-800 line-clamp-2 group-hover:text-gray-900">
                    {ticket.summary}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityBadge[priorityKey] ?? priorityBadge.low}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[priorityKey] ?? priorityDot.low}`} />
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge[statusKey] ?? statusBadge.todo}`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(ticket.created)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(ticket.updated)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md px-2 py-1">
                    {ticket.hours}h
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <TimerButton ticketKey={ticket.key} ticketSummary={ticket.summary} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-200">
            <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-gray-600">
              {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
            </td>
            <td className="px-4 py-3 text-right">
              <span className="inline-flex items-center justify-center bg-indigo-600 text-white text-xs font-bold rounded-md px-2 py-1">
                {tickets.reduce((sum, t) => sum + t.hours, 0)}h
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
