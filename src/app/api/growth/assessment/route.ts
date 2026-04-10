export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import {
  loadTopics,
  getDailyAssessment,
  saveDailyAssessment,
  getAssessmentSubmission,
  saveAssessmentSubmission,
  loadAssessmentHistory,
  DailyAssessment,
} from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";

const FIRMS = ["BCG", "McKinsey", "Bain", "Deloitte", "Oliver Wyman"];
const INDUSTRIES = [
  "global retail banking and payments",
  "FMCG and consumer goods supply chain",
  "healthcare systems and digital health",
  "e-commerce and logistics",
  "telecom and digital infrastructure",
  "energy transition and sustainability",
  "fintech and embedded finance",
  "media, streaming, and entertainment",
];

async function generateAssessment(dateKey: string, topicIds: string[], topicLabels: string[]): Promise<DailyAssessment> {
  const firm = FIRMS[Math.floor(Math.random() * FIRMS.length)];
  const industry = INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)];
  const topicsStr = topicLabels.join(", ");

  const prompt = `You are a ${firm} Partner designing the ultimate capability assessment for a Senior Associate who has been studying: ${topicsStr}.

Today's date: ${dateKey}
Industry context: ${industry}

Design a single, rich business problem scenario that requires the associate to simultaneously apply ALL of the following skills: ${topicsStr}.

This should feel like a real ${firm} client engagement in the ${industry} sector.

Return ONLY valid JSON (no markdown):
{
  "scenario": "A rich, 4-6 paragraph scenario that:\\n\\nParagraph 1: Company background — specific company type, scale, market position, and why they engaged ${firm}\\n\\nParagraph 2: The core problem — what is failing, what the client has already tried, and why standard approaches have not worked\\n\\nParagraph 3: The data context — what data systems, pipelines, or technical infrastructure are involved, and what is broken or suboptimal\\n\\nParagraph 4: The business stakes — what happens if this is not solved (revenue at risk, regulatory exposure, competitive threat), with specific numbers\\n\\nParagraph 5: Your mandate — you are the Senior Associate leading the technical workstream. The Partner has asked you to produce a comprehensive recommendation covering all dimensions of the problem.",
  "contextData": {
    "firm": "${firm}",
    "industry": "${industry}",
    "companyType": "Specific description of the client company",
    "problemStatement": "1-2 sentence crisp problem statement a Partner would put on a slide",
    "expectedSkills": ${JSON.stringify(topicLabels)},
    "evaluationCriteria": [
      "Technicality: depth and accuracy of technical recommendations across ${topicsStr}",
      "Logic: MECE structure, clear cause-effect reasoning, no logical gaps",
      "Problem-solving: hypothesis-driven approach, prioritisation of root causes",
      "Delivery: clarity of communication, executive-ready language, actionability of recommendations",
      "Integration: ability to connect insights across ${topicsStr} into a coherent solution"
    ]
  }
}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    id: "",
    dateKey,
    scenario: parsed.scenario,
    topicsCovered: topicIds,
    contextData: parsed.contextData,
    generatedAt: Date.now(),
  };
}

function fallbackAssessment(dateKey: string, topicIds: string[], topicLabels: string[]): DailyAssessment {
  const firm = FIRMS[Math.floor(Math.random() * FIRMS.length)];
  return {
    id: "",
    dateKey,
    scenario: `You are a Senior Associate at ${firm} leading the data & technology workstream for a global financial services client — a tier-1 bank operating across 35 countries with $2.4 trillion in assets under management.\n\nThe client's Chief Data Officer has escalated a critical issue: their data platform, which processes 500 million daily transactions, is producing inconsistent risk metrics that are causing regulatory reporting failures. The bank has already missed two reporting deadlines and is facing potential fines of $120M. Internal teams have been investigating for 6 weeks without a root cause.\n\nThe technical landscape is complex: the platform includes a multi-layer data pipeline (ingestion → transformation → serving), a SQL-based analytics warehouse, Python-based ML risk models, Kubernetes-orchestrated microservices, and Power BI dashboards used by 200 risk analysts. Each layer has been built by a different team over 5 years.\n\nThe business stakes are severe: the regulatory body has given the bank 90 days to resolve the issue or face licence restrictions. The CEO has personally committed to the regulator that this will be fixed. The ${firm} engagement is the bank's last credible option.\n\nYou have been given full access to all systems, teams, and data. The Partner has asked you to produce a structured recommendation covering: (1) root cause diagnosis using a hypothesis-driven framework, (2) a technical remediation plan addressing each layer of the stack, (3) a data quality monitoring strategy to prevent recurrence, (4) an executive communication plan for the board and regulator, and (5) a 90-day delivery roadmap with clear milestones and risk mitigation. Your answer will be presented to the Managing Director tomorrow morning.`,
    topicsCovered: topicIds,
    contextData: {
      firm,
      industry: "global retail banking and regulatory reporting",
      companyType: "Tier-1 global bank, $2.4T AUM, 35 countries",
      problemStatement: "Inconsistent risk metrics causing regulatory reporting failures, 90-day deadline to resolve or face licence restrictions",
      expectedSkills: topicLabels,
      evaluationCriteria: [
        `Technicality: depth and accuracy of technical recommendations across ${topicLabels.join(", ")}`,
        "Logic: MECE structure, clear cause-effect reasoning, no logical gaps",
        "Problem-solving: hypothesis-driven approach, prioritisation of root causes",
        "Delivery: clarity of communication, executive-ready language, actionability",
        "Integration: ability to connect insights across all topics into a coherent solution",
      ],
    },
    generatedAt: Date.now(),
  };
}

// ── GET: fetch or generate today's assessment ─────────────────────────────────

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const dateKey = dateParam ?? format(new Date(), "yyyy-MM-dd");
  const historyOnly = request.nextUrl.searchParams.get("history") === "true";

  if (historyOnly) {
    const history = await loadAssessmentHistory(30);
    return NextResponse.json({ history });
  }

  // Return existing assessment + any submission
  const existing = await getDailyAssessment(dateKey);
  const submission = await getAssessmentSubmission(dateKey);
  if (existing) return NextResponse.json({ assessment: existing, submission });

  // Generate new assessment using all non-soft topics
  const topics = await loadTopics();
  // Use all active topics (or a subset of the most relevant ones)
  const selected = topics.slice(0, 14); // all default topics
  const topicIds = selected.map((t) => t.id);
  const topicLabels = selected.map((t) => t.label);

  let assessment: DailyAssessment;
  if (process.env.GEMINI_API_KEY) {
    try {
      assessment = await generateAssessment(dateKey, topicIds, topicLabels);
    } catch {
      assessment = fallbackAssessment(dateKey, topicIds, topicLabels);
    }
  } else {
    assessment = fallbackAssessment(dateKey, topicIds, topicLabels);
  }

  const saved = await saveDailyAssessment(assessment);
  return NextResponse.json({ assessment: saved, submission: null });
}

// ── POST: submit and evaluate answer ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { assessmentId, dateKey, answer, submissionType } = await request.json();
  if (!assessmentId || !dateKey || !answer?.trim()) {
    return NextResponse.json({ error: "assessmentId, dateKey, and answer required" }, { status: 400 });
  }

  const assessment = await getDailyAssessment(dateKey);
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  const isFolderSubmission = submissionType === "folder";

  // Evaluate with Gemini
  let feedback: import("@/lib/growthStore").AssessmentSubmission["feedback"];
  let score = 50;

  if (process.env.GEMINI_API_KEY) {
    try {
      const folderInstructions = isFolderSubmission
        ? `\nThe associate has submitted a FOLDER of files. Evaluate the folder structure and file organisation as the 5th dimension.`
        : "";

      const structureDimension = isFolderSubmission
        ? `\n5. Structure: Quality of folder organisation (logical grouping of files, clear naming conventions, professional decomposition of deliverables across files — as you would expect from a consulting workstream folder)`
        : "";

      const structureJson = isFolderSubmission
        ? `,\n  "structure": { "score": <0-100>, "comment": "2-3 sentences on folder organisation, file naming, and decomposition quality" }`
        : "";

      const evalPrompt = `You are a ${assessment.contextData.firm} Partner evaluating a Senior Associate's response to a complex business problem.${folderInstructions}

SCENARIO:
${assessment.scenario}

EVALUATION CRITERIA:
${assessment.contextData.evaluationCriteria.join("\n")}

ASSOCIATE'S SUBMISSION:
${answer}

Evaluate this response across ${isFolderSubmission ? "5" : "4"} dimensions (each scored 0-100):
1. Technicality: Accuracy and depth of technical recommendations
2. Logic: MECE structure, cause-effect clarity, absence of logical gaps
3. Problem-solving: Hypothesis-driven approach, root cause prioritisation, creative solutions
4. Delivery: Communication clarity, executive-readiness, actionability${structureDimension}

Return ONLY valid JSON (no markdown):
{
  "technicality": { "score": <0-100>, "comment": "2-3 sentences of specific feedback" },
  "logic": { "score": <0-100>, "comment": "2-3 sentences of specific feedback" },
  "problemSolving": { "score": <0-100>, "comment": "2-3 sentences of specific feedback" },
  "delivery": { "score": <0-100>, "comment": "2-3 sentences of specific feedback" }${structureJson},
  "overallVerdict": "3-4 sentence overall assessment of the response quality and readiness level",
  "strengthsHighlighted": ["Specific strength 1", "Specific strength 2", "Specific strength 3"],
  "areasToImprove": ["Specific improvement area 1", "Specific improvement area 2", "Specific improvement area 3"]
}`;

      const raw = await callGemini(evalPrompt);
      const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
      feedback = JSON.parse(cleaned);
      const dimCount = isFolderSubmission && feedback.structure ? 5 : 4;
      const dimSum = feedback.technicality.score + feedback.logic.score + feedback.problemSolving.score + feedback.delivery.score + (feedback.structure?.score ?? 0);
      score = Math.round(dimSum / dimCount);
    } catch {
      feedback = {
        technicality: { score: 50, comment: "Unable to evaluate automatically. Review your technical depth and accuracy." },
        logic: { score: 50, comment: "Check your answer follows a MECE structure with clear cause-effect reasoning." },
        problemSolving: { score: 50, comment: "Ensure you applied a hypothesis-driven approach and prioritised root causes." },
        delivery: { score: 50, comment: "Review your communication clarity and whether the answer is executive-ready." },
        ...(isFolderSubmission ? { structure: { score: 50, comment: "Review your folder organisation and file naming." } } : {}),
        overallVerdict: "Your answer has been recorded. AI evaluation was unavailable — review against the criteria manually.",
        strengthsHighlighted: ["Answer submitted successfully"],
        areasToImprove: ["Retry evaluation when AI is available"],
      };
    }
  } else {
    feedback = {
      technicality: { score: 50, comment: "AI evaluation unavailable — GEMINI_API_KEY not configured." },
      logic: { score: 50, comment: "Manual review required." },
      problemSolving: { score: 50, comment: "Manual review required." },
      delivery: { score: 50, comment: "Manual review required." },
      ...(isFolderSubmission ? { structure: { score: 50, comment: "Manual review required." } } : {}),
      overallVerdict: "Answer recorded. Configure GEMINI_API_KEY to enable AI evaluation.",
      strengthsHighlighted: ["Submitted"],
      areasToImprove: ["Enable AI evaluation"],
    };
  }

  const submission = await saveAssessmentSubmission({
    assessmentId,
    dateKey,
    answer,
    score,
    feedback,
    submittedAt: Date.now(),
  });

  return NextResponse.json({ submission, score });
}
