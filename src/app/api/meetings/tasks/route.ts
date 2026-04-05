export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { parseTranscript, callGemini, extractDateFromTranscript, isPersonName } from "@/lib/summarize";
import { addTasks, generateTaskId, MeetingTask, TaskPriority } from "@/lib/taskStoreServer";
import { saveMeetingMeta } from "@/lib/meetingStore";
import { format } from "date-fns";

const ACTION_PATTERNS = [
  /\bi('ll| will| need to| should| am going to| plan to| have to)\b/i,
  /\baction item\b/i,
  /\bfollow[- ]up\b/i,
  /\btake care of\b/i,
  /\bwork on\b/i,
  /\bfinish\b/i,
  /\bcomplete\b/i,
  /\bupdate\b/i,
  /\bfix\b/i,
  /\bcreate\b/i,
  /\bsend\b/i,
  /\bcheck\b/i,
  /\bhandle\b/i,
  /\bimplement\b/i,
  /\breview\b/i,
  /\bprepare\b/i,
  /\bshare\b/i,
];

const HIGH_PRIORITY_PATTERNS = [/\burgent\b/i, /\bASAP\b/, /\bblocking\b/i, /\bcritical\b/i, /\btoday\b/i, /\bimmediately\b/i];
const LOW_PRIORITY_PATTERNS  = [/\bwhen possible\b/i, /\bno rush\b/i, /\blater\b/i, /\bsome time\b/i];

function detectPriority(text: string): TaskPriority {
  if (HIGH_PRIORITY_PATTERNS.some((p) => p.test(text))) return "high";
  if (LOW_PRIORITY_PATTERNS.some((p) => p.test(text))) return "low";
  return "medium";
}

async function extractWithGemini(transcript: string, userName: string, source: string): Promise<MeetingTask[]> {
  const prompt = `You are a project manager creating Jira-style tickets from a meeting transcript. Extract every task or action item and format each as a structured ticket.

Return a JSON array where each item has:
- "text": a concise ticket title (5-10 words max), written as an imperative starting with a verb (e.g. "Fix deployment pipeline timeout", "Send Q2 report to client")
- "description": 2-4 sentences of context — what needs to be done, why it matters, and any relevant details from the meeting. Write it as a ticket description a developer or team member would see in Jira.
- "priority": "high" if urgent/blocking/ASAP/today/deadline-driven, "low" if no rush/later/nice-to-have, otherwise "medium"
- "assignee": the full name of the person this task is assigned to, exactly as it appears in the transcript. Use "${userName}" for tasks assigned to them.
- "checklist": an array of 2-4 acceptance criteria strings — specific, testable conditions that define when this task is done (e.g. "PR reviewed and merged", "Client notified via email", "Unit tests passing")

Return ONLY the JSON array. No markdown fences, no explanation. Example:
[{"text":"Fix login authentication bug","description":"Users are unable to log in after the recent OAuth token refresh. This is blocking the QA team from completing regression testing. Root cause identified as an expired certificate on the auth service.","priority":"high","assignee":"${userName}","checklist":["Identify and patch the expired certificate","Verify login works across all supported browsers","Notify QA team once fix is deployed"]},{"text":"Review infrastructure PR","description":"The PR for the new Kubernetes cluster configuration is ready for review. It includes changes to resource limits and health check configurations discussed in today's meeting.","priority":"medium","assignee":"Richard Dadzie","checklist":["Review resource limit changes","Check health check configurations","Approve or request changes on the PR"]}]

If no tasks are found, return [].

Meeting transcript:
${transcript.slice(0, 10000)}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed: Array<{ text: string; description?: string; priority: TaskPriority; assignee?: string; checklist?: string[] }> = JSON.parse(cleaned);

  return parsed.map((t) => ({
    id: generateTaskId(),
    text: t.text,
    description: t.description,
    priority: t.priority ?? "medium",
    status: "todo" as const,
    source,
    assignee: t.assignee ?? userName,
    checklist: (t.checklist ?? []).map((item) => ({ id: generateTaskId(), text: item, done: false })),
    createdAt: Date.now(),
  }));
}

function extractWithPatterns(transcript: string, userName: string, source: string): MeetingTask[] {
  const lines = parseTranscript(transcript);
  const firstName = userName.split(" ")[0].toLowerCase();
  const fullNameLower = userName.toLowerCase();
  const tasks: MeetingTask[] = [];

  for (const line of lines) {
    const isUserSpeaking = line.speaker.toLowerCase().includes(firstName) || line.speaker.toLowerCase().includes(fullNameLower);
    const mentionsUser = line.text.toLowerCase().includes(firstName) || line.text.toLowerCase().includes(fullNameLower);
    const hasAction = ACTION_PATTERNS.some((p) => p.test(line.text));

    if (hasAction && (isUserSpeaking || mentionsUser) && line.text.length > 10) {
      tasks.push({
        id: generateTaskId(),
        text: line.text.trim(),
        priority: detectPriority(line.text),
        status: "todo",
        source,
        assignee: isUserSpeaking ? userName : line.speaker || userName,
        createdAt: Date.now(),
      });
    }
  }
  return tasks;
}

export async function POST(request: NextRequest) {
  const { transcript, userName, meetingLabel } = await request.json();
  if (!transcript || !userName) {
    return NextResponse.json({ error: "transcript and userName are required" }, { status: 400 });
  }

  // Prefer explicit meetingLabel, then try to pull a date from the transcript itself
  const transcriptDate = extractDateFromTranscript(transcript);
  const source = meetingLabel || transcriptDate || format(new Date(), "MMM d, yyyy");

  // Extract all unique speaker names from the transcript
  const parsedLines = parseTranscript(transcript);
  const speakers = Array.from(
    new Set(parsedLines.map((l) => l.speaker.trim()).filter(isPersonName))
  );

  try {
    await saveMeetingMeta({ source, speakers, date: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/meetings/tasks] saveMeetingMeta error:", err);
  }

  try {
    let extracted: MeetingTask[] = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        extracted = await extractWithGemini(transcript, userName, source);
      } catch {
        extracted = extractWithPatterns(transcript, userName, source);
      }
    } else {
      extracted = extractWithPatterns(transcript, userName, source);
    }

    const allTasks = await addTasks(extracted);
    return NextResponse.json({ extracted, allTasks, count: extracted.length, speakers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
