/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { useDashboard } from "@/hooks/use-dashboard";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PresetOption {
  id: string;
  label: string;
  getRange: () => { from: Date; to: Date };
}

const PRESETS: PresetOption[] = [
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const y = subDays(new Date(), 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
  {
    id: "7d",
    label: "Last 7 Days",
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    },
  },
  {
    id: "14d",
    label: "Last 14 Days",
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(subDays(now, 13)), to: endOfDay(now) };
    },
  },
  {
    id: "30d",
    label: "Last 30 Days",
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    },
  },
  {
    id: "month",
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return { from: startOfMonth(now), to: endOfDay(now) };
    },
  },
  {
    id: "90d",
    label: "Last 90 Days",
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    },
  },
];

export function formatDateRangeLabel(from: Date, to: Date): string {
  const now = new Date();
  if (isSameDay(from, to)) {
    if (isSameDay(from, now)) return `Today · ${format(from, "MMM d")}`;
    if (isSameDay(from, subDays(now, 1))) return `Yesterday · ${format(from, "MMM d")}`;
    return format(from, "MMM d, yyyy");
  }
  const sameYear = from.getFullYear() === to.getFullYear();
  return sameYear
    ? `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`
    : `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}

export const DateRangePicker: React.FC<{ className?: string }> = ({ className }) => {
  const { dateRange, setDateRange } = useDashboard();
  const [open, setOpen] = React.useState(false);
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>({
    from: dateRange.from,
    to: dateRange.to,
  });

  React.useEffect(() => {
    setDraftRange({ from: dateRange.from, to: dateRange.to });
  }, [dateRange.from, dateRange.to]);

  const dayCount = Math.max(1, differenceInCalendarDays(dateRange.to, dateRange.from) + 1);

  const activePresetId = React.useMemo(() => {
    for (const preset of PRESETS) {
      const r = preset.getRange();
      if (isSameDay(r.from, dateRange.from) && isSameDay(r.to, dateRange.to)) {
        return preset.id;
      }
    }
    return "custom";
  }, [dateRange.from, dateRange.to]);

  const handleSelectPreset = (preset: PresetOption) => {
    const next = preset.getRange();
    setDraftRange(next);
    setDateRange(next);
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setDraftRange(range);
    if (range?.from && range?.to) {
      setDateRange({
        from: startOfDay(range.from),
        to: endOfDay(range.to),
      });
    } else if (range?.from && !range?.to) {
      // Allow user to pick second date, or click Apply for single day
    }
  };

  const handleApplyDraft = () => {
    if (!draftRange?.from) return;
    const from = startOfDay(draftRange.from);
    const to = endOfDay(draftRange.to ?? draftRange.from);
    setDateRange({ from, to });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-slate-700 transition-colors cursor-pointer shadow-2xs",
          className
        )}
      >
        <CalendarIcon className="w-4 h-4 text-orange-500 shrink-0" />
        <span className="whitespace-nowrap">{formatDateRangeLabel(dateRange.from, dateRange.to)}</span>
        <span className="hidden sm:inline-flex items-center rounded bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-orange-700">
          {dayCount}d
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Quick Presets */}
          <div className="flex sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-slate-100 p-2.5 sm:w-40 overflow-x-auto bg-slate-50/70">
            <span className="hidden sm:block px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Quick Ranges
            </span>
            {PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    "text-left px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-orange-500 text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Calendar Picker */}
          <div className="p-3 space-y-3">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              defaultMonth={subDays(dateRange.to, 28)}
              disabled={{ after: endOfMonth(new Date()) }}
            />
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 gap-3">
              <span className="text-xs text-slate-500 font-mono">
                {draftRange?.from
                  ? draftRange.to
                    ? `${format(draftRange.from, "dd MMM")} → ${format(draftRange.to, "dd MMM yyyy")}`
                    : `${format(draftRange.from, "dd MMM yyyy")} (select end date)`
                  : "Pick a date range"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const now = new Date();
                    const todayRange = { from: startOfDay(now), to: endOfDay(now) };
                    setDraftRange(todayRange);
                    setDateRange(todayRange);
                    setOpen(false);
                  }}
                >
                  Reset Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draftRange?.from}
                  onClick={handleApplyDraft}
                  className="h-7 px-3 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
