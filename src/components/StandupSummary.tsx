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
      <span className="font-mono text-[11px] bg-mint text-teal-pine px-1.5 py-0.5 rounded-tag shrink-0 group-hover:bg-teal-deep group-hover:text-white transition-colors">
        {ticket.key}
      </span>
      <span className="text-[14px] text-charcoal/80 group-hover:text-charcoal group-hover:underline leading-snug">
        {ticket.summary}
      </span>
    </a>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p className="text-[14px] text-charcoal/40 italic py-1">{message}</p>
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
    <div className="card-white !p-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-mint flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-heading-sm text-charcoal">Daily Standup</h2>
          <p className="text-[12px] text-charcoal/50 mt-0.5">{summary.date}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Slack button — primary CTA */}
          <button onClick={handleSendSlack} disabled={sendingSlack} className="btn-primary-sm">
            {sendingSlack ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : slackStatus === "success" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
            {slackStatus === "success" ? "Sent!" : slackStatus === "error" ? "Retry Slack" : "Send to Slack"}
          </button>

          {/* Teams button — secondary CTA, navy */}
          <button onClick={handleSendTeams} disabled={sendingTeams} className="btn-secondary">
            {sendingTeams ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : teamsStatus === "success" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
            {teamsStatus === "success" ? "Sent!" : teamsStatus === "error" ? "Retry Teams" : "Send to Teams"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(slackStatus === "error" || teamsStatus === "error") && errorMessage && (
        <div className="mx-6 mt-3 px-3 py-2 bg-blush border border-rose/40 rounded-card text-[12px] text-charcoal">
          {errorMessage}
        </div>
      )}

      {/* Sections */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-24">
        {/* Done yesterday */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="eyebrow">
              <span className="eyebrow-dot" />
              Done Yesterday
            </h3>
            <span className="ml-auto tag-done">{summary.doneYesterday.length}</span>
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
            <h3 className="eyebrow">
              <span className="eyebrow-dot" />
              In Progress Today
            </h3>
            <span className="ml-auto tag-progress">{summary.inProgress.length}</span>
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
            <h3 className="eyebrow">
              <span className="eyebrow-dot" />
              Blockers
            </h3>
            <span className={`ml-auto ${summary.blockers.length > 0 ? "tag-blocked" : "tag-neutral"}`}>
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
