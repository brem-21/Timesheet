export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, fetchTicketsByRange } from "@/lib/jira";
import { loadTasks } from "@/lib/taskStoreServer";
import { loadMilestones } from "@/lib/milestoneStore";
import { loadProfDev } from "@/lib/profDevStore";
import { loadSummaries } from "@/lib/summaryStore";
import { callGemini } from "@/lib/summarize";
import { savePerformanceEntry } from "@/lib/performanceStore";
import { format } from "date-fns";

interface PerformanceRequestBody {
  startDate: string;
  endDate: string;
  rangeLabel: string;
  jiraSeconds: number;
  meetingSeconds: number;
  sessionCount: number;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function buildExtractiveInsights(
  stats: Record<string, number | string>,
  rangeLabel: string
): string {
  const jiraHrsLogged = formatHours(stats.jiraLoggedSeconds as number);
  const meetingHrsLogged = formatHours(stats.meetingLoggedSeconds as number);

  return [
    `## Time Management`,
    `You logged ${jiraHrsLogged} on Jira tickets and ${meetingHrsLogged} in meeting-related work during ${rangeLabel}. Across ${stats.sessionCount} sessions, your time was split between ticket delivery and meeting tasks. Consistent session frequency helps maintain momentum and visibility into progress.`,
    ``,
    `## Delivery & Efficiency`,
    `You worked on ${stats.jiraTotal} Jira tickets, completing ${stats.jiraDone} (${stats.completionRate}% completion rate). ${stats.jiraInProgress} tickets remain in progress, ${stats.jiraInReview} are in review, and ${stats.jiraTodo} are yet to be started. Your tracked Jira effort totals approximately ${(stats.jiraHours as number).toFixed(1)} estimated hours.`,
    ``,
    `## Leadership & Collaboration`,
    `You attended ${stats.meetingsCount} meetings this period. Your meeting tasks show ${stats.meetingTasksDone} completed out of ${stats.meetingTasksTotal} total, with ${stats.meetingTasksActive} currently active. Staying on top of action items from meetings is a key indicator of reliability and follow-through.`,
    ``,
    `## Professional Growth`,
    `You logged ${stats.profDevCount} professional development ${stats.profDevCount === 1 ? "activity" : "activities"} totalling ${stats.profDevHours} hours this period. On the milestones front, you have ${stats.milestonesCompleted} completed out of ${stats.milestonesTotal} total milestones, with ${stats.milestonesInProgress} currently in progress. Continued investment in learning and milestone delivery demonstrates long-term career intentionality.`,
    ``,
    `## Communication & Influence`,
    `Based on meeting records, you have been involved in ${stats.meetingsCount} meetings this period. Consistent participation in meetings and taking on action items signals reliability and collaborative intent. Aim to increase the specificity of contributions — moving from status updates to problem framing and solution proposals demonstrates Senior Associate-level communication. Leading decisions, not just participating in them, is a key marker of growing influence.`,
    ``,
    `## Key Recommendations`,
    `1. Aim to close out the ${stats.jiraInProgress} in-progress tickets before picking up new work to reduce work-in-progress accumulation.`,
    `2. Review the ${stats.jiraTodo} todo tickets and prioritise or de-scope those no longer relevant to the current sprint.`,
    `3. Ensure all ${stats.meetingTasksActive} active meeting action items have clear owners and deadlines logged.`,
    `4. Schedule time for at least one professional development activity next period to maintain growth momentum.`,
    `5. Push forward on in-progress milestones — ${stats.milestonesInProgress} are underway and tracking completion will strengthen your performance narrative.`,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PerformanceRequestBody;
    const { startDate, endDate, rangeLabel, jiraSeconds, meetingSeconds, sessionCount } = body;

    if (!startDate || !endDate || !rangeLabel) {
      return NextResponse.json(
        { error: "Missing required fields: startDate, endDate, rangeLabel" },
        { status: 400 }
      );
    }

    // 1. Fetch Jira tickets
    let tickets: Awaited<ReturnType<typeof fetchTicketsByRange>> = [];
    try {
      const user = await getCurrentUser();
      tickets = await fetchTicketsByRange(user.accountId, startDate, endDate);
    } catch {
      // Jira may not be configured — continue with empty tickets
      tickets = [];
    }

    // 2. Load meeting tasks
    const allTasks = await loadTasks();

    // 3. Load milestones
    const milestones = await loadMilestones();

    // 4. Load profdev, filter to date range
    const allProfDev = await loadProfDev();
    const filteredProfDev = allProfDev.filter(
      (e) => e.completedDate >= startDate && e.completedDate <= endDate
    );

    // 5. Load meeting summaries
    const summaries = await loadSummaries();

    // 6. Compute stats
    const done = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s === "done" || s === "closed" || s === "resolved";
    });
    const inProgress = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s === "in progress" || s === "in-progress";
    });
    const inReview = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s.includes("review") || s === "in review";
    });
    const todo = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s === "to do" || s === "todo" || s === "open" || s === "backlog";
    });

    const stats = {
      jiraTotal: tickets.length,
      jiraDone: done.length,
      jiraInProgress: inProgress.length,
      jiraInReview: inReview.length,
      jiraTodo: todo.length,
      jiraHours: tickets.reduce((s, t) => s + t.hours, 0),
      jiraDoneHours: done.reduce((s, t) => s + t.hours, 0),
      completionRate:
        tickets.length > 0 ? Math.round((done.length / tickets.length) * 100) : 0,
      meetingTasksTotal: allTasks.length,
      meetingTasksDone: allTasks.filter((t) => t.status === "done").length,
      meetingTasksActive: allTasks.filter((t) => t.status === "in-progress").length,
      milestonesTotal: milestones.length,
      milestonesCompleted: milestones.filter((m) => m.status === "completed").length,
      milestonesInProgress: milestones.filter((m) => m.status === "in-progress").length,
      profDevCount: filteredProfDev.length,
      profDevHours: filteredProfDev.reduce((s, e) => s + (e.durationHours ?? 0), 0),
      meetingsCount: summaries.length,
      jiraLoggedSeconds: jiraSeconds,
      meetingLoggedSeconds: meetingSeconds,
      sessionCount,
      rangeLabel,
    };

    // 7. Communication data from meeting summaries
    const allContributions = summaries.flatMap((s) => s.summary.contributions ?? []).filter(Boolean);
    const allDecisions = summaries.flatMap((s) => s.summary.decisions ?? []).filter(Boolean);
    const allActionItems = summaries.flatMap((s) => s.summary.actionItems ?? []).filter((a) => a && a !== "No action items detected.");
    const avgContribLen = allContributions.length > 0
      ? Math.round(allContributions.reduce((s, c) => s + c.length, 0) / allContributions.length)
      : 0;
    const sampleContribs = allContributions.slice(0, 5);

    // 8. Build Gemini prompt
    const jiraHrsLogged = formatHours(jiraSeconds);
    const meetingHrsLogged = formatHours(meetingSeconds);

    const communicationSection = allContributions.length > 0
      ? `\n\nCommunication Evidence (from meeting transcripts):
- Total meetings with recorded contributions: ${summaries.length}
- Total contributions logged: ${allContributions.length}
- Average contribution length: ${avgContribLen} characters
- Total decisions involved in: ${allDecisions.length}
- Total action items taken on: ${allActionItems.length}
- Sample contributions (assess depth, clarity, specificity, and strategic vs tactical thinking):
${sampleContribs.map((c, i) => `  ${i + 1}. "${c}"`).join("\n")}`
      : "";

    const prompt = `You are a performance coach assessing a Senior Associate at a technology consulting/software company. Based on the data below for the period ${rangeLabel}, provide a structured performance summary with exactly these sections in order: ## Time Management, ## Delivery & Efficiency, ## Leadership & Collaboration, ## Communication & Influence, ## Professional Growth, ## Key Recommendations. Be specific, reference the actual numbers, and be candid but constructive. Keep each section to 3-5 sentences.

Performance Data for ${rangeLabel}:
- Jira time logged: ${jiraHrsLogged} (${jiraSeconds}s) across ${sessionCount} sessions
- Meeting-related time logged: ${meetingHrsLogged} (${meetingSeconds}s)
- Jira tickets total: ${stats.jiraTotal}
- Jira tickets done/completed: ${stats.jiraDone} (${stats.completionRate}% completion rate)
- Jira tickets in progress: ${stats.jiraInProgress}
- Jira tickets in review: ${stats.jiraInReview}
- Jira tickets todo/backlog: ${stats.jiraTodo}
- Estimated Jira hours (from ticket dates): ${stats.jiraHours.toFixed(1)}h
- Meeting tasks total (action items): ${stats.meetingTasksTotal}
- Meeting tasks completed: ${stats.meetingTasksDone}
- Meeting tasks active: ${stats.meetingTasksActive}
- Meetings attended (with summaries): ${stats.meetingsCount}
- Milestones total: ${stats.milestonesTotal}
- Milestones completed: ${stats.milestonesCompleted}
- Milestones in progress: ${stats.milestonesInProgress}
- Professional development activities this period: ${stats.profDevCount}
- Professional development hours this period: ${stats.profDevHours}h${communicationSection}`;

    // 9. Call Gemini or fall back to extractive
    let insights: string;
    try {
      insights = await callGemini(prompt);
    } catch {
      insights = buildExtractiveInsights(stats as unknown as Record<string, number | string>, rangeLabel);
    }

    // 10. Auto-save to performance history
    const autoLabel = `${rangeLabel} — ${format(new Date(), "MMM yyyy")}`;
    const saved = await savePerformanceEntry({
      dateLabel: autoLabel,
      rangeLabel,
      startDate,
      endDate,
      stats: stats as Record<string, number | string>,
      insights,
    });
    const savedId = saved[0]?.id ?? null;

    // 11. Return result
    return NextResponse.json({ stats, insights, rangeLabel, savedId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/performance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
