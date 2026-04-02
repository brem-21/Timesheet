"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/activity/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, type: "page" }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
