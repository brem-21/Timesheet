import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export type ProfDevType =
  | "course"
  | "certification"
  | "book"
  | "workshop"
  | "conference"
  | "mentoring"
  | "presentation"
  | "shadowing"
  | "other";

export interface ProfDevEntry {
  id: string;
  title: string;
  type: ProfDevType;
  provider?: string;       // e.g. "Coursera", "Internal", "O'Reilly"
  completedDate: string;   // "YYYY-MM-DD"
  durationHours?: number;
  notes?: string;
  skills?: string[];       // e.g. ["TypeScript", "Leadership"]
  createdAt: number;
}

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "profdev.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadProfDev(): ProfDevEntry[] {
  ensureDir();
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as ProfDevEntry[];
  } catch {
    return [];
  }
}

function saveProfDev(entries: ProfDevEntry[]): void {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(entries, null, 2));
}

export function addProfDev(e: ProfDevEntry): ProfDevEntry[] {
  const existing = loadProfDev();
  const updated = [e, ...existing];
  saveProfDev(updated);
  return updated;
}

export function updateProfDev(id: string, patch: Partial<ProfDevEntry>): ProfDevEntry[] {
  const updated = loadProfDev().map((e) =>
    e.id === id ? { ...e, ...patch } : e
  );
  saveProfDev(updated);
  return updated;
}

export function deleteProfDev(id: string): ProfDevEntry[] {
  const updated = loadProfDev().filter((e) => e.id !== id);
  saveProfDev(updated);
  return updated;
}
