import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export type MilestoneStatus = "pending" | "in-progress" | "completed";
export type MilestoneCategory =
  | "technical"
  | "leadership"
  | "delivery"
  | "growth"
  | "communication"
  | "other";

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;   // "YYYY-MM-DD"
  completedAt?: string;  // ISO string
  status: MilestoneStatus;
  category: MilestoneCategory;
  createdAt: number;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "milestones.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadMilestones(): Milestone[] {
  ensureDir();
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as Milestone[];
  } catch {
    return [];
  }
}

function saveMilestones(milestones: Milestone[]): void {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(milestones, null, 2));
}

export function addMilestone(m: Milestone): Milestone[] {
  const existing = loadMilestones();
  const updated = [m, ...existing];
  saveMilestones(updated);
  return updated;
}

export function updateMilestone(id: string, patch: Partial<Milestone>): Milestone[] {
  const updated = loadMilestones().map((m) =>
    m.id === id ? { ...m, ...patch } : m
  );
  saveMilestones(updated);
  return updated;
}

export function deleteMilestone(id: string): Milestone[] {
  const updated = loadMilestones().filter((m) => m.id !== id);
  saveMilestones(updated);
  return updated;
}
