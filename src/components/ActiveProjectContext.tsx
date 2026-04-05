"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface ActiveProject {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface ActiveProjectContextValue {
  activeProject: ActiveProject | null;
  setActiveProject: (project: ActiveProject | null) => void;
  clearActiveProject: () => void;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue>({
  activeProject: null,
  setActiveProject: () => {},
  clearActiveProject: () => {},
});

const LS_KEY = "clockit_active_project";

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<ActiveProject | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setActiveProjectState(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  const setActiveProject = useCallback((project: ActiveProject | null) => {
    setActiveProjectState(project);
    if (project) {
      localStorage.setItem(LS_KEY, JSON.stringify(project));
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, []);

  const clearActiveProject = useCallback(() => {
    setActiveProjectState(null);
    localStorage.removeItem(LS_KEY);
  }, []);

  // Don't render children until hydrated to avoid SSR mismatch
  if (!hydrated) return null;

  return (
    <ActiveProjectContext.Provider value={{ activeProject, setActiveProject, clearActiveProject }}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  return useContext(ActiveProjectContext);
}
