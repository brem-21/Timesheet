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
    questionMix = `3 multiple-choice + 2 free_text`;
  } else if (supportsSQL && supportsCode) {
    questionMix = `2 multiple-choice + 1 sql_write + 1 code_write + 1 free_text`;
  } else if (supportsSQL) {
    questionMix = `2 multiple-choice + 2 sql_write + 1 free_text`;
  } else if (supportsCode) {
    questionMix = `2 multiple-choice + 2 code_write + 1 free_text`;
  } else {
    questionMix = `3 multiple-choice + 2 free_text`;
  }

  const prompt = `You are a ${firm} case interviewer and technical assessor. Generate 5 quiz questions for a Senior Associate on: ${topicLabel}

Today the associate studied this lesson:
- Expert: ${lesson.expertName}
- Focus: ${lesson.todaysFocus}
- Concepts covered: ${lesson.concepts.map((c) => c.title).join(", ")}
- Client scenario context: ${lesson.consultingContext.realClientScenario}
- Debugging framework: ${lesson.consultingContext.debuggingFramework}

Question mix: ${questionMix}

ALL questions must:
1. Be scenario-based — set inside a realistic ${firm} client engagement (Fortune 500 company, specific industry)
2. Test one or more of: debugging, problem-solving methodology, or application of ${lesson.todaysFocus}
3. Reference the lesson concepts — the associate just studied them and should recognise the connection
4. Be at Senior Associate difficulty — someone with 3-5 years experience who studied the lesson

Return ONLY a JSON array (no markdown fences):
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "text": "Your ${firm} team is advising a global bank processing 2M daily transactions. The data engineering team (led by their VP of Data) flags that...[scenario]...Based on ${lesson.expertName}'s approach to [concept], which action addresses the root cause?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 2,
    "explanation": "Why this is correct referencing the lesson concept, and why each distractor is wrong (2-3 sentences)."
  },
  {
    "id": "q2",
    "type": "sql_write",
    "text": "Your ${firm} client (a global e-commerce platform) needs...[scenario]...\\nSchema:\\n  table1(col1 TYPE, col2 TYPE, ...)\\nWrite a SQL query that...",
    "language": "sql",
    "expected_answer": "-- Optimal solution\\nSELECT ...",
    "explanation": "What makes this solution correct and efficient, tied to today's lesson."
  },
  {
    "id": "q3",
    "type": "code_write",
    "text": "During a ${firm} engagement at a fintech client...[scenario]...\\nFunction signature: def function_name(params) -> return_type\\n\\nRequirements:\\n- requirement 1\\n- requirement 2",
    "language": "python",
    "expected_answer": "def function_name(params):\\n    # Solution\\n    ...",
    "explanation": "Why this approach is correct, connecting to the lesson methodology."
  },
  {
    "id": "q4",
    "type": "free_text",
    "text": "You are presenting to the CTO of a ${firm} client...[scenario]...Using ${lesson.expertName}'s [methodology] and ${firm}'s structured approach, walk through how you would [debug/solve/design] this. Structure your answer using the [debugging framework from lesson].",
    "expected_answer": "Key points the answer should cover: ...",
    "explanation": "What a high-scoring answer demonstrates."
  }
]

Rules:
- Every question must name a realistic company type (e.g. 'global retail bank', 'streaming platform with 200M subscribers', 'FMCG multinational', 'ride-sharing startup scaling to APAC')
- Debugging questions must follow the 3-step framework from today's lesson
- Problem-solving questions must require structured, MECE thinking
- Methodology questions must reference ${lesson.expertName}'s specific approach
- For code/SQL: include full schema and constraints so the question is self-contained
- Make distractors in MC questions reflect the common mistake from today's lesson`;

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
  return [
    {
      id: "q1", type: "multiple_choice",
      text: `Your BCG team is advising a global retail client whose ${topicLabel} system has failed in production. The incident has been ongoing for 2 hours and the CTO is asking for a root cause. What is the correct first step using a hypothesis-driven debugging approach?`,
      options: [
        "Restart all services and monitor for recurrence",
        "Form a specific failure hypothesis, then check logs that would confirm or disprove it",
        "Escalate to the vendor immediately",
        "Roll back the last deployment without investigation"
      ],
      correctIndex: 1,
      explanation: "Hypothesis-driven debugging — the McKinsey and BCG standard — means forming a testable hypothesis first, then gathering targeted evidence. Restarting services is a fix, not a diagnosis."
    },
    {
      id: "q2", type: "multiple_choice",
      text: `A McKinsey client's ${topicLabel} team is debating two approaches. Approach A is faster to implement but creates technical debt. Approach B takes 3x longer but is more maintainable. The client needs to go live in 6 weeks. As Senior Associate, what is the structured recommendation?`,
      options: [
        "Always choose Approach B — technical debt is never acceptable",
        "Always choose Approach A — client deadlines take priority",
        "Recommend Approach A for MVP with a documented remediation plan and timeline for Approach B",
        "Ask the client to decide — it's their system"
      ],
      correctIndex: 2,
      explanation: "Senior Associates balance delivery and quality. The MECE answer is: meet the deadline with Approach A but document and commit to the debt remediation. Leaving the decision entirely to the client without a recommendation is not consulting."
    },
    {
      id: "q3", type: "free_text",
      text: `You are leading a Bain engagement at a global logistics company. Their ${topicLabel} system processes 10M events per day and is intermittently producing incorrect outputs that only appear in reports 3 days later. Using the 3-step debugging framework (Isolate → Hypothesise → Validate), walk through how you would diagnose this. Be specific about what data, logs, or tests you would look for at each step.`,
      expectedAnswer: "A strong answer: Step 1 Isolate — reproduce on a subset of data, identify which records are affected, check if pattern is time-based or data-based. Step 2 Hypothesise — form 2-3 specific hypotheses (e.g. timezone handling, batch aggregation boundary, upstream data quality). Step 3 Validate — design minimum test for each hypothesis, check audit logs, compare input vs output checksums.",
      explanation: "This tests the ability to apply structured consulting methodology to a technical debugging scenario — a core Senior Associate skill."
    },
    {
      id: "q4", type: "multiple_choice",
      text: `During a BCG engagement, a client's ${topicLabel} team reports that their system 'sometimes fails'. This is not MECE. Which of the following restatements best applies MECE decomposition to this problem statement?`,
      options: [
        "'The system fails randomly, so we need more servers'",
        "'Failures occur in category A (data quality issues) OR category B (infrastructure failures) OR category C (logic bugs) — these are mutually exclusive and cover all cases'",
        "'We need to add more logging to understand what's happening'",
        "'The system is unreliable and needs to be rewritten'"
      ],
      correctIndex: 1,
      explanation: "MECE decomposition creates categories that are Mutually Exclusive (no overlap) and Collectively Exhaustive (cover all cases). Option B is the only answer that actually decomposes the problem space without overlap."
    },
    {
      id: "q5", type: "free_text",
      text: `A McKinsey client (global bank) asks you to evaluate whether their ${topicLabel} investment is delivering ROI. They have gut-feel metrics but no structured measurement. Using a top-down, hypothesis-driven methodology, outline the 3 key questions you would answer first and the data you would need to answer each one.`,
      expectedAnswer: "Good answer: Q1 What is the baseline? (current state metrics before investment) Q2 What changed? (delta in KPIs attributable to the investment, not external factors) Q3 What is the counterfactual? (what would have happened without the investment). Each needs specific data sources, not just 'we need data'.",
      explanation: "Senior Associates on consulting engagements must structure ambiguous business questions before collecting data — this is the hypothesis-driven, top-down approach."
    },
  ];
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
