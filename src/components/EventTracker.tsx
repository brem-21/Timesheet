"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// ── Session ID (persisted in localStorage) ────────────────────────────────────

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("clockit_session_id");
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("clockit_session_id", id);
  }
  return id;
}

function newEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Fire-and-forget event publisher ──────────────────────────────────────────

function track(payload: Record<string, unknown>): void {
  const body = JSON.stringify({
    eventId: newEventId(),
    sessionId: getSessionId(),
    timestamp: Date.now(),
    referrer: document.referrer || null,
    ...payload,
  });

  // Use sendBeacon when available (survives page unload), fall back to fetch
  const url = "/api/track";
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } else {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const pageEntryRef = useRef<number>(Date.now());

  // Page view tracking
  useEffect(() => {
    const prev = prevPathRef.current;
    const now = Date.now();
    const timeOnPrev = prev ? now - pageEntryRef.current : 0;

    track({
      type: "page_view",
      path: pathname,
      action: "view",
      metadata: {
        title: document.title,
        timeOnPreviousPage: timeOnPrev,
        previousPath: prev,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
        language: navigator.language,
        online: navigator.onLine,
      },
    });

    prevPathRef.current = pathname;
    pageEntryRef.current = now;
  }, [pathname]);

  // Click tracking via event delegation
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Walk up to find the nearest interactive element
      const el = target.closest("button, a, [role='button'], [data-track]") as HTMLElement | null;
      if (!el) return;

      const label =
        el.getAttribute("data-track") ??
        el.getAttribute("aria-label") ??
        el.getAttribute("title") ??
        el.textContent?.trim().slice(0, 60) ??
        el.tagName.toLowerCase();

      track({
        type: "click",
        path: pathname,
        component: el.tagName.toLowerCase(),
        action: label,
        metadata: {
          href: el instanceof HTMLAnchorElement ? el.href : undefined,
          id: el.id || undefined,
          classList: Array.from(el.classList).slice(0, 5),
        },
      });
    }

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  // Visibility change — track when user leaves/returns to tab
  useEffect(() => {
    function handleVisibility() {
      track({
        type: "visibility",
        path: pathname,
        action: document.hidden ? "tab_hidden" : "tab_visible",
        metadata: { timeOnPage: Date.now() - pageEntryRef.current },
      });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pathname]);

  return null;
}
