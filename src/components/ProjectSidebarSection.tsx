"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveProject } from "./ActiveProjectContext";

interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
}

const PROJECT_TABS = [
  { key: "overview",   label: "Overview",   icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "tasks",      label: "Tasks",      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7l2 2 4-4" },
  { key: "timelogs",   label: "Time Log",   icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "milestones", label: "Milestones", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
  { key: "meetings",   label: "Meetings",   icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "export",     label: "Export",     icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" },
];

export default function ProjectSidebarSection() {
  const { activeProject, setActiveProject, clearActiveProject } = useActiveProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const router = useRouter();
  const pathname = usePathname();

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    window.addEventListener("projects-updated", loadProjects);
    return () => window.removeEventListener("projects-updated", loadProjects);
  }, [loadProjects]);

  // Determine active tab from URL hash / search params stored in sessionStorage
  useEffect(() => {
    if (pathname === "/projects") {
      const tab = sessionStorage.getItem("clockit_project_tab");
      if (tab) setActiveTab(tab);
    }
  }, [pathname]);

  const selectProject = (p: Project) => {
    setActiveProject({ id: p.id, name: p.name, color: p.color, description: p.description });
    // Navigate to projects page and pass the selected project id via sessionStorage
    sessionStorage.setItem("clockit_active_project_id", p.id);
    sessionStorage.setItem("clockit_project_tab", "overview");
    setActiveTab("overview");
    router.push("/projects");
  };

  const selectTab = (tab: string) => {
    if (!activeProject) return;
    setActiveTab(tab);
    sessionStorage.setItem("clockit_project_tab", tab);
    router.push("/projects");
  };

  const isProjectsPage = pathname === "/projects";

  return (
    <div>
      {/* Section heading + toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 mb-1"
      >
        <p className="nav-section-label !mb-0 !mt-0 !px-0">Projects</p>
        <svg
          className={`w-3 h-3 text-charcoal/50 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2">
          {/* Active project + its sub-nav */}
          {activeProject && (
            <div className="mb-2 card-mint !p-0 overflow-hidden">
              {/* Active project header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-mint-mist">
                <span className="w-2.5 h-2.5 rounded-pill shrink-0" style={{ backgroundColor: activeProject.color }} />
                <span className="text-[13px] font-medium text-charcoal truncate flex-1">{activeProject.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); clearActiveProject(); router.push("/projects"); }}
                  className="text-charcoal/40 hover:text-charcoal shrink-0"
                  title="Deselect project"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Sub-nav tabs */}
              {PROJECT_TABS.map((tab) => {
                const isActive = isProjectsPage && activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => selectTab(tab.key)}
                    className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                      isActive ? "bg-teal-deep text-white font-medium" : "text-charcoal/70 hover:bg-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Project list */}
          {projects.length === 0 ? (
            <button
              onClick={() => { sessionStorage.setItem("clockit_open_create_project", "1"); router.push("/projects"); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-teal-pine hover:text-teal-deep transition-colors"
            >
              + Create a project
            </button>
          ) : (
            <>
              {/* Show project list */}
              {projects.map((p) => {
                const isActive = activeProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProject(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-nav text-left text-[13px] transition-colors ${
                      isActive
                        ? "bg-mint text-charcoal font-medium"
                        : "text-charcoal/60 hover:bg-mint/60 hover:text-charcoal"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="truncate flex-1">{p.name}</span>
                  </button>
                );
              })}

              {/* New project link */}
              <button
                onClick={() => { sessionStorage.setItem("clockit_open_create_project", "1"); router.push("/projects"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-teal-pine hover:text-teal-deep transition-colors mt-1"
              >
                + New project
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
