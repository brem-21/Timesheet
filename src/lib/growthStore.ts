import { pool } from "./db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GrowthTopic {
  id: string;
  label: string;
  description?: string;
  isCustom: boolean;
  createdAt: number;
}

export type MaterialType = "file" | "link" | "note" | "ai_suggestion";

export interface GrowthMaterial {
  id: string;
  topicId: string;
  title: string;
  type: MaterialType;
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  contentText?: string;
  sourceUrl?: string;
  createdAt: number;
}

export type QuizQuestionType = "multiple_choice" | "code_write" | "sql_write" | "free_text";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  text: string;
  // multiple_choice only
  options?: string[];
  correctIndex?: number;
  // code/sql/free_text — model answer for AI evaluation
  expectedAnswer?: string;
  language?: string; // e.g. "python", "sql", "bash"
  explanation: string;
}

export interface QuizConcept {
  title: string;
  explanation: string;
  whyItMatters: string;
  commonMistake: string;
}

export interface QuizLesson {
  expertName: string;
  expertCredentials: string;
  expertSource: string;
  todaysFocus: string;
  concepts: QuizConcept[];
  consultingContext: {
    firmPerspective: string;
    realClientScenario: string;
    debuggingFramework: string;
    methodologyApproach: string;
  };
  cheatSheet: string[];
  quizPreview: string;
}

export interface GrowthQuiz {
  id: string;
  topicId: string;
  dateKey: string; // YYYY-MM-DD
  questions: QuizQuestion[];
  lesson: QuizLesson;
  generatedAt: number;
}

export interface QuizAnswer {
  questionId: string;
  questionType: QuizQuestionType;
  // multiple_choice
  chosenIndex?: number;
  // open-ended
  writtenAnswer?: string;
  aiFeedback?: string;
  aiScore?: number; // 0-100 for open-ended
  isCorrect: boolean;
  timeTakenMs?: number;
}

export interface GrowthQuizAttempt {
  id: string;
  quizId: string;
  topicId: string;
  dateKey: string;
  answers: QuizAnswer[];
  score: number; // 0-100
  totalQ: number;
  correctQ: number;
  completedAt: number;
}

export interface GrowthInsight {
  id: string;
  topicId: string;
  generatedAt: number;
  avgScore?: number;
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  takeaways: string[];
  improvements: string[];
  weaknesses: string[];
  summaryText: string;
}

export interface CourseSection {
  id: string;
  title: string;
  objectives: string[];
  keyTopics: string[];
  practiceExercise: string;
}

export interface CourseChapter {
  id: string;
  number: number;
  title: string;
  description: string;
  estimatedHours: number;
  sections: CourseSection[];
}

export interface CourseModule {
  title: string;
  description: string;
  level: string;
  totalHours: number;
  chapters: CourseChapter[];
}

export interface GrowthModuleRecord {
  id: string;
  topicId: string;
  title: string;
  modules: CourseModule;
  generatedAt: number;
}

// ── ID generator ──────────────────────────────────────────────────────────────

export function growthId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Topics ────────────────────────────────────────────────────────────────────

function rowToTopic(r: Record<string, unknown>): GrowthTopic {
  return {
    id: r.id as string,
    label: r.label as string,
    description: (r.description as string) ?? undefined,
    isCustom: r.is_custom as boolean,
    createdAt: Number(r.created_at),
  };
}

export async function loadTopics(): Promise<GrowthTopic[]> {
  const result = await pool.query(`SELECT * FROM growth_topics ORDER BY is_custom ASC, label ASC`);
  return result.rows.map(rowToTopic);
}

export async function addCustomTopic(label: string, description?: string): Promise<GrowthTopic> {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const now = Date.now();
  await pool.query(
    `INSERT INTO growth_topics (id, label, description, is_custom, created_at)
     VALUES ($1, $2, $3, TRUE, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, label, description ?? null, now]
  );
  const r = await pool.query(`SELECT * FROM growth_topics WHERE id = $1`, [id]);
  return rowToTopic(r.rows[0]);
}

export async function deleteCustomTopic(id: string): Promise<void> {
  await pool.query(`DELETE FROM growth_topics WHERE id = $1 AND is_custom = TRUE`, [id]);
}

// ── Materials ─────────────────────────────────────────────────────────────────

function rowToMaterial(r: Record<string, unknown>): GrowthMaterial {
  return {
    id: r.id as string,
    topicId: r.topic_id as string,
    title: r.title as string,
    type: r.type as MaterialType,
    url: (r.url as string) ?? undefined,
    fileName: (r.file_name as string) ?? undefined,
    fileSize: r.file_size ? Number(r.file_size) : undefined,
    mimeType: (r.mime_type as string) ?? undefined,
    contentText: (r.content_text as string) ?? undefined,
    sourceUrl: (r.source_url as string) ?? undefined,
    createdAt: Number(r.created_at),
  };
}

export async function loadMaterials(topicId: string): Promise<GrowthMaterial[]> {
  const result = await pool.query(
    `SELECT * FROM growth_materials WHERE topic_id = $1 ORDER BY created_at DESC`,
    [topicId]
  );
  return result.rows.map(rowToMaterial);
}

export async function addMaterial(m: Omit<GrowthMaterial, "id" | "createdAt">): Promise<GrowthMaterial> {
  const id = growthId("mat");
  const now = Date.now();
  await pool.query(
    `INSERT INTO growth_materials (id, topic_id, title, type, url, file_name, file_size, mime_type, content_text, source_url, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, m.topicId, m.title, m.type, m.url ?? null, m.fileName ?? null, m.fileSize ?? null,
     m.mimeType ?? null, m.contentText ?? null, m.sourceUrl ?? null, now]
  );
  const r = await pool.query(`SELECT * FROM growth_materials WHERE id = $1`, [id]);
  return rowToMaterial(r.rows[0]);
}

export async function deleteMaterial(id: string): Promise<void> {
  await pool.query(`DELETE FROM growth_materials WHERE id = $1`, [id]);
}

// ── Quizzes ───────────────────────────────────────────────────────────────────

function rowToQuiz(r: Record<string, unknown>): GrowthQuiz {
  return {
    id: r.id as string,
    topicId: r.topic_id as string,
    dateKey: r.date_key as string,
    questions: r.questions as QuizQuestion[],
    lesson: (r.lesson ?? {}) as QuizLesson,
    generatedAt: Number(r.generated_at),
  };
}

export async function getQuiz(topicId: string, dateKey: string): Promise<GrowthQuiz | null> {
  const result = await pool.query(
    `SELECT * FROM growth_quizzes WHERE topic_id = $1 AND date_key = $2`,
    [topicId, dateKey]
  );
  return result.rows.length > 0 ? rowToQuiz(result.rows[0]) : null;
}

export async function saveQuiz(
  topicId: string, dateKey: string,
  questions: QuizQuestion[], lesson: QuizLesson
): Promise<GrowthQuiz> {
  const id = growthId("quiz");
  const now = Date.now();
  await pool.query(
    `INSERT INTO growth_quizzes (id, topic_id, date_key, questions, lesson, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (topic_id, date_key) DO UPDATE
       SET questions = EXCLUDED.questions, lesson = EXCLUDED.lesson, generated_at = EXCLUDED.generated_at`,
    [id, topicId, dateKey, JSON.stringify(questions), JSON.stringify(lesson), now]
  );
  return (await getQuiz(topicId, dateKey))!;
}

export async function getAllTopicQuizDates(dateKey: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT topic_id FROM growth_quizzes WHERE date_key = $1`,
    [dateKey]
  );
  return result.rows.map((r) => r.topic_id as string);
}

// ── Quiz Attempts ─────────────────────────────────────────────────────────────

function rowToAttempt(r: Record<string, unknown>): GrowthQuizAttempt {
  return {
    id: r.id as string,
    quizId: r.quiz_id as string,
    topicId: r.topic_id as string,
    dateKey: r.date_key as string,
    answers: r.answers as QuizAnswer[],
    score: Number(r.score),
    totalQ: Number(r.total_q),
    correctQ: Number(r.correct_q),
    completedAt: Number(r.completed_at),
  };
}

export async function saveAttempt(attempt: Omit<GrowthQuizAttempt, "id">): Promise<GrowthQuizAttempt> {
  const id = growthId("att");
  await pool.query(
    `INSERT INTO growth_quiz_attempts (id, quiz_id, topic_id, date_key, answers, score, total_q, correct_q, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, attempt.quizId, attempt.topicId, attempt.dateKey, JSON.stringify(attempt.answers),
     attempt.score, attempt.totalQ, attempt.correctQ, attempt.completedAt]
  );
  const r = await pool.query(`SELECT * FROM growth_quiz_attempts WHERE id = $1`, [id]);
  return rowToAttempt(r.rows[0]);
}

export async function loadAttemptsByTopic(topicId: string): Promise<GrowthQuizAttempt[]> {
  const result = await pool.query(
    `SELECT * FROM growth_quiz_attempts WHERE topic_id = $1 ORDER BY completed_at DESC`,
    [topicId]
  );
  return result.rows.map(rowToAttempt);
}

export async function loadAllAttempts(): Promise<GrowthQuizAttempt[]> {
  const result = await pool.query(
    `SELECT * FROM growth_quiz_attempts ORDER BY completed_at DESC`
  );
  return result.rows.map(rowToAttempt);
}

// Aggregated stats per topic for performance integration
export interface TopicStats {
  topicId: string;
  label: string;
  avgScore: number;
  attemptCount: number;
  lastAttempt?: string;
}

export async function loadTopicStats(): Promise<TopicStats[]> {
  const result = await pool.query(`
    SELECT
      a.topic_id,
      t.label,
      ROUND(AVG(a.score)::numeric, 1) AS avg_score,
      COUNT(*)::int                   AS attempt_count,
      MAX(a.date_key)                 AS last_attempt
    FROM growth_quiz_attempts a
    JOIN growth_topics t ON t.id = a.topic_id
    GROUP BY a.topic_id, t.label
    ORDER BY avg_score ASC
  `);
  return result.rows.map((r) => ({
    topicId: r.topic_id as string,
    label: r.label as string,
    avgScore: Number(r.avg_score),
    attemptCount: Number(r.attempt_count),
    lastAttempt: (r.last_attempt as string) ?? undefined,
  }));
}

// ── Insights ──────────────────────────────────────────────────────────────────

function rowToInsight(r: Record<string, unknown>): GrowthInsight {
  return {
    id: r.id as string,
    topicId: r.topic_id as string,
    generatedAt: Number(r.generated_at),
    avgScore: r.avg_score ? Number(r.avg_score) : undefined,
    trend: r.trend as GrowthInsight["trend"],
    takeaways: r.takeaways as string[],
    improvements: r.improvements as string[],
    weaknesses: r.weaknesses as string[],
    summaryText: r.summary_text as string,
  };
}

export async function getLatestInsight(topicId: string): Promise<GrowthInsight | null> {
  const result = await pool.query(
    `SELECT * FROM growth_insights WHERE topic_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [topicId]
  );
  return result.rows.length > 0 ? rowToInsight(result.rows[0]) : null;
}

export async function saveInsight(insight: Omit<GrowthInsight, "id">): Promise<GrowthInsight> {
  const id = growthId("ins");
  await pool.query(
    `INSERT INTO growth_insights (id, topic_id, generated_at, avg_score, trend, takeaways, improvements, weaknesses, summary_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, insight.topicId, insight.generatedAt, insight.avgScore ?? null, insight.trend,
     JSON.stringify(insight.takeaways), JSON.stringify(insight.improvements),
     JSON.stringify(insight.weaknesses), insight.summaryText]
  );
  const r = await pool.query(`SELECT * FROM growth_insights WHERE id = $1`, [id]);
  return rowToInsight(r.rows[0]);
}

// ── Comprehensive Growth Stats (for performance integration) ──────────────────

export interface TopicGrowthStat {
  topicId: string;
  label: string;
  attemptCount: number;
  avgScore: number;
  bestScore: number;
  latestScore: number | null;
  lastAttempt: string | null;
  uniqueActiveDays: number;
  trend: "improving" | "declining" | "stable" | "insufficient_data";
}

export interface GrowthStats {
  topicStats: TopicGrowthStat[];
  overallAvgScore: number;
  totalAttempts: number;
  topicsAttempted: number;
  topicsTotal: number;
  mostEngagedTopic: string | null;
  weakestTopic: string | null;
  strongestTopic: string | null;
  quizCompletionRate: number; // % of topics attempted at least once
  growthPageVisits: number;
}

export async function loadGrowthStats(startDate?: string, endDate?: string): Promise<GrowthStats> {
  const dateFilter = startDate && endDate
    ? `AND a.date_key >= '${startDate}' AND a.date_key <= '${endDate}'`
    : "";

  // Per-topic aggregates
  const perTopic = await pool.query(`
    SELECT
      t.id                                         AS topic_id,
      t.label,
      COUNT(a.id)::int                             AS attempt_count,
      COALESCE(ROUND(AVG(a.score)::numeric, 1), 0) AS avg_score,
      COALESCE(MAX(a.score), 0)                    AS best_score,
      COUNT(DISTINCT a.date_key)::int              AS unique_active_days,
      MAX(a.date_key)                              AS last_attempt
    FROM growth_topics t
    LEFT JOIN growth_quiz_attempts a ON a.topic_id = t.id ${dateFilter}
    GROUP BY t.id, t.label
    ORDER BY attempt_count DESC, t.label ASC
  `);

  // Latest score per topic (most recent attempt)
  const latestScores = await pool.query(`
    SELECT DISTINCT ON (topic_id)
      topic_id,
      score,
      date_key
    FROM growth_quiz_attempts
    ORDER BY topic_id, completed_at DESC
  `);
  const latestMap: Record<string, number> = {};
  for (const r of latestScores.rows) {
    latestMap[r.topic_id as string] = Number(r.score);
  }

  // Score trend per topic (last 3 attempts)
  const trendData = await pool.query(`
    SELECT topic_id, score
    FROM (
      SELECT topic_id, score, ROW_NUMBER() OVER (PARTITION BY topic_id ORDER BY completed_at DESC) rn
      FROM growth_quiz_attempts
    ) ranked
    WHERE rn <= 3
    ORDER BY topic_id, rn ASC
  `);
  const trendMap: Record<string, number[]> = {};
  for (const r of trendData.rows) {
    const tid = r.topic_id as string;
    if (!trendMap[tid]) trendMap[tid] = [];
    trendMap[tid].push(Number(r.score));
  }

  function computeTrend(scores: number[]): TopicGrowthStat["trend"] {
    if (scores.length < 2) return "insufficient_data";
    const diff = scores[scores.length - 1] - scores[0];
    if (diff > 5) return "improving";
    if (diff < -5) return "declining";
    return "stable";
  }

  const topicStats: TopicGrowthStat[] = perTopic.rows.map((r) => ({
    topicId: r.topic_id as string,
    label: r.label as string,
    attemptCount: Number(r.attempt_count),
    avgScore: Number(r.avg_score),
    bestScore: Number(r.best_score),
    latestScore: latestMap[r.topic_id as string] ?? null,
    lastAttempt: (r.last_attempt as string) ?? null,
    uniqueActiveDays: Number(r.unique_active_days),
    trend: computeTrend(trendMap[r.topic_id as string] ?? []),
  }));

  const attempted = topicStats.filter((t) => t.attemptCount > 0);
  const totalAttempts = topicStats.reduce((s, t) => s + t.attemptCount, 0);
  const overallAvgScore = attempted.length > 0
    ? Math.round(attempted.reduce((s, t) => s + t.avgScore, 0) / attempted.length)
    : 0;

  // Page visit count from user_events
  const visitRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM user_events WHERE path LIKE '/growth%'`
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  const growthPageVisits = Number(visitRes.rows[0]?.cnt ?? 0);

  return {
    topicStats,
    overallAvgScore,
    totalAttempts,
    topicsAttempted: attempted.length,
    topicsTotal: topicStats.length,
    mostEngagedTopic: attempted.length > 0 ? attempted[0].label : null,
    weakestTopic: attempted.length > 0
      ? attempted.reduce((w, t) => t.avgScore < w.avgScore ? t : w).label
      : null,
    strongestTopic: attempted.length > 0
      ? attempted.reduce((b, t) => t.avgScore > b.avgScore ? t : b).label
      : null,
    quizCompletionRate: topicStats.length > 0
      ? Math.round((attempted.length / topicStats.length) * 100)
      : 0,
    growthPageVisits,
  };
}

// ── Course Modules ─────────────────────────────────────────────────────────────

export async function getModules(topicId: string): Promise<GrowthModuleRecord | null> {
  const r = await pool.query(`SELECT * FROM growth_modules WHERE topic_id = $1`, [topicId]);
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    id: row.id as string,
    topicId: row.topic_id as string,
    title: row.title as string,
    modules: row.modules as CourseModule,
    generatedAt: Number(row.generated_at),
  };
}

export async function saveModules(topicId: string, title: string, modules: CourseModule): Promise<GrowthModuleRecord> {
  const id = growthId("mod");
  const now = Date.now();
  await pool.query(
    `INSERT INTO growth_modules (id, topic_id, title, modules, generated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (topic_id) DO UPDATE SET title = $3, modules = $4, generated_at = $5`,
    [id, topicId, title, JSON.stringify(modules), now]
  );
  const r = await pool.query(`SELECT * FROM growth_modules WHERE topic_id = $1`, [topicId]);
  const row = r.rows[0];
  return {
    id: row.id as string,
    topicId: row.topic_id as string,
    title: row.title as string,
    modules: row.modules as CourseModule,
    generatedAt: Number(row.generated_at),
  };
}
