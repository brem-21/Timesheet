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
    desc: "Start a timer directly on any Jira ticket. Clock-It captures every second and logs it against the right ticket automatically.",
    gradient: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-50",
  },
  {
    icon: "🤖",
    title: "AI meeting summaries",
    desc: "Paste a transcript or .vtt file and get a structured summary — contributions, decisions, action items, and follow-ups — in seconds.",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
  },
  {
    icon: "📊",
    title: "Performance insights",
    desc: "Weekly, monthly, and quarterly AI-generated reviews covering delivery efficiency, leadership, communication depth, and growth.",
    gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
  },
  {
    icon: "✅",
    title: "Smart task extraction",
    desc: "Action items are automatically pulled from meeting transcripts and saved as tasks — with assignees, priorities, and sources.",
    gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
  },
  {
    icon: "💬",
    title: "Slack-native standups",
    desc: "Send daily standups, weekly reviews, and quarterly performance reports to Slack — automatically every Friday at 4 PM.",
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
  },
  {
    icon: "🎯",
    title: "Milestones & growth",
    desc: "Track professional milestones, log learning activities, and build a record of your growth that feeds directly into your reviews.",
    gradient: "from-rose-500 to-pink-600",
    bg: "bg-rose-50",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect Jira",
    desc: "Add your Jira credentials and the app syncs your tickets, statuses, and time logs instantly.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    color: "text-indigo-600 bg-indigo-100",
  },
  {
    step: "02",
    title: "Track & meet",
    desc: "Start timers on tickets, attend meetings, paste transcripts — Clock-It captures everything in real time.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "text-violet-600 bg-violet-100",
  },
  {
    step: "03",
    title: "Get insights",
    desc: "AI analyses your work patterns and delivers a candid, structured performance summary straight to Slack.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: "text-amber-600 bg-amber-100",
  },
];

const INTEGRATIONS = [
  { name: "Jira", color: "text-blue-600", bg: "bg-blue-50 border-blue-100",
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.35 4.35h1.78v1.71a4.362 4.362 0 004.35 4.35V7.63a.84.84 0 00-.84-.83H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72c.01 2.4 1.95 4.34 4.35 4.34v-9.57a.84.84 0 00-.84-.84L2 11.6z"/></svg> },
  { name: "Slack", color: "text-purple-700", bg: "bg-purple-50 border-purple-100",
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"/></svg> },
  { name: "Gemini AI", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg> },
  { name: "Microsoft Teams", color: "text-blue-700", bg: "bg-blue-50 border-blue-100",
    icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.625 7.313a2.813 2.813 0 100-5.626 2.813 2.813 0 000 5.626zm0 1.312c-1.62 0-3.063.646-4.125 1.688V10.5a4.688 4.688 0 00-9.375 0v6.563a6.563 6.563 0 0013.125 0V8.625h.375zm-10.313 9.75V10.5a3.375 3.375 0 116.75 0v7.875a5.25 5.25 0 01-6.75-.625v.625zm0 0"/></svg> },
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
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ── Sticky nav ──────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className={`font-bold text-lg tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-white"}`}>
              Clock-It
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  scrolled ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900" : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
          >
            Open App →
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0f0c29]">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-purple-900/30 rounded-full blur-[80px]" />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-powered · Jira-native · Slack-ready
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
            Track smarter.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Deliver better.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Clock-It ties your Jira tickets, meeting transcripts, and daily standups into one intelligent workspace — then sends AI performance reviews to Slack every Friday.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="group flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-2xl shadow-indigo-900/50 transition-all active:scale-95 text-base"
            >
              Open Dashboard
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/meetings"
              className="flex items-center gap-2 px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-2xl border border-white/20 backdrop-blur-sm transition-all text-base"
            >
              Try AI Summaries
            </Link>
          </div>

          {/* Floating stat pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-16">
            {[
              { label: "Jira tickets tracked", val: "∞", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
              { label: "AI summaries", val: "Instant", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
              { label: "Slack delivery", val: "Every Friday", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
              { label: "Setup time", val: "< 2 min", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
            ].map(({ label, val, color }) => (
              <div key={label} className={`inline-flex flex-col items-center px-4 py-2.5 rounded-xl border backdrop-blur-sm ${color}`}>
                <span className="text-lg font-bold">{val}</span>
                <span className="text-[10px] font-medium opacity-80 mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 animate-bounce">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-indigo-600 to-violet-600 py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {[
            { label: "Hours tracked", to: 2400, suffix: "+" },
            { label: "Summaries generated", to: 380, suffix: "+" },
            { label: "Slack messages sent", to: 1200, suffix: "+" },
            { label: "Action items captured", to: 5000, suffix: "+" },
          ].map(({ label, to, suffix }) => (
            <div key={label}>
              <p className="text-3xl font-extrabold"><Counter to={to} suffix={suffix} /></p>
              <p className="text-sm text-indigo-200 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-3">Everything you need</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              Built for the way you actually work
            </h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">
              Six core capabilities that cover your entire workday — from the first ticket of the morning to the Friday afternoon Slack summary.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc, gradient, bg }) => (
              <div
                key={title}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                <div className={`mt-4 h-0.5 w-8 rounded-full bg-gradient-to-r ${gradient} group-hover:w-full transition-all duration-500`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-3">Simple by design</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Up and running in minutes</h2>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-8 top-12 bottom-12 w-0.5 bg-gradient-to-b from-indigo-200 via-violet-200 to-amber-200 hidden md:block" />

            <div className="space-y-10">
              {HOW_IT_WORKS.map(({ step, title, desc, icon, color }, i) => (
                <div key={step} className="flex items-start gap-6 group">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${color} group-hover:scale-110 transition-transform`}>
                    {icon}
                  </div>
                  <div className="pt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-gray-300 tracking-widest">{step}</span>
                      <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
                    </div>
                    <p className="text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Plays well with your stack</p>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-10">Integrations that matter</h2>

          <div className="flex flex-wrap justify-center gap-4">
            {INTEGRATIONS.map(({ name, color, bg, icon }) => (
              <div
                key={name}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${bg} hover:scale-105 transition-transform cursor-default`}
              >
                <span className={color}>{icon}</span>
                <span className={`font-semibold text-sm ${color}`}>{name}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-400 mt-8">
            Connects to your existing tools — no new logins, no vendor lock-in.
          </p>
        </div>
      </section>

      {/* ── Performance preview ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-3">For Senior Associates</p>
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                Know exactly where you stand — before your review does
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Clock-It analyses your Jira throughput, meeting contributions, professional development, and communication depth to produce a Senior Associate–level performance narrative every quarter.
              </p>
              <div className="space-y-3">
                {[
                  { icon: "⏱", label: "Time management", sub: "Hours by type, session frequency, deep work ratio" },
                  { icon: "🚀", label: "Delivery efficiency", sub: "Completion rate, ticket velocity, WIP health" },
                  { icon: "💬", label: "Communication depth", sub: "AI analysis of your actual meeting contributions" },
                  { icon: "📈", label: "Growth tracking", sub: "Milestones, certifications, and learning hours" },
                ].map(({ icon, label, sub }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <span className="text-xl mt-0.5">{icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/performance"
                className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors text-sm"
              >
                View Performance Hub
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Mock insight card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Performance Insights</p>
                  <p className="font-bold text-lg">This Quarter</p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full border border-indigo-500/30">
                  ✨ AI Insights
                </span>
              </div>

              {[
                { color: "bg-indigo-500", title: "⏱ Time Management", body: "Logged 48h on Jira tickets and 12h on meeting tasks this quarter — a healthy 80/20 split indicating strong deep-work focus..." },
                { color: "bg-emerald-500", title: "🚀 Delivery & Efficiency", body: "Completed 23 of 28 tickets (82% rate), above the Senior Associate benchmark. 3 high-priority items moved to review this week..." },
                { color: "bg-blue-500", title: "💬 Communication", body: "Your meeting contributions averaged 340 characters — above the team median. Contributions show strategic framing over operational detail..." },
              ].map(({ color, title, body }) => (
                <div key={title} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-xs font-bold text-gray-200">{title}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{body}</p>
                </div>
              ))}

              <div className="flex gap-2">
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xl font-bold text-emerald-400">82%</p>
                  <p className="text-[10px] text-gray-400">completion</p>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xl font-bold text-indigo-400">60h</p>
                  <p className="text-[10px] text-gray-400">tracked</p>
                </div>
                <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">3</p>
                  <p className="text-[10px] text-gray-400">milestones</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="relative py-28 px-6 overflow-hidden bg-[#0f0c29]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px]" />
          <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-5">
            Ready to make every <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Friday count?</span>
          </h2>
          <p className="text-white/50 text-lg mb-10">
            Your performance story is already being written in Jira and Slack. Clock-It just helps you read it clearly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="group flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-2xl shadow-indigo-900/60 transition-all active:scale-95 text-base"
            >
              Open Dashboard
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/performance"
              className="px-10 py-4 text-white/70 hover:text-white font-semibold transition-colors text-base"
            >
              See Performance Hub →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-white text-sm">Clock-It</span>
            <span className="text-gray-600 text-xs">· Amali Tech</span>
          </div>
          <div className="flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-600">Built with ♥ for Senior Associates</p>
        </div>
      </footer>
    </div>
  );
}
