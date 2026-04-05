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
  { key: "overview",  label: "Overview",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "tasks",     label: "Tasks",     icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7l2 2 4-4" },
  { key: "timelogs",  label: "Time Log",  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "meetings",  label: "Meetings",  icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "export",    label: "Export",    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" },
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
        className="w-full flex items-center justify-between px-3 py-1 mb-1"
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b88]">
          Projects
        </p>
        <svg
          className={`w-3 h-3 text-[#6b6b88] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {/* Active project + its sub-nav */}
          {activeProject && (
            <div className="mb-1">
              {/* Active project header */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 mx-1 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeProject.color }} />
                <span className="text-xs font-semibold text-white truncate flex-1">{activeProject.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); clearActiveProject(); router.push("/projects"); }}
                  className="text-[#6b6b88] hover:text-white shrink-0"
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
                    className={`w-full flex items-center gap-2.5 pl-6 pr-3 py-2 text-left text-sm transition-colors rounded-lg mx-0 ${
                      isActive ? "bg-indigo-500/20 text-indigo-300 font-medium" : "text-[#a0a0b8] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                    </svg>
                    <span className="text-xs">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Project list */}
          {projects.length === 0 ? (
            <button
              onClick={() => router.push("/projects")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-[#6b6b88] hover:text-[#a0a0b8] transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create a project
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors rounded-lg ${
                      isActive
                        ? "text-indigo-300"
                        : "text-[#a0a0b8] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-xs truncate flex-1">{p.name}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}

              {/* Manage projects link */}
              <button
                onClick={() => { clearActiveProject(); router.push("/projects"); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-[#6b6b88] hover:text-[#a0a0b8] transition-colors mt-1"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New project
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
