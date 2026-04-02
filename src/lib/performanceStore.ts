import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "performance-history.json");
const MAX_HISTORY = 5;

export interface SavedPerformance {
  id: string;
  savedAt: number;
  dateLabel: string;   // user-editable label e.g. "Q1 2026 Review"
  rangeLabel: string;  // preset e.g. "This Month"
  startDate: string;
  endDate: string;
  stats: Record<string, number | string>;
  insights: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadPerformanceHistory(): SavedPerformance[] {
  ensureDir();
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as SavedPerformance[];
  } catch {
    return [];
  }
}

export function savePerformanceEntry(entry: Omit<SavedPerformance, "id" | "savedAt">): SavedPerformance[] {
  ensureDir();
  const existing = loadPerformanceHistory();
  const newEntry: SavedPerformance = {
    id: `perf-${Date.now()}`,
    savedAt: Date.now(),
    ...entry,
  };
  const updated = [newEntry, ...existing].slice(0, MAX_HISTORY);
  writeFileSync(FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export function updatePerformanceLabel(id: string, dateLabel: string): SavedPerformance[] {
  ensureDir();
  const updated = loadPerformanceHistory().map((e) =>
    e.id === id ? { ...e, dateLabel } : e
  );
  writeFileSync(FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export function deletePerformanceEntry(id: string): SavedPerformance[] {
  ensureDir();
  const updated = loadPerformanceHistory().filter((e) => e.id !== id);
  writeFileSync(FILE, JSON.stringify(updated, null, 2));
  return updated;
}
