import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MeetingTask {
  id: string;
  text: string;
  source: string;
  createdAt: number;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  reportsTo?: string;
  notes?: string;
  description?: string;
  checklist?: ChecklistItem[];
}

const DATA_DIR = join(process.cwd(), "data");
const TASKS_FILE = join(DATA_DIR, "tasks.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadTasks(): MeetingTask[] {
  ensureDataDir();
  if (!existsSync(TASKS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(TASKS_FILE, "utf-8")) as MeetingTask[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: MeetingTask[]): void {
  ensureDataDir();
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export function addTasks(tasks: MeetingTask[]): MeetingTask[] {
  const existing = loadTasks();
  const existingTexts = new Set(existing.map((t) => t.text.trim().toLowerCase()));
  const newOnes = tasks.filter((t) => !existingTexts.has(t.text.trim().toLowerCase()));
  const merged = [...newOnes, ...existing];
  saveTasks(merged);
  return merged;
}

export function updateTask(id: string, patch: Partial<MeetingTask>): MeetingTask[] {
  const tasks = loadTasks().map((t) => (t.id === id ? { ...t, ...patch } : t));
  saveTasks(tasks);
  return tasks;
}

export function deleteTask(id: string): MeetingTask[] {
  const tasks = loadTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
  return tasks;
}

export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
