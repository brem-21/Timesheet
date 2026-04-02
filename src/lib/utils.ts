import { format, differenceInDays, parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string | null;
  assigneeAccountId: string | null;
  created: string;
  updated: string;
  hours: number;
  url: string;
}

export interface User {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl: string;
}

export interface StandupSummary {
  userName: string;
  date: string;
  inProgress: Ticket[];
  doneYesterday: Ticket[];
  blockers: Ticket[];
}

// ─── Hours Calculation ────────────────────────────────────────────────────────

/**
 * Calculate hours worked on a ticket:
 * (updatedDate - createdDate) in days * 8, minimum 1 hour if same day.
 */
export function calculateHours(created: string, updated: string): number {
  const createdDate = parseISO(created);
  const updatedDate = parseISO(updated);
  const days = differenceInDays(updatedDate, createdDate);
  if (days <= 0) return 1;
  return days * 8;
}

// ─── Date Formatting ─────────────────────────────────────────────────────────

export function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  try {
    return format(parseISO(dateString), "MMM d");
  } catch {
    return dateString;
  }
}

export function getCurrentMonthYear(): { month: string; year: string } {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function generateCSVByRange(tickets: Ticket[], userName: string, startDate: string, endDate: string): string {
  const header = ["Key", "Summary", "Status", "Priority", "Assignee", "Created", "Updated", "Hours Logged"];

  const rows = tickets.map((t) => [
    t.key,
    `"${t.summary.replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.assignee ?? "Unassigned",
    formatDate(t.created),
    formatDate(t.updated),
    String(t.hours),
  ]);

  const meta = [
    `# Clock-It Export`,
    `# User: ${userName}`,
    `# Period: ${startDate} to ${endDate}`,
    `# Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
    `# Total Tickets: ${tickets.length}`,
    `# Total Hours: ${tickets.reduce((sum, t) => sum + t.hours, 0)}`,
    "",
  ];

  return [...meta, header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function generateCSV(tickets: Ticket[], userName: string, month: string, year: string): string {
  const header = ["Key", "Summary", "Status", "Priority", "Assignee", "Created", "Updated", "Hours Logged"];

  const rows = tickets.map((t) => [
    t.key,
    `"${t.summary.replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.assignee ?? "Unassigned",
    formatDate(t.created),
    formatDate(t.updated),
    String(t.hours),
  ]);

  const meta = [
    `# Clock-It Export`,
    `# User: ${userName}`,
    `# Period: ${month}/${year}`,
    `# Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
    `# Total Tickets: ${tickets.length}`,
    `# Total Hours: ${tickets.reduce((sum, t) => sum + t.hours, 0)}`,
    "",
  ];

  return [...meta, header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// ─── Standup Helpers ─────────────────────────────────────────────────────────

export function buildStandupSummary(tickets: Ticket[], userName: string): StandupSummary {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const inProgress = tickets.filter((t) =>
    t.status.toLowerCase().includes("in progress") ||
    t.status.toLowerCase().includes("in-progress") ||
    t.status.toLowerCase() === "in progress"
  );

  const doneYesterday = tickets.filter((t) => {
    const updatedDate = parseISO(t.updated);
    const isRecentlyDone =
      t.status.toLowerCase() === "done" ||
      t.status.toLowerCase() === "closed" ||
      t.status.toLowerCase() === "resolved";
    const daysDiff = differenceInDays(today, updatedDate);
    return isRecentlyDone && daysDiff <= 2;
  });

  const blockers = tickets.filter((t) => {
    const isBlocked =
      t.status.toLowerCase() === "to do" ||
      t.status.toLowerCase() === "todo" ||
      t.status.toLowerCase() === "blocked";
    const isHighPriority =
      t.priority.toLowerCase() === "high" ||
      t.priority.toLowerCase() === "highest" ||
      t.priority.toLowerCase() === "critical";
    return isBlocked && isHighPriority;
  });

  return {
    userName,
    date: format(today, "EEEE, MMMM d, yyyy"),
    inProgress,
    doneYesterday,
    blockers,
  };
}

// ─── Status / Priority Colour Helpers ────────────────────────────────────────

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "done" || s === "closed" || s === "resolved") return "done";
  if (s.includes("progress")) return "in-progress";
  if (s.includes("review") || s.includes("testing") || s.includes("qa")) return "review";
  if (s === "blocked") return "blocked";
  return "todo";
}

export function getPriorityColor(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "highest" || p === "critical") return "highest";
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  if (p === "lowest") return "lowest";
  return "low";
}
