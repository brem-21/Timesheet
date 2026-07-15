"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "@/lib/utils";

interface UserSearchProps {
  onSelect: (user: User) => void;
  selectedUser: User | null;
}

export default function UserSearch({ onSelect, selectedUser }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    setError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/jira/users?query=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.users ?? []);
        setOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = (user: User) => {
    onSelect(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clearSelection = () => {
    onSelect({ accountId: "", displayName: "", emailAddress: "", avatarUrl: "" });
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      {selectedUser?.accountId ? (
        <div className="flex items-center gap-3 input-field">
          {selectedUser.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedUser.avatarUrl}
              alt={selectedUser.displayName}
              className="w-7 h-7 rounded-pill object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-charcoal truncate">{selectedUser.displayName}</p>
            <p className="text-[12px] text-charcoal/40 truncate">{selectedUser.emailAddress}</p>
          </div>
          <button
            onClick={clearSelection}
            className="text-charcoal/40 hover:text-charcoal transition-colors shrink-0"
            aria-label="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {loading ? (
              <svg className="w-4 h-4 animate-spin text-charcoal/40" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-charcoal/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search team member..."
            className="input-field w-full pl-9"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-1 text-[12px] text-[#b3492f]">{error}</p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-mint rounded-card overflow-hidden max-h-64 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user.accountId}
              onClick={() => handleSelect(user)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-mint/60 transition-colors text-left border-b border-mint last:border-b-0"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-pill object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-pill bg-mint text-teal-pine flex items-center justify-center shrink-0 text-[14px] font-bold">
                  {user.displayName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-charcoal truncate">{user.displayName}</p>
                <p className="text-[12px] text-charcoal/40 truncate">{user.emailAddress}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-mint rounded-card px-4 py-3 text-[14px] text-charcoal/50">
          No users found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
