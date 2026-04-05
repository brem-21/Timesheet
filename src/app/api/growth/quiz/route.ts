export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { loadTopics, getQuiz, saveQuiz, QuizQuestion, QuizLesson } from "@/lib/growthStore";
import { callGemini } from "@/lib/summarize";

// ── Expert Registry ───────────────────────────────────────────────────────────
// Primary authority per topic — sourced by YouTube views, GitHub forks, Medium reads, course ratings

const EXPERT_REGISTRY: Record<string, { name: string; credentials: string; source: string }> = {
  "data-engineering": {
    name: "Zach Wilson",
    credentials: "Creator of DataEngineer.io, ex-Facebook/Netflix/Airbnb data engineer, 500k+ YouTube subscribers, taught dimensional data modeling to 100k+ students, GitHub 'data-engineer-handbook' 26k+ stars",
    source: "YouTube (@EcZachly), GitHub (EcZachly), DataEngineer.io bootcamp",
  },
  "devops": {
    name: "TechWorld with Nana + Kelsey Hightower",
    credentials: "Nana: 4M+ YouTube subscribers, highest-rated DevOps crash course. Hightower: Google Developer Advocate, 'Kubernetes the Hard Way' GitHub repo most forked K8s tutorial globally",
    source: "YouTube (TechWorld with Nana), GitHub (kelseyhightower), Google Cloud blog",
  },
  "ml": {
    name: "Andrej Karpathy",
    credentials: "Ex-Tesla AI Director, Ex-OpenAI, Stanford PhD, 'Neural Networks: Zero to Hero' YouTube series, 800k+ subscribers, most watched ML content globally in 2023-24",
    source: "YouTube (@AndrejKarpathy), GitHub (karpathy), Stanford CS231n course notes",
  },
  "mlops": {
    name: "Chip Huyen + Goku Mohandas",
    credentials: "Chip Huyen: Stanford lecturer, 'Designing ML Systems' O'Reilly book, 'mlops-guide' GitHub 10k+ stars. Goku: 'Made With ML' GitHub 35k+ stars, most forked MLOps resource",
    source: "GitHub (chiphuyen/mlops-course), Made With ML (madewithml.com), Chip's substack",
  },
  "kubernetes": {
    name: "TechWorld with Nana + Jeffrey Geerling",
    credentials: "Nana: definitive K8s beginner-to-advanced series, 50M+ total views. Geerling: 'Kubernetes 101' book, Ansible for K8s YouTube series 500k+ subscribers, 'Pi Cluster' GitHub most starred",
    source: "YouTube (TechWorld with Nana, Jeff Geerling), GitHub (geerlingguy)",
  },
  "sql": {
    name: "Alex The Analyst + Use The Index Luke",
    credentials: "Alex: 1M+ YouTube subscribers, most watched SQL tutorial channel 2022-24. Use The Index Luke (Markus Winand): most bookmarked SQL performance guide globally, referenced by major DBs",
    source: "YouTube (@AlexTheAnalyst), use-the-index-luke.com, Mode Analytics SQL Tutorial (most read)",
  },
  "spark": {
    name: "Frank Kane + Databricks Official",
    credentials: "Frank Kane: ex-Amazon engineer, 'Taming Big Data with Apache Spark' Udemy most-sold Spark course 150k+ students. Databricks blog: authoritative Spark source, written by Spark creators",
    source: "Udemy (Frank Kane), Databricks engineering blog, GitHub (databricks/koalas)",
  },
  "python-dsa": {
    name: "NeetCode (Navdeep Singh)",
    credentials: "500k+ YouTube subscribers, NeetCode.io most used FAANG prep platform 2022-24, systematic LeetCode breakdowns, Google engineer. Abdul Bari algorithms course: 2M+ YouTube subscribers",
    source: "YouTube (@NeetCode), neetcode.io, YouTube (@Abdul Bari), GitHub (neetcode-gh)",
  },
  "aws-solutions-architect": {
    name: "Adrian Cantrill",
    credentials: "'learn-cantrill-io-labs' GitHub most forked AWS hands-on labs repository. ExamPro (Andrew Brown): freeCodeCamp AWS series 12M+ YouTube views. Cantrill AWS courses rated #1 on TrustPilot",
    source: "GitHub (acantril/learn-cantrill-io-labs), freeCodeCamp YouTube, cantrill.io",
  },
  "power-bi": {
    name: "SQLBI (Marco Russo & Alberto Ferrari) + Guy in a Cube",
    credentials: "SQLBI: world's most authoritative DAX resource, 'The Definitive Guide to DAX' O'Reilly, sqlbi.com most read Power BI reference. Guy in a Cube: 500k+ YouTube, Microsoft MVPs",
    source: "sqlbi.com, YouTube (@GuyInACube), dax.guide, Power BI community blog",
  },
  "dashboard-engineering": {
    name: "The Pudding + Ben Stancil",
    credentials: "The Pudding: most viral data storytelling publication, Webby Award winners. Ben Stancil (Mode Analytics founder): most cited dashboard design blog posts. Mike Bostock: D3.js creator, Observable",
    source: "pudding.cool, benn.substack.com, observablehq.com, FlowingData (Nathan Yau)",
  },
  "business-consultancy": {
    name: "Victor Cheng + Barbara Minto",
    credentials: "Victor Cheng: CaseInterview.com most used MBB case prep resource, ex-McKinsey. Barbara Minto: Pyramid Principle creator (McKinsey), most read consulting communication framework globally",
    source: "caseinterview.com, 'The Pyramid Principle' book, McKinsey Insights, HBS Case Studies",
  },
  "problem-solving": {
    name: "Shane Parrish (Farnam Street) + McKinsey MECE",
    credentials: "Farnam Street: most read mental models blog, 500k newsletter subscribers. McKinsey MECE framework: used by all MBB firms. Edward de Bono's lateral thinking: 4M+ books sold",
    source: "fs.blog, McKinsey problem solving guide, 'Thinking, Fast and Slow' (Kahneman)",
  },
  "active-listening": {
    name: "Julian Treasure + Michael Sorensen",
    credentials: "Julian Treasure: 'How to speak so people want to listen' TED Talk 80M+ views, most watched communication TED Talk. Michael Sorensen: 'I Hear You' bestselling listening book 500k+ copies",
    source: "TED.com, 'I Hear You' book, Julian Treasure's Sound Business methodology",
  },
};

const FALLBACK_EXPERT = {
  name: "Top Industry Practitioners",
  credentials: "Curated from highest-rated YouTube courses, most-forked GitHub repositories, and most-read Medium posts in this domain",
  source: "YouTube, GitHub, Medium, O'Reilly books",
};

// ── Topic question mix config ─────────────────────────────────────────────────

const CODE_TOPICS = new Set(["python-dsa", "spark", "data-engineering", "devops", "mlops", "ml", "kubernetes"]);
const SQL_TOPICS = new Set(["sql", "data-engineering", "power-bi", "dashboard-engineering"]);
const SOFT_TOPICS = new Set(["problem-solving", "active-listening", "business-consultancy"]);

// ── Consulting firm context ───────────────────────────────────────────────────

const CONSULTING_FIRMS = ["BCG", "McKinsey", "Bain", "Deloitte", "Accenture"];
const pickFirm = () => CONSULTING_FIRMS[Math.floor(Math.random() * CONSULTING_FIRMS.length)];

// ── Lesson generation ─────────────────────────────────────────────────────────

async function generateLesson(
  topicId: string,
  topicLabel: string,
  dateKey: string
): Promise<QuizLesson> {
  const expert = EXPERT_REGISTRY[topicId] ?? FALLBACK_EXPERT;
  const firm = pickFirm();

  const prompt = `You are a senior learning designer creating a daily micro-lesson for a Senior Associate at a top-4 consulting firm (${firm}).

Today's topic: ${topicLabel}
Today's date: ${dateKey}
Expert to draw from: ${expert.name}
Expert credentials: ${expert.credentials}
Expert sources: ${expert.source}

Generate a focused 5-minute micro-lesson that teaches 2-3 specific, practical concepts the associate will then be tested on — framed through the lens of consulting work at ${firm}.

Return ONLY a JSON object (no markdown fences, no prose):
{
  "expertName": "${expert.name}",
  "expertCredentials": "${expert.credentials}",
  "expertSource": "${expert.source}",
  "todaysFocus": "Specific concept(s) being taught today (8-12 words)",
  "concepts": [
    {
      "title": "Concept name (3-6 words)",
      "explanation": "2-3 sentence explanation in plain English — what it is and how it works, as ${expert.name} would explain it",
      "whyItMatters": "1-2 sentences on why a ${firm} client engagement would fail without this knowledge",
      "commonMistake": "The single most common mistake Senior Associates make with this concept, with a concrete example"
    }
  ],
  "consultingContext": {
    "firmPerspective": "How ${firm} approaches ${topicLabel} problems differently from in-house teams — 2 sentences",
    "realClientScenario": "A realistic anonymised client scenario (Fortune 500 company, realistic industry) where ${topicLabel} expertise was critical — 3 sentences with specific technical and business details",
    "debuggingFramework": "A 3-step debugging or diagnostic framework ${firm} analysts use when ${topicLabel} systems fail — reference MECE or structured hypothesis testing",
    "methodologyApproach": "The systematic problem-solving methodology (e.g., hypothesis-driven, top-down, data-first) applied to ${topicLabel} challenges at ${firm} — 2 sentences"
  },
  "cheatSheet": [
    "Concise, memorable rule or pattern from today's lesson (max 15 words each)",
    "another rule",
    "another rule",
    "another rule",
    "another rule"
  ],
  "quizPreview": "1 sentence describing what types of scenarios today's quiz will test, building on this lesson"
}

Rules:
- Concepts must be ones ${expert.name} explicitly teaches or is known for (e.g. Zach Wilson teaches idempotent pipelines, SCD Type 2, cumulative table design)
- The client scenario must feel realistic with actual company characteristics (industry, scale, problem type)
- Debugging framework must be 3 explicit numbered steps a consultant would follow
- Cheat sheet items must be actionable rules, not definitions`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as QuizLesson;
}

// ── Quiz question generation (based on lesson) ────────────────────────────────

async function generateQuestions(
  topicId: string,
  topicLabel: string,
  dateKey: string,
  lesson: QuizLesson
): Promise<QuizQuestion[]> {
  const firm = pickFirm();
  const supportsCode = CODE_TOPICS.has(topicId);
  const supportsSQL = SQL_TOPICS.has(topicId);
  const isSoft = SOFT_TOPICS.has(topicId);

  let questionMix: string;
  if (isSoft) {
    questionMix = `8 multiple_choice + 22 free_text`;
  } else if (supportsSQL && supportsCode) {
    questionMix = `7 multiple_choice + 8 sql_write + 8 code_write + 7 free_text`;
  } else if (supportsSQL) {
    questionMix = `8 multiple_choice + 12 sql_write + 10 free_text`;
  } else if (supportsCode) {
    questionMix = `8 multiple_choice + 14 code_write + 8 free_text`;
  } else {
    questionMix = `8 multiple_choice + 22 free_text`;
  }

  const prompt = `You are a ${firm} case interviewer and technical assessor. Generate EXACTLY 30 quiz questions for a Senior Associate on: ${topicLabel}

Today the associate studied this lesson:
- Expert: ${lesson.expertName}
- Focus: ${lesson.todaysFocus}
- Concepts covered: ${lesson.concepts.map((c) => c.title).join(", ")}
- Client scenario context: ${lesson.consultingContext.realClientScenario}
- Debugging framework: ${lesson.consultingContext.debuggingFramework}

Required question mix (MUST total exactly 30): ${questionMix}

ALL 30 questions must:
1. Be scenario-based — set inside a DIFFERENT realistic consulting engagement per question (rotate firms: BCG, McKinsey, Bain, Deloitte, Oliver Wyman; rotate industries: banking, retail, healthcare, logistics, telecom, energy, fintech, FMCG)
2. Test one or more of: debugging methodology, problem-solving structure, technical application, or MECE analysis
3. Reference the lesson concepts — the associate just studied them and should recognise the connection
4. Progress in difficulty: q1-q8 intermediate, q9-q20 senior associate, q21-q30 challenging/edge cases
5. Be at Senior Associate difficulty — someone with 3-5 years experience

Return ONLY a JSON array of exactly 30 objects (no markdown fences, ids q1 through q30):
- multiple_choice: include "options" (4 choices), "correct_index" (0-3), "explanation"
- sql_write: include "language":"sql", "expected_answer" (full SQL), "explanation"
- code_write: include "language" (python/bash/scala/etc), "expected_answer" (full code), "explanation"
- free_text: include "expected_answer" (key points to cover), "explanation"

Rules:
- Each question names a specific company type and industry (never generic "a company")
- Debugging questions follow the 3-step Isolate→Hypothesise→Validate framework
- Multiple choice distractors reflect the common mistakes from today's lesson
- Code/SQL questions include full schema/context so they are self-contained
- Free-text questions require structured MECE answers referencing ${lesson.expertName}'s methodology
- Spread the 30 questions to cover ALL concepts from today's lesson multiple times`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed: Array<{
    id: string; type: string; text: string;
    options?: string[]; correct_index?: number;
    language?: string; expected_answer?: string;
    explanation: string;
  }> = JSON.parse(cleaned);

  return parsed.map((q) => ({
    id: q.id,
    type: (q.type as QuizQuestion["type"]) ?? "multiple_choice",
    text: q.text,
    options: q.options,
    correctIndex: q.correct_index,
    language: q.language,
    expectedAnswer: q.expected_answer,
    explanation: q.explanation,
  }));
}

// ── Fallbacks ─────────────────────────────────────────────────────────────────

function fallbackLesson(topicLabel: string, topicId: string): QuizLesson {
  const expert = EXPERT_REGISTRY[topicId] ?? FALLBACK_EXPERT;
  return {
    expertName: expert.name,
    expertCredentials: expert.credentials,
    expertSource: expert.source,
    todaysFocus: `Core principles and best practices in ${topicLabel}`,
    concepts: [
      {
        title: "Structured Problem Decomposition",
        explanation: `In ${topicLabel}, breaking problems into MECE (Mutually Exclusive, Collectively Exhaustive) components allows teams to diagnose root causes without overlap or gaps.`,
        whyItMatters: "Consulting clients at BCG or McKinsey expect engineers to communicate solutions clearly and systematically, not just technically correctly.",
        commonMistake: "Jumping to solutions before fully diagnosing the problem — a classic error that wastes client time and erodes credibility.",
      },
      {
        title: "Hypothesis-Driven Debugging",
        explanation: `Form a specific hypothesis about what could cause the observed failure in ${topicLabel}, test it with the minimum viable experiment, and iterate.`,
        whyItMatters: "Random debugging wastes project budgets. Hypothesis-driven approaches are what separate Senior Associates from juniors on client engagements.",
        commonMistake: "Testing fixes without documenting the hypothesis, making it impossible to learn from the outcome.",
      },
    ],
    consultingContext: {
      firmPerspective: `Top firms like BCG and McKinsey treat ${topicLabel} expertise as a client-facing skill, not just a back-office capability. Associates are expected to explain technical trade-offs to C-suite stakeholders.`,
      realClientScenario: `A Fortune 500 financial services client faced significant operational risk due to gaps in ${topicLabel} practices. The engagement team had to rapidly diagnose, remediate, and upskill the client's internal team within a 12-week sprint.`,
      debuggingFramework: "1. Isolate: Reproduce the issue in a controlled environment. 2. Hypothesise: Form one specific root-cause hypothesis. 3. Validate: Test with the minimum change that proves or disproves it.",
      methodologyApproach: `${expert.name}'s approach emphasises starting with proven patterns and adapting them to context, rather than reinventing solutions. This aligns with consulting's 'use the right tool for the job' philosophy.`,
    },
    cheatSheet: [
      `Always start ${topicLabel} debugging with logs and observability data`,
      "MECE thinking prevents overlap in root-cause analysis",
      "Senior Associates communicate trade-offs, not just solutions",
      "Hypothesis-driven: form it, test it, document it",
      `In ${topicLabel}, the most elegant solution is usually the most maintainable one`,
    ],
    quizPreview: `Today's quiz tests your ability to apply ${topicLabel} concepts in realistic consulting scenarios involving debugging, methodology, and structured problem-solving.`,
  };
}

function fallbackQuestions(topicLabel: string): QuizQuestion[] {
  const firms = ["BCG", "McKinsey", "Bain", "Deloitte", "Oliver Wyman", "PwC"];
  const companies = [
    "global retail bank processing 2M daily transactions",
    "FMCG multinational with operations in 40 countries",
    "streaming platform with 200M active subscribers",
    "global logistics company handling 50M shipments/year",
    "healthcare provider network across 300 hospitals",
    "ride-sharing startup scaling to APAC markets",
  ];

  const base: QuizQuestion[] = [];

  // 8 multiple choice
  for (let i = 0; i < 8; i++) {
    const firm = firms[i % firms.length];
    const company = companies[i % companies.length];
    if (i % 2 === 0) {
      base.push({
        id: `q${i + 1}`, type: "multiple_choice",
        text: `Your ${firm} team is advising a ${company} whose ${topicLabel} system has failed in production. Incident ongoing for ${i + 1} hours. Using a hypothesis-driven debugging approach, what is the correct first step?`,
        options: [
          "Restart all services and monitor for recurrence",
          "Form a specific failure hypothesis, then check logs to confirm or disprove it",
          "Escalate to the vendor immediately without evidence",
          "Roll back the last deployment without investigating root cause",
        ],
        correctIndex: 1,
        explanation: `Hypothesis-driven debugging — the ${firm} standard — means forming a testable hypothesis first, then gathering targeted evidence. Restarting services is a temporary fix, not a diagnosis.`,
      });
    } else {
      base.push({
        id: `q${i + 1}`, type: "multiple_choice",
        text: `A ${firm} client's ${topicLabel} team reports that their system 'sometimes produces wrong results'. This is not MECE. Which restatement correctly applies MECE decomposition?`,
        options: [
          "'It fails randomly — we need more servers'",
          "'Failures fall into: (A) data quality issues OR (B) processing logic errors OR (C) infrastructure failures — mutually exclusive, collectively exhaustive'",
          "'We need to add more logging first'",
          "'The system needs to be rebuilt from scratch'",
        ],
        correctIndex: 1,
        explanation: "MECE decomposition creates non-overlapping, exhaustive categories. Option B is the only answer that genuinely decomposes the problem space without overlap or gaps.",
      });
    }
  }

  // 22 free_text
  const freeTextTemplates = [
    (f: string, c: string, n: number) => ({
      id: `q${n}`, type: "free_text" as const,
      text: `You are leading a ${f} engagement at a ${c}. Their ${topicLabel} system is intermittently producing incorrect outputs that only appear 3 days later. Using Isolate → Hypothesise → Validate, walk through your diagnostic approach. What specific data and logs would you check at each step?`,
      expectedAnswer: "Isolate: reproduce on a data subset, identify affected records and whether the pattern is time-based. Hypothesise: form 2-3 specific hypotheses (timezone handling, boundary conditions, upstream quality). Validate: design minimum experiment per hypothesis, check audit logs, compare checksums.",
      explanation: "Structured consulting debugging methodology — a core Senior Associate skill on client engagements.",
    }),
    (f: string, c: string, n: number) => ({
      id: `q${n}`, type: "free_text" as const,
      text: `A ${f} client (${c}) asks you to evaluate ROI for their ${topicLabel} investment. No structured measurement exists. Using top-down hypothesis-driven methodology, define the 3 key questions you'd answer first and the data needed for each.`,
      expectedAnswer: "Q1: What is the baseline? (pre-investment KPIs) Q2: What changed? (delta attributable to investment vs external factors) Q3: What is the counterfactual? (what would have happened without it). Each needs specific, named data sources.",
      explanation: "Before collecting data, Senior Associates structure the measurement framework — this is hypothesis-driven, top-down consulting methodology.",
    }),
    (f: string, c: string, n: number) => ({
      id: `q${n}`, type: "free_text" as const,
      text: `You are presenting to the CTO of a ${c} (${f} engagement). They want to cut ${topicLabel} costs by 40% in 6 months. How would you structure your analysis? Include your decomposition framework, key hypotheses, and how you'd prioritise initiatives.`,
      expectedAnswer: "Decompose cost drivers MECE: people vs infrastructure vs licensing vs process waste. Form hypotheses for each driver. Prioritise by: impact (%) × feasibility × time-to-realise. Always quantify the 'safe to cut vs risky to cut' distinction.",
      explanation: "Cost optimisation is a classic consulting problem requiring MECE decomposition, hypothesis testing, and prioritisation frameworks.",
    }),
    (f: string, c: string, n: number) => ({
      id: `q${n}`, type: "free_text" as const,
      text: `During a ${f} engagement, a ${c} is deciding between build vs buy for their ${topicLabel} needs. Walk through the decision framework you'd use. What are the 4-5 most critical factors and how would you weight them?`,
      expectedAnswer: "Factors: strategic differentiation (build if core), total cost of ownership, time-to-market, internal capability, vendor lock-in risk. Weight by: urgency, competitive moat, and build capability. Recommend with clear assumptions documented.",
      explanation: "Build vs buy is a classic Senior Associate-level recommendation that requires structured trade-off analysis, not opinion.",
    }),
    (f: string, c: string, n: number) => ({
      id: `q${n}`, type: "free_text" as const,
      text: `You discover a critical ${topicLabel} architectural flaw at a ${c} (${f} client) 2 weeks before go-live. The flaw will cause data inconsistencies under load. Walk through how you would: (1) assess severity, (2) communicate to the client, and (3) recommend a path forward.`,
      expectedAnswer: "Severity: quantify impact under realistic load scenarios. Communication: early, factual, with solution options — not just the problem. Path forward: present 2-3 options with trade-offs, timelines, and risks. Recommend one with clear rationale. Never deliver bad news without a prepared recommendation.",
      explanation: "This tests judgment, communication under pressure, and structured problem-solving — core consulting competencies for Senior Associates.",
    }),
  ];

  for (let i = 0; i < 22; i++) {
    const n = i + 9; // q9 through q30
    const firm = firms[i % firms.length];
    const company = companies[i % companies.length];
    const template = freeTextTemplates[i % freeTextTemplates.length];
    base.push(template(firm, company, n));
  }

  return base;
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topicId");
  const dateParam = request.nextUrl.searchParams.get("date");
  const dateKey = dateParam ?? format(new Date(), "yyyy-MM-dd");

  if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

  const topics = await loadTopics();
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  // Return cached quiz if exists for today
  const existing = await getQuiz(topicId, dateKey);
  if (existing) return NextResponse.json({ quiz: existing, cached: true });

  // Generate lesson first, then questions based on lesson
  let lesson: QuizLesson;
  let questions: QuizQuestion[];
  let generatedWithAI = true;

  if (process.env.GEMINI_API_KEY) {
    try {
      lesson = await generateLesson(topicId, topic.label, dateKey);
    } catch {
      lesson = fallbackLesson(topic.label, topicId);
      generatedWithAI = false;
    }

    if (generatedWithAI) {
      try {
        questions = await generateQuestions(topicId, topic.label, dateKey, lesson);
      } catch {
        questions = fallbackQuestions(topic.label);
      }
    } else {
      questions = fallbackQuestions(topic.label);
    }
  } else {
    lesson = fallbackLesson(topic.label, topicId);
    questions = fallbackQuestions(topic.label);
    generatedWithAI = false;
  }

  const quiz = await saveQuiz(topicId, dateKey, questions, lesson);
  return NextResponse.json({ quiz, cached: false, generatedWithAI });
}
