export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getModules, saveModules, CourseModule } from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";

async function generateModules(topicLabel: string, topicDescription: string): Promise<CourseModule> {
  const prompt = `You are a world-class curriculum designer and ${topicLabel} expert building a professional training course for a Senior Associate at a top-tier consulting firm (BCG/McKinsey/Bain).

Design a structured, richly-explained course on: "${topicLabel}"
Topic description: "${topicDescription}"

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "title": "Complete [TopicLabel] Mastery — Senior Associate Track",
  "description": "2-3 sentence overview of what the learner will achieve and why it matters in consulting/industry contexts",
  "level": "Senior Associate",
  "totalHours": <number between 30 and 60>,
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
          "objectives": ["Specific, measurable objective using action verbs", "Second objective"],
          "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"],
          "explanation": "Write 3-5 rich teaching paragraphs as an expert instructor:\\n\\nParagraph 1: What this concept is and why it matters — define it clearly in plain English, no jargon without explanation.\\n\\nParagraph 2: How it works in practice — the mechanics, the patterns, the mental model a practitioner uses.\\n\\nParagraph 3: Common pitfalls and how to avoid them — what goes wrong and what good looks like.\\n\\nParagraph 4: Consulting/business application — how this shows up in client engagements at BCG/McKinsey/Bain and what a Senior Associate is expected to deliver.",
          "teachingPoints": [
            "Memorable rule or key insight from this section (max 20 words)",
            "Second key insight",
            "Third key insight",
            "Fourth key insight",
            "Fifth key insight — most important pattern or anti-pattern"
          ],
          "realWorldExample": "A specific, concrete example: 'A global bank processing 500M transactions/day implemented X because Y, resulting in Z measurable outcome.' Make it vivid and industry-specific. 2-3 sentences.",
          "codeExample": "Optional short code snippet demonstrating a key concept. Start with a language comment. Leave empty string if not a technical topic.",
          "exerciseLanguage": "python or sql or bash or scala or empty string",
          "practiceExercise": "A hands-on scenario exercise: frame as a specific consulting engagement problem that requires applying this section's content. Include enough context that the learner knows exactly what to produce."
        }
      ]
    }
  ]
}

Requirements:
- 6 to 8 chapters total, progressing from foundations → core skills → advanced → consulting applications
- Each chapter has 3 to 5 sections
- explanation must be genuinely instructive — 3-5 paragraphs that teach, not just describe topics
- teachingPoints must be actionable and memorable, not just topic labels
- realWorldExample must name specific company type, scale, and measurable outcome
- codeExample: include where applicable (technical topics), empty string for soft skills
- practiceExercise must be scenario-based with a specific deliverable
- Tailor to Senior Associate — skip pure basics, assume professional context`;

  const raw = await callGemini(prompt);
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(jsonStr) as CourseModule;
}

const FALLBACK_EXPLANATION = (title: string, label: string) =>
  `${title} is a foundational concept in ${label} that every Senior Associate must master to deliver credible client work.\n\nIn practice, this means understanding not just the mechanics but the underlying principles — why this approach exists, what problems it solves, and what trade-offs it makes. Strong practitioners can explain these trade-offs to non-technical stakeholders.\n\nCommon pitfalls include applying the concept without understanding context, or optimising the wrong dimension (e.g. performance when the bottleneck is actually reliability). The best consultants always validate their assumptions before recommending solutions.\n\nIn BCG/McKinsey/Bain engagements, Senior Associates are expected to apply this knowledge to client problems with structured recommendations, not just technical implementations.`;

function fallbackModules(topicLabel: string): CourseModule {
  return {
    title: `${topicLabel} — Senior Associate Track`,
    description: `A structured curriculum covering ${topicLabel} from professional foundations to consulting-grade application. Build the skills needed to deliver client-facing work confidently.`,
    level: "Senior Associate",
    totalHours: 40,
    chapters: [
      {
        id: "ch1", number: 1,
        title: "Foundations & Mental Models",
        description: `Core concepts and mental models that underpin ${topicLabel}. Establish the vocabulary and thinking frameworks used by practitioners.`,
        estimatedHours: 6,
        sections: [
          {
            id: "ch1-s1", title: "Core Concepts & Terminology",
            objectives: ["Define key terms used by practitioners", "Map how core components relate to each other"],
            keyTopics: ["Definitions", "Architecture overview", "Key trade-offs", "Industry use cases"],
            explanation: FALLBACK_EXPLANATION("Core Concepts & Terminology", topicLabel),
            teachingPoints: ["Always define terms precisely before using them in client communication", "Understand the why behind every architectural choice, not just the what", "Trade-offs exist in every design decision — document them explicitly", "Industry vocabulary matters: using wrong terms loses client credibility"],
            realWorldExample: `A Fortune 500 financial services client hired ${topicLabel} specialists who could not explain core concepts to the steering committee — the engagement stalled for 3 weeks until the team rebuilt credibility through clearer communication.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: `Sketch a 1-page cheat sheet of ${topicLabel} concepts you'd use to brief a CTO in 5 minutes. Include 5 key terms, 3 common misconceptions, and 2 key trade-offs.`,
          },
          {
            id: "ch1-s2", title: "Mental Models & First Principles",
            objectives: ["Apply first-principles thinking to ${topicLabel} problems", "Build transferable mental models"],
            keyTopics: ["First principles", "Abstractions", "Cause-effect reasoning", "System thinking"],
            explanation: FALLBACK_EXPLANATION("Mental Models & First Principles", topicLabel),
            teachingPoints: ["First principles: break problems to fundamentals, don't inherit assumptions", "Mental models are tools — use the right one for each problem type", "System thinking prevents local optimisation at system cost", "Always ask: what would have to be true for this to fail?"],
            realWorldExample: `A McKinsey team applied systems thinking to a ${topicLabel} failure at a global retailer and identified the root cause 4x faster than the client's internal team, who were optimising individual components without seeing the system.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: `A ${topicLabel} system at a logistics company is failing intermittently. Using first-principles thinking, decompose the possible failure modes MECE and identify which mental model you would apply at each layer.`,
          },
        ],
      },
      {
        id: "ch2", number: 2,
        title: "Core Skills & Patterns",
        description: "The bread-and-butter techniques every practitioner must be fluent in. Build pattern recognition and execution speed.",
        estimatedHours: 8,
        sections: [
          {
            id: "ch2-s1", title: "Industry Patterns & Best Practices",
            objectives: ["Apply industry-standard patterns correctly", "Identify anti-patterns and quantify their costs"],
            keyTopics: ["Design patterns", "Performance considerations", "Error handling", "Idiomatic usage"],
            explanation: FALLBACK_EXPLANATION("Industry Patterns & Best Practices", topicLabel),
            teachingPoints: ["Patterns exist because problems recur — recognise the problem type before choosing the pattern", "Anti-patterns are expensive: document their costs to justify refactoring", "Best practices evolve — always check the date on the resource you're learning from", "Apply patterns in context: the right pattern for one scale is wrong for another"],
            realWorldExample: `A Bain client's engineering team was using an anti-pattern in their ${topicLabel} implementation that caused 40% cost overrun. The BCG-trained associate identified it in the first code review by recognising the pattern from prior engagements.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: "Refactor a poorly designed implementation to follow best practices. For each change, document: (1) what the anti-pattern was, (2) what it costs, and (3) how the pattern fix addresses it.",
          },
          {
            id: "ch2-s2", title: "Systematic Debugging & Troubleshooting",
            objectives: ["Diagnose failures using Isolate→Hypothesise→Validate", "Build observability into systems to enable faster diagnosis"],
            keyTopics: ["Debugging methodology", "Logging & observability", "Common failure modes", "Root cause analysis"],
            explanation: FALLBACK_EXPLANATION("Systematic Debugging & Troubleshooting", topicLabel),
            teachingPoints: ["Never restart or fix before you understand — you lose evidence", "Form one specific hypothesis at a time, not a list of guesses", "Observability: if you can't see it, you can't debug it", "Document your debugging steps — the pattern helps next time"],
            realWorldExample: `A global bank's ${topicLabel} system failed for 6 hours. The senior associate applied Isolate→Hypothesise→Validate and found the root cause (a timezone handling bug) in 45 minutes while the internal team had been randomly restarting services for 5 hours.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: "Given a broken implementation with 3 intentional bugs, debug each using the structured framework. For each bug: write your hypothesis, your test, your finding, and your fix.",
          },
        ],
      },
      {
        id: "ch3", number: 3,
        title: "Advanced Techniques & Optimisation",
        description: "Techniques that differentiate senior practitioners — performance, scale, and architectural trade-offs.",
        estimatedHours: 10,
        sections: [
          {
            id: "ch3-s1", title: "Performance Analysis & Optimisation",
            objectives: ["Diagnose performance bottlenecks using profiling", "Apply targeted optimisations with measurable results"],
            keyTopics: ["Profiling techniques", "Bottleneck identification", "Scaling strategies", "Cost optimisation"],
            explanation: FALLBACK_EXPLANATION("Performance Analysis & Optimisation", topicLabel),
            teachingPoints: ["Measure before optimising — the obvious bottleneck is rarely the real one", "Amdahl's Law: optimise the biggest constraint, not the easiest one", "Cost and performance are not the same axis — both must be measured", "Document before/after metrics every time — clients need evidence, not opinions"],
            realWorldExample: `A streaming platform's ${topicLabel} pipeline was processing data 8x slower than needed at scale. Profiling revealed the bottleneck was not the algorithm but the I/O pattern — fixing the I/O alone delivered a 6x speedup.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: "Profile a slow implementation. Identify the top bottleneck. Optimise it. Report: what you measured, what you found, what you changed, and the before/after performance delta.",
          },
          {
            id: "ch3-s2", title: "Architecture & Design Decisions",
            objectives: ["Evaluate architectural trade-offs against business constraints", "Produce structured architecture recommendations"],
            keyTopics: ["Architecture patterns", "Trade-off analysis", "Cost vs complexity", "Make-vs-buy decisions"],
            explanation: FALLBACK_EXPLANATION("Architecture & Design Decisions", topicLabel),
            teachingPoints: ["Every architecture decision is a trade-off — document what you're optimising for", "Start with constraints, not solutions", "Make-vs-buy: build only what differentiates your client", "Architecture must be explainable to the C-suite in 3 sentences or it's not ready"],
            realWorldExample: `A ${topicLabel} architecture decision at a global bank saved $4M/year once a senior associate reframed the question from 'which tool is best' to 'what are the constraints and what do we need to optimise for'.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: "A client needs to scale their current system 10x within 6 months on a fixed budget. Propose an architecture redesign: list your constraints, your options, your trade-offs, and your recommendation. Justify each decision.",
          },
        ],
      },
      {
        id: "ch4", number: 4,
        title: "Consulting Applications & Deliverables",
        description: "Apply expertise to consulting-grade work: client presentations, technical due diligence, and executive recommendations.",
        estimatedHours: 8,
        sections: [
          {
            id: "ch4-s1", title: "Translating Technical Work to Business Value",
            objectives: ["Articulate technical decisions in quantified business terms", "Write executive summaries that drive decisions"],
            keyTopics: ["Business case framing", "KPI alignment", "Executive communication", "ROI quantification"],
            explanation: FALLBACK_EXPLANATION("Translating Technical Work to Business Value", topicLabel),
            teachingPoints: ["CEOs care about revenue, cost, risk, and speed — frame everything in these terms", "Quantify impact even approximately — a range is more useful than 'significant'", "The Pyramid Principle: lead with the recommendation, not the analysis", "Executives interrupt when they don't see the 'so what' — never bury the lead"],
            realWorldExample: `A senior associate's ${topicLabel} recommendation was initially rejected by the client CFO because it was written in technical language. Rewriting it with a 3-bullet executive summary with $2.1M projected savings got it approved in 10 minutes.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: "Take a technical ${topicLabel} recommendation and rewrite it as a 3-bullet executive summary. Include: (1) the problem in business terms, (2) the recommendation with rationale, (3) quantified impact and timeline.",
          },
          {
            id: "ch4-s2", title: "Technical Due Diligence",
            objectives: ["Conduct a structured technical assessment against a DD framework", "Produce a DD memo with prioritised findings"],
            keyTopics: ["DD frameworks", "Risk categorisation (Red/Amber/Green)", "Red flags", "Prioritised recommendations"],
            explanation: FALLBACK_EXPLANATION("Technical Due Diligence", topicLabel),
            teachingPoints: ["DD is not about finding everything — it's about finding the things that change the decision", "RAG (Red/Amber/Green) status must be calibrated: Red = deal-breaker without remediation", "Always interview the team, not just read the docs", "A strong DD memo has: findings, evidence, severity, and recommended remediation"],
            realWorldExample: `A ${topicLabel} due diligence on a $200M acquisition target found a critical architectural flaw that would require $8M to remediate — this finding changed the deal terms significantly and was only discovered through structured technical assessment.`,
            codeExample: "",
            exerciseLanguage: "",
            practiceExercise: "Review a sample ${topicLabel} codebase/architecture and produce a 1-page DD memo: (1) 3 critical risks with severity and evidence, (2) 3 improvement opportunities, (3) overall RAG status with justification.",
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

  // Return cached modules unless force-regenerate or >30 days old (monthly auto-refresh)
  if (!forceRegen) {
    const existing = await getModules(topicId);
    if (existing) {
      const ageMs = Date.now() - existing.generatedAt;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (ageMs < thirtyDaysMs) return NextResponse.json({ modules: existing });
      // Older than 30 days — fall through to regenerate
    }
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
