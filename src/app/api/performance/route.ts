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

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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

function signal(v: number, strong: number, developing: number) {
  if (v >= strong) return "Strong";
  if (v >= developing) return "Developing";
  return "Needs Attention";
}

// ── Extractive fallback (when Gemini unavailable) ────────────────────────────

function buildExtractiveInsights(
  stats: Record<string, number | string>,
  rangeLabel: string
): string {
  const pwRate  = stats.allTasksPriorityWeightedRate as number;
  const rawRate = stats.allTasksRawCompletionRate as number;
  const totalHrs = Math.floor((stats.dbTimeLogMinutes as number) / 60);

  return [
    `## What Brempong Has Been Working On`,
    `Over ${rangeLabel}, Brempong has been active across ${stats.projectCount} project(s), logging ${fmtMins(stats.dbTimeLogMinutes as number)} of hands-on project work across ${stats.dbTimeLogActiveDays} active days. He completed ${stats.allTasksDone} of ${stats.allTasksTotal} tasks (${rawRate}% raw completion, ${pwRate}% priority-weighted), with ${stats.allHighPriDone} high-priority items delivered and ${stats.allHighPriStuck} still in progress.`,
    ``,
    `## What He Has Built and Why It Matters`,
    `Brempong has closed ${stats.milestonesCompleted} career milestones this period, each representing a capability he did not have before. His ${stats.totalSkillAreas} skill areas span ${stats.projectCount} distinct domains, built through ${totalHrs}+ hours of delivery work. These are not theoretical skills — they are grounded in real tickets, real bugs, and real production deployments.`,
    ``,
    `## How He Works (Methodology & Approach)`,
    `${stats.tasksWithChecklists} of Brempong's tasks include structured checklists with ${stats.checklistCompletionRate}% sub-task completion, and ${stats.tasksWithDescriptions} have written descriptions — showing a deliberate, documented approach to work. ${stats.tasksWithComments} tasks have comments, indicating collaborative thinking and knowledge sharing. Delegation is evident across ${stats.tasksWithAssignees} tasks with assigned team members.`,
    ``,
    `## Growth in Numbers`,
    `Brempong has completed ${stats.totalAssessmentsEver} scenario-based assessments with an all-time average score of ${stats.totalAssessAvgScore}% — rising to ${stats.assessmentAvgScore}% in this period. His quiz performance spans ${stats.assessmentsCompleted} topics, all backed by real work done on the same problems tested. ${stats.milestonesCompleted} milestones completed | ${stats.totalSkillAreas} skill areas unlocked.`,
    ``,
    `## Where This Is Taking Him`,
    `Based on the career roles unlocked through his milestones — Analytics Engineer, Data Quality Engineer, Platform Automation Engineer, Production Data Engineer, Cloud/Network Engineer, DevSecOps Engineer — Brempong is building a multi-domain engineering profile. His skill depth ranges from Owner (Data Quality) and Lead (Analytics Engineering) down to Emerging (DevSecOps, Security), showing a consultant who is deepening established expertise while actively expanding into new domains.`,
    ``,
    `## What to Focus on Next`,
    `1. Close the ${stats.allHighPriStuck} high-priority task(s) still open — these are the highest-weighted delivery gap.`,
    `2. Push the ${stats.milestonesInProgress} in-progress milestone(s) to completion to fully realise the career transition they represent.`,
    `3. Increase task commenting — ${stats.tasksWithComments} documented so far; the target should be every complex task having a comment thread showing reasoning.`,
    `4. Elevate Emerging-level skills (DevSecOps, Security, Reliability Engineering) through deliberate practice on real infrastructure work.`,
    `5. Log meeting contributions more consistently — ${stats.decisionsCount} decisions recorded but deeper cross-functional engagement would strengthen the leadership signal.`,
  ].join("\n");
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PerformanceRequestBody;
    const { startDate, endDate, rangeLabel, jiraSeconds, meetingSeconds, sessionCount } = body;

    if (!startDate || !endDate || !rangeLabel) {
      return NextResponse.json({ error: "Missing required fields: startDate, endDate, rangeLabel" }, { status: 400 });
    }

    // ── 1. Jira tickets ──────────────────────────────────────────────────────
    let tickets: Awaited<ReturnType<typeof fetchTicketsByRange>> = [];
    try {
      const user = await getCurrentUser();
      tickets = await fetchTicketsByRange(user.accountId, startDate, endDate);
    } catch { tickets = []; }

    // ── 2. All tasks ─────────────────────────────────────────────────────────
    const allTasks = await loadTasks();
    const meetingTasks = allTasks.filter((t) => !t.projectId);
    const projectTasks = allTasks.filter((t) => !!t.projectId);

    // ── 3. Task comments ─────────────────────────────────────────────────────
    const commentsRes = await pool.query<{
      task_id: string; body: string; created_at: string;
      priority: string; status: string; task_text: string;
    }>(
      `SELECT tc.task_id, tc.body, tc.created_at, t.priority, t.status, t.text AS task_text
       FROM task_comments tc JOIN tasks t ON tc.task_id = t.id
       ORDER BY tc.created_at DESC LIMIT 50`
    );
    const allComments = commentsRes.rows;
    const commentedTaskIds = new Set(allComments.map((c) => c.task_id));
    const tasksWithComments = commentedTaskIds.size;
    const sampleComments = allComments.slice(0, 8).map(
      (c) => `[${c.priority}/${c.status}] "${c.task_text.slice(0, 40)}": ${c.body.slice(0, 120)}`
    );

    // ── 4. Core loads ────────────────────────────────────────────────────────
    const milestones    = await loadMilestones();
    const allProfDev    = await loadProfDev();
    const filteredProfDev = allProfDev.filter(e => e.completedDate >= startDate && e.completedDate <= endDate);
    const summaries     = await loadSummaries();
    const growthStats   = await loadGrowthStats(startDate, endDate).catch(() => null);

    // ── 5. Projects with per-project stats ───────────────────────────────────
    const projectStatsRes = await pool.query<{
      id: string; name: string; color: string;
      task_count: number; done_count: number; in_progress_count: number;
      total_min: number; log_entries: number; milestone_count: number;
    }>(`
      SELECT
        p.id, p.name, p.color,
        COUNT(DISTINCT t.id)::int                                         AS task_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done')::int        AS done_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'in-progress')::int AS in_progress_count,
        COALESCE(SUM(tl.duration_min), 0)::int                            AS total_min,
        COUNT(DISTINCT tl.id)::int                                        AS log_entries,
        COUNT(DISTINCT m.id)::int                                         AS milestone_count
      FROM projects p
      LEFT JOIN tasks t        ON t.project_id = p.id
      LEFT JOIN time_logs tl   ON tl.project_id = p.id
      LEFT JOIN milestones m   ON m.project_id = p.id
      GROUP BY p.id, p.name, p.color
      ORDER BY task_count DESC
    `);
    const projectStats = projectStatsRes.rows;

    // ── 6. Time logs — full DB + date-filtered ────────────────────────────────
    const timeLogsAllRes = await pool.query<{
      total_min: number; total_entries: number; active_days: number;
    }>(`
      SELECT
        COALESCE(SUM(duration_min), 0)::int AS total_min,
        COUNT(*)::int                        AS total_entries,
        COUNT(DISTINCT logged_date)::int     AS active_days
      FROM time_logs
    `);
    const timeLogsAll = timeLogsAllRes.rows[0];

    // Period totals (no limit — for accurate stats)
    const timeLogsTotalsRes = await pool.query<{
      total_min: number; entry_count: number; active_days: number;
    }>(
      `SELECT COALESCE(SUM(duration_min),0)::int AS total_min,
              COUNT(*)::int                       AS entry_count,
              COUNT(DISTINCT logged_date)::int    AS active_days
       FROM time_logs
       WHERE logged_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );
    const dbTotalMinutes = timeLogsTotalsRes.rows[0].total_min;
    const dbActiveDays   = timeLogsTotalsRes.rows[0].active_days;
    const dbEntryCount   = timeLogsTotalsRes.rows[0].entry_count;

    // Sample rows for the AI prompt (limited)
    const timeLogsRes = await pool.query<{
      description: string; duration_min: number; logged_date: string;
      project_name: string | null; task_text: string | null;
    }>(
      `SELECT tl.description, tl.duration_min, tl.logged_date,
              p.name AS project_name, t.text AS task_text
       FROM time_logs tl
       LEFT JOIN projects p ON p.id = tl.project_id
       LEFT JOIN tasks t    ON t.id = tl.task_id
       WHERE tl.logged_date BETWEEN $1 AND $2
       ORDER BY tl.logged_date DESC LIMIT 20`,
      [startDate, endDate]
    );
    const dbTimeLogs = timeLogsRes.rows;

    // ── 7. Milestones — detail ────────────────────────────────────────────────
    const msDetailRes = await pool.query<{
      id: string; title: string; status: string; category: string;
      career_impact: string | null; completed_at: string | null;
      why_it_matters: string | null; key_deliverables: string[];
      related_tickets: string[]; project_name: string | null; skill_count: number;
    }>(`
      SELECT m.id, m.title, m.status, m.category,
             m.career_impact, m.completed_at,
             m.why_it_matters, m.key_deliverables, m.related_tickets,
             p.name AS project_name,
             COUNT(s.id)::int AS skill_count
      FROM milestones m
      LEFT JOIN projects p          ON p.id = m.project_id
      LEFT JOIN milestone_skills s  ON s.milestone_id = m.id
      GROUP BY m.id, m.title, m.status, m.category, m.career_impact, m.completed_at,
               m.why_it_matters, m.key_deliverables, m.related_tickets, p.name
      ORDER BY m.completed_at NULLS LAST, m.created_at
    `);

    // Milestone skills by domain
    const msSkillsRes = await pool.query<{
      domain: string; proficiency_level: string; skill_count: number;
    }>(`
      SELECT domain, proficiency_level, COUNT(*)::int AS skill_count
      FROM milestone_skills
      GROUP BY domain, proficiency_level
      ORDER BY domain, proficiency_level
    `);

    // ── 8. Growth — full quiz + assessment picture ────────────────────────────
    const quizSummaryRes = await pool.query<{
      topic_id: string; label: string; attempt_count: number;
      avg_score: number; best_score: number; trend: string | null;
    }>(`
      SELECT
        t.id AS topic_id, t.label,
        COUNT(a.id)::int                             AS attempt_count,
        ROUND(AVG(a.score)::numeric, 1)              AS avg_score,
        COALESCE(MAX(a.score), 0)                    AS best_score,
        i.trend
      FROM growth_topics t
      LEFT JOIN growth_quiz_attempts a ON a.topic_id = t.id
      LEFT JOIN growth_insights i      ON i.topic_id = t.id
      GROUP BY t.id, t.label, i.trend
      HAVING COUNT(a.id) > 0
      ORDER BY avg_score DESC
    `);

    const assessAllRes = await pool.query<{
      total: number; avg_score: number; min_score: number; max_score: number;
    }>(`
      SELECT COUNT(*)::int AS total,
             ROUND(AVG(score)::numeric,1) AS avg_score,
             MIN(score)::int AS min_score,
             MAX(score)::int AS max_score
      FROM growth_assessment_submissions
    `);
    const assessAll = assessAllRes.rows[0];

    const assessRes = await pool.query<{
      date_key: string; score: number; scenario: string;
    }>(
      `SELECT s.date_key, s.score::int AS score, a.scenario
       FROM growth_assessment_submissions s
       JOIN growth_assessments a ON a.id = s.assessment_id
       WHERE s.date_key BETWEEN $1 AND $2
       ORDER BY s.date_key DESC LIMIT 10`,
      [startDate, endDate]
    );
    const assessments    = assessRes.rows;
    const assessAvgScore = assessments.length > 0
      ? Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length) : null;

    // ── 9. Notes & task notes count ──────────────────────────────────────────
    const notesCountRes = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM project_notes`
    );
    const taskCommentsCountRes = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM task_comments`
    );

    // ── 10. Jira bucket calculations ─────────────────────────────────────────
    const jiraDone        = tickets.filter(t => ["done","closed","resolved"].includes(t.status.toLowerCase()));
    const jiraInProgress  = tickets.filter(t => ["in progress","in-progress"].includes(t.status.toLowerCase()));
    const jiraInReview    = tickets.filter(t => t.status.toLowerCase().includes("review"));
    const jiraTodo        = tickets.filter(t => ["to do","todo","open","backlog"].includes(t.status.toLowerCase()));
    const jiraDoneIds     = new Set(jiraDone.map(t => t.id));
    const jiraHighPri     = tickets.filter(t => jiraPriorityWeight(t.priority) >= 3);
    const jiraHighPriDone = jiraHighPri.filter(t => jiraDoneIds.has(t.id));
    const jiraHighPriStuck = jiraHighPri.filter(t => !jiraDoneIds.has(t.id));
    const jiraMedPri      = tickets.filter(t => jiraPriorityWeight(t.priority) === 2);
    const jiraMedPriDone  = jiraMedPri.filter(t => jiraDoneIds.has(t.id));
    const jiraTotalWeighted  = tickets.reduce((s, t) => s + jiraPriorityWeight(t.priority), 0);
    const jiraEarnedWeighted = jiraDone.reduce((s, t) => s + jiraPriorityWeight(t.priority), 0);
    const jiraPriorityWeightedRate = jiraTotalWeighted > 0 ? Math.round((jiraEarnedWeighted / jiraTotalWeighted) * 100) : 0;
    const topDoneTickets  = [...jiraDone].sort((a,b) => jiraPriorityWeight(b.priority) - jiraPriorityWeight(a.priority)).slice(0,5).map(t => `${t.key}: ${t.summary} [${t.priority}]`);
    const topStuckTickets = [...jiraInProgress, ...jiraInReview].sort((a,b) => jiraPriorityWeight(b.priority) - jiraPriorityWeight(a.priority)).slice(0,4).map(t => `${t.key}: ${t.summary} [${t.priority}, ${t.status}]`);

    // ── 11. Task quality metrics ──────────────────────────────────────────────
    const allTasksDone           = allTasks.filter(t => t.status === "done").length;
    const allTasksRawCompletionRate = allTasks.length > 0 ? Math.round((allTasksDone / allTasks.length) * 100) : 0;
    const allTasksTotalWeighted  = allTasks.reduce((s, t) => s + taskPriorityWeight(t.priority), 0);
    const allTasksEarnedWeighted = allTasks.filter(t => t.status === "done").reduce((s, t) => s + taskPriorityWeight(t.priority), 0);
    const allTasksPriorityWeightedRate = allTasksTotalWeighted > 0 ? Math.round((allTasksEarnedWeighted / allTasksTotalWeighted) * 100) : 0;
    const allHighPriDone  = allTasks.filter(t => t.priority === "high" && t.status === "done").length;
    const allHighPriStuck = allTasks.filter(t => t.priority === "high" && t.status !== "done").length;
    const meetingTasksDone   = meetingTasks.filter(t => t.status === "done").length;
    const meetingTasksActive = meetingTasks.filter(t => t.status === "in-progress").length;
    const projectTasksDone      = projectTasks.filter(t => t.status === "done").length;
    const projectTasksInProgress = projectTasks.filter(t => t.status === "in-progress").length;
    const checklistItemsTotal = allTasks.reduce((s, t) => s + (t.checklist?.length ?? 0), 0);
    const checklistItemsDone  = allTasks.reduce((s, t) => s + (t.checklist?.filter(c => c.done).length ?? 0), 0);
    const tasksWithChecklists    = allTasks.filter(t => (t.checklist?.length ?? 0) > 0).length;
    const tasksWithDescriptions  = allTasks.filter(t => t.description && t.description.trim().length > 20).length;
    const checklistCompletionRate = checklistItemsTotal > 0 ? Math.round((checklistItemsDone / checklistItemsTotal) * 100) : 0;
    const tasksWithAssignees     = allTasks.filter(t => t.assignee && t.assignee.trim().length > 0).length;
    const uniqueMeetingSources   = new Set(meetingTasks.map(t => t.source)).size;
    const allContributions       = summaries.flatMap(s => s.summary.contributions ?? []).filter(Boolean);
    const allDecisions           = summaries.flatMap(s => s.summary.decisions ?? []).filter(Boolean);
    const allActionItemsList     = summaries.flatMap(s => s.summary.actionItems ?? []).filter(a => a && a !== "No action items detected.");
    const allActionItemsDone     = meetingTasksDone;
    const avgContribLen          = allContributions.length > 0 ? Math.round(allContributions.reduce((s,c) => s + c.length, 0) / allContributions.length) : 0;
    const sampleContribs         = allContributions.slice(0, 5);

    const stats = {
      jiraTotal: tickets.length, jiraDone: jiraDone.length, jiraInProgress: jiraInProgress.length,
      jiraInReview: jiraInReview.length, jiraTodo: jiraTodo.length,
      jiraHours: tickets.reduce((s, t) => s + t.hours, 0),
      completionRate: tickets.length > 0 ? Math.round((jiraDone.length / tickets.length) * 100) : 0,
      jiraPriorityWeightedRate, jiraHighPriTotal: jiraHighPri.length,
      jiraHighPriDone: jiraHighPriDone.length, jiraHighPriStuck: jiraHighPriStuck.length,
      jiraMedPriTotal: jiraMedPri.length, jiraMedPriDone: jiraMedPriDone.length,
      allTasksTotal: allTasks.length, allTasksDone, allTasksRawCompletionRate, allTasksPriorityWeightedRate,
      allHighPriDone, allHighPriStuck,
      meetingTasksTotal: meetingTasks.length, meetingTasksDone, meetingTasksActive, uniqueMeetingSources,
      projectTasksTotal: projectTasks.length, projectTasksDone, projectTasksInProgress,
      tasksWithComments, tasksWithChecklists, checklistItemsTotal, checklistItemsDone,
      checklistCompletionRate, tasksWithDescriptions, tasksWithAssignees,
      decisionsCount: allDecisions.length,
      milestonesTotal: milestones.length,
      milestonesCompleted: milestones.filter(m => m.status === "completed").length,
      milestonesInProgress: milestones.filter(m => m.status === "in-progress").length,
      profDevCount: filteredProfDev.length,
      profDevHours: filteredProfDev.reduce((s, e) => s + (e.durationHours ?? 0), 0),
      meetingsCount: summaries.length, allActionItemsDone,
      jiraLoggedSeconds: jiraSeconds, meetingLoggedSeconds: meetingSeconds, sessionCount, rangeLabel,
      dbTimeLogMinutes: dbTotalMinutes, dbTimeLogEntries: dbEntryCount, dbTimeLogActiveDays: dbActiveDays,
      totalDbTimeLogMinutes: timeLogsAll.total_min, totalDbTimeLogEntries: timeLogsAll.total_entries,
      assessmentsCompleted: assessments.length, assessmentAvgScore: assessAvgScore ?? 0,
      totalAssessmentsEver: assessAll.total, totalAssessAvgScore: assessAll.avg_score,
      totalNotesCount: notesCountRes.rows[0].total,
      totalTaskCommentsCount: taskCommentsCountRes.rows[0].total,
      totalSkillAreas: msSkillsRes.rows.reduce((s, r) => s + r.skill_count, 0),
      projectCount: projectStats.length,
    };

    // ── 12. Build comprehensive prompt ────────────────────────────────────────

    const jiraHrsLogged   = formatHours(jiraSeconds);
    const meetingHrsLogged = formatHours(meetingSeconds);

    // Per-project breakdown table
    const projectTable = projectStats.map(p =>
      `  • ${p.name}: ${p.task_count} tasks (${p.done_count} done, ${p.in_progress_count} in-progress) | ${fmtMins(p.total_min)} logged | ${p.log_entries} time entries | ${p.milestone_count} milestones`
    ).join("\n");

    // Milestone list with full evidence (key deliverables + why it matters)
    const msUnlinked = msDetailRes.rows.filter(m => !m.project_name);
    const msLinked   = msDetailRes.rows.filter(m =>  m.project_name);

    const msLines = msDetailRes.rows.map(m => {
      const title    = m.title.replace(/^First\s+/i, "");
      const proj     = m.project_name ? ` [${m.project_name}]` : " [standalone]";
      const done     = m.completed_at ? ` ✓ completed ${m.completed_at.slice(0,10)}` : ` (${m.status})`;
      const role     = m.career_impact ? `\n    Role unlocked: ${m.career_impact}` : "";
      const why      = m.why_it_matters ? `\n    Why it matters: ${m.why_it_matters}` : "";
      const tickets  = Array.isArray(m.related_tickets) && m.related_tickets.length > 0
                        ? `\n    Evidence tickets: ${m.related_tickets.join(", ")}` : "";
      const delivers = Array.isArray(m.key_deliverables) && m.key_deliverables.length > 0
                        ? `\n    Key deliverables:\n${m.key_deliverables.map(d => `      - ${d}`).join("\n")}` : "";
      const skills   = m.skill_count > 0 ? `\n    Skills gained: ${m.skill_count} area(s)` : "";
      return `  ◆ ${title}${proj}${done}${role}${why}${tickets}${delivers}${skills}`;
    }).join("\n\n");

    // Skills domain summary
    const skillDomainLines = (() => {
      const byDomain: Record<string, string[]> = {};
      for (const r of msSkillsRes.rows) {
        if (!byDomain[r.domain]) byDomain[r.domain] = [];
        byDomain[r.domain].push(`${r.proficiency_level}×${r.skill_count}`);
      }
      return Object.entries(byDomain).map(([d, levels]) => `  • ${d}: ${levels.join(", ")}`).join("\n");
    })();

    // Quiz per-topic table
    const quizLines = quizSummaryRes.rows.map(r =>
      `  • ${r.label}: ${r.attempt_count} attempt(s) | avg ${r.avg_score}% | best ${r.best_score}% | trend: ${r.trend ?? "insufficient_data"}`
    ).join("\n");

    // Assessment score history (all time)
    const assessHistory = `All-time: ${assessAll.total} submissions | avg ${assessAll.avg_score}% | range ${assessAll.min_score}–${assessAll.max_score}%`;

    // Time logs detail for period
    const timeLogDetail = dbTimeLogs.slice(0, 12).map(l =>
      `  • [${l.logged_date}] ${l.project_name ?? "—"} | ${Math.floor(l.duration_min/60)}h${l.duration_min%60>0?` ${l.duration_min%60}m`:""} | ${l.task_text ? `"${l.task_text.slice(0,40)}" — ` : ""}${l.description.slice(0, 80)}`
    ).join("\n");

    // Jira section
    const jiraDetail = tickets.length > 0 ? `
Jira Tickets (${startDate} → ${endDate}):
- ${tickets.length} total | done: ${jiraDone.length} (${stats.completionRate}% raw, ${jiraPriorityWeightedRate}% weighted) | in-progress: ${jiraInProgress.length} | in-review: ${jiraInReview.length} | todo: ${jiraTodo.length}
- High-priority: ${jiraHighPriDone.length}/${jiraHighPri.length} done | ${jiraHighPriStuck.length} blocked
- Medium-priority: ${jiraMedPriDone.length}/${jiraMedPri.length} done
${topDoneTickets.length > 0 ? `- Completed (highest priority first):\n${topDoneTickets.map(t => `  • ${t}`).join("\n")}` : ""}
${topStuckTickets.length > 0 ? `- Blocked:\n${topStuckTickets.map(t => `  • ${t}`).join("\n")}` : ""}` : "Jira Tickets: none in range (API unavailable or no tickets).";

    // Task methodology detail
    const taskMethodology = `
Task Methodology Signals:
- Tasks with documented comments: ${tasksWithComments} / ${allTasks.length} (${taskCommentsCountRes.rows[0].total} total comments in DB)
- Tasks with checklists: ${tasksWithChecklists} | sub-task completion: ${checklistItemsDone}/${checklistItemsTotal} (${checklistCompletionRate}%)
- Tasks with written descriptions: ${tasksWithDescriptions}
- Tasks with assignees (delegation signal): ${tasksWithAssignees}
${sampleComments.length > 0 ? `- Sample comments (assess thinking quality):\n${sampleComments.map((c,i) => `  ${i+1}. ${c}`).join("\n")}` : ""}`;

    // Social section
    const socialDetail = allContributions.length > 0 ? `
Meeting & Collaboration Evidence:
- ${summaries.length} meetings with recorded contributions | avg contribution depth: ${avgContribLen} chars
- Decisions involved in: ${allDecisions.length} | action items taken: ${allActionItemsList.length}
- Sample contributions:\n${sampleContribs.map((c,i) => `  ${i+1}. "${c}"`).join("\n")}` : "";

    // Growth detail
    const growthDetail = growthStats && growthStats.totalAttempts > 0 ? `
Quiz Performance (${startDate} → ${endDate}):
- Topics with attempts: ${growthStats.topicsAttempted}/${growthStats.topicsTotal} (${growthStats.quizCompletionRate}% coverage)
- Total quiz sessions in period: ${growthStats.totalAttempts} | Overall avg: ${growthStats.overallAvgScore}%
- Strongest: ${growthStats.strongestTopic ?? "N/A"} | Weakest: ${growthStats.weakestTopic ?? "N/A"}
- Improving topics: ${growthStats.topicStats.filter(t => t.trend === "improving").map(t => t.label).join(", ") || "none"}` : "";

    const prompt = `You are writing a performance narrative for Brempong Appiah Dankwah, a data and analytics consultant. You have been given everything logged in his work-tracking system. Write this as a human story — not a metrics report. Start by explaining what Brempong has actually been doing, then connect that work to the skills he has built and why those skills matter for his career. Use his name naturally throughout.

Produce exactly these sections in this order:

## What Brempong Has Been Working On
## What He Has Built and Why It Matters
## How He Works (Methodology & Approach)
## Growth in Numbers
## Where This Is Taking Him
## What to Focus on Next

---

WRITING RULES — read these carefully before writing a single word:

1. **Open with a narrative sentence**, not a bullet or a heading. The very first line after "## What Brempong Has Been Working On" must read like: "Over [period], Brempong has been [doing X across Y and Z]..." — use the project names, task titles, and ticket IDs from the data to be specific.

2. **Name the actual work.** Do not say "tasks were completed." Say which tasks — e.g. "He resolved a long-standing data discrepancy in the Coupa invoice pipeline (BROCK-010), fixing duplicate Line_IDs caused by a multi-description office code join." Pull from the task text, milestone titles (strip the word "First"), and time log descriptions.

3. **Connect work → skill → career impact.** For every body of work mentioned, follow through: "This work built [skill] because [reason], which matters because [career impact from milestone career_impact field]." Use the exact career impact values from the milestones data (e.g. "Analytics Engineer", "Cloud / Network Engineer", "DevSecOps Engineer").

4. **Quote specific numbers** — not as a list, but woven into sentences. "Brempong logged 60+ hours across 23 active days, completing 50 of 54 tasks (93% delivery rate)." The numbers should feel like supporting evidence in a case, not a dashboard.

5. **Quiz and assessment scores tell a learning story.** Don't list scores — narrate them. "His scores on SQL jumped from 40% to 92% after solving a real deduplication bug in production — the problem taught the concept." Connect score improvements to the actual tasks that caused them.

6. **Milestones describe career transitions with factual evidence.** Each milestone in the data includes "Key deliverables" — use these verbatim as proof. Write it like: "Before this period, Brempong had never owned cloud infrastructure. By June, he had designed and deployed a complete AWS VPC, provisioned public and private subnets, deployed NAT Gateway with Elastic IP, and validated end-to-end VPN connectivity — unlocking the Network Security Engineer capability." The deliverables listed under each milestone ARE the evidence. Reference them by name. Do not paraphrase them into vague claims.

7. **Why it matters** must be specific to Brempong's consulting career, not generic advice. What does it mean for his next client engagement? What can he now offer that he couldn't before?

8. **"What to Focus on Next"** must be 3–5 numbered recommendations that are specific and grounded in gaps visible in the data (e.g. tasks still in-progress, quizzes with declining or insufficient_data trend, unresolved high-priority items, skills still at "Emerging" level).

9. **Tone**: Honest and direct. Like a mentor who has read everything in the database and is speaking candidly. Not congratulatory padding. Not generic management-speak.

---

ALL DATA (use everything below to write the narrative):

PERIOD: ${rangeLabel} (${startDate} → ${endDate})

TIME LOGGED:
- Jira sessions: ${jiraHrsLogged} (${sessionCount} sessions)
- Meeting work: ${meetingHrsLogged}
- Project task logs: ${fmtMins(dbTotalMinutes)} across ${dbActiveDays} active days (${dbEntryCount} log entries)
- All-time total logged in DB: ${fmtMins(timeLogsAll.total_min)} across ${timeLogsAll.total_entries} entries / ${timeLogsAll.active_days} days

PROJECTS (${projectStats.length}):
${projectTable || "  None"}

TASKS (${allTasks.length} total | ${allTasksDone} done | ${allHighPriDone} high-pri done | ${allHighPriStuck} high-pri unresolved):
- Raw completion: ${allTasksRawCompletionRate}% | Priority-weighted: ${allTasksPriorityWeightedRate}%
- Project tasks: ${projectTasksDone}/${projectTasks.length} done | Meeting tasks: ${meetingTasksDone}/${meetingTasks.length} done
- Checklist sub-tasks: ${checklistItemsDone}/${checklistItemsTotal} (${checklistCompletionRate}%)
- Tasks with written descriptions: ${tasksWithDescriptions} | with comments: ${tasksWithComments} | with assignees: ${tasksWithAssignees}
- Total task comments in system: ${taskCommentsCountRes.rows[0].total}
${sampleComments.length > 0 ? `\nSample task comments (shows Brempong's working style and thinking):\n${sampleComments.map((c,i)=>`  ${i+1}. ${c}`).join("\n")}` : ""}

TIME LOG DETAIL — period sample (read these to understand what the work actually was):
${timeLogDetail || "  No entries in period"}

MILESTONES (${msDetailRes.rows.length} total | ${milestones.filter(m=>m.status==="completed").length} completed):
${msLines}

SKILLS UNLOCKED BY DOMAIN (from milestone_skills table — ${stats.totalSkillAreas} skill areas):
${skillDomainLines}

${jiraDetail}

QUIZ SCORES — ALL TIME (${quizSummaryRes.rows.reduce((s,r)=>s+r.attempt_count,0)} attempts across ${quizSummaryRes.rows.length} topics):
${quizLines}

DAILY ASSESSMENTS:
- All-time: ${assessHistory}
- This period (${assessments.length} submitted | avg ${assessAvgScore ?? "N/A"}%):
${assessments.slice(0,5).map(a=>`  • [${a.date_key}] ${a.score}% — ${a.scenario.slice(0,100).replace(/\n/g," ")}…`).join("\n") || "  None in period"}

MEETINGS & COLLABORATION:
- ${summaries.length} meetings recorded | ${allContributions.length} contributions | ${allDecisions.length} decisions | ${allActionItemsList.length} action items
${sampleContribs.length > 0 ? `- Sample contributions:\n${sampleContribs.map((c,i)=>`  ${i+1}. "${c}"`).join("\n")}` : ""}

PROFDEV THIS PERIOD:
- ${filteredProfDev.length} activit${filteredProfDev.length===1?"y":"ies"} | ${filteredProfDev.reduce((s,e)=>s+(e.durationHours??0),0)}h
${filteredProfDev.slice(0,5).map(e=>`  • ${e.title} (${e.type}) — ${e.durationHours ?? 0}h`).join("\n") || "  None recorded this period"}
${growthDetail}`;

    // ── 13. Call AI or fall back ──────────────────────────────────────────────
    let insights: string;
    let aiStatus: "gemini" | "fallback" = "gemini";
    let aiError: string | null = null;
    try {
      insights = await callGemini(prompt);
      if (!insights) throw new Error("Empty response from Gemini");
    } catch (err) {
      aiStatus = "fallback";
      aiError = err instanceof Error ? err.message : String(err);
      console.warn("[/api/performance] Gemini unavailable, using fallback:", aiError);
      insights = buildExtractiveInsights(stats as unknown as Record<string, number | string>, rangeLabel);
    }

    // ── 14. Auto-save ─────────────────────────────────────────────────────────
    const autoLabel = `${rangeLabel} — ${format(new Date(), "MMM yyyy")}`;
    const saved = await savePerformanceEntry({
      dateLabel: autoLabel, rangeLabel, startDate, endDate,
      stats: stats as Record<string, number | string>,
      insights,
    });

    return NextResponse.json({ stats, insights, rangeLabel, savedId: saved[0]?.id ?? null, aiStatus, aiError });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/performance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
