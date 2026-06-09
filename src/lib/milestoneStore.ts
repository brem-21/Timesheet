import { pool } from "./db";

export type MilestoneStatus   = "pending" | "in-progress" | "completed";
export type MilestoneCategory = "technical" | "leadership" | "delivery" | "growth" | "communication" | "other";
export type ProficiencyLevel  = "Emerging" | "Practitioner" | "Lead" | "Owner";

export interface MilestoneSkill {
  id: string;
  milestoneId: string;
  domain: string;
  skillCategory: string;
  specificSkills: string[];
  proficiencyLevel: ProficiencyLevel;
  evidenceTickets: string[];
  resumeBullet?: string;
  createdAt: number;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  completedAt?: string;
  status: MilestoneStatus;
  category: MilestoneCategory;
  createdAt: number;
  // enriched fields
  whyItMatters?: string;
  keyDeliverables?: string[];
  careerImpact?: string;
  relatedTickets?: string[];
  projectId?: string | null;
  skills?: MilestoneSkill[];
}

// ── row mappers ───────────────────────────────────────────────────────────────

function rowToMilestone(r: Record<string, unknown>): Milestone {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? undefined,
    targetDate: (r.target_date as string) ?? undefined,
    completedAt: (r.completed_at as string) ?? undefined,
    status: r.status as MilestoneStatus,
    category: r.category as MilestoneCategory,
    createdAt: Number(r.created_at),
    whyItMatters: (r.why_it_matters as string) ?? undefined,
    keyDeliverables: (r.key_deliverables as string[]) ?? [],
    careerImpact: (r.career_impact as string) ?? undefined,
    relatedTickets: (r.related_tickets as string[]) ?? [],
    projectId: (r.project_id as string) ?? null,
    skills: [],
  };
}

function rowToSkill(r: Record<string, unknown>): MilestoneSkill {
  return {
    id: r.id as string,
    milestoneId: r.milestone_id as string,
    domain: r.domain as string,
    skillCategory: r.skill_category as string,
    specificSkills: (r.specific_skills as string[]) ?? [],
    proficiencyLevel: r.proficiency_level as ProficiencyLevel,
    evidenceTickets: (r.evidence_tickets as string[]) ?? [],
    resumeBullet: (r.resume_bullet as string) ?? undefined,
    createdAt: Number(r.created_at),
  };
}

// ── Milestones ────────────────────────────────────────────────────────────────

async function attachSkills(milestones: Milestone[]): Promise<Milestone[]> {
  if (milestones.length === 0) return milestones;
  const ids = milestones.map(m => m.id);
  const sRes = await pool.query(
    `SELECT * FROM milestone_skills WHERE milestone_id = ANY($1) ORDER BY created_at ASC`,
    [ids]
  );
  const skillsByMs: Record<string, MilestoneSkill[]> = {};
  for (const r of sRes.rows) {
    const s = rowToSkill(r);
    if (!skillsByMs[s.milestoneId]) skillsByMs[s.milestoneId] = [];
    skillsByMs[s.milestoneId].push(s);
  }
  return milestones.map(m => ({ ...m, skills: skillsByMs[m.id] ?? [] }));
}

export async function loadMilestones(): Promise<Milestone[]> {
  const mRes = await pool.query(`SELECT * FROM milestones ORDER BY created_at DESC`);
  const milestones = mRes.rows.map(rowToMilestone);
  return attachSkills(milestones);
}

export async function loadMilestonesByProject(projectId: string): Promise<Milestone[]> {
  const mRes = await pool.query(
    `SELECT * FROM milestones WHERE project_id = $1
     ORDER BY COALESCE(completed_at, target_date) ASC NULLS LAST, created_at ASC`,
    [projectId]
  );
  const milestones = mRes.rows.map(rowToMilestone);
  return attachSkills(milestones);
}

export async function getMilestoneById(id: string): Promise<Milestone | null> {
  const [mRes, sRes] = await Promise.all([
    pool.query(`SELECT * FROM milestones WHERE id = $1`, [id]),
    pool.query(`SELECT * FROM milestone_skills WHERE milestone_id = $1 ORDER BY created_at ASC`, [id]),
  ]);
  if (!mRes.rows.length) return null;
  const m = rowToMilestone(mRes.rows[0]);
  m.skills = sRes.rows.map(rowToSkill);
  return m;
}

export async function addMilestone(m: Milestone): Promise<Milestone[]> {
  await pool.query(
    `INSERT INTO milestones
       (id, title, description, target_date, completed_at, status, category, created_at,
        why_it_matters, key_deliverables, career_impact, related_tickets, project_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13)`,
    [
      m.id, m.title, m.description ?? null, m.targetDate ?? null,
      m.completedAt ?? null, m.status, m.category, m.createdAt,
      m.whyItMatters ?? null,
      JSON.stringify(m.keyDeliverables ?? []),
      m.careerImpact ?? null,
      JSON.stringify(m.relatedTickets ?? []),
      m.projectId ?? null,
    ]
  );
  return loadMilestones();
}

export async function updateMilestone(id: string, patch: Partial<Milestone>): Promise<Milestone[]> {
  const colMap: Record<string, string> = {
    title: "title", description: "description", targetDate: "target_date",
    completedAt: "completed_at", status: "status", category: "category",
    createdAt: "created_at", whyItMatters: "why_it_matters",
    keyDeliverables: "key_deliverables", careerImpact: "career_impact",
    relatedTickets: "related_tickets",
  };
  const jsonbCols = new Set(["keyDeliverables", "relatedTickets"]);

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, col] of Object.entries(colMap)) {
    if (key in patch) {
      const val = patch[key as keyof Milestone];
      if (jsonbCols.has(key)) {
        fields.push(`${col} = $${idx++}::jsonb`);
        values.push(JSON.stringify(val ?? []));
      } else {
        fields.push(`${col} = $${idx++}`);
        values.push(val ?? null);
      }
    }
  }

  if (fields.length > 0) {
    values.push(id);
    await pool.query(`UPDATE milestones SET ${fields.join(", ")} WHERE id = $${idx}`, values);
  }
  return loadMilestones();
}

export async function deleteMilestone(id: string): Promise<Milestone[]> {
  await pool.query(`DELETE FROM milestones WHERE id = $1`, [id]);
  return loadMilestones();
}

// ── Skills ────────────────────────────────────────────────────────────────────

export async function addMilestoneSkill(s: MilestoneSkill): Promise<MilestoneSkill> {
  await pool.query(
    `INSERT INTO milestone_skills
       (id, milestone_id, domain, skill_category, specific_skills, proficiency_level,
        evidence_tickets, resume_bullet, created_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9)
     ON CONFLICT (id) DO NOTHING`,
    [
      s.id, s.milestoneId, s.domain, s.skillCategory,
      JSON.stringify(s.specificSkills), s.proficiencyLevel,
      JSON.stringify(s.evidenceTickets), s.resumeBullet ?? null, s.createdAt,
    ]
  );
  const r = await pool.query(`SELECT * FROM milestone_skills WHERE id = $1`, [s.id]);
  return rowToSkill(r.rows[0]);
}

export async function loadSkillsByMilestone(milestoneId: string): Promise<MilestoneSkill[]> {
  const r = await pool.query(
    `SELECT * FROM milestone_skills WHERE milestone_id = $1 ORDER BY created_at ASC`,
    [milestoneId]
  );
  return r.rows.map(rowToSkill);
}

export async function loadAllSkills(): Promise<MilestoneSkill[]> {
  const r = await pool.query(`SELECT * FROM milestone_skills ORDER BY domain, skill_category`);
  return r.rows.map(rowToSkill);
}

export async function deleteMilestoneSkill(id: string): Promise<void> {
  await pool.query(`DELETE FROM milestone_skills WHERE id = $1`, [id]);
}
