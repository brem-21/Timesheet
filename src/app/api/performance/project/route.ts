export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { callGemini } from "@/lib/summarize";

interface ProjectPerfBody {
  projectId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function buildFallbackInsights(
  projectName: string,
  rangeLabel: string,
  stats: Record<string, number | string>
): string {
  const completionRate = stats.completionRate as number;
  const doneLabel = completionRate >= 75 ? "strong" : completionRate >= 50 ? "moderate" : "low";
  return [
    `## Project Overview`,
    `${projectName} logged ${stats.timeLogged} of tracked work during ${rangeLabel} across ${stats.logEntries} log entries. This reflects the active scope of work tracked within the system for this period.`,
    ``,
    `## Task Delivery`,
    `Out of ${stats.taskCount} total tasks, ${stats.tasksDone} are completed (${completionRate}% — ${doneLabel} completion rate). ${stats.tasksInProgress} tasks are in progress and ${stats.tasksTodo} remain to-do. Reducing in-progress task count and driving more to Done signals strong delivery discipline.`,
    ``,
    `## Time Efficiency`,
    `${stats.timeLogged} was logged in this period. ${stats.tasksCreatedInRange} new tasks were created during ${rangeLabel}. Tracking time consistently against specific tasks (rather than general project buckets) improves visibility and retrospective accuracy.`,
    ``,
    `## Key Recommendations`,
    `1. Close out the ${stats.tasksInProgress} in-progress tasks before adding new scope.`,
    `2. Review and prioritise the ${stats.tasksTodo} todo tasks — de-scope anything no longer relevant.`,
    `3. Aim to log time against specific tasks, not just the project, for better granularity in future reviews.`,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProjectPerfBody;
    const { projectId, startDate, endDate, rangeLabel } = body;

    if (!projectId || !startDate || !endDate) {
      return NextResponse.json({ error: "projectId, startDate, endDate required" }, { status: 400 });
    }

    // Load project name
    const projRes = await pool.query<{ name: string; color: string }>(
      `SELECT name, color FROM projects WHERE id = $1`,
      [projectId]
    );
    if (projRes.rows.length === 0) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const { name: projectName } = projRes.rows[0];

    // Time logs in date range
    const logsRes = await pool.query<{ logged_date: string; duration_min: number; description: string }>(
      `SELECT logged_date, duration_min, description
         FROM time_logs
        WHERE project_id = $1
          AND logged_date BETWEEN $2 AND $3
        ORDER BY logged_date ASC`,
      [projectId, startDate, endDate]
    );
    const logsInRange = logsRes.rows;

    // All time logs grouped by date for chart (full history capped at 60 days, prefer range)
    const chartRes = await pool.query<{ logged_date: string; total_min: number }>(
      `SELECT logged_date, SUM(duration_min)::int AS total_min
         FROM time_logs
        WHERE project_id = $1
          AND logged_date BETWEEN $2 AND $3
        GROUP BY logged_date
        ORDER BY logged_date ASC`,
      [projectId, startDate, endDate]
    );
    const timeByDate = chartRes.rows.map((r) => ({ date: r.logged_date, minutes: r.total_min }));

    // All tasks for project (current snapshot)
    const tasksRes = await pool.query<{ status: string; created_at: number }>(
      `SELECT status, created_at FROM tasks WHERE project_id = $1`,
      [projectId]
    );
    const allTasks = tasksRes.rows;

    // Tasks created in range
    const rangeStartMs = new Date(startDate).getTime();
    const rangeEndMs = new Date(endDate + "T23:59:59").getTime();
    const tasksCreatedInRange = allTasks.filter(
      (t) => t.created_at >= rangeStartMs && t.created_at <= rangeEndMs
    ).length;

    // Compute stats
    const totalMinutes = logsInRange.reduce((s, l) => s + l.duration_min, 0);
    const tasksDone = allTasks.filter((t) => t.status === "done").length;
    const tasksInProgress = allTasks.filter((t) => t.status === "in-progress").length;
    const tasksTodo = allTasks.filter((t) => t.status === "todo").length;
    const taskCount = allTasks.length;
    const completionRate = taskCount > 0 ? Math.round((tasksDone / taskCount) * 100) : 0;

    // Velocity: tasks done / weeks in range (rough)
    const daySpan = Math.max(
      1,
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const weekSpan = Math.max(1, daySpan / 7);
    const velocity = Math.round((tasksDone / weekSpan) * 10) / 10;

    // Avg daily time logged (only days with logs)
    const activeDays = timeByDate.length;
    const avgDailyMins = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;

    const stats = {
      totalMinutes,
      timeLogged: fmtMins(totalMinutes),
      logEntries: logsInRange.length,
      taskCount,
      tasksDone,
      tasksInProgress,
      tasksTodo,
      completionRate,
      tasksCreatedInRange,
      velocity,
      activeDays,
      avgDailyMins,
      avgDailyTime: fmtMins(avgDailyMins),
    };

    // Build Gemini prompt
    const topLogs = logsInRange.slice(0, 8).map((l) => `  - ${l.logged_date}: ${fmtMins(l.duration_min)} — ${l.description}`).join("\n");

    const prompt = `You are a performance coach reviewing project work for a Senior Associate at a consulting/tech company.

Project: ${projectName}
Period: ${rangeLabel} (${startDate} to ${endDate})

Project Stats:
- Total time logged in period: ${fmtMins(totalMinutes)} across ${logsInRange.length} log entries
- Average time per active day: ${fmtMins(avgDailyMins)} (${activeDays} days with logs)
- Tasks (current snapshot): ${taskCount} total — ${tasksDone} done, ${tasksInProgress} in progress, ${tasksTodo} todo
- Completion rate: ${completionRate}%
- Delivery velocity: ~${velocity} tasks completed per week
- New tasks created in period: ${tasksCreatedInRange}

Recent work log samples:
${topLogs || "  (no log entries in this period)"}

Write a structured performance summary with exactly these 3 sections in order:
## Project Overview
## Task Delivery
## Key Recommendations

Be specific with numbers. Keep each section to 3-4 sentences. Frame recommendations as concrete actions.`;

    let insights: string;
    try {
      insights = await callGemini(prompt);
    } catch {
      insights = buildFallbackInsights(projectName, rangeLabel, stats as unknown as Record<string, number | string>);
    }

    return NextResponse.json({ stats, insights, timeByDate, projectName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/performance/project]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
