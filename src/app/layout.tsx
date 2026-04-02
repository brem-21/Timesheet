import type { Metadata } from "next";
import "./globals.css";
import { TimerProvider } from "@/components/TimerContext";
import ActiveTimerBanner from "@/components/ActiveTimerBanner";
import EventTracker from "@/components/EventTracker";
import SidebarLink from "@/components/SidebarLink";

export const metadata: Metadata = {
  title: "Clock-It — Time Tracking Dashboard",
  description: "Track your Jira time logs and send daily standups to Slack and Teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <TimerProvider>
        {/* Sidebar */}
        <aside
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{ width: "var(--sidebar-width)", backgroundColor: "#1e1e2e" }}
        >
          {/* Logo */}
          <div className="px-5 py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Clock-It</p>
                <p className="text-[#a0a0b8] text-xs mt-0.5">Time Tracker</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b6b88] mb-2">
              Main
            </p>
            <SidebarLink
              href="/"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
            >
              Dashboard
            </SidebarLink>

            <SidebarLink
              href="/team"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            >
              Team View
            </SidebarLink>

            <SidebarLink
              href="/meetings"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
            >
              Meetings
            </SidebarLink>

            <SidebarLink
              href="/overview"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              Overview
            </SidebarLink>

            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b6b88] mb-2 mt-5">
              Insights
            </p>
            <SidebarLink
              href="/performance"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              Performance
            </SidebarLink>

            <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[#6b6b88] mb-2 mt-5">
              Tools
            </p>

            <SidebarLink
              href="/tasks"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7l2 2 4-4" />
                </svg>
              }
            >
              Tasks
            </SidebarLink>

            <SidebarLink
              href="/standup"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              }
            >
              All Tasks
            </SidebarLink>

            <SidebarLink
              href="/timelog"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              Time Log
            </SidebarLink>

            <SidebarLink
              href="/export"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              }
            >
              Export
            </SidebarLink>
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#a0a0b8] truncate">Amali Tech</p>
                <p className="text-[10px] text-[#6b6b88] truncate">Jira Integration</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <EventTracker />
          {children}
        </main>
        <ActiveTimerBanner />
        </TimerProvider>
      </body>
    </html>
  );
}
