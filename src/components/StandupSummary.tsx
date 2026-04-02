"use client";

import { useState } from "react";
import { StandupSummary as StandupSummaryType, Ticket } from "@/lib/utils";

interface StandupSummaryProps {
  summary: StandupSummaryType;
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  return (
    <a
      href={ticket.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2 py-1.5 group"
    >
      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
        {ticket.key}
      </span>
      <span className="text-sm text-gray-700 group-hover:text-gray-900 group-hover:underline leading-snug">
        {ticket.summary}
      </span>
    </a>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 italic py-1">{message}</p>
  );
}

export default function StandupSummaryCard({ summary }: StandupSummaryProps) {
  const [sendingSlack, setSendingSlack] = useState(false);
  const [sendingTeams, setSendingTeams] = useState(false);
  const [slackStatus, setSlackStatus] = useState<"idle" | "success" | "error">("idle");
  const [teamsStatus, setTeamsStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSendSlack = async () => {
    setSendingSlack(true);
    setSlackStatus("idle");
    setErrorMessage("");
    try {
      const res = await fetch("/api/standup/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setSlackStatus("success");
      setTimeout(() => setSlackStatus("idle"), 4000);
    } catch (err) {
      setSlackStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send to Slack");
    } finally {
      setSendingSlack(false);
    }
  };

  const handleSendTeams = async () => {
    setSendingTeams(true);
    setTeamsStatus("idle");
    setErrorMessage("");
    try {
      const res = await fetch("/api/standup/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setTeamsStatus("success");
      setTimeout(() => setTeamsStatus("idle"), 4000);
    } catch (err) {
      setTeamsStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send to Teams");
    } finally {
      setSendingTeams(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Daily Standup</h2>
          <p className="text-xs text-gray-500 mt-0.5">{summary.date}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Slack button */}
          <button
            onClick={handleSendSlack}
            disabled={sendingSlack}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${slackStatus === "success"
                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                : slackStatus === "error"
                ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                : "bg-[#4A154B] text-white hover:bg-[#611f69]"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {sendingSlack ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : slackStatus === "success" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
            )}
            {slackStatus === "success" ? "Sent!" : "Send to Slack"}
          </button>

          {/* Teams button */}
          <button
            onClick={handleSendTeams}
            disabled={sendingTeams}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${teamsStatus === "success"
                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                : teamsStatus === "error"
                ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                : "bg-[#6264A7] text-white hover:bg-[#4f5091]"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {sendingTeams ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : teamsStatus === "success" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.625 4.5h-6.75A.375.375 0 0 0 13.5 4.875v3.75h3.375a1.875 1.875 0 0 1 0 3.75H13.5v6.75c0 .207.168.375.375.375h6.75A.375.375 0 0 0 21 19.125V4.875A.375.375 0 0 0 20.625 4.5z" />
                <path d="M9.375 12.375a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1.125c-3.313 0-6 1.343-6 3v.75h12v-.75c0-1.657-2.687-3-6-3z" />
              </svg>
            )}
            {teamsStatus === "success" ? "Sent!" : "Send to Teams"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(slackStatus === "error" || teamsStatus === "error") && errorMessage && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Sections */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Done yesterday */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">✅</span>
            <h3 className="text-sm font-semibold text-gray-700">Done Yesterday</h3>
            <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {summary.doneYesterday.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {summary.doneYesterday.length > 0
              ? summary.doneYesterday.map((t) => <TicketRow key={t.id} ticket={t} />)
              : <EmptyRow message="No tickets completed recently" />}
          </div>
        </div>

        {/* In progress */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔄</span>
            <h3 className="text-sm font-semibold text-gray-700">In Progress Today</h3>
            <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {summary.inProgress.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {summary.inProgress.length > 0
              ? summary.inProgress.map((t) => <TicketRow key={t.id} ticket={t} />)
              : <EmptyRow message="No tickets in progress" />}
          </div>
        </div>

        {/* Blockers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🚧</span>
            <h3 className="text-sm font-semibold text-gray-700">Blockers</h3>
            <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
              summary.blockers.length > 0
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {summary.blockers.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {summary.blockers.length > 0
              ? summary.blockers.map((t) => <TicketRow key={t.id} ticket={t} />)
              : <EmptyRow message="No blockers — great!" />}
          </div>
        </div>
      </div>
    </div>
  );
}
