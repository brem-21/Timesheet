export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  loadMilestones, addMilestone, loadAllSkills,
  addMilestoneSkill, Milestone, MilestoneSkill,
} from "@/lib/milestoneStore";

export async function GET() {
  try {
    const milestones = await loadMilestones();
    return NextResponse.json(milestones);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Allow posting a skill directly
    if (body._type === "skill") {
      const skill: MilestoneSkill = {
        id: body.id ?? `mskill-${Date.now()}`,
        milestoneId: body.milestoneId,
        domain: body.domain,
        skillCategory: body.skillCategory,
        specificSkills: body.specificSkills ?? [],
        proficiencyLevel: body.proficiencyLevel,
        evidenceTickets: body.evidenceTickets ?? [],
        resumeBullet: body.resumeBullet,
        createdAt: Date.now(),
      };
      const saved = await addMilestoneSkill(skill);
      return NextResponse.json(saved, { status: 201 });
    }

    const milestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: body.title,
      description: body.description,
      targetDate: body.targetDate,
      completedAt: body.completedAt,
      status: body.status ?? "pending",
      category: body.category ?? "other",
      createdAt: Date.now(),
      whyItMatters: body.whyItMatters,
      keyDeliverables: body.keyDeliverables ?? [],
      careerImpact: body.careerImpact,
      relatedTickets: body.relatedTickets ?? [],
    };
    const updated = await addMilestone(milestone);
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
