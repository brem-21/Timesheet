"use client";

import { useEffect, useState } from "react";
import SidebarLink from "@/components/SidebarLink";
import ProjectSidebarSection from "@/components/ProjectSidebarSection";

const STORAGE_KEY = "clockit_sidebar_collapsed";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden bg-white border-r border-mint transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? "72px" : "var(--sidebar-width)" }}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center py-6 ${collapsed ? "justify-center px-0" : "justify-between px-6"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-card bg-teal-deep flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-[20px] leading-none text-charcoal truncate">ProfDev</p>
              <p className="eyebrow text-[10px] mt-1">
                <span className="eyebrow-dot" />
                Performance Hub
              </p>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={toggle}
            title="Collapse menu"
            className="w-7 h-7 rounded-pill bg-mint flex items-center justify-center shrink-0 hover:bg-mint-mist transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-teal-pine" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {collapsed ? (
        /* Collapsed rail — just a reopen affordance */
        <div className="flex-1 flex flex-col items-center pt-2">
          <button
            onClick={toggle}
            title="Expand menu"
            className="w-7 h-7 rounded-pill bg-mint flex items-center justify-center hover:bg-mint-mist transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-teal-pine" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Navigation */}
          <nav className="flex-1 py-2 overflow-y-auto">

            {/* ── Professional Growth ────────────────────────────── */}
            <p className="nav-section-label">Professional Growth</p>
            <SidebarLink href="/growth">Course &amp; Quizzes</SidebarLink>

            {/* ── Projects (dynamic) ─────────────────────────────── */}
            <div className="mt-5">
              <ProjectSidebarSection />
            </div>

            {/* ── Meetings (independent) ─────────────────────────── */}
            <div className="mt-5">
              <p className="nav-section-label">Meetings</p>
              <SidebarLink href="/meetings">Meetings</SidebarLink>
            </div>

            {/* ── Global / Analytics ─────────────────────────────── */}
            <div className="mt-5">
              <p className="nav-section-label">Analytics</p>
              <SidebarLink href="/performance">Performance</SidebarLink>
              <SidebarLink href="/overview">Overview</SidebarLink>
            </div>

            {/* ── Work Tools ─────────────────────────────────────── */}
            <div className="mt-5">
              <p className="nav-section-label">Work</p>
              <SidebarLink href="/">Dashboard</SidebarLink>
              <SidebarLink href="/team">Team View</SidebarLink>
              <SidebarLink href="/tasks">Jira Tasks</SidebarLink>
              <SidebarLink href="/standup">All Tasks</SidebarLink>
              <SidebarLink href="/morning-update">Daily Update</SidebarLink>
              <SidebarLink href="/timelog">Time Log</SidebarLink>
              <SidebarLink href="/export">Export</SidebarLink>
            </div>
          </nav>

          {/* Footer */}
          <div className="px-6 py-5 border-t border-mint">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-pill bg-mint flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-teal-pine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-charcoal truncate">Amali Tech</p>
                <p className="text-[11px] text-charcoal/50 truncate">Jira Integration</p>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
