"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types (mirrored from store) ────────────────────────────────────────────────

interface GrowthTopic {
  id: string;
  label: string;
  description?: string;
  isCustom: boolean;
  createdAt: number;
}

interface GrowthMaterial {
  id: string;
  topicId: string;
  title: string;
  type: "file" | "link" | "note" | "ai_suggestion";
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  contentText?: string;
  sourceUrl?: string;
  createdAt: number;
}

type QuizQuestionType = "multiple_choice" | "code_write" | "sql_write" | "free_text";

interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  text: string;
  // multiple_choice
  options?: string[];
  correctIndex?: number;
  // open-ended
  expectedAnswer?: string;
  language?: string;
  explanation: string;
}

interface QuizConcept {
  title: string;
  explanation: string;
  whyItMatters: string;
  commonMistake: string;
}

interface QuizLesson {
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

interface GrowthQuiz {
  id: string;
  topicId: string;
  dateKey: string;
  questions: QuizQuestion[];
  lesson: QuizLesson;
  generatedAt: number;
}

interface QuizAnswer {
  questionId: string;
  questionType: QuizQuestionType;
  chosenIndex?: number;
  writtenAnswer?: string;
  aiFeedback?: string;
  aiScore?: number;
  isCorrect: boolean;
  timeTakenMs?: number;
}

interface GrowthInsight {
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

interface GrowthQuizAttempt {
  id: string;
  topicId: string;
  dateKey: string;
  score: number;
  totalQ: number;
  correctQ: number;
  completedAt: number;
}

interface AISuggestion {
  title: string;
  url: string;
  type: string;
  why: string;
}

interface CourseSection {
  id: string;
  title: string;
  objectives: string[];
  keyTopics: string[];
  explanation?: string;
  teachingPoints?: string[];
  realWorldExample?: string;
  codeExample?: string;
  exerciseLanguage?: string;
  practiceExercise: string;
}

interface CourseChapter {
  id: string;
  number: number;
  title: string;
  description: string;
  estimatedHours: number;
  sections: CourseSection[];
}

interface CourseModule {
  title: string;
  description: string;
  level: string;
  totalHours: number;
  chapters: CourseChapter[];
}

interface GrowthModuleRecord {
  id: string;
  topicId: string;
  title: string;
  modules: CourseModule;
  generatedAt: number;
}

interface AssessmentContextData {
  firm: string;
  industry: string;
  companyType: string;
  problemStatement: string;
  expectedSkills: string[];
  evaluationCriteria: string[];
}

interface DailyAssessment {
  id: string;
  dateKey: string;
  scenario: string;
  topicsCovered: string[];
  contextData: AssessmentContextData;
  generatedAt: number;
}

interface AssessmentFeedback {
  technicality: { score: number; comment: string };
  logic: { score: number; comment: string };
  problemSolving: { score: number; comment: string };
  delivery: { score: number; comment: string };
  structure?: { score: number; comment: string }; // folder submissions only
  overallVerdict: string;
  strengthsHighlighted: string[];
  areasToImprove: string[];
}

interface UploadedFile {
  path: string;
  name: string;
  content: string;
  binary: boolean;
  size: number;
}

interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  dateKey: string;
  answer: string;
  score: number;
  feedback: AssessmentFeedback;
  submittedAt: number;
}

type Tab = "materials" | "course" | "quiz" | "insights" | "assessment";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".py", ".sql", ".js", ".ts", ".jsx", ".tsx", ".json", ".csv",
  ".html", ".css", ".yaml", ".yml", ".sh", ".r", ".ipynb", ".java", ".go",
  ".rb", ".php", ".cpp", ".c", ".h", ".rs", ".scala", ".kt", ".swift", ".xml",
  ".toml", ".ini", ".env", ".dockerfile", ".makefile", ".tf", ".hcl",
]);

function buildFolderTreeText(files: UploadedFile[]): string {
  if (files.length === 0) return "";
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const root = sorted[0].path.split("/")[0] ?? "submission";
  const lines: string[] = [root + "/"];
  for (const f of sorted) {
    const parts = f.path.split("/");
    const depth = parts.length - 1;
    const name = parts[parts.length - 1];
    lines.push("  ".repeat(depth) + "├── " + name + (f.binary ? " (binary)" : ""));
  }
  return lines.join("\n");
}

function formatFolderSubmission(files: UploadedFile[]): string {
  const tree = buildFolderTreeText(files);
  const textFiles = [...files].filter((f) => !f.binary).sort((a, b) => a.path.localeCompare(b.path));
  const contents = textFiles
    .map((f) => `${"─".repeat(4)} ${f.path} ${"─".repeat(4)}\n${f.content}`)
    .join("\n\n");
  return `=== FOLDER SUBMISSION ===\n\nFOLDER STRUCTURE:\n${tree}\n\n=== FILE CONTENTS ===\n\n${contents}`;
}

function parseFolderTree(answer: string): string {
  const match = answer.match(/FOLDER STRUCTURE:\n([\s\S]*?)\n\n===/);
  return match ? match[1] : "";
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function materialIcon(type: GrowthMaterial["type"], mimeType?: string): string {
  if (type === "ai_suggestion") return "✨";
  if (type === "note") return "📝";
  if (type === "link") return "🔗";
  if (mimeType?.includes("pdf")) return "📄";
  if (mimeType?.includes("video")) return "🎬";
  if (mimeType?.includes("audio")) return "🎧";
  if (mimeType?.includes("image")) return "🖼️";
  return "📎";
}

function trendBadge(trend: GrowthInsight["trend"]) {
  const cfg = {
    improving:         { label: "Improving ↑",        cls: "bg-emerald-100 text-emerald-700" },
    declining:         { label: "Declining ↓",        cls: "bg-red-100 text-red-700" },
    stable:            { label: "Stable →",            cls: "bg-amber-100 text-amber-700" },
    insufficient_data: { label: "Not enough data",    cls: "bg-gray-100 text-gray-500" },
  };
  const { label, cls } = cfg[trend] ?? cfg.insufficient_data;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function scoreBadge(score?: number) {
  if (score === undefined) return null;
  const cls = score >= 80 ? "bg-emerald-100 text-emerald-700"
    : score >= 60 ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls}`}>{score}%</span>;
}

// ── Score mini-chart ──────────────────────────────────────────────────────────

function ScoreChart({ attempts }: { attempts: GrowthQuizAttempt[] }) {
  const data = [...attempts].reverse().slice(-14);
  if (data.length === 0) return <p className="text-xs text-gray-400 text-center py-4">No attempts yet</p>;

  const max = 100;
  const h = 60;
  const w = 300;
  const barW = Math.min(18, (w / data.length) - 4);

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" style={{ maxWidth: 380 }}>
      {data.map((a, i) => {
        const x = (i / data.length) * w + 2;
        const barH = (a.score / max) * h;
        const y = h - barH;
        const fill = a.score >= 80 ? "#10b981" : a.score >= 60 ? "#f59e0b" : "#ef4444";
        return (
          <g key={a.id}>
            <rect x={x} y={y} width={barW} height={barH} fill={fill} rx={2} opacity={0.85} />
            <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize={7} fill="#9ca3af">
              {a.dateKey.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const [topics, setTopics] = useState<GrowthTopic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("materials");
  const [topicScores, setTopicScores] = useState<Record<string, number>>({});

  // Materials state
  const [materials, setMaterials] = useState<GrowthMaterial[]>([]);
  const [matLoading, setMatLoading] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [noteText, setNoteText] = useState("");
  const [addMode, setAddMode] = useState<"none" | "link" | "note">("none");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Course modules state
  const [courseRecord, setCourseRecord] = useState<GrowthModuleRecord | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Quiz state
  const [quiz, setQuiz] = useState<GrowthQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizPhase, setQuizPhase] = useState<"idle" | "lesson" | "quiz" | "done">("idle");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; correctQ: number; totalQ: number } | null>(null);
  const [quizHistory, setQuizHistory] = useState<GrowthQuizAttempt[]>([]);
  const questionStartRef = useRef<number>(Date.now());

  // Insights state
  const [insight, setInsight] = useState<GrowthInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  // Add topic state
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicLabel, setNewTopicLabel] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");

  // Course section expansion + exercise state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [exerciseCode, setExerciseCode] = useState<Record<string, string>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [exerciseResults, setExerciseResults] = useState<Record<string, { score: number; feedback: string }>>({});
  const [exerciseEvaluating, setExerciseEvaluating] = useState<Record<string, boolean>>({});

  // Daily assessment state
  const [assessment, setAssessment] = useState<DailyAssessment | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentAnswer, setAssessmentAnswer] = useState("");
  const [assessmentSubmission, setAssessmentSubmission] = useState<AssessmentSubmission | null>(null);
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState<Array<{ dateKey: string; score: number; submittedAt: number }>>([]);
  const [assessmentMode, setAssessmentMode] = useState<"text" | "folder">("text");
  const [assessmentFiles, setAssessmentFiles] = useState<UploadedFile[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTopics = useCallback(async () => {
    const res = await fetch("/api/growth/topics");
    const data = await res.json();
    if (data.topics) {
      setTopics(data.topics);
      if (!selectedId && data.topics.length > 0) setSelectedId(data.topics[0].id);
    }
  }, [selectedId]);

  useEffect(() => { loadTopics(); }, []);

  const loadMaterials = useCallback(async (topicId: string) => {
    setMatLoading(true);
    try {
      const res = await fetch(`/api/growth/materials?topicId=${topicId}`);
      const data = await res.json();
      if (data.materials) setMaterials(data.materials);
    } finally {
      setMatLoading(false);
    }
  }, []);

  const loadInsight = useCallback(async (topicId: string) => {
    const res = await fetch(`/api/growth/insights?topicId=${topicId}`);
    const data = await res.json();
    if (data.insight) setInsight(data.insight);
    else setInsight(null);
    setAttemptCount(data.attemptCount ?? 0);
    if (data.insight?.avgScore !== undefined) {
      setTopicScores((prev) => ({ ...prev, [topicId]: data.insight.avgScore }));
    }
  }, []);

  const loadModules = useCallback(async (topicId: string, regen = false) => {
    setCourseLoading(true);
    setCourseRecord(null);
    setExpandedChapters(new Set());
    setExpandedSections(new Set());
    try {
      const url = `/api/growth/modules?topicId=${topicId}${regen ? "&regen=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.modules) {
        setCourseRecord(data.modules);
        setExpandedChapters(new Set([data.modules.modules.chapters[0]?.id].filter(Boolean)));
      }
    } finally {
      setCourseLoading(false);
    }
  }, []);

  const loadAssessment = useCallback(async () => {
    setAssessmentLoading(true);
    try {
      const res = await fetch(`/api/growth/assessment?date=${todayKey()}`);
      const data = await res.json();
      if (data.assessment) setAssessment(data.assessment);
      if (data.submission) setAssessmentSubmission(data.submission);
      // Load history
      const hRes = await fetch(`/api/growth/assessment?history=true`);
      const hData = await hRes.json();
      setAssessmentHistory(hData.history ?? []);
    } finally {
      setAssessmentLoading(false);
    }
  }, []);

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const parsed: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name;
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      const isText = TEXT_EXTENSIONS.has(ext) && file.size <= 500_000;
      if (isText) {
        const content = await file.text();
        parsed.push({ path, name: file.name, content, binary: false, size: file.size });
      } else {
        parsed.push({ path, name: file.name, content: `[${file.type || "binary"} — ${(file.size / 1024).toFixed(1)} KB]`, binary: true, size: file.size });
      }
    }
    parsed.sort((a, b) => a.path.localeCompare(b.path));
    setAssessmentFiles(parsed);
    e.target.value = "";
  }, []);

  const handleSubmitAssessment = async () => {
    if (!assessment || assessmentSubmitting) return;
    let answer: string;
    if (assessmentMode === "folder") {
      if (assessmentFiles.length === 0) return;
      answer = formatFolderSubmission(assessmentFiles);
    } else {
      if (!assessmentAnswer.trim()) return;
      answer = assessmentAnswer;
    }
    setAssessmentSubmitting(true);
    try {
      const res = await fetch("/api/growth/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: assessment.id, dateKey: todayKey(), answer, submissionType: assessmentMode }),
      });
      const data = await res.json();
      if (data.submission) setAssessmentSubmission(data.submission);
    } finally {
      setAssessmentSubmitting(false);
    }
  };

  const handleEvaluateExercise = async (sectionId: string, section: CourseSection) => {
    const answer = exerciseCode[sectionId] || exerciseNotes[sectionId] || "";
    if (!answer.trim() || !selectedTopic) return;
    setExerciseEvaluating((prev) => ({ ...prev, [sectionId]: true }));
    try {
      const res = await fetch("/api/growth/quiz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: {
            type: section.exerciseLanguage ? "code_write" : "free_text",
            text: section.practiceExercise,
            expectedAnswer: section.explanation ?? section.practiceExercise,
            language: section.exerciseLanguage,
          },
          answer,
          topicLabel: selectedTopic.label,
        }),
      });
      const data = await res.json();
      setExerciseResults((prev) => ({ ...prev, [sectionId]: { score: data.score ?? 50, feedback: data.feedback ?? "" } }));
    } catch {
      setExerciseResults((prev) => ({ ...prev, [sectionId]: { score: 0, feedback: "Evaluation failed. Please try again." } }));
    } finally {
      setExerciseEvaluating((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    setMaterials([]);
    setQuiz(null);
    setQuizPhase("idle");
    setQuizDone(false);
    setQuizResult(null);
    setAnswers([]);
    setCurrentQ(0);
    setSelectedOption(null);
    setRevealed(false);
    setInsight(null);
    setSuggestions([]);
    setAddMode("none");
    setQuizHistory([]);
    setCourseRecord(null);
    setExpandedChapters(new Set());
    setExpandedSections(new Set());
    setExerciseCode({});
    setExerciseNotes({});
    setExerciseResults({});

    loadMaterials(selectedId);
    loadInsight(selectedId);
  }, [selectedId, loadMaterials, loadInsight]);

  // ── Materials ─────────────────────────────────────────────────────────────

  const handleUpload = async (file: File) => {
    if (!selectedId) return;
    setUploadLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("topicId", selectedId);
      const res = await fetch("/api/growth/materials/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.material) setMaterials((prev) => [data.material, ...prev]);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!selectedId || !linkUrl.trim()) return;
    const res = await fetch("/api/growth/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: selectedId, title: linkTitle.trim() || linkUrl, type: "link", url: linkUrl.trim() }),
    });
    const data = await res.json();
    if (data.material) { setMaterials((prev) => [data.material, ...prev]); setLinkUrl(""); setLinkTitle(""); setAddMode("none"); }
  };

  const handleAddNote = async () => {
    if (!selectedId || !noteText.trim()) return;
    const res = await fetch("/api/growth/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: selectedId, title: noteText.slice(0, 60), type: "note", contentText: noteText }),
    });
    const data = await res.json();
    if (data.material) { setMaterials((prev) => [data.material, ...prev]); setNoteText(""); setAddMode("none"); }
  };

  const handleDeleteMaterial = async (id: string) => {
    await fetch(`/api/growth/materials/${id}`, { method: "DELETE" });
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSuggest = async () => {
    if (!selectedId) return;
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/growth/materials/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: selectedId }),
      });
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleAddSuggestion = async (s: AISuggestion) => {
    if (!selectedId) return;
    const res = await fetch("/api/growth/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: selectedId, title: s.title, type: "ai_suggestion", url: s.url, sourceUrl: s.url, contentText: s.why }),
    });
    const data = await res.json();
    if (data.material) { setMaterials((prev) => [data.material, ...prev]); setSuggestions((prev) => prev.filter((x) => x.url !== s.url)); }
  };

  // ── Quiz ──────────────────────────────────────────────────────────────────

  const loadQuiz = async () => {
    if (!selectedId) return;
    setQuizLoading(true);
    try {
      const res = await fetch(`/api/growth/quiz?topicId=${selectedId}&date=${todayKey()}`);
      const data = await res.json();
      if (data.quiz) {
        setQuiz(data.quiz);
        setCurrentQ(0);
        setAnswers([]);
        setSelectedOption(null);
        setRevealed(false);
        setQuizDone(false);
        setQuizResult(null);
        setWrittenAnswer("");
        setEvalFeedback(null);
        // Always show lesson first before quiz
        setQuizPhase("lesson");
      }
    } finally {
      setQuizLoading(false);
    }
  };

  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState<{ score: number; isCorrect: boolean; feedback: string } | null>(null);

  const handleSelectOption = (optionIndex: number) => {
    if (revealed || !quiz) return;
    setSelectedOption(optionIndex);
    setRevealed(true);

    const question = quiz.questions[currentQ];
    const isCorrect = optionIndex === (question.correctIndex ?? 0);
    const timeTakenMs = Date.now() - questionStartRef.current;

    const newAnswer: QuizAnswer = {
      questionId: question.id,
      questionType: question.type ?? "multiple_choice",
      chosenIndex: optionIndex,
      isCorrect,
      timeTakenMs,
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (currentQ === quiz.questions.length - 1) {
      setTimeout(() => submitQuiz(updatedAnswers, quiz.id), 800);
    }
  };

  const handleSubmitWritten = async () => {
    if (!quiz || !writtenAnswer.trim() || evaluating) return;
    const question = quiz.questions[currentQ];
    setEvaluating(true);
    setEvalFeedback(null);

    let evalResult = { score: 50, isCorrect: false, feedback: "Unable to evaluate — answer recorded." };
    try {
      const res = await fetch("/api/growth/quiz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer: writtenAnswer, topicLabel: selectedTopic?.label }),
      });
      if (res.ok) evalResult = await res.json();
    } catch { /* use fallback */ }

    setEvalFeedback(evalResult);
    setEvaluating(false);
    setRevealed(true);

    const timeTakenMs = Date.now() - questionStartRef.current;
    const newAnswer: QuizAnswer = {
      questionId: question.id,
      questionType: question.type,
      writtenAnswer: writtenAnswer.trim(),
      aiFeedback: evalResult.feedback,
      aiScore: evalResult.score,
      isCorrect: evalResult.isCorrect,
      timeTakenMs,
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (currentQ === quiz.questions.length - 1) {
      setTimeout(() => submitQuiz(updatedAnswers, quiz.id), 1200);
    }
  };

  const handleNextQuestion = () => {
    if (!quiz || currentQ >= quiz.questions.length - 1) return;
    setCurrentQ((prev) => prev + 1);
    setSelectedOption(null);
    setRevealed(false);
    setWrittenAnswer("");
    setEvalFeedback(null);
    questionStartRef.current = Date.now();
  };

  const submitQuiz = async (finalAnswers: QuizAnswer[], quizId: string) => {
    if (!selectedId) return;
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/growth/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, topicId: selectedId, dateKey: todayKey(), answers: finalAnswers }),
      });
      const data = await res.json();
      setQuizResult({ score: data.score, correctQ: data.correctQ, totalQ: data.totalQ });
      setQuizHistory(data.history ?? []);
      setQuizDone(true);
      setQuizPhase("done");
      setTopicScores((prev) => ({ ...prev, [selectedId]: data.score }));
      // Refresh insights
      await loadInsight(selectedId);
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Insights ──────────────────────────────────────────────────────────────

  const handleRegenerateInsight = async () => {
    if (!selectedId) return;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/growth/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: selectedId }),
      });
      const data = await res.json();
      if (data.insight) setInsight(data.insight);
    } finally {
      setInsightLoading(false);
    }
  };

  // ── Add custom topic ──────────────────────────────────────────────────────

  const handleAddTopic = async () => {
    if (!newTopicLabel.trim()) return;
    const res = await fetch("/api/growth/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newTopicLabel.trim(), description: newTopicDesc.trim() }),
    });
    const data = await res.json();
    if (data.topic) {
      setTopics((prev) => [...prev, data.topic]);
      setSelectedId(data.topic.id);
      setNewTopicLabel("");
      setNewTopicDesc("");
      setShowAddTopic(false);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    await fetch("/api/growth/topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(topics.find((t) => t.id !== id)?.id ?? null);
  };

  const selectedTopic = topics.find((t) => t.id === selectedId);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">

      {/* ── Topic selector bar ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Topic</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="flex-1 min-w-0 max-w-xs text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">— Select a topic —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}{topicScores[t.id] !== undefined ? ` (${topicScores[t.id]}%)` : ""}
              </option>
            ))}
          </select>
          {selectedTopic?.isCustom && (
            <button onClick={() => handleDeleteTopic(selectedTopic.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
          )}
        </div>

        {/* Add custom topic inline */}
        {showAddTopic ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input value={newTopicLabel} onChange={(e) => setNewTopicLabel(e.target.value)}
              placeholder="Topic name" autoFocus
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-32" />
            <input value={newTopicDesc} onChange={(e) => setNewTopicDesc(e.target.value)}
              placeholder="Description (optional)"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none w-40" />
            <button onClick={handleAddTopic} className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600">Add</button>
            <button onClick={() => setShowAddTopic(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowAddTopic(true)} className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0">+ Custom topic</button>
        )}

        {selectedTopic && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setTab("quiz"); loadQuiz(); }}
              className="text-sm px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              Today&apos;s Quiz
            </button>
            <button onClick={() => { setTab("insights"); handleRegenerateInsight(); }}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Insights
            </button>
          </div>
        )}
      </div>

      {/* ── Content area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedTopic ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-gray-500 text-sm">Select a topic from the dropdown above to get started</p>
            </div>
          </div>
        ) : (
          <>
            {/* Topic header + tabs */}
            <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-base font-bold text-gray-900">{selectedTopic.label}</h1>
                {selectedTopic.description && <span className="text-sm text-gray-400">— {selectedTopic.description}</span>}
                {topicScores[selectedId!] !== undefined && scoreBadge(topicScores[selectedId!])}
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 mt-4 flex-wrap">
                {(["materials", "course", "quiz", "insights", "assessment"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t);
                      if (t === "course" && selectedId && !courseRecord && !courseLoading) {
                        loadModules(selectedId);
                      }
                      if (t === "assessment" && !assessment && !assessmentLoading) {
                        loadAssessment();
                      }
                    }}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                      tab === t
                        ? t === "assessment" ? "bg-purple-100 text-purple-700 font-medium" : "bg-indigo-100 text-indigo-700 font-medium"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t === "materials" ? "Study Materials"
                      : t === "course" ? "Course Modules"
                      : t === "quiz" ? "Daily Quiz"
                      : t === "assessment" ? "Daily Assessment"
                      : "Insights"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ── MATERIALS TAB ─────────────────────────────────────────── */}
              {tab === "materials" && (
                <div className="max-w-3xl space-y-5">
                  {/* Upload zone */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                      dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleUpload(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadLoading ? (
                      <p className="text-sm text-indigo-500">Uploading...</p>
                    ) : (
                      <>
                        <p className="text-2xl mb-1">📁</p>
                        <p className="text-sm font-medium text-gray-700">Drop files here or click to upload</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, MP4, MP3, images — up to 20 MB</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                    />
                  </div>

                  {/* Add link / note */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddMode(addMode === "link" ? "none" : "link")}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${addMode === "link" ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      🔗 Add Link
                    </button>
                    <button
                      onClick={() => setAddMode(addMode === "note" ? "none" : "note")}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${addMode === "note" ? "bg-amber-50 border-amber-300 text-amber-700" : "border-gray-200 hover:bg-gray-50"}`}
                    >
                      📝 Add Note
                    </button>
                    <button
                      onClick={handleSuggest}
                      disabled={suggestLoading}
                      className="text-sm px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                    >
                      {suggestLoading ? "Asking AI..." : "✨ AI Suggest"}
                    </button>
                  </div>

                  {addMode === "link" && (
                    <div className="bg-blue-50 rounded-xl p-4 space-y-2 border border-blue-100">
                      <input
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="Title (optional)"
                        className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleAddLink} className="text-sm bg-blue-500 text-white px-4 py-1.5 rounded-lg hover:bg-blue-600">Save Link</button>
                        <button onClick={() => setAddMode("none")} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  )}

                  {addMode === "note" && (
                    <div className="bg-amber-50 rounded-xl p-4 space-y-2 border border-amber-100">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write your note or key takeaways..."
                        rows={4}
                        className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleAddNote} className="text-sm bg-amber-500 text-white px-4 py-1.5 rounded-lg hover:bg-amber-600">Save Note</button>
                        <button onClick={() => setAddMode("none")} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* AI suggestions */}
                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Suggestions</p>
                      {suggestions.map((s, i) => (
                        <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{s.title}</span>
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">{s.type}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{s.why}</p>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline break-all">{s.url}</a>
                          </div>
                          <button
                            onClick={() => handleAddSuggestion(s)}
                            className="shrink-0 text-xs bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:bg-purple-600 self-start"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Materials list */}
                  {matLoading ? (
                    <p className="text-sm text-gray-400">Loading materials...</p>
                  ) : materials.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-3xl mb-2">📚</p>
                      <p className="text-sm">No materials yet. Upload files, add links, or ask AI to suggest resources.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{materials.length} material{materials.length !== 1 ? "s" : ""}</p>
                      {materials.map((m) => (
                        <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
                          <span className="text-xl shrink-0">{materialIcon(m.type, m.mimeType)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400 capitalize">{m.type.replace("_", " ")}</span>
                              {m.fileSize && <span className="text-xs text-gray-400">{formatBytes(m.fileSize)}</span>}
                              {m.contentText && <span className="text-xs text-gray-500 truncate max-w-xs">{m.contentText.slice(0, 80)}…</span>}
                              {(m.url || m.sourceUrl) && (
                                <a href={m.url ?? m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">Open ↗</a>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteMaterial(m.id)} className="text-gray-300 hover:text-red-400 text-sm shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── COURSE MODULES TAB ────────────────────────────────────── */}
              {tab === "course" && (
                <div className="max-w-3xl space-y-5">
                  {/* Loading */}
                  {courseLoading && (
                    <div className="text-center py-16">
                      <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-sm font-medium text-gray-600 mb-1">Designing your course curriculum…</p>
                      <p className="text-xs text-gray-400">AI is structuring chapters, sections & exercises for Senior Associate level</p>
                    </div>
                  )}

                  {/* Empty state */}
                  {!courseLoading && !courseRecord && (
                    <div className="text-center py-16">
                      <p className="text-4xl mb-3">📚</p>
                      <p className="text-base font-semibold text-gray-700 mb-1">{selectedTopic.label} Course</p>
                      <p className="text-sm text-gray-400 mb-6">AI will design a structured curriculum with chapters, sections and hands-on exercises tailored to Senior Associate level.</p>
                      <button
                        onClick={() => selectedId && loadModules(selectedId)}
                        className="bg-indigo-500 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-600 text-sm font-medium"
                      >
                        Generate Course Modules
                      </button>
                    </div>
                  )}

                  {/* Course content */}
                  {!courseLoading && courseRecord && (() => {
                    const cm = courseRecord.modules;
                    return (
                      <>
                        {/* Course header */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h2 className="text-base font-bold text-gray-900 mb-1">{cm.title}</h2>
                              <p className="text-sm text-gray-500 leading-relaxed">{cm.description}</p>
                            </div>
                            <button
                              onClick={() => selectedId && loadModules(selectedId, true)}
                              className="shrink-0 text-xs text-gray-400 hover:text-indigo-500 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              Regenerate
                            </button>
                          </div>
                          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-50">
                            <div className="text-center">
                              <p className="text-lg font-bold text-indigo-600">{cm.chapters.length}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Chapters</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-indigo-600">
                                {cm.chapters.reduce((s, c) => s + c.sections.length, 0)}
                              </p>
                              <p className="text-[10px] text-gray-400 uppercase">Sections</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-indigo-600">{cm.totalHours}h</p>
                              <p className="text-[10px] text-gray-400 uppercase">Total Hours</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-indigo-600">{cm.level}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Level</p>
                            </div>
                          </div>
                        </div>

                        {/* Chapters */}
                        {cm.chapters.map((chapter) => {
                          const isOpen = expandedChapters.has(chapter.id);
                          return (
                            <div key={chapter.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                              {/* Chapter header — clickable */}
                              <button
                                onClick={() => {
                                  setExpandedChapters((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(chapter.id)) next.delete(chapter.id);
                                    else next.add(chapter.id);
                                    return next;
                                  });
                                }}
                                className="w-full text-left p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                                  {chapter.number}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{chapter.title}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{chapter.sections.length} sections · {chapter.estimatedHours}h</p>
                                </div>
                                <svg
                                  className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {/* Chapter description + sections */}
                              {isOpen && (
                                <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-5">
                                  <p className="text-sm text-gray-500">{chapter.description}</p>

                                  {chapter.sections.map((section, si) => {
                                    const secKey = section.id;
                                    const isSectionOpen = expandedSections.has(secKey);
                                    const exResult = exerciseResults[secKey];
                                    const isEvaluating = exerciseEvaluating[secKey];
                                    const isCodeExercise = !!section.exerciseLanguage;

                                    return (
                                    <div key={section.id} className="border border-gray-100 rounded-xl overflow-hidden">
                                      {/* Section header — clickable */}
                                      <button
                                        onClick={() => {
                                          setExpandedSections((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(secKey)) next.delete(secKey); else next.add(secKey);
                                            return next;
                                          });
                                        }}
                                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                                      >
                                        <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                          {chapter.number}.{si + 1}
                                        </span>
                                        <p className="flex-1 text-sm font-semibold text-gray-800">{section.title}</p>
                                        {exResult && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${exResult.score >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{exResult.score}%</span>}
                                        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isSectionOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>

                                      {isSectionOpen && (
                                        <div className="border-t border-gray-50 px-4 pb-5 pt-4 space-y-4">
                                          {/* Objectives */}
                                          <div>
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1.5">Learning Objectives</p>
                                            <ul className="space-y-1">
                                              {section.objectives.map((obj, i) => (
                                                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{obj}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>

                                          {/* Key topics */}
                                          <div>
                                            <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1.5">Key Topics</p>
                                            <div className="flex flex-wrap gap-1.5">
                                              {section.keyTopics.map((topic, i) => (
                                                <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{topic}</span>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Rich explanation */}
                                          {section.explanation && (
                                            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                                              <p className="text-[10px] font-bold text-gray-500 uppercase">Explanation</p>
                                              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{section.explanation}</div>
                                            </div>
                                          )}

                                          {/* Teaching points */}
                                          {section.teachingPoints && section.teachingPoints.length > 0 && (
                                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                              <p className="text-[10px] font-bold text-indigo-600 uppercase mb-2">Key Takeaways</p>
                                              <ul className="space-y-1.5">
                                                {section.teachingPoints.map((pt, i) => (
                                                  <li key={i} className="flex items-start gap-2 text-sm text-indigo-900">
                                                    <span className="text-indigo-400 shrink-0 mt-0.5">▸</span>{pt}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          {/* Real-world example */}
                                          {section.realWorldExample && (
                                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                              <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Real-World Example</p>
                                              <p className="text-sm text-amber-900 leading-relaxed">{section.realWorldExample}</p>
                                            </div>
                                          )}

                                          {/* Code example */}
                                          {section.codeExample && (
                                            <div className="rounded-xl overflow-hidden border border-gray-200">
                                              <div className="bg-gray-900 px-4 py-2 flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Code Example</span>
                                              </div>
                                              <pre className="bg-gray-950 text-gray-200 text-xs px-4 py-3 overflow-x-auto font-mono leading-relaxed">{section.codeExample}</pre>
                                            </div>
                                          )}

                                          {/* Practice exercise */}
                                          <div className="border border-amber-200 rounded-xl overflow-hidden">
                                            <div className="bg-amber-50 px-4 py-3">
                                              <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Practice Exercise</p>
                                              <p className="text-sm text-amber-900 leading-relaxed">{section.practiceExercise}</p>
                                            </div>

                                            <div className="bg-white p-4 space-y-3">
                                              {isCodeExercise ? (
                                                <textarea
                                                  value={exerciseCode[secKey] ?? ""}
                                                  onChange={(e) => setExerciseCode((prev) => ({ ...prev, [secKey]: e.target.value }))}
                                                  placeholder={`Write your ${section.exerciseLanguage} code here…`}
                                                  rows={12}
                                                  className="w-full font-mono text-xs bg-gray-950 text-gray-100 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                                                />
                                              ) : (
                                                <textarea
                                                  value={exerciseNotes[secKey] ?? ""}
                                                  onChange={(e) => setExerciseNotes((prev) => ({ ...prev, [secKey]: e.target.value }))}
                                                  placeholder="Write your answer, analysis, or notes here…"
                                                  rows={8}
                                                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y leading-relaxed"
                                                />
                                              )}

                                              <div className="flex items-center justify-between flex-wrap gap-2">
                                                <p className="text-xs text-gray-400">
                                                  {isCodeExercise ? `${section.exerciseLanguage} editor` : "Text answer"}
                                                  {exResult && <span className={`ml-2 font-semibold ${exResult.score >= 70 ? "text-emerald-600" : "text-amber-600"}`}>Score: {exResult.score}/100</span>}
                                                </p>
                                                <button
                                                  onClick={() => handleEvaluateExercise(secKey, section)}
                                                  disabled={isEvaluating || (!(exerciseCode[secKey] || "").trim() && !(exerciseNotes[secKey] || "").trim())}
                                                  className="text-sm bg-indigo-500 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                  {isEvaluating ? (
                                                    <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Evaluating…</>
                                                  ) : "Submit for AI Review"}
                                                </button>
                                              </div>

                                              {exResult && (
                                                <div className={`rounded-xl p-3 border-l-4 ${exResult.score >= 70 ? "bg-emerald-50 border-emerald-400" : "bg-amber-50 border-amber-400"}`}>
                                                  <p className="text-xs font-semibold text-gray-600 mb-1">AI Feedback</p>
                                                  <p className="text-sm text-gray-700 leading-relaxed">{exResult.feedback}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ── QUIZ TAB ──────────────────────────────────────────────── */}
              {tab === "quiz" && (
                <div className="max-w-2xl">
                  {/* Phase: idle */}
                  {quizPhase === "idle" && !quizLoading && (
                    <div className="text-center py-16">
                      <p className="text-4xl mb-3">🧠</p>
                      <p className="text-base font-semibold text-gray-700 mb-1">Today&apos;s {selectedTopic.label} Quiz</p>
                      <p className="text-sm text-gray-400 mb-6">Senior Associate difficulty · 30 questions (MC + code + theory) · Daily rotation</p>
                      <button onClick={loadQuiz} className="bg-indigo-500 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-600 text-sm font-medium">
                        Generate Today&apos;s Quiz
                      </button>
                    </div>
                  )}

                  {/* Phase: loading */}
                  {quizLoading && (
                    <div className="text-center py-16">
                      <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-sm font-medium text-gray-600 mb-1">Curating your expert lesson…</p>
                      <p className="text-xs text-gray-400">Generating consulting-framed questions next</p>
                    </div>
                  )}

                  {/* Phase: lesson — expert micro-lesson before quiz */}
                  {quizPhase === "lesson" && quiz && quiz.lesson && (
                    <div className="space-y-5">
                      {/* Expert header */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl shrink-0">
                            🎓
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <p className="text-sm font-bold text-gray-900">{quiz.lesson.expertName}</p>
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full uppercase tracking-wide">Expert Curated</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">{quiz.lesson.expertCredentials}</p>
                            <p className="text-[11px] text-indigo-500 truncate">{quiz.lesson.expertSource}</p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Today&apos;s Focus</p>
                          <p className="text-sm font-medium text-gray-800">{quiz.lesson.todaysFocus}</p>
                        </div>
                      </div>

                      {/* Concepts */}
                      {quiz.lesson.concepts && quiz.lesson.concepts.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Key Concepts</p>
                          {quiz.lesson.concepts.map((concept, i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                <p className="text-sm font-semibold text-gray-800">{concept.title}</p>
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed">{concept.explanation}</p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="bg-emerald-50 rounded-lg p-3">
                                  <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Why It Matters</p>
                                  <p className="text-xs text-emerald-800">{concept.whyItMatters}</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-3">
                                  <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Common Mistake</p>
                                  <p className="text-xs text-red-700">{concept.commonMistake}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Consulting context */}
                      {quiz.lesson.consultingContext && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consulting Context</p>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">Firm Perspective</p>
                              <p className="text-sm text-gray-700">{quiz.lesson.consultingContext.firmPerspective}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Real Client Scenario</p>
                              <p className="text-sm text-gray-700">{quiz.lesson.consultingContext.realClientScenario}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div className="bg-violet-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Debugging Framework</p>
                                <p className="text-xs text-violet-800">{quiz.lesson.consultingContext.debuggingFramework}</p>
                              </div>
                              <div className="bg-sky-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-sky-600 uppercase mb-1">Methodology</p>
                                <p className="text-xs text-sky-800">{quiz.lesson.consultingContext.methodologyApproach}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cheat sheet */}
                      {quiz.lesson.cheatSheet && quiz.lesson.cheatSheet.length > 0 && (
                        <div className="bg-amber-50 rounded-xl border border-amber-100 p-5">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">📋 Quick Cheat Sheet</p>
                          <ul className="space-y-1.5">
                            {quiz.lesson.cheatSheet.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                                <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Quiz preview + CTA */}
                      <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-5">
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">What&apos;s Coming Up</p>
                        <p className="text-sm text-indigo-800 mb-4">{quiz.lesson.quizPreview}</p>
                        <button
                          onClick={() => setQuizPhase("quiz")}
                          className="w-full bg-indigo-500 text-white text-sm py-3 rounded-xl hover:bg-indigo-600 transition-colors font-medium"
                        >
                          I&apos;m Ready — Start Quiz →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Phase: quiz — questions */}
                  {quizPhase === "quiz" && quiz && (
                    <div className="space-y-4">
                      {/* Progress */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex gap-1">
                          {quiz.questions.map((_, i) => (
                            <div
                              key={i}
                              className={`h-1.5 w-8 rounded-full transition-colors ${
                                i < currentQ ? "bg-emerald-400"
                                : i === currentQ ? "bg-indigo-500"
                                : "bg-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">Q{currentQ + 1} of {quiz.questions.length}</span>
                      </div>

                      {/* Question card */}
                      {(() => {
                        const q = quiz.questions[currentQ];
                        const qType = q.type ?? "multiple_choice";
                        const isOpenEnded = qType !== "multiple_choice";
                        const isLastQ = currentQ === quiz.questions.length - 1;

                        const typeBadge = qType === "sql_write"
                          ? { label: "SQL", cls: "bg-blue-100 text-blue-700" }
                          : qType === "code_write"
                          ? { label: q.language ? q.language.toUpperCase() : "Code", cls: "bg-violet-100 text-violet-700" }
                          : qType === "free_text"
                          ? { label: "Written", cls: "bg-amber-100 text-amber-700" }
                          : { label: "Multiple Choice", cls: "bg-gray-100 text-gray-600" };

                        return (
                          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                            {/* Question header */}
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-gray-800 leading-relaxed flex-1 whitespace-pre-wrap">{q.text}</p>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${typeBadge.cls}`}>{typeBadge.label}</span>
                            </div>

                            {/* Multiple choice */}
                            {!isOpenEnded && q.options && (
                              <div className="space-y-2.5">
                                {q.options.map((opt, i) => {
                                  let cls = "border border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50";
                                  if (revealed) {
                                    if (i === q.correctIndex) cls = "border-emerald-400 bg-emerald-50 text-emerald-800";
                                    else if (i === selectedOption) cls = "border-red-300 bg-red-50 text-red-700";
                                    else cls = "border-gray-100 text-gray-400";
                                  }
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => handleSelectOption(i)}
                                      disabled={revealed}
                                      className={`w-full text-left text-sm px-4 py-3 rounded-xl transition-all border ${cls}`}
                                    >
                                      <span className="font-semibold mr-2 text-gray-400">{String.fromCharCode(65 + i)}.</span>
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Open-ended editor */}
                            {isOpenEnded && !revealed && (
                              <div className="space-y-3">
                                <textarea
                                  value={writtenAnswer}
                                  onChange={(e) => setWrittenAnswer(e.target.value)}
                                  placeholder={
                                    qType === "sql_write" ? "Write your SQL query here..."
                                    : qType === "code_write" ? `Write your ${q.language ?? "code"} here...`
                                    : "Write your answer here..."
                                  }
                                  rows={qType === "free_text" ? 5 : 10}
                                  disabled={evaluating}
                                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-y ${
                                    (qType === "sql_write" || qType === "code_write")
                                      ? "font-mono bg-gray-950 text-gray-100 border-gray-700 focus:ring-violet-500"
                                      : "border-gray-200 focus:ring-indigo-300"
                                  }`}
                                />
                                <button
                                  onClick={handleSubmitWritten}
                                  disabled={!writtenAnswer.trim() || evaluating}
                                  className="w-full bg-indigo-500 text-white text-sm py-2.5 rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                  {evaluating ? (
                                    <>
                                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                      AI is evaluating your answer…
                                    </>
                                  ) : "Submit for AI Review"}
                                </button>
                              </div>
                            )}

                            {/* Open-ended — show submitted answer */}
                            {isOpenEnded && revealed && (
                              <div className="bg-gray-950 rounded-xl p-4">
                                <p className="text-[10px] text-gray-400 mb-1 uppercase font-semibold">Your Answer</p>
                                <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono">{writtenAnswer}</pre>
                              </div>
                            )}

                            {/* AI evaluation result */}
                            {revealed && isOpenEnded && evalFeedback && (
                              <div className={`p-4 rounded-xl border-l-4 ${evalFeedback.isCorrect ? "bg-emerald-50 border-emerald-400" : "bg-amber-50 border-amber-400"}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={`text-xs font-bold ${evalFeedback.isCorrect ? "text-emerald-700" : "text-amber-700"}`}>
                                    AI Score: {evalFeedback.score}/100
                                  </p>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${evalFeedback.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                    {evalFeedback.isCorrect ? "Pass ≥60" : "Needs Improvement"}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700">{evalFeedback.feedback}</p>
                              </div>
                            )}

                            {/* MC explanation */}
                            {revealed && !isOpenEnded && (
                              <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-indigo-400">
                                <p className="text-xs font-semibold text-indigo-600 mb-1">Explanation</p>
                                <p className="text-sm text-gray-600">{q.explanation}</p>
                              </div>
                            )}

                            {/* Model answer (collapsible) */}
                            {revealed && isOpenEnded && q.expectedAnswer && (
                              <details>
                                <summary className="text-xs text-gray-400 cursor-pointer hover:text-indigo-500 select-none">View model answer / key points</summary>
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-4 border-indigo-300 space-y-1">
                                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{q.expectedAnswer}</pre>
                                  <p className="text-xs text-gray-400">{q.explanation}</p>
                                </div>
                              </details>
                            )}

                            {/* Navigation */}
                            {revealed && !isLastQ && (
                              <button onClick={handleNextQuestion} className="w-full bg-indigo-500 text-white text-sm py-2.5 rounded-xl hover:bg-indigo-600 transition-colors">
                                Next Question →
                              </button>
                            )}
                            {revealed && isLastQ && (
                              <div className="text-center text-sm text-gray-400">
                                {submitLoading ? "Submitting your score…" : "Score submitted ✓"}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Phase: done — score + history */}
                  {quizPhase === "done" && quizResult && (
                    <div className="space-y-5">
                      {/* Score card */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                        <p className="text-5xl font-bold mb-1 text-gray-900">{quizResult.score}%</p>
                        <p className="text-base text-gray-500 mb-4">{quizResult.correctQ} / {quizResult.totalQ} correct</p>
                        <p className={`text-sm font-medium ${
                          quizResult.score >= 80 ? "text-emerald-600"
                          : quizResult.score >= 60 ? "text-amber-600"
                          : "text-red-600"
                        }`}>
                          {quizResult.score >= 80 ? "Excellent work! You have strong command of this topic."
                          : quizResult.score >= 60 ? "Good effort. Review the explanations to strengthen weak areas."
                          : "Keep practising. Focus on the explanations and revisit your materials."}
                        </p>
                        <div className="flex gap-2 justify-center mt-5">
                          <button onClick={loadQuiz} className="text-sm px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
                            Retake Quiz
                          </button>
                          <button onClick={() => setTab("insights")} className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                            View Insights
                          </button>
                        </div>
                      </div>

                      {/* Score history chart */}
                      {quizHistory.length > 1 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Score History</p>
                          <ScoreChart attempts={quizHistory} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── INSIGHTS TAB ──────────────────────────────────────────── */}
              {tab === "insights" && (
                <div className="max-w-2xl space-y-5">
                  {insightLoading && (
                    <div className="text-center py-12">
                      <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-sm text-gray-400">Generating insights with AI...</p>
                    </div>
                  )}

                  {!insightLoading && !insight && (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-3xl mb-2">📊</p>
                      <p className="text-sm mb-4">No insights yet. Take a quiz first, then click Refresh Insights.</p>
                      <button onClick={handleRegenerateInsight} className="text-sm px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
                        Generate Insights
                      </button>
                    </div>
                  )}

                  {!insightLoading && insight && (
                    <>
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Avg Score", value: insight.avgScore !== undefined ? `${insight.avgScore}%` : "—" },
                          { label: "Attempts", value: String(attemptCount) },
                          { label: "Trend", value: trendBadge(insight.trend) },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
                            <p className="text-xs text-gray-400 mb-1">{label}</p>
                            <div className="text-sm font-bold text-gray-800">{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Summary */}
                      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <p className="text-sm text-gray-600 leading-relaxed">{insight.summaryText}</p>
                      </div>

                      {/* Takeaways */}
                      {insight.takeaways.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">What you know well</p>
                          <ul className="space-y-1.5">
                            {insight.takeaways.map((t, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-emerald-500 mt-0.5">✓</span>{t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {insight.weaknesses.length > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3">Knowledge gaps</p>
                          <ul className="space-y-1.5">
                            {insight.weaknesses.map((w, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-red-400 mt-0.5">△</span>{w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Improvements */}
                      {insight.improvements.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">Next steps</p>
                          <ul className="space-y-1.5">
                            {insight.improvements.map((imp, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-indigo-500 mt-0.5">→</span>{imp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          onClick={handleRegenerateInsight}
                          disabled={insightLoading}
                          className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                        >
                          ↻ Regenerate insights
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── DAILY ASSESSMENT TAB ─────────────────────────────────── */}
              {tab === "assessment" && (
                <div className="max-w-3xl space-y-5">
                  {/* Loading */}
                  {assessmentLoading && (
                    <div className="text-center py-16">
                      <div className="inline-block w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-sm font-medium text-gray-600 mb-1">Generating today&apos;s comprehensive assessment…</p>
                      <p className="text-xs text-gray-400">AI is designing a real-world business scenario across all your topics</p>
                    </div>
                  )}

                  {/* No assessment */}
                  {!assessmentLoading && !assessment && (
                    <div className="text-center py-16">
                      <p className="text-4xl mb-3">🎯</p>
                      <p className="text-base font-semibold text-gray-700 mb-1">Daily Business Assessment</p>
                      <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                        A daily consulting scenario designed to test your command of ALL topics simultaneously — as a business consultant solving a real client problem.
                      </p>
                      <button onClick={loadAssessment} className="bg-purple-500 text-white px-6 py-2.5 rounded-xl hover:bg-purple-600 text-sm font-medium">
                        Generate Today&apos;s Assessment
                      </button>
                    </div>
                  )}

                  {!assessmentLoading && assessment && (
                    <>
                      {/* Assessment header */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 text-lg">🎯</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-bold text-gray-900">Daily Assessment — {assessment.dateKey}</p>
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full uppercase">{assessment.contextData.firm}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{assessment.contextData.industry}</span>
                            </div>
                            <p className="text-xs text-gray-500">{assessment.contextData.companyType}</p>
                          </div>
                        </div>

                        {/* Problem statement */}
                        <div className="bg-purple-50 rounded-xl p-4 mb-4">
                          <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">Problem Statement</p>
                          <p className="text-sm font-medium text-purple-900">{assessment.contextData.problemStatement}</p>
                        </div>

                        {/* Scenario */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Full Scenario</p>
                          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{assessment.scenario}</div>
                        </div>

                        {/* Skills + criteria */}
                        <div className="grid grid-cols-1 gap-3 mt-5 sm:grid-cols-2">
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase mb-2">Skills to Apply</p>
                            <div className="flex flex-wrap gap-1">
                              {assessment.contextData.expectedSkills.map((s, i) => (
                                <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-amber-600 uppercase mb-2">Evaluation Criteria</p>
                            <ul className="space-y-0.5">
                              {assessment.contextData.evaluationCriteria.slice(0, 4).map((c, i) => (
                                <li key={i} className="text-xs text-amber-800 truncate">{c.split(":")[0]}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Already submitted */}
                      {assessmentSubmission ? (
                        <div className="space-y-4">
                          {/* Score overview */}
                          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                            <p className="text-5xl font-bold text-gray-900 mb-1">{assessmentSubmission.score}%</p>
                            <p className="text-sm text-gray-500 mb-4">Overall Assessment Score</p>
                            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">{assessmentSubmission.feedback.overallVerdict}</p>
                          </div>

                          {/* Dimension scores */}
                          <div className="grid grid-cols-2 gap-3">
                            {(["technicality", "logic", "problemSolving", "delivery"] as const).map((dim) => {
                              const d = assessmentSubmission.feedback[dim];
                              const label = dim === "problemSolving" ? "Problem Solving" : dim.charAt(0).toUpperCase() + dim.slice(1);
                              const color = d.score >= 80 ? "emerald" : d.score >= 60 ? "amber" : "red";
                              return (
                                <div key={dim} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <p className={`text-[10px] font-bold text-${color}-700 uppercase`}>{label}</p>
                                    <span className={`text-sm font-bold text-${color}-700`}>{d.score}/100</span>
                                  </div>
                                  <p className="text-xs text-gray-600 leading-relaxed">{d.comment}</p>
                                </div>
                              );
                            })}
                            {assessmentSubmission.feedback.structure && (() => {
                              const d = assessmentSubmission.feedback.structure;
                              const color = d.score >= 80 ? "emerald" : d.score >= 60 ? "amber" : "red";
                              return (
                                <div className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4 col-span-2`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <p className={`text-[10px] font-bold text-${color}-700 uppercase`}>Folder Structure</p>
                                    <span className={`text-sm font-bold text-${color}-700`}>{d.score}/100</span>
                                  </div>
                                  <p className="text-xs text-gray-600 leading-relaxed">{d.comment}</p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Strengths / improvements */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {assessmentSubmission.feedback.strengthsHighlighted.length > 0 && (
                              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                <p className="text-[10px] font-bold text-emerald-700 uppercase mb-2">Strengths</p>
                                <ul className="space-y-1">
                                  {assessmentSubmission.feedback.strengthsHighlighted.map((s, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700"><span className="text-emerald-500 shrink-0">✓</span>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {assessmentSubmission.feedback.areasToImprove.length > 0 && (
                              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Areas to Improve</p>
                                <ul className="space-y-1">
                                  {assessmentSubmission.feedback.areasToImprove.map((s, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700"><span className="text-red-400 shrink-0">△</span>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Your submitted answer */}
                          <details className="bg-gray-50 rounded-xl border border-gray-100">
                            <summary className="px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer select-none">
                              {assessmentSubmission.answer.startsWith("=== FOLDER SUBMISSION ===") ? "View submitted folder structure" : "View your submitted answer"}
                            </summary>
                            <div className="px-4 pb-4 pt-2">
                              {assessmentSubmission.answer.startsWith("=== FOLDER SUBMISSION ===") ? (
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono bg-gray-100 rounded-lg p-3">
                                  {parseFolderTree(assessmentSubmission.answer)}
                                </pre>
                              ) : (
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{assessmentSubmission.answer}</pre>
                              )}
                            </div>
                          </details>

                          {/* Score history */}
                          {assessmentHistory.length > 1 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Assessment Score History</p>
                              <ScoreChart attempts={assessmentHistory.map((h, i) => ({ id: String(i), topicId: "", dateKey: h.dateKey, score: h.score, totalQ: 100, correctQ: h.score, completedAt: h.submittedAt }))} />
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Answer form */
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                          {/* Mode toggle */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAssessmentMode("text")}
                              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${assessmentMode === "text" ? "bg-purple-100 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
                            >
                              Write Answer
                            </button>
                            <button
                              onClick={() => setAssessmentMode("folder")}
                              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${assessmentMode === "folder" ? "bg-purple-100 border-purple-300 text-purple-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
                            >
                              Upload Folder
                            </button>
                          </div>

                          {assessmentMode === "text" ? (
                            <div>
                              <p className="text-xs text-gray-400 mb-3">
                                Write a comprehensive response covering all dimensions of the problem. Structure your answer clearly — the Partner is reading this tomorrow morning.
                              </p>
                              <textarea
                                value={assessmentAnswer}
                                onChange={(e) => setAssessmentAnswer(e.target.value)}
                                placeholder={`Structure your response:\n\n1. Problem diagnosis — MECE decomposition of root causes\n2. Technical analysis — what the data/systems show\n3. Recommended interventions — specific, prioritised, with rationale\n4. Implementation roadmap — 30/60/90 day plan\n5. Risk mitigation — what could go wrong and how you'd prevent it\n6. Executive summary — 3 bullets for the board`}
                                rows={20}
                                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y leading-relaxed"
                                disabled={assessmentSubmitting}
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-xs text-gray-400">
                                Submit a folder of files as your deliverable. The AI will assess both the folder structure (file organisation, naming, decomposition) and the content of each file.
                              </p>

                              {/* Hidden folder input */}
                              <input
                                ref={folderInputRef}
                                type="file"
                                // @ts-expect-error webkitdirectory is non-standard
                                webkitdirectory=""
                                multiple
                                className="hidden"
                                onChange={handleFolderSelect}
                              />

                              {assessmentFiles.length === 0 ? (
                                <button
                                  onClick={() => folderInputRef.current?.click()}
                                  disabled={assessmentSubmitting}
                                  className="w-full border-2 border-dashed border-purple-200 rounded-xl p-8 text-center hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-50"
                                >
                                  <p className="text-2xl mb-2">📂</p>
                                  <p className="text-sm font-medium text-gray-700">Click to select a folder</p>
                                  <p className="text-xs text-gray-400 mt-1">All text files will be read and assessed — code, markdown, SQL, notebooks, etc.</p>
                                </button>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-gray-600">{assessmentFiles[0]?.path.split("/")[0]} — {assessmentFiles.length} file{assessmentFiles.length !== 1 ? "s" : ""}</p>
                                    <button
                                      onClick={() => { setAssessmentFiles([]); folderInputRef.current?.click(); }}
                                      className="text-xs text-purple-500 hover:text-purple-700"
                                    >
                                      Change folder
                                    </button>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 max-h-64 overflow-y-auto">
                                    <pre className="text-xs font-mono text-gray-700 leading-relaxed">
                                      {buildFolderTreeText(assessmentFiles)}
                                    </pre>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {assessmentFiles.filter(f => !f.binary).length > 0 && (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                        {assessmentFiles.filter(f => !f.binary).length} text files
                                      </span>
                                    )}
                                    {assessmentFiles.filter(f => f.binary).length > 0 && (
                                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                                        {assessmentFiles.filter(f => f.binary).length} binary files
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                              {assessmentMode === "text" ? `${assessmentAnswer.length} characters` : assessmentFiles.length > 0 ? `${assessmentFiles.length} files selected` : "No folder selected"}
                            </p>
                            <button
                              onClick={handleSubmitAssessment}
                              disabled={(assessmentMode === "text" ? !assessmentAnswer.trim() : assessmentFiles.length === 0) || assessmentSubmitting}
                              className="bg-purple-500 text-white text-sm px-6 py-2.5 rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                              {assessmentSubmitting ? (
                                <>
                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  AI is evaluating…
                                </>
                              ) : "Submit for Partner Review"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}
