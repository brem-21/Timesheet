import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "activity.json");
const MAX_ENTRIES = 2000;

export interface ActivityEntry {
  path: string;
  title?: string;
  timestamp: number;
  type: "page" | "api" | "browser";
}

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function logActivity(entry: ActivityEntry): void {
  ensureDir();
  let entries: ActivityEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {}
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries));
}

export function getLastActivityTime(): number | null {
  try {
    const entries: ActivityEntry[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return entries[0]?.timestamp ?? null;
  } catch {
    return null;
  }
}

export interface ActivitySummaryEntry {
  path: string;
  count: number;
  lastVisit: number;
}

export function getActivitySummary(sinceMs: number): ActivitySummaryEntry[] {
  try {
    const entries: ActivityEntry[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    const recent = entries.filter((e) => e.timestamp >= sinceMs);
    const map = new Map<string, { count: number; lastVisit: number }>();
    for (const e of recent) {
      const existing = map.get(e.path);
      if (!existing) {
        map.set(e.path, { count: 1, lastVisit: e.timestamp });
      } else {
        existing.count++;
        if (e.timestamp > existing.lastVisit) existing.lastVisit = e.timestamp;
      }
    }
    return Array.from(map.entries())
      .map(([p, v]) => ({ path: p, ...v }))
      .sort((a, b) => b.lastVisit - a.lastVisit);
  } catch {
    return [];
  }
}
