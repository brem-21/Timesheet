"use client";

import { useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, startOfQuarter, endOfQuarter, subQuarters } from "date-fns";

export type RangePreset = "this-week" | "last-week" | "this-month" | "last-month" | "this-quarter" | "last-quarter" | "custom";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
  preset: RangePreset;
}

function getPresetRange(preset: RangePreset, customStart?: string, customEnd?: string): DateRange {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  switch (preset) {
    case "this-week":
      return { startDate: fmt(startOfWeek(today, { weekStartsOn: 1 })), endDate: fmt(endOfWeek(today, { weekStartsOn: 1 })), label: "This Week", preset };
    case "last-week": {
      const lastWeek = subWeeks(today, 1);
      return { startDate: fmt(startOfWeek(lastWeek, { weekStartsOn: 1 })), endDate: fmt(endOfWeek(lastWeek, { weekStartsOn: 1 })), label: "Last Week", preset };
    }
    case "this-month":
      return { startDate: fmt(startOfMonth(today)), endDate: fmt(endOfMonth(today)), label: format(today, "MMMM yyyy"), preset };
    case "last-month": {
      const lastMonth = subMonths(today, 1);
      return { startDate: fmt(startOfMonth(lastMonth)), endDate: fmt(endOfMonth(lastMonth)), label: format(lastMonth, "MMMM yyyy"), preset };
    }
    case "this-quarter":
      return { startDate: fmt(startOfQuarter(today)), endDate: fmt(endOfQuarter(today)), label: `Q${Math.ceil((today.getMonth() + 1) / 3)} ${today.getFullYear()}`, preset };
    case "last-quarter": {
      const lastQ = subQuarters(today, 1);
      return { startDate: fmt(startOfQuarter(lastQ)), endDate: fmt(endOfQuarter(lastQ)), label: `Q${Math.ceil((lastQ.getMonth() + 1) / 3)} ${lastQ.getFullYear()}`, preset };
    }
    case "custom":
      return { startDate: customStart ?? fmt(startOfMonth(today)), endDate: customEnd ?? fmt(today), label: "Custom Range", preset };
    default:
      return { startDate: fmt(startOfMonth(today)), endDate: fmt(endOfMonth(today)), label: format(today, "MMMM yyyy"), preset: "this-month" };
  }
}

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "last-quarter", label: "Last Quarter" },
  { value: "custom", label: "Custom Range" },
];

interface Props {
  onChange: (range: DateRange) => void;
  defaultPreset?: RangePreset;
}

export default function DateRangeFilter({ onChange, defaultPreset = "this-month" }: Props) {
  const [selected, setSelected] = useState<RangePreset>(defaultPreset);
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showCustom, setShowCustom] = useState(false);

  function handlePreset(preset: RangePreset) {
    setSelected(preset);
    if (preset === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(getPresetRange(preset));
    }
  }

  function applyCustom() {
    onChange(getPresetRange("custom", customStart, customEnd));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500 font-medium mr-1">Period:</span>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              selected === p.value
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 mt-2 w-full">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={applyCustom}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export { getPresetRange };
