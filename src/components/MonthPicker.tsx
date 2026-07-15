"use client";

import { useState } from "react";
import { format, addMonths, subMonths, parseISO } from "date-fns";

interface MonthPickerProps {
  month: string;
  year: string;
  onChange: (month: string, year: string) => void;
}

export default function MonthPicker({ month, year, onChange }: MonthPickerProps) {
  const currentDate = parseISO(`${year}-${month.padStart(2, "0")}-01`);

  const goToPrevious = () => {
    const prev = subMonths(currentDate, 1);
    onChange(
      String(prev.getMonth() + 1).padStart(2, "0"),
      String(prev.getFullYear())
    );
  };

  const goToNext = () => {
    const next = addMonths(currentDate, 1);
    const now = new Date();
    // Don't allow navigating past the current month
    if (next > now) return;
    onChange(
      String(next.getMonth() + 1).padStart(2, "0"),
      String(next.getFullYear())
    );
  };

  const isCurrentMonth =
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

  return (
    <div className="flex items-center gap-2 input-field !py-1.5">
      <button
        onClick={goToPrevious}
        className="p-1 rounded-pill hover:bg-mint transition-colors text-charcoal/60 hover:text-charcoal"
        aria-label="Previous month"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span className="text-[14px] font-semibold text-charcoal min-w-[120px] text-center">
        {format(currentDate, "MMMM yyyy")}
      </span>

      <button
        onClick={goToNext}
        disabled={isCurrentMonth}
        className="p-1 rounded-pill hover:bg-mint transition-colors text-charcoal/60 hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
