export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, fetchTicketsByRange } from "@/lib/jira";
import { loadTasks } from "@/lib/taskStoreServer";
import { loadMilestones } from "@/lib/milestoneStore";
import { loadProfDev } from "@/lib/profDevStore";
import { loadSummaries } from "@/lib/summaryStore";
import { loadGrowthStats } from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";
import { savePerformanceEntry } from "@/lib/performanceStore";
import { pool } from "@/lib/db";
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

// ── Priority weights ────────────────────────────────────────────────────────

function jiraPriorityWeight(priority: string): number {
  const p = priority.toLowerCase();
  if (p === "highest" || p === "critical" || p === "blocker") return 4;
  if (p === "high") return 3;
  if (p === "medium") return 2;
  return 1;
}

function taskPriorityWeight(priority: string): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

// ── Extractive fallback ─────────────────────────────────────────────────────

function signal(
  v: number,
  strongThreshold: number,
  developingThreshold: number
): "Strong" | "Developing" | "Needs Attention" {
  if (v >= strongThreshold) return "Strong";
  if (v >= developingThreshold) return "Developing";
  return "Needs Attention";
}

function buildExtractiveInsights(
  stats: Record<string, number | string>,
  rangeLabel: string
): string {
  const jiraHrsLogged = formatHours(stats.jiraLoggedSeconds as number);
  const meetingHrsLogged = formatHours(stats.meetingLoggedSeconds as number);
  const pwRate = stats.allTasksPriorityWeightedRate as number;
  const rawRate = stats.allTasksRawCompletionRate as number;
  const qualityDelta = pwRate - rawRate;

  const leadershipSig = signal(
    (stats.tasksWithAssignees as number) + (stats.decisionsCount as number) * 2,
    4, 2
  );
  const methodSig = signal(
    (stats.tasksWithComments as number) + (stats.tasksWithChecklists as number) + (stats.tasksWithDescriptions as number),
    6, 3
  );
  const socialSig = signal(
    (stats.meetingsCount as number) + (stats.uniqueMeetingSources as number),
    6, 3
  );
  const problemSolvingSig = signal(
    (stats.allHighPriDone as number) + Math.round((stats.checklistCompletionRate as number) / 20),
    5, 2
  );

  return [
    `## Time Management`,
    `You logged ${jiraHrsLogged} on Jira tickets and ${meetingHrsLogged} in meeting-related work during ${rangeLabel}. Across ${stats.sessionCount} sessions your time spanned Jira delivery, project tasks, and meeting follow-ups. Consistent session frequency keeps momentum and stakeholder visibility high.`,
    ``,
    `## Delivery Quality`,
    `Across all task sources, you completed ${stats.allTasksDone} of ${stats.allTasksTotal} tasks (${rawRate}% raw). Priority-weighted delivery stands at ${pwRate}% — ${qualityDelta > 0 ? `${qualityDelta}pts above raw, meaning higher-value work is landing first` : qualityDelta < 0 ? `${Math.abs(qualityDelta)}pts below raw — high-priority tasks are lagging behind lower-priority ones` : "on par with the raw rate"}. Jira: ${stats.jiraDone}/${stats.jiraTotal} done (${stats.jiraHighPriDone} high-pri). Meeting tasks: ${stats.meetingTasksDone}/${stats.meetingTasksTotal}. Project tasks: ${stats.projectTasksDone}/${stats.projectTasksTotal}.`,
    ``,
    `## Skill Takeaways`,
    `**Leadership:** ${leadershipSig}. ${stats.tasksWithAssignees} task(s) delegated to others, ${stats.milestonesCompleted} milestone(s) completed, and involvement in ${stats.decisionsCount} decision(s) recorded in meetings.`,
    `**Methodology:** ${methodSig}. ${stats.tasksWithComments} task(s) have documented comments, ${stats.tasksWithChecklists} used checklists (${stats.checklistCompletionRate}% sub-task completion), and ${stats.tasksWithDescriptions} had written descriptions — together indicating how structured and intentional the approach to work is.`,
    `**Social Competency:** ${socialSig}. Active across ${stats.uniqueMeetingSources} meeting contexts, attending ${stats.meetingsCount} meetings with ${stats.allActionItemsDone} meeting action items completed.`,
    `**Problem Solving:** ${problemSolvingSig}. ${stats.allHighPriDone} high-priority tasks completed across all sources. Checklist usage on ${stats.tasksWithChecklists} tasks with ${stats.checklistCompletionRate}% completion shows systematic breakdown of complex work.`,
    ``,
    `## Leadership & Collaboration`,
    `You attended ${stats.meetingsCount} meetings generating ${stats.meetingTasksTotal} action items across ${stats.uniqueMeetingSources} unique meeting source(s). ${stats.meetingTasksDone} are done and ${stats.meetingTasksActive} remain active. Task delegation recorded for ${stats.tasksWithAssignees} item(s), and you were part of ${stats.decisionsCount} key decision(s).`,
    ``,
    `## Professional Growth`,
    `${stats.profDevCount} development ${(stats.profDevCount as number) === 1 ? "activity" : "activities"} totalling ${stats.profDevHours}h logged this period. Milestones: ${stats.milestonesCompleted}/${stats.milestonesTotal} completed, ${stats.milestonesInProgress} in progress. ${(stats.assessmentsCompleted as number) > 0 ? `${stats.assessmentsCompleted} scenario-based daily assessment(s) completed with an average score of ${stats.assessmentAvgScore}% — demonstrating deliberate applied learning. ` : ""}${(stats.dbTimeLogMinutes as number) > 0 ? `${Math.floor((stats.dbTimeLogMinutes as number)/60)}h logged directly against project tasks across ${stats.dbTimeLogActiveDays} active day(s). ` : ""}Continued investment in deliberate learning and milestone delivery builds a compounding performance narrative.`,
    ``,
    `## Key Recommendations`,
    `1. Unblock the ${stats.allHighPriStuck} high-priority task(s) currently stuck — these carry the most weighted delivery impact.`,
    `2. Add comments or descriptions to tasks lacking them — it doubles as methodology evidence and improves handoff clarity.`,
    `3. Close the ${stats.meetingTasksActive} active meeting action items; they are visible to stakeholders and signal follow-through.`,
    `4. Push the ${stats.milestonesInProgress} in-progress milestone(s) to completion before taking on new ones.`,
    `5. Increase decision involvement and task delegation to strengthen leadership and social competency signals.`,
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
      tickets = [];
    }

    // 2. Load ALL tasks (meeting tasks + project tasks — same table, differentiated by projectId/source)
    const allTasks = await loadTasks();
    const meetingTasks = allTasks.filter((t) => !t.projectId);
    const projectTasks = allTasks.filter((t) => !!t.projectId);

    // 3. Fetch task comments for methodology signals
    const commentsRes = await pool.query<{
      task_id: string; body: string; created_at: string;
      priority: string; status: string; task_text: string;
    }>(
      `SELECT tc.task_id, tc.body, tc.created_at, t.priority, t.status, t.text AS task_text
       FROM task_comments tc
       JOIN tasks t ON tc.task_id = t.id
       ORDER BY tc.created_at DESC
       LIMIT 50`
    );
    const allComments = commentsRes.rows;
    const commentedTaskIds = new Set(allComments.map((c) => c.task_id));
    const tasksWithComments = commentedTaskIds.size;
    // Sample comments for methodology assessment (show the actual thinking)
    const sampleComments = allComments.slice(0, 8).map(
      (c) => `[${c.priority}/${c.status}] "${c.task_text.slice(0, 40)}": ${c.body.slice(0, 120)}`
    );

    // 4. Load milestones, profdev, summaries, growth stats
    const milestones = await loadMilestones();
    const allProfDev = await loadProfDev();
    const filteredProfDev = allProfDev.filter(
      (e) => e.completedDate >= startDate && e.completedDate <= endDate
    );
    const summaries = await loadSummaries();
    const growthStats = await loadGrowthStats(startDate, endDate).catch(() => null);

    // 4b. Load time logs from DB for the period (project task time — separate from Jira timer)
    const timeLogsRes = await pool.query<{
      description: string; duration_min: number; logged_date: string;
      project_name: string | null; task_text: string | null;
    }>(
      `SELECT tl.description, tl.duration_min, tl.logged_date,
              p.name AS project_name, t.text AS task_text
       FROM time_logs tl
       LEFT JOIN projects p ON p.id = tl.project_id
       LEFT JOIN tasks t    ON t.id  = tl.task_id
       WHERE tl.logged_date BETWEEN $1 AND $2
       ORDER BY tl.logged_date DESC
       LIMIT 25`,
      [startDate, endDate]
    );
    const dbTimeLogs = timeLogsRes.rows;
    const dbTotalMinutes = dbTimeLogs.reduce((s, l) => s + l.duration_min, 0);
    const dbActiveDays = new Set(dbTimeLogs.map((l) => l.logged_date)).size;

    // 4c. Load assessment submissions for the period
    const assessRes = await pool.query<{
      date_key: string; score: number; scenario: string;
    }>(
      `SELECT s.date_key, s.score::int AS score, a.scenario
       FROM growth_assessment_submissions s
       JOIN growth_assessments a ON a.id = s.assessment_id
       WHERE s.date_key BETWEEN $1 AND $2
       ORDER BY s.date_key DESC
       LIMIT 10`,
      [startDate, endDate]
    );
    const assessments = assessRes.rows;
    const assessAvgScore = assessments.length > 0
      ? Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length)
      : null;

    // 5. Jira status buckets
    const jiraDone = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s === "done" || s === "closed" || s === "resolved";
    });
    const jiraInProgress = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s === "in progress" || s === "in-progress";
    });
    const jiraInReview = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s.includes("review") || s === "in review";
    });
    const jiraTodo = tickets.filter((t) => {
      const s = t.status.toLowerCase();
      return s === "to do" || s === "todo" || s === "open" || s === "backlog";
    });

    // 6. Jira quality weighting
    const jiraDoneIds = new Set(jiraDone.map((t) => t.id));
    const jiraHighPri = tickets.filter((t) => jiraPriorityWeight(t.priority) >= 3);
    const jiraHighPriDone = jiraHighPri.filter((t) => jiraDoneIds.has(t.id));
    const jiraHighPriStuck = jiraHighPri.filter((t) => !jiraDoneIds.has(t.id));
    const jiraMedPri = tickets.filter((t) => jiraPriorityWeight(t.priority) === 2);
    const jiraMedPriDone = jiraMedPri.filter((t) => jiraDoneIds.has(t.id));
    const jiraTotalWeighted = tickets.reduce((s, t) => s + jiraPriorityWeight(t.priority), 0);
    const jiraEarnedWeighted = jiraDone.reduce((s, t) => s + jiraPriorityWeight(t.priority), 0);
    const jiraPriorityWeightedRate =
      jiraTotalWeighted > 0 ? Math.round((jiraEarnedWeighted / jiraTotalWeighted) * 100) : 0;

    const topDoneTickets = [...jiraDone]
      .sort((a, b) => jiraPriorityWeight(b.priority) - jiraPriorityWeight(a.priority))
      .slice(0, 5)
      .map((t) => `${t.key}: ${t.summary} [${t.priority}]`);
    const topStuckTickets = [...jiraInProgress, ...jiraInReview]
      .sort((a, b) => jiraPriorityWeight(b.priority) - jiraPriorityWeight(a.priority))
      .slice(0, 4)
      .map((t) => `${t.key}: ${t.summary} [${t.priority}, ${t.status}]`);

    // 7. All-tasks quality weighting (meeting + project tasks)
    const allTasksDone = allTasks.filter((t) => t.status === "done").length;
    const allTasksRawCompletionRate =
      allTasks.length > 0 ? Math.round((allTasksDone / allTasks.length) * 100) : 0;
    const allTasksTotalWeighted = allTasks.reduce((s, t) => s + taskPriorityWeight(t.priority), 0);
    const allTasksEarnedWeighted = allTasks
      .filter((t) => t.status === "done")
      .reduce((s, t) => s + taskPriorityWeight(t.priority), 0);
    const allTasksPriorityWeightedRate =
      allTasksTotalWeighted > 0
        ? Math.round((allTasksEarnedWeighted / allTasksTotalWeighted) * 100)
        : 0;

    // High-priority across ALL task sources
    const allHighPriDone = allTasks.filter((t) => t.priority === "high" && t.status === "done").length;
    const allHighPriStuck = allTasks.filter((t) => t.priority === "high" && t.status !== "done").length;

    // Meeting tasks
    const meetingTasksDone = meetingTasks.filter((t) => t.status === "done").length;
    const meetingTasksActive = meetingTasks.filter((t) => t.status === "in-progress").length;

    // Project tasks
    const projectTasksDone = projectTasks.filter((t) => t.status === "done").length;
    const projectTasksInProgress = projectTasks.filter((t) => t.status === "in-progress").length;

    // 8. Task depth / methodology signals (across ALL tasks)
    const checklistItemsTotal = allTasks.reduce((s, t) => s + (t.checklist?.length ?? 0), 0);
    const checklistItemsDone = allTasks.reduce(
      (s, t) => s + (t.checklist?.filter((c) => c.done).length ?? 0), 0
    );
    const tasksWithChecklists = allTasks.filter((t) => (t.checklist?.length ?? 0) > 0).length;
    const tasksWithDescriptions = allTasks.filter(
      (t) => t.description && t.description.trim().length > 20
    ).length;
    const checklistCompletionRate =
      checklistItemsTotal > 0 ? Math.round((checklistItemsDone / checklistItemsTotal) * 100) : 0;

    // 9. Leadership signals
    const tasksWithAssignees = allTasks.filter(
      (t) => t.assignee && t.assignee.trim().length > 0
    ).length;

    // 10. Social competency signals
    const uniqueMeetingSources = new Set(meetingTasks.map((t) => t.source)).size;
    const allContributions = summaries.flatMap((s) => s.summary.contributions ?? []).filter(Boolean);
    const allDecisions = summaries.flatMap((s) => s.summary.decisions ?? []).filter(Boolean);
    const allActionItemsList = summaries
      .flatMap((s) => s.summary.actionItems ?? [])
      .filter((a) => a && a !== "No action items detected.");
    const allActionItemsDone = meetingTasksDone; // action items closed ≈ meeting tasks done
    const avgContribLen =
      allContributions.length > 0
        ? Math.round(allContributions.reduce((s, c) => s + c.length, 0) / allContributions.length)
        : 0;
    const sampleContribs = allContributions.slice(0, 5);

    const stats = {
      // Jira
      jiraTotal: tickets.length,
      jiraDone: jiraDone.length,
      jiraInProgress: jiraInProgress.length,
      jiraInReview: jiraInReview.length,
      jiraTodo: jiraTodo.length,
      jiraHours: tickets.reduce((s, t) => s + t.hours, 0),
      completionRate: tickets.length > 0 ? Math.round((jiraDone.length / tickets.length) * 100) : 0,
      jiraPriorityWeightedRate,
      jiraHighPriTotal: jiraHighPri.length,
      jiraHighPriDone: jiraHighPriDone.length,
      jiraHighPriStuck: jiraHighPriStuck.length,
      jiraMedPriTotal: jiraMedPri.length,
      jiraMedPriDone: jiraMedPriDone.length,
      // All tasks combined
      allTasksTotal: allTasks.length,
      allTasksDone,
      allTasksRawCompletionRate,
      allTasksPriorityWeightedRate,
      allHighPriDone,
      allHighPriStuck,
      // Meeting tasks
      meetingTasksTotal: meetingTasks.length,
      meetingTasksDone,
      meetingTasksActive,
      uniqueMeetingSources,
      // Project tasks
      projectTasksTotal: projectTasks.length,
      projectTasksDone,
      projectTasksInProgress,
      // Methodology
      tasksWithComments,
      tasksWithChecklists,
      checklistItemsTotal,
      checklistItemsDone,
      checklistCompletionRate,
      tasksWithDescriptions,
      // Leadership
      tasksWithAssignees,
      decisionsCount: allDecisions.length,
      // Rest
      milestonesTotal: milestones.length,
      milestonesCompleted: milestones.filter((m) => m.status === "completed").length,
      milestonesInProgress: milestones.filter((m) => m.status === "in-progress").length,
      profDevCount: filteredProfDev.length,
      profDevHours: filteredProfDev.reduce((s, e) => s + (e.durationHours ?? 0), 0),
      meetingsCount: summaries.length,
      allActionItemsDone,
      jiraLoggedSeconds: jiraSeconds,
      meetingLoggedSeconds: meetingSeconds,
      sessionCount,
      rangeLabel,
      // DB-sourced time logs
      dbTimeLogMinutes: dbTotalMinutes,
      dbTimeLogEntries: dbTimeLogs.length,
      dbTimeLogActiveDays: dbActiveDays,
      // Assessment performance
      assessmentsCompleted: assessments.length,
      assessmentAvgScore: assessAvgScore ?? 0,
    };

    // 11. Build prompt sections
    const jiraHrsLogged = formatHours(jiraSeconds);
    const meetingHrsLogged = formatHours(meetingSeconds);

    const jiraQualitySection = tickets.length > 0 ? `

Jira Ticket Quality:
- Priority-weighted rate: ${jiraPriorityWeightedRate}% vs raw ${stats.completionRate}% (${jiraPriorityWeightedRate > stats.completionRate ? "closing higher-value work first ✓" : jiraPriorityWeightedRate < stats.completionRate ? "high-priority tickets lagging ⚠" : "balanced"})
- High-priority: ${jiraHighPriDone.length} done / ${jiraHighPri.length} total | ${jiraHighPriStuck.length} still blocked
- Medium-priority: ${jiraMedPriDone.length} done / ${jiraMedPri.length} total
${topDoneTickets.length > 0 ? `- Completed (by priority):\n${topDoneTickets.map((t) => `  • ${t}`).join("\n")}` : ""}
${topStuckTickets.length > 0 ? `- Blocked high-priority:\n${topStuckTickets.map((t) => `  • ${t}`).join("\n")}` : ""}` : "";

    const taskQualitySection = allTasks.length > 0 ? `

All Tasks Quality (meeting + project tasks combined):
- Total: ${allTasks.length} tasks | done: ${allTasksDone} (raw ${allTasksRawCompletionRate}%, priority-weighted ${allTasksPriorityWeightedRate}%)
- Meeting tasks: ${meetingTasksDone}/${meetingTasks.length} done | across ${uniqueMeetingSources} meeting source(s)
- Project tasks: ${projectTasksDone}/${projectTasks.length} done | ${projectTasksInProgress} in progress
- High-priority tasks (all sources): ${allHighPriDone} done, ${allHighPriStuck} unresolved
- Tasks delegated / with assignees: ${tasksWithAssignees}

Task Depth & Methodology Signals:
- Tasks with comments: ${tasksWithComments} (shows documented thinking / collaboration)
- Tasks with checklists: ${tasksWithChecklists} | sub-task completion: ${checklistItemsDone}/${checklistItemsTotal} (${checklistCompletionRate}%)
- Tasks with written descriptions: ${tasksWithDescriptions}
${sampleComments.length > 0 ? `- Sample task comments (assess structured thinking, clarity, problem-framing):\n${sampleComments.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}` : "- No task comments recorded this period"}` : "";

    const socialSection = allContributions.length > 0 ? `

Social Competency Evidence (from meeting transcripts):
- Meetings with recorded contributions: ${summaries.length}
- Total contributions logged: ${allContributions.length} (avg ${avgContribLen} chars — signals depth)
- Decisions involved in: ${allDecisions.length}
- Action items taken on: ${allActionItemsList.length}
- Sample contributions (assess strategic vs tactical framing, influence, clarity):
${sampleContribs.map((c, i) => `  ${i + 1}. "${c}"`).join("\n")}` : "";

    const growthSection =
      growthStats && growthStats.totalAttempts > 0
        ? `

Professional Growth — Quiz Performance:
- Topics studied: ${growthStats.topicsAttempted}/${growthStats.topicsTotal} (${growthStats.quizCompletionRate}% coverage)
- Quiz sessions: ${growthStats.totalAttempts} | Overall avg: ${growthStats.overallAvgScore}%
- Strongest: ${growthStats.strongestTopic ?? "N/A"} | Weakest: ${growthStats.weakestTopic ?? "N/A"}
- Improving: ${growthStats.topicStats.filter((t) => t.trend === "improving").map((t) => t.label).join(", ") || "None yet"}
- Below 60%: ${growthStats.topicStats.filter((t) => t.attemptCount > 0 && t.avgScore < 60).map((t) => `${t.label} (${t.avgScore}%)`).join(", ") || "None"}`
        : "";

    const timeLogSection = dbTimeLogs.length > 0 ? `

Logged Time on Project Tasks (from time_logs table — ${startDate} to ${endDate}):
- Total: ${Math.floor(dbTotalMinutes / 60)}h ${dbTotalMinutes % 60}m across ${dbActiveDays} active day(s)
- Log entries: ${dbTimeLogs.length}
- Sample entries (assess depth of work and variety of tasks tackled):
${dbTimeLogs.slice(0, 10).map((l) =>
  `  • [${l.logged_date}] ${l.project_name ?? "—"} | ${Math.floor(l.duration_min/60)}h${l.duration_min%60>0?` ${l.duration_min%60}m`:""} | ${l.task_text ? `Task: "${l.task_text.slice(0,40)}" | ` : ""}${l.description.slice(0, 80)}`
).join("\n")}` : "";

    const assessmentSection = assessments.length > 0 ? `

Daily Assessment Results (scenario-based evaluations — ${startDate} to ${endDate}):
- Assessments completed: ${assessments.length} | Average score: ${assessAvgScore}%
- Score range: ${Math.min(...assessments.map(a=>a.score))} – ${Math.max(...assessments.map(a=>a.score))}
- Recent assessments:
${assessments.slice(0, 5).map((a) =>
  `  • [${a.date_key}] Score: ${a.score}% | ${a.scenario.slice(0, 90).replace(/\n/g," ")}…`
).join("\n")}` : "";

    const prompt = `You are a performance coach assessing a Senior Associate at a technology consulting firm. Based on ALL the data below for ${rangeLabel}, produce a structured performance summary with exactly these sections in order:

## Time Management
## Delivery Quality
## Skill Takeaways
## Leadership & Collaboration
## Professional Growth
## Key Recommendations

Section guidelines:
- Each section: 3–5 sentences, specific, candid but constructive.
- "## Delivery Quality": analyse across ALL task sources (Jira + meeting tasks + project tasks). Compare raw vs priority-weighted completion rates and explain what the gap means about prioritisation behaviour.
- "## Skill Takeaways": rate the person on exactly these four dimensions. Each dimension: one bold label, a signal badge (Strong / Developing / Needs Attention), then 1–2 sentences of specific evidence. Format exactly:
  **Leadership:** [signal]. [evidence: task delegation, decision involvement, milestone ownership, direction-setting]
  **Methodology:** [signal]. [evidence: task comments (what the comments reveal about structured thinking and approach), checklist usage, description quality, how work is broken down and documented]
  **Social Competency:** [signal]. [evidence: meeting breadth, contribution quality/depth, decisions influenced, cross-team action items]
  **Problem Solving:** [signal]. [evidence: high-priority resolution across all sources, handling of blocked/stuck work, systematic execution signals]

Performance Data for ${rangeLabel}:
- Time logged: ${jiraHrsLogged} (Jira timer, ${sessionCount} sessions) + ${meetingHrsLogged} (meetings) + ${Math.floor(dbTotalMinutes/60)}h ${dbTotalMinutes%60}m (project task logs, ${dbActiveDays} days)
- Jira: ${tickets.length} tickets | done: ${jiraDone.length} (${stats.completionRate}% raw) | in-progress: ${jiraInProgress.length} | in-review: ${jiraInReview.length} | todo: ${jiraTodo.length}
- All tasks (meeting + project): ${allTasks.length} total | ${allTasksDone} done (raw ${allTasksRawCompletionRate}%, weighted ${allTasksPriorityWeightedRate}%)
- Meetings: ${summaries.length} | Milestones: ${stats.milestonesCompleted}/${stats.milestonesTotal} | Profdev: ${stats.profDevCount} activities, ${stats.profDevHours}h
- Daily assessments: ${assessments.length} completed | Avg score: ${assessAvgScore ?? "N/A"}%${jiraQualitySection}${taskQualitySection}${timeLogSection}${assessmentSection}${socialSection}${growthSection}`;

    // 12. Call Gemini or fall back
    let insights: string;
    try {
      insights = await callGemini(prompt);
    } catch {
      insights = buildExtractiveInsights(stats as unknown as Record<string, number | string>, rangeLabel);
    }

    // 13. Auto-save
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

    return NextResponse.json({ stats, insights, rangeLabel, savedId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/performance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
