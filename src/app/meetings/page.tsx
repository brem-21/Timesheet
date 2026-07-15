"use client";

import { useState, useEffect } from "react";
import { TranscriptSummary, summaryToSlack } from "@/lib/summarize";
import { SavedSummary } from "@/lib/summaryStore";

const DEFAULT_USER = "Brempong Dankwah";

export default function MeetingsPage() {
  const [transcript, setTranscript] = useState("");
  const [userName, setUserName] = useState(DEFAULT_USER);
  const [meetingLabel, setMeetingLabel] = useState("");
  const [fromTeams, setFromTeams] = useState(false);
  const [summary, setSummary] = useState<TranscriptSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [slackStatus, setSlackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [slackError, setSlackError] = useState("");
  const [taskStatus, setTaskStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [taskCount, setTaskCount] = useState(0);
  const [autoTaskCount, setAutoTaskCount] = useState(0);
  const [extractedTasks, setExtractedTasks] = useState<Array<{ id: string; text: string; priority: string }>>([]);

  // Saved summary label editing
  const [savedSummaryId, setSavedSummaryId] = useState<string | null>(null);
  const [editingMeetingLabel, setEditingMeetingLabel] = useState(false);
  const [meetingLabelDraft, setMeetingLabelDraft] = useState("");
  const [labelSaving, setLabelSaving] = useState(false);

  // History
  const [history, setHistory] = useState<SavedSummary[]>([]);
  const [historyFilter, setHistoryFilter] = useState(""); // filter by label/date

  async function loadHistory() {
    try {
      const res = await fetch("/api/meetings/history");
      const data = await res.json();
      setHistory(data.summaries ?? []);
    } catch {}
  }

  async function deleteHistoryEntry(id: string) {
    try {
      await fetch("/api/meetings/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setHistory((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  }

  function loadFromHistory(saved: SavedSummary) {
    setSummary(saved.summary);
    setMeetingLabel(saved.summary.meetingLabel ?? "");
    setMeetingLabelDraft(saved.summary.meetingLabel ?? "");
    setSavedSummaryId(saved.id);
    setEditingMeetingLabel(false);
    setTranscript(saved.summary.rawText ?? "");
    setShowRaw(false);
    setAutoTaskCount(0);
    setTaskStatus("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Auto-load transcript pushed from the browser extension
  useEffect(() => {
    loadHistory();

    fetch("/api/meetings/ingest")
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.transcript) return;
        setTranscript(data.transcript);
        if (data.meetingLabel) setMeetingLabel(data.meetingLabel);
        setFromTeams(true);

        setLoading(true);
        try {
          const res = await fetch("/api/meetings/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: data.transcript, userName: DEFAULT_USER, meetingLabel: data.meetingLabel ?? "" }),
          });
          const result = await res.json();
          if (res.ok) {
            setSummary(result.summary);
            await loadHistory();
          }
        } catch {}
        finally { setLoading(false); }

        setTaskStatus("loading");
        try {
          const res = await fetch("/api/meetings/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: data.transcript, userName: DEFAULT_USER, meetingLabel: data.meetingLabel ?? "" }),
          });
          const result = await res.json();
          if (res.ok) {
            setTaskCount(result.count);
            setTaskStatus("done");
            setExtractedTasks((result.extracted ?? []).map((t: { id: string; text: string; priority: string }) => ({
              id: t.id, text: t.text, priority: t.priority,
            })));
          } else setTaskStatus("error");
        } catch { setTaskStatus("error"); }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExtractTasks() {
    if (!transcript.trim()) return;
    setTaskStatus("loading");
    setExtractedTasks([]);
    try {
      const res = await fetch("/api/meetings/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, userName, meetingLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTaskCount(data.count);
      setTaskStatus("done");
      setExtractedTasks((data.extracted ?? []).map((t: { id: string; text: string; priority: string }) => ({
        id: t.id, text: t.text, priority: t.priority,
      })));
    } catch {
      setTaskStatus("error");
    }
  }

  async function removeExtractedTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setExtractedTasks((prev) => prev.filter((t) => t.id !== id));
    setTaskCount((c) => Math.max(0, c - 1));
  }

  async function handleSummarize() {
    if (!transcript.trim()) return;
    setLoading(true);
    setError("");
    setSummary(null);

    try {
      const res = await fetch("/api/meetings/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, userName, meetingLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Summarization failed");
      setSummary(data.summary);
      if (data.savedId) {
        setSavedSummaryId(data.savedId);
        setMeetingLabelDraft(data.summary.meetingLabel ?? "");
        setEditingMeetingLabel(false);
      }
      if (data.tasksExtracted > 0) {
        setAutoTaskCount(data.tasksExtracted);
        setTaskStatus("done");
        setTaskCount(data.tasksExtracted);
      }
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to summarize");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendToSlack() {
    if (!summary) return;
    setSlackStatus("sending");
    setSlackError("");
    try {
      const text = summaryToSlack(summary);
      const res = await fetch("/api/standup/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setSlackStatus("sent");
      setTimeout(() => setSlackStatus("idle"), 4000);
    } catch (e) {
      setSlackError(e instanceof Error ? e.message : "Failed to send");
      setSlackStatus("error");
    }
  }

  const filteredHistory = history.filter((s) => {
    if (!historyFilter) return true;
    const q = historyFilter.toLowerCase();
    // Search label, date, about prose, and all named items (action items, contributions, decisions)
    const haystack = [
      s.summary.meetingLabel ?? "",
      s.summary.date,
      s.summary.about ?? "",
      ...(s.summary.contributions ?? []),
      ...(s.summary.actionItems ?? []),
      ...(s.summary.decisions ?? []),
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="eyebrow"><span className="eyebrow-dot" />meetings</p>
        <h1 className="headline mt-1">Meeting Transcript</h1>
        <p className="text-sm text-charcoal/50 mt-1">Paste a transcript, get a summary focused on you, send to Slack.</p>
      </div>

      {/* ── Previous summaries ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="card-white space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-charcoal/80">Previous Summaries</h2>
            {history.length > 1 && (
              <input
                type="text"
                placeholder="Filter by name or date..."
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="input-field !py-1.5 text-xs w-52"
              />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredHistory.map((saved) => {
              const isActive = summary === saved.summary;
              return (
                <div
                  key={saved.id}
                  className={`group relative rounded-xl border p-3.5 cursor-pointer transition-all ${
                    isActive
                      ? "border-teal-deep/40 bg-mint ring-1 ring-teal-sage/30"
                      : "border-mint hover:border-teal-sage/50 hover:bg-mint/40"
                  }`}
                  onClick={() => loadFromHistory(saved)}
                >
                  <p className="text-xs font-semibold text-charcoal truncate pr-5">
                    {saved.summary.meetingLabel || "Untitled Meeting"}
                  </p>
                  <p className="text-[11px] text-charcoal/40 mt-0.5">{saved.summary.date}</p>
                  <p className="text-[11px] text-charcoal/50 mt-1.5 line-clamp-2 leading-relaxed">
                    {saved.summary.about?.slice(0, 100) ?? "No summary available"}…
                  </p>
                  <span className={`mt-2 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    saved.summary.method === "gemini"
                      ? "bg-rose/25 text-charcoal"
                      : "bg-mint text-charcoal/50"
                  }`}>
                    {saved.summary.method === "gemini" ? "✨ Gemini" : "⚡ Extractive"}
                  </span>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(saved.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-charcoal/25 hover:text-[#b3492f] transition-all"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
            {filteredHistory.length === 0 && (
              <p className="text-xs text-charcoal/40 col-span-3">No summaries match "{historyFilter}".</p>
            )}
          </div>
        </div>
      )}

      {/* Teams banner */}
      {fromTeams && (
        <div className="bg-[#6264A7] text-white rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.625 4.5h-6.75A.375.375 0 0 0 13.5 4.875v3.75h3.375a1.875 1.875 0 0 1 0 3.75H13.5v6.75c0 .207.168.375.375.375h6.75A.375.375 0 0 0 21 19.125V4.875A.375.375 0 0 0 20.625 4.5z" />
              <path d="M9.375 12.375a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1.125c-3.313 0-6 1.343-6 3v.75h12v-.75c0-1.657-2.687-3-6-3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold">Transcript imported from Microsoft Teams</p>
              <p className="text-xs text-white/70 mt-0.5">{meetingLabel || "Meeting transcript ready"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSummarize}
              disabled={loading}
              className="px-4 py-2 bg-white text-[#6264A7] rounded-button text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              Summarise
            </button>
            <button
              onClick={handleExtractTasks}
              disabled={taskStatus === "loading"}
              className="px-4 py-2 bg-white/20 text-white rounded-button text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50"
            >
              Extract Tasks
            </button>
          </div>
        </div>
      )}

      {/* Input card */}
      <div className="card-white space-y-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-1.5">
              Your name (as it appears in the transcript)
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Brempong Dankwah"
              className="input-field w-64"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-1.5">
              Meeting label / date
            </label>
            <input
              type="text"
              value={meetingLabel}
              onChange={(e) => setMeetingLabel(e.target.value)}
              placeholder="e.g. Sprint Planning – Apr 1"
              className="input-field w-64"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-charcoal/50 uppercase tracking-wide mb-1.5">
            Paste transcript
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`Paste your meeting transcript here.\n\nSupports formats like:\n  Brempong Dankwah: Let me walk through the changes...\n  Richard Dadzie: That looks good, can you also...\n\nOr paste a .vtt file content directly.`}
            rows={12}
            className="input-field w-full font-mono resize-y placeholder:text-charcoal/25 placeholder:font-sans"
          />
          <p className="text-xs text-charcoal/40 mt-1">
            {transcript.length > 0 ? `${transcript.length.toLocaleString()} characters` : "Supports plain text and .vtt format"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSummarize}
            disabled={loading || !transcript.trim() || !userName.trim()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 4z" />
                </svg>
                Summarising...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Summarise
              </>
            )}
          </button>

          {transcript.trim() && (
            <button
              onClick={() => { setTranscript(""); setSummary(null); setError(""); setMeetingLabel(""); }}
              className="px-4 py-2.5 text-sm text-charcoal/50 hover:text-[#b3492f] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {transcript.trim() && (
          <div className="flex items-center gap-3 pt-1 border-t border-mint">
            <button
              onClick={handleExtractTasks}
              disabled={taskStatus === "loading" || !transcript.trim()}
              className="btn-secondary disabled:opacity-40"
            >
              {taskStatus === "loading" ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7l2 2 4-4" />
                </svg>
              )}
              {taskStatus === "loading" ? "Extracting..." : "Extract Tasks"}
            </button>

            {taskStatus === "done" && (
              <span className="text-sm text-teal-pine font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {taskCount} task{taskCount !== 1 ? "s" : ""} saved →{" "}
                <a href="/tasks" className="text-teal-pine hover:underline">View Tasks</a>
              </span>
            )}
            {taskStatus === "error" && (
              <span className="text-sm text-[#b3492f]">Failed to extract tasks. Try again.</span>
            )}
          </div>
        )}

        {/* Extracted task review */}
        {extractedTasks.length > 0 && (
          <div className="border-t border-mint pt-4 space-y-2">
            <p className="text-xs font-semibold text-charcoal/50 uppercase tracking-wide">
              Extracted Tasks — remove any you don&apos;t want
            </p>
            <ul className="space-y-1.5">
              {extractedTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 group">
                  <span className={`mt-0.5 shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    t.priority === "high" ? "bg-[#e07a5f]/20 text-[#b3492f]" :
                    t.priority === "low"  ? "bg-mint text-charcoal/50" :
                    "bg-rose/25 text-charcoal"
                  }`}>{t.priority}</span>
                  <span className="text-sm text-charcoal/80 flex-1">{t.text}</span>
                  <button
                    onClick={() => removeExtractedTask(t.id)}
                    className="shrink-0 text-charcoal/25 hover:text-[#b3492f] opacity-0 group-hover:opacity-100 transition-all mt-0.5"
                    title="Remove this task"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm text-[#b3492f] bg-[#e07a5f]/15 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Summary output */}
      {summary && (
        <div className="bg-white rounded-2xl border border-mint shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-mint flex items-center justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              {/* Editable label row */}
              {savedSummaryId && editingMeetingLabel ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={meetingLabelDraft}
                    onChange={(e) => setMeetingLabelDraft(e.target.value)}
                    className="border border-teal-deep/40 rounded-lg px-2.5 py-1 text-sm font-medium text-teal-pine w-64 focus:outline-none focus:ring-2 focus:ring-teal-sage/40"
                    placeholder="Meeting label e.g. Sprint Review — Mar 28"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        setLabelSaving(true);
                        await fetch("/api/meetings/history", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: savedSummaryId, meetingLabel: meetingLabelDraft }),
                        });
                        setSummary((s) => s ? { ...s, meetingLabel: meetingLabelDraft } : s);
                        await loadHistory();
                        setEditingMeetingLabel(false);
                        setLabelSaving(false);
                      } else if (e.key === "Escape") {
                        setEditingMeetingLabel(false);
                      }
                    }}
                  />
                  <button
                    disabled={labelSaving}
                    onClick={async () => {
                      setLabelSaving(true);
                      await fetch("/api/meetings/history", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: savedSummaryId, meetingLabel: meetingLabelDraft }),
                      });
                      setSummary((s) => s ? { ...s, meetingLabel: meetingLabelDraft } : s);
                      await loadHistory();
                      setEditingMeetingLabel(false);
                      setLabelSaving(false);
                    }}
                    className="px-2.5 py-1 bg-teal-deep text-white rounded-lg text-xs font-semibold hover:bg-teal-forest disabled:opacity-60"
                  >
                    {labelSaving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditingMeetingLabel(false)} className="text-xs text-charcoal/40 hover:text-charcoal">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-charcoal">
                    {summary.meetingLabel ? (
                      <>
                        <span className="text-charcoal/50 font-normal">Summary · </span>
                        <span className="text-teal-pine">{summary.meetingLabel}</span>
                      </>
                    ) : (
                      <>Summary for <span className="text-teal-pine">{summary.userName}</span></>
                    )}
                  </h2>
                  {savedSummaryId && (
                    <button
                      onClick={() => setEditingMeetingLabel(true)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-charcoal/40 border border-mint-mist rounded-md hover:bg-mint/40 hover:text-charcoal"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Rename
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-charcoal/40 mt-0.5">
                <span className="font-medium text-charcoal/50">{summary.date}</span>
                {" · "}
                <span className={`font-medium ${summary.method === "gemini" ? "text-charcoal/70" : "text-charcoal/40"}`}>
                  {summary.method === "gemini" ? "✨ Gemini AI Summary" : "⚡ Extractive Summary"}
                </span>
                {summary.reportsTo && (
                  <span className="ml-2 text-charcoal/50">· Reports to <span className="font-medium text-charcoal/80">{summary.reportsTo}</span></span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendToSlack}
                disabled={slackStatus === "sending"}
                className={`flex items-center gap-2 px-4 py-2 rounded-button text-sm font-semibold transition-all ${
                  slackStatus === "sent"
                    ? "bg-teal-sage/20 text-teal-pine"
                    : slackStatus === "error"
                    ? "bg-[#e07a5f]/20 text-[#b3492f]"
                    : "bg-[#4A154B] text-white hover:bg-[#3d1040]"
                } disabled:opacity-50`}
              >
                {slackStatus === "sending" ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 4z" />
                  </svg>
                ) : slackStatus === "sent" ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                )}
                {slackStatus === "sent" ? "Sent!" : slackStatus === "sending" ? "Sending..." : "Send to Slack"}
              </button>

              <button
                onClick={() => setShowRaw((v) => !v)}
                className="px-4 py-2 border border-mint-mist text-charcoal/70 rounded-button text-sm font-medium hover:bg-mint/40 transition-colors"
              >
                {showRaw ? "Hide Raw" : "View Raw"}
              </button>
            </div>
          </div>

          {slackError && (
            <div className="mx-6 mt-4 text-sm text-[#b3492f] bg-[#e07a5f]/15 rounded-lg px-3 py-2">{slackError}</div>
          )}

          {!showRaw && (
            <div className="p-6 space-y-5">
              {summary.about && (
                <div className="bg-mint/40 border border-mint rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-charcoal/50 uppercase tracking-wider mb-3">📋 Meeting Summary</h3>
                  <p className="text-sm text-charcoal/80 leading-7 whitespace-pre-line">{summary.about}</p>
                </div>
              )}

              <SummarySection icon="✅" title="What Needs to Be Done" color="emerald" items={summary.actionItems} />
              <SummarySection icon="💬" title="My Contributions" color="indigo" items={summary.contributions} />
              <SummarySection icon="🔷" title="Decisions I Was Part Of" color="blue" items={summary.decisions} />
              {summary.followUps.length > 0 && (
                <SummarySection icon="📅" title="Follow-ups" color="amber" items={summary.followUps} />
              )}

              {autoTaskCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-teal-pine bg-teal-sage/15 border border-teal-sage/30 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{autoTaskCount} action item{autoTaskCount !== 1 ? "s" : ""} saved to Tasks →{" "}
                    <a href="/tasks" className="font-semibold underline">View Tasks</a>
                  </span>
                </div>
              )}
            </div>
          )}

          {showRaw && (
            <div className="p-6">
              <pre className="text-xs text-charcoal/70 font-mono bg-mint/40 rounded-xl p-4 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                {summary.rawText || transcript}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummarySection({
  icon,
  title,
  items,
  color,
}: {
  icon: string;
  title: string;
  items: string[];
  color: "indigo" | "emerald" | "blue" | "amber";
}) {
  const colors = {
    indigo: "bg-mint border-teal-sage/30",
    emerald: "bg-teal-sage/15 border-teal-sage/30",
    blue: "bg-navy/10 border-navy/20",
    amber: "bg-rose/15 border-rose/30",
  };
  const textColors = {
    indigo: "text-teal-pine",
    emerald: "text-teal-pine",
    blue: "text-navy",
    amber: "text-charcoal",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <h3 className={`text-sm font-semibold mb-2.5 ${textColors[color]}`}>
        {icon} {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex gap-2 ${textColors[color]}`}>
            <span className="opacity-40 shrink-0 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
