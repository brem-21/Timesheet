// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptSummary {
  userName: string;
  date: string;
  meetingLabel?: string;
  reportsTo?: string;
  about: string;
  contributions: string[];
  actionItems: string[];
  decisions: string[];
  followUps: string[];
  rawText: string;
  method: "gemini" | "extractive";
}

// ─── Name validator ───────────────────────────────────────────────────────────

/** Returns true only if the string looks like a real person's name. */
export function isPersonName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 60) return false;
  if (/\d{1,2}:\d{2}/.test(s)) return false;          // timestamps like 00:01:23
  if (/^\d+$/.test(s)) return false;                   // pure numbers
  if (/^(Unknown|Meeting Notes|WEBVTT)$/i.test(s)) return false;
  if (/^(NOTE|STYLE|REGION)\b/i.test(s)) return false; // VTT metadata
  return /[a-zA-Z]{2,}/.test(s);                       // must have at least 2 consecutive letters
}

// ─── VTT / plain-text parser ──────────────────────────────────────────────────

export interface TranscriptLine {
  speaker: string;
  text: string;
}

export function parseTranscript(raw: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];

  // Handle .vtt format (WebVTT)
  if (raw.includes("WEBVTT") || raw.match(/\d{2}:\d{2}:\d{2}\.\d{3} --> /)) {
    const blocks = raw.split(/\n\n+/);
    for (const block of blocks) {
      const blockLines = block.trim().split("\n");
      // Find the speaker line — usually "<Name>: text" or just text after timestamp
      const contentLine = blockLines.find(
        (l) => !l.startsWith("WEBVTT") && !l.match(/^\d+$/) && !l.match(/\d{2}:\d{2}/)
      );
      if (!contentLine) continue;

      const colonIdx = contentLine.indexOf(":");
      if (colonIdx > 0 && colonIdx < 40) {
        lines.push({
          speaker: contentLine.slice(0, colonIdx).trim(),
          text: contentLine.slice(colonIdx + 1).trim(),
        });
      } else if (contentLine.trim()) {
        lines.push({ speaker: "Unknown", text: contentLine.trim() });
      }
    }
    return lines;
  }

  // Check if the text has any "Speaker: text" patterns at all
  const speakerLineCount = raw.split("\n").filter((l) => {
    const idx = l.indexOf(":");
    return idx > 0 && idx < 50 && l.trim().length > idx + 2;
  }).length;

  // If fewer than 3 speaker lines, treat as plain meeting notes
  if (speakerLineCount < 3) {
    lines.push({ speaker: "Meeting Notes", text: raw.trim() });
    return lines;
  }

  // Handle plain text format: "Speaker Name: text" per line
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0 && colonIdx < 50) {
      lines.push({
        speaker: trimmed.slice(0, colonIdx).trim(),
        text: trimmed.slice(colonIdx + 1).trim(),
      });
    } else if (trimmed) {
      if (lines.length > 0) {
        lines[lines.length - 1].text += " " + trimmed;
      } else {
        lines.push({ speaker: "Unknown", text: trimmed });
      }
    }
  }

  return lines;
}

// ─── Extractive summarizer (no API key needed) ────────────────────────────────

const ACTION_PATTERNS = [
  /\bi('ll| will| need to| should| am going to| plan to| have to)\b/i,
  /\baction item\b/i,
  /\bfollow[- ]up\b/i,
  /\btake care of\b/i,
  /\bwork on\b/i,
  /\bfix\b/i,
  /\bupdate\b/i,
  /\bcreate\b/i,
  /\bcheck\b/i,
  /\bsend\b/i,
  /\bfinish\b/i,
  /\bcomplete\b/i,
];

const DECISION_PATTERNS = [
  /\bwe('ve| have) decided\b/i,
  /\bdecision\b/i,
  /\bagreed\b/i,
  /\bgoing with\b/i,
  /\bwe('ll| will) go\b/i,
  /\bconfirmed\b/i,
  /\bapproved\b/i,
];

export function extractiveSummarize(lines: TranscriptLine[], userName: string): TranscriptSummary {
  const firstName = userName.split(" ")[0].toLowerCase();
  const fullNameLower = userName.toLowerCase();

  // Lines where the user is speaking
  const userLines = lines.filter(
    (l) =>
      l.speaker.toLowerCase().includes(firstName) ||
      l.speaker.toLowerCase().includes(fullNameLower)
  );

  // Lines where the user is mentioned by others
  const mentionLines = lines.filter(
    (l) =>
      !l.speaker.toLowerCase().includes(firstName) &&
      (l.text.toLowerCase().includes(firstName) ||
        l.text.toLowerCase().includes(fullNameLower))
  );

  const contributions = userLines
    .filter((l) => l.text.length > 20)
    .slice(0, 8)
    .map((l) => l.text);

  const actionItems = [
    ...userLines.filter((l) => ACTION_PATTERNS.some((p) => p.test(l.text))),
    ...mentionLines.filter((l) => ACTION_PATTERNS.some((p) => p.test(l.text))),
  ]
    .slice(0, 6)
    .map((l) => (l.speaker !== userName ? `[${l.speaker}]: ${l.text}` : l.text));

  const decisions = lines
    .filter((l) => DECISION_PATTERNS.some((p) => p.test(l.text)))
    .slice(0, 4)
    .map((l) => l.text);

  const followUps = userLines
    .filter((l) => /\bby\s+(monday|tuesday|wednesday|thursday|friday|tomorrow|eod|end of|next week)\b/i.test(l.text))
    .map((l) => l.text);

  // Build a simple "about" from the first few non-user lines
  const firstLines = lines.slice(0, 6).map((l) => l.text).join(" ");
  const about = firstLines.length > 20
    ? firstLines.slice(0, 300) + (firstLines.length > 300 ? "..." : "")
    : "Meeting transcript — no overview available.";

  return {
    userName,
    date: new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    about,
    contributions: contributions.length > 0 ? contributions : ["No direct contributions found in transcript."],
    actionItems: actionItems.length > 0 ? actionItems : ["No action items detected."],
    decisions: decisions.length > 0 ? decisions : ["No decisions detected."],
    followUps,
    rawText: lines.map((l) => `${l.speaker}: ${l.text}`).join("\n"),
    method: "extractive",
  };
}

// ─── Gemini AI summarizer ─────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function geminiSummarize(
  transcript: string,
  userName: string
): Promise<TranscriptSummary> {
  const content = transcript.slice(0, 14000);

  const prompt = `You are analyzing a meeting transcript. Produce two outputs separated by the delimiter ---JSON--- exactly as shown below.

PART 1: Write a meeting summary of approximately 10 sentences as plain prose (no bullet points, no markdown). Cover:
- The purpose and context of the meeting
- Main topics and agenda items discussed
- Key problems, blockers, or concerns raised
- Progress updates and status reports shared
- Decisions reached and next steps agreed upon
Be specific — use the actual names, projects, features, and details from the transcript. Do not be vague.

---JSON---

PART 2: Return a single JSON object (no markdown fences) with these keys:
- "contributions": array of strings — what ${userName} personally said or contributed (max 6, 1 sentence each)
- "actionItems": array of strings — tasks for ${userName} as clear imperatives e.g. "Fix the login bug by Friday". If assigned to someone else, prefix with their name. Max 10.
- "decisions": array of strings — decisions ${userName} was involved in or that affect them (max 5)
- "followUps": array of strings — follow-ups ${userName} committed to with deadlines if known (max 5)
- "reportsTo": string — the name of the person ${userName} reports to, escalates to, or whose approval they seek in this meeting. Leave as empty string if unclear.

If ${userName} does not appear in the transcript, still extract general action items for all participants.

Meeting transcript:
${content}`;

  const raw = await callGemini(prompt);

  const delimIdx = raw.indexOf("---JSON---");
  const about = delimIdx > -1 ? raw.slice(0, delimIdx).trim() : raw.trim();
  const jsonPart = delimIdx > -1 ? raw.slice(delimIdx + 10).trim() : "";

  let parsed: { contributions?: string[]; actionItems?: string[]; decisions?: string[]; followUps?: string[]; reportsTo?: string } = {};
  if (jsonPart) {
    try {
      const cleaned = jsonPart.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const lines = parseTranscript(transcript);
      const fallback = extractiveSummarize(lines, userName);
      parsed = { contributions: fallback.contributions, actionItems: fallback.actionItems, decisions: fallback.decisions, followUps: fallback.followUps };
    }
  }

  return {
    userName,
    date: new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    about,
    contributions: parsed.contributions ?? [],
    actionItems: parsed.actionItems ?? [],
    decisions: parsed.decisions ?? [],
    followUps: parsed.followUps ?? [],
    reportsTo: parsed.reportsTo || undefined,
    rawText: transcript,
    method: "gemini",
  };
}

export { callGemini };

// ─── Extract a date string from transcript content ────────────────────────────

export function extractDateFromTranscript(text: string): string | null {
  const first2000 = text.slice(0, 2000);
  const patterns = [
    // "Monday, March 31, 2025" or "Tuesday, 31 March 2025"
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:\d{1,2}\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/i,
    // "March 31, 2025" / "31 March 2025"
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/i,
    // ISO: 2025-03-31
    /\b\d{4}-\d{2}-\d{2}\b/,
    // UK/EU: 31/03/2025 or 31-03-2025
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/,
  ];

  for (const p of patterns) {
    const m = first2000.match(p);
    if (m) {
      // Try to parse and reformat as a clean label
      const d = new Date(m[0]);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      }
      return m[0].trim();
    }
  }
  return null;
}

// ─── Format summary as Slack message ─────────────────────────────────────────

export function summaryToSlack(summary: TranscriptSummary): string {
  const bullet = (items: string[]) =>
    items.length === 0 ? "• None" : items.map((i) => `• ${i}`).join("\n");

  return [
    `*Meeting Summary — ${summary.userName} — ${summary.date}*`,
    `_Summarised by Clock-It (${summary.method === "gemini" ? "Gemini AI" : "extractive"})_`,
    "",
    ...(summary.about ? [`📋 *About this meeting:*\n${summary.about}`, ""] : []),
    `💬 *My Contributions:*\n${bullet(summary.contributions)}`,
    "",
    `✅ *What needs to be done:*\n${bullet(summary.actionItems)}`,
    "",
    `🔷 *Decisions I Was Part Of:*\n${bullet(summary.decisions)}`,
    ...(summary.followUps.length > 0
      ? ["", `📅 *Follow-ups:*\n${bullet(summary.followUps)}`]
      : []),
  ].join("\n");
}
