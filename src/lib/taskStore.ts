// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface MeetingTask {
  id: string;
  text: string;
  source: string;       // meeting date/label
  createdAt: number;    // Unix ms
  status: TaskStatus;
  priority: TaskPriority;
  notes?: string;
}

const TASKS_KEY = "clockit_meeting_tasks";

export function loadTasks(): MeetingTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? (JSON.parse(raw) as MeetingTask[]) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: MeetingTask[]): void {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function addTasks(tasks: MeetingTask[]): void {
  const existing = loadTasks();
  // Deduplicate by text
  const existingTexts = new Set(existing.map((t) => t.text.trim().toLowerCase()));
  const newOnes = tasks.filter((t) => !existingTexts.has(t.text.trim().toLowerCase()));
  saveTasks([...newOnes, ...existing]);
}

export function updateTask(id: string, patch: Partial<MeetingTask>): void {
  const tasks = loadTasks();
  saveTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function deleteTask(id: string): void {
  saveTasks(loadTasks().filter((t) => t.id !== id));
}

export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
