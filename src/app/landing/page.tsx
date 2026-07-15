"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// ─── Animated counter ─────────────────────────────────────────────────────────

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        let start = 0;
        const step = to / 40;
        const timer = setInterval(() => {
          start += step;
          if (start >= to) { setVal(to); clearInterval(timer); }
          else setVal(Math.round(start));
        }, 30);
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Feature card ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "⏱",
    title: "One-click time tracking",
    desc: "Start a timer directly on any Jira ticket. ProfDev captures every second and logs it against the right ticket automatically.",
    surface: "mint" as const,
  },
  {
    icon: "🤖",
    title: "AI meeting summaries",
    desc: "Paste a transcript or .vtt file and get a structured summary — contributions, decisions, action items, and follow-ups — in seconds.",
    surface: "blush" as const,
  },
  {
    icon: "📊",
    title: "Performance insights",
    desc: "Weekly, monthly, and quarterly AI-generated reviews covering delivery efficiency, leadership, communication depth, and growth.",
    surface: "mint" as const,
  },
  {
    icon: "✅",
    title: "Smart task extraction",
    desc: "Action items are automatically pulled from meeting transcripts and saved as tasks — with assignees, priorities, and sources.",
    surface: "blush" as const,
  },
  {
    icon: "💬",
    title: "Slack-native standups",
    desc: "Send daily standups, weekly reviews, and quarterly performance reports to Slack — automatically every Friday at 4 PM.",
    surface: "mint" as const,
  },
  {
    icon: "🎯",
    title: "Milestones & growth",
    desc: "Track professional milestones, log learning activities, and build a record of your growth that feeds directly into your reviews.",
    surface: "blush" as const,
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect Jira",
    desc: "Add your Jira credentials and the app syncs your tickets, statuses, and time logs instantly.",
  },
  {
    step: "02",
    title: "Track & meet",
    desc: "Start timers on tickets, attend meetings, paste transcripts — ProfDev captures everything in real time.",
  },
  {
    step: "03",
    title: "Get insights",
    desc: "AI analyses your work patterns and delivers a candid, structured performance summary straight to Slack.",
  },
];

const INTEGRATIONS = [
  { name: "Jira", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.35 4.35h1.78v1.71a4.362 4.362 0 004.35 4.35V7.63a.84.84 0 00-.84-.83H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72c.01 2.4 1.95 4.34 4.35 4.34v-9.57a.84.84 0 00-.84-.84L2 11.6z"/></svg> },
  { name: "Slack", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"/></svg> },
  { name: "Gemini AI", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> },
  { name: "Microsoft Teams", icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.625 7.313a2.813 2.813 0 100-5.626 2.813 2.813 0 000 5.626zm0 1.312c-1.62 0-3.063.646-4.125 1.688V10.5a4.688 4.688 0 00-9.375 0v6.563a6.563 6.563 0 0013.125 0V8.625h.375zm-10.313 9.75V10.5a3.375 3.375 0 116.75 0v7.875a5.25 5.25 0 01-6.75-.625v.625zm0 0"/></svg> },
];

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Overview", href: "/overview" },
  { label: "Meetings", href: "/meetings" },
  { label: "Performance", href: "/performance" },
  { label: "All Tasks", href: "/standup" },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-charcoal overflow-x-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-paper/90 backdrop-blur-md border-b border-mint" : "bg-transparent"
      }`}>
        <div className="max-w-page mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-card bg-teal-deep flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-display text-[22px] text-charcoal">ProfDev</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-pill">
                {l.label}
              </Link>
            ))}
          </nav>

          <Link href="/" className="btn-primary-sm">
            Open App →
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center pt-40 pb-24 px-8">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="eyebrow justify-center mb-6">
            <span className="eyebrow-dot" />
            AI-powered · Jira-native · Slack-ready
          </p>

          <h1 className="font-display text-display leading-[1.15] text-charcoal mb-6">
            Track smarter.
            <br />
            Deliver better.
          </h1>

          <p className="text-body text-charcoal/70 max-w-xl mx-auto mb-10 leading-relaxed">
            ProfDev ties your Jira tickets, meeting transcripts, and daily standups into one intelligent workspace — then sends AI performance reviews to Slack every Friday.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/" className="btn-primary">
              Open Dashboard
            </Link>
            <Link href="/meetings" className="btn-ghost">
              Try AI Summaries
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stat banner ──────────────────────────────────────────────────────── */}
      <section className="max-w-page mx-auto px-8">
        <div className="stat-banner justify-center">
          {[
            { label: "Hours tracked", to: 2400, suffix: "+" },
            { label: "Summaries generated", to: 380, suffix: "+" },
            { label: "Slack messages sent", to: 1200, suffix: "+" },
            { label: "Action items captured", to: 5000, suffix: "+" },
          ].map(({ label, to, suffix }, i) => (
            <div key={label} className="flex items-center gap-6">
              {i > 0 && <span className="text-mint-mist hidden sm:inline">|</span>}
              <span>
                <span className="stat-value">
                  <Counter to={to} suffix={suffix} />
                </span>{" "}
                <span className="stat-label">{label}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-[88px] px-8">
        <div className="max-w-page mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow justify-center mb-4">
              <span className="eyebrow-dot" />
              Everything you need
            </p>
            <h2 className="headline-lg mb-4">Built for the way you actually work</h2>
            <p className="text-charcoal/60 max-w-xl mx-auto">
              Six core capabilities that cover your entire workday — from the first ticket of the morning to the Friday afternoon Slack summary.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc, surface }) => (
              <div key={title} className={surface === "mint" ? "card-mint" : "card-blush"}>
                <div className="w-12 h-12 rounded-card bg-white flex items-center justify-center text-2xl mb-4">
                  {icon}
                </div>
                <h3 className="font-medium text-charcoal mb-2">{title}</h3>
                <p className="text-[14px] text-charcoal/60 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section className="py-[88px] px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow justify-center mb-4">
              <span className="eyebrow-dot" />
              Simple by design
            </p>
            <h2 className="headline-lg">Up and running in minutes</h2>
          </div>

          <div className="space-y-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-6 card-mint">
                <span className="font-mono text-[20px] font-semibold text-teal-deep shrink-0">{step}</span>
                <div>
                  <h3 className="font-medium text-charcoal text-[18px] mb-1">{title}</h3>
                  <p className="text-charcoal/60 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────────────── */}
      <section className="py-[64px] px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="eyebrow justify-center mb-4">
            <span className="eyebrow-dot" />
            Plays well with your stack
          </p>
          <h2 className="headline mb-10">Integrations that matter</h2>

          <div className="flex flex-wrap justify-center gap-4">
            {INTEGRATIONS.map(({ name, icon }) => (
              <div key={name} className="flex items-center gap-3 px-5 py-3 rounded-card bg-white border border-mint">
                <span className="text-teal-pine">{icon}</span>
                <span className="font-medium text-[14px] text-charcoal">{name}</span>
              </div>
            ))}
          </div>

          <p className="text-[13px] text-charcoal/50 mt-8">
            Connects to your existing tools — no new logins, no vendor lock-in.
          </p>
        </div>
      </section>

      {/* ── Performance preview ───────────────────────────────────────────────── */}
      <section className="py-[88px] px-8 bg-white">
        <div className="max-w-page mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="eyebrow mb-4">
                <span className="eyebrow-dot" />
                For Senior Associates
              </p>
              <h2 className="headline-lg mb-4">
                Know exactly where you stand — before your review does
              </h2>
              <p className="text-charcoal/60 leading-relaxed mb-6">
                ProfDev analyses your Jira throughput, meeting contributions, professional development, and communication depth to produce a Senior Associate–level performance narrative every quarter.
              </p>
              <div className="space-y-2">
                {[
                  { label: "Time management", sub: "Hours by type, session frequency, deep work ratio" },
                  { label: "Delivery efficiency", sub: "Completion rate, ticket velocity, WIP health" },
                  { label: "Communication depth", sub: "AI analysis of your actual meeting contributions" },
                  { label: "Growth tracking", sub: "Milestones, certifications, and learning hours" },
                ].map(({ label, sub }) => (
                  <div key={label} className="check-item">
                    <span className="check-mark">✓</span>
                    <div>
                      <p className="font-medium text-charcoal text-[14px]">{label}</p>
                      <p className="text-[13px] text-charcoal/50 mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/performance" className="btn-primary mt-8">
                View Performance Hub
              </Link>
            </div>

            {/* Mock insight card */}
            <div className="card-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">
                    <span className="eyebrow-dot" />
                    Performance Insights
                  </p>
                  <p className="font-medium text-[18px] text-charcoal mt-1">This Quarter</p>
                </div>
                <span className="tag-progress">AI Insights</span>
              </div>

              {[
                { tag: "tag-done" as const, title: "Time Management", body: "Logged 48h on Jira tickets and 12h on meeting tasks this quarter — a healthy 80/20 split indicating strong deep-work focus..." },
                { tag: "tag-progress" as const, title: "Delivery & Efficiency", body: "Completed 23 of 28 tickets (82% rate), above the Senior Associate benchmark. 3 high-priority items moved to review this week..." },
                { tag: "tag-review" as const, title: "Communication", body: "Your meeting contributions averaged 340 characters — above the team median. Contributions show strategic framing over operational detail..." },
              ].map(({ tag, title, body }) => (
                <div key={title} className="rounded-card bg-mint p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={tag}>{title}</span>
                  </div>
                  <p className="text-[13px] text-charcoal/60 leading-relaxed line-clamp-2">{body}</p>
                </div>
              ))}

              <div className="flex gap-2">
                <div className="flex-1 rounded-card bg-mint p-3 text-center">
                  <p className="text-[20px] font-semibold text-teal-deep">82%</p>
                  <p className="text-[11px] text-charcoal/50">completion</p>
                </div>
                <div className="flex-1 rounded-card bg-mint p-3 text-center">
                  <p className="text-[20px] font-semibold text-navy">60h</p>
                  <p className="text-[11px] text-charcoal/50">tracked</p>
                </div>
                <div className="flex-1 rounded-card bg-mint p-3 text-center">
                  <p className="text-[20px] font-semibold text-charcoal">3</p>
                  <p className="text-[11px] text-charcoal/50">milestones</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-[88px] px-8 bg-blush">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-heading-lg text-charcoal mb-5">
            Ready to make every Friday count?
          </h2>
          <p className="text-charcoal/60 text-[18px] mb-10">
            Your performance story is already being written in Jira and Slack. ProfDev just helps you read it clearly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/" className="btn-primary">
              Open Dashboard
            </Link>
            <Link href="/performance" className="btn-ghost">
              See Performance Hub →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-mint py-10 px-8">
        <div className="max-w-page mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-card bg-teal-deep flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-display text-[16px] text-charcoal">ProfDev</span>
            <span className="text-charcoal/40 text-[13px]">· Amali Tech</span>
          </div>
          <div className="flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-[13px] text-charcoal/50 hover:text-teal-pine transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[13px] text-charcoal/40">Built with ♥ for Senior Associates</p>
        </div>
      </footer>
    </div>
  );
}
