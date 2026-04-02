import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "meetings.json");

export interface MeetingMeta {
  source: string;
  speakers: string[];
  date: string;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadMeetings(): MeetingMeta[] {
  ensureDir();
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as MeetingMeta[];
  } catch {
    return [];
  }
}

export function saveMeetingMeta(meta: MeetingMeta): void {
  ensureDir();
  const existing = loadMeetings();
  const idx = existing.findIndex((m) => m.source === meta.source);
  if (idx >= 0) {
    existing[idx] = meta;
  } else {
    existing.unshift(meta);
  }
  writeFileSync(FILE, JSON.stringify(existing, null, 2));
}

export function getMeetingSpeakers(source: string): string[] {
  return loadMeetings().find((m) => m.source === source)?.speakers ?? [];
}
