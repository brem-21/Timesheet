export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getModules, saveModules, CourseModule } from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";

async function generateModules(topicLabel: string, topicDescription: string): Promise<CourseModule> {
  const prompt = `You are a world-class curriculum designer building a professional training course for a Senior Associate at a top-tier consulting firm (BCG/McKinsey/Bain).

Design a structured course on: "${topicLabel}"
Topic description: "${topicDescription}"

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "title": "Complete [TopicLabel] Mastery — Senior Associate Track",
  "description": "2-3 sentence overview of what the learner will achieve and why it matters in consulting/industry contexts",
  "level": "Senior Associate",
  "totalHours": <number between 20 and 60>,
  "chapters": [
    {
      "id": "ch1",
      "number": 1,
      "title": "Chapter title",
      "description": "1-2 sentence description of what this chapter covers and its importance",
      "estimatedHours": <number>,
      "sections": [
        {
          "id": "ch1-s1",
          "title": "Section title",
          "objectives": ["Specific, measurable objective 1", "Specific, measurable objective 2"],
          "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"],
          "practiceExercise": "A concrete, hands-on exercise framed as a real consulting or industry scenario that tests the section's content"
        }
      ]
    }
  ]
}

Requirements:
- 6 to 8 chapters total, progressing from foundations to advanced/expert
- Each chapter has 3 to 5 sections
- Objectives must be specific and measurable (use action verbs: implement, design, optimise, diagnose, build)
- Practice exercises should be scenario-based: real client problems, debugging challenges, architecture decisions, or business analyses
- Frame advanced chapters around consulting deliverables: client readouts, recommendations, executive summaries
- Tailor depth to Senior Associate level — skip pure basics, assume professional context`;

  const raw = await callGemini(prompt);
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(jsonStr) as CourseModule;
}

function fallbackModules(topicLabel: string): CourseModule {
  return {
    title: `${topicLabel} — Senior Associate Track`,
    description: `A structured curriculum covering ${topicLabel} from professional foundations to consulting-grade application. Build the skills needed to deliver client-facing work confidently.`,
    level: "Senior Associate",
    totalHours: 30,
    chapters: [
      {
        id: "ch1",
        number: 1,
        title: "Foundations & Mental Models",
        description: `Core concepts and mental models that underpin ${topicLabel}. Establish the vocabulary and thinking frameworks used by practitioners.`,
        estimatedHours: 4,
        sections: [
          {
            id: "ch1-s1",
            title: "Core Concepts & Terminology",
            objectives: ["Define key terms used by practitioners", "Map how core components relate to each other"],
            keyTopics: ["Definitions", "Architecture overview", "Key trade-offs", "Industry use cases"],
            practiceExercise: `Sketch a 1-page cheat sheet of ${topicLabel} concepts you'd use to brief a client stakeholder in 5 minutes.`,
          },
          {
            id: "ch1-s2",
            title: "Toolchain & Environment Setup",
            objectives: ["Set up a working local environment", "Navigate the standard toolchain used in industry"],
            keyTopics: ["Essential tools", "Configuration best practices", "Version management", "Local vs cloud workflows"],
            practiceExercise: "Set up a clean environment and run a 'hello world' end-to-end to validate your setup.",
          },
        ],
      },
      {
        id: "ch2",
        number: 2,
        title: "Core Skills & Patterns",
        description: "The bread-and-butter techniques every practitioner must be fluent in. Build pattern recognition and execution speed.",
        estimatedHours: 6,
        sections: [
          {
            id: "ch2-s1",
            title: "Common Patterns & Best Practices",
            objectives: ["Apply industry-standard patterns", "Identify anti-patterns and explain their costs"],
            keyTopics: ["Design patterns", "Performance considerations", "Error handling", "Idiomatic usage"],
            practiceExercise: "Refactor a poorly designed example to follow best practices. Document each change and its rationale.",
          },
          {
            id: "ch2-s2",
            title: "Debugging & Troubleshooting",
            objectives: ["Diagnose common failures systematically", "Apply a structured debugging framework"],
            keyTopics: ["Debugging methodology", "Logging & observability", "Common failure modes", "Root cause analysis"],
            practiceExercise: "Given a broken implementation, identify and fix 3 intentional bugs using a systematic root-cause approach.",
          },
        ],
      },
      {
        id: "ch3",
        number: 3,
        title: "Advanced Techniques & Optimisation",
        description: "Push beyond basics into techniques that differentiate senior practitioners — performance, scale, and design trade-offs.",
        estimatedHours: 8,
        sections: [
          {
            id: "ch3-s1",
            title: "Performance & Scale",
            objectives: ["Diagnose performance bottlenecks", "Apply optimisation strategies with measurable results"],
            keyTopics: ["Profiling techniques", "Bottleneck identification", "Scaling strategies", "Cost optimisation"],
            practiceExercise: "Profile a slow implementation, identify the top bottleneck, and optimise it. Report before/after metrics.",
          },
          {
            id: "ch3-s2",
            title: "Architecture & Design Decisions",
            objectives: ["Evaluate architectural trade-offs", "Recommend designs that match business constraints"],
            keyTopics: ["Architecture patterns", "Trade-off frameworks", "Cost vs complexity", "Make-vs-buy decisions"],
            practiceExercise: "A client needs to scale their current system 10x within 6 months. Propose and justify an architecture redesign in a 1-page recommendation.",
          },
        ],
      },
      {
        id: "ch4",
        number: 4,
        title: "Consulting Applications & Deliverables",
        description: "Apply your skills to consulting-grade work: client presentations, technical due diligence, and advisory recommendations.",
        estimatedHours: 6,
        sections: [
          {
            id: "ch4-s1",
            title: "Translating Technical Work to Business Value",
            objectives: ["Articulate technical decisions in business terms", "Quantify the ROI of technical choices"],
            keyTopics: ["Business case framing", "KPI alignment", "Executive communication", "Risk quantification"],
            practiceExercise: "Take a technical recommendation and rewrite it as a 3-bullet executive summary with quantified business impact.",
          },
          {
            id: "ch4-s2",
            title: "Technical Due Diligence & Assessments",
            objectives: ["Conduct a structured technical assessment", "Produce a written DD report with findings and recommendations"],
            keyTopics: ["Assessment frameworks", "Risk categorisation", "Red flags", "Recommendation prioritisation"],
            practiceExercise: "Review a sample codebase/architecture and produce a 1-page due diligence memo identifying 3 risks and 3 improvement opportunities.",
          },
        ],
      },
    ],
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topicId");
  const forceRegen = searchParams.get("regen") === "true";

  if (!topicId) {
    return NextResponse.json({ error: "topicId required" }, { status: 400 });
  }

  // Return cached modules unless force-regenerate requested
  if (!forceRegen) {
    const existing = await getModules(topicId);
    if (existing) return NextResponse.json({ modules: existing });
  }

  // Fetch topic label + description from DB
  const { pool } = await import("@/lib/db");
  const topicRes = await pool.query(`SELECT label, description FROM growth_topics WHERE id = $1`, [topicId]);
  if (topicRes.rows.length === 0) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
  const { label, description } = topicRes.rows[0];

  let courseModule: CourseModule;
  if (process.env.GEMINI_API_KEY) {
    try {
      courseModule = await generateModules(label as string, (description as string) ?? "");
    } catch {
      courseModule = fallbackModules(label as string);
    }
  } else {
    courseModule = fallbackModules(label as string);
  }

  const saved = await saveModules(topicId, courseModule.title, courseModule);
  return NextResponse.json({ modules: saved });
}
