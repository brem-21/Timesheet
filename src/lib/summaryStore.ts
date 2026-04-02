import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { TranscriptSummary } from "./summarize";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "summaries.json");
const MAX_HISTORY = 5;

export interface SavedSummary {
  id: string;
  savedAt: number;
  summary: TranscriptSummary;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadSummaries(): SavedSummary[] {
  ensureDir();
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as SavedSummary[];
  } catch {
    return [];
  }
}

export function saveSummary(summary: TranscriptSummary): SavedSummary[] {
  ensureDir();
  const existing = loadSummaries();
  const entry: SavedSummary = {
    id: `sum-${Date.now()}`,
    savedAt: Date.now(),
    summary,
  };
  // Prepend newest, keep only MAX_HISTORY
  const updated = [entry, ...existing].slice(0, MAX_HISTORY);
  writeFileSync(FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export function deleteSummary(id: string): SavedSummary[] {
  ensureDir();
  const updated = loadSummaries().filter((s) => s.id !== id);
  writeFileSync(FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export function updateSummaryLabel(id: string, meetingLabel: string): SavedSummary[] {
  ensureDir();
  const updated = loadSummaries().map((s) =>
    s.id === id ? { ...s, summary: { ...s.summary, meetingLabel } } : s
  );
  writeFileSync(FILE, JSON.stringify(updated, null, 2));
  return updated;
}
