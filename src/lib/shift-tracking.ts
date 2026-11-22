/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { addDays, format, startOfWeek } from 'date-fns';
import { ScheduledShift, ScheduleShiftType, ShiftSlot, Staff, TimeEntry } from '@/types';

export const SHIFT_PRESETS: Record<
  ScheduleShiftType,
  { label: string; startTime: string; endTime: string; hoursLabel: string }
> = {
  Morning: {
    label: 'Morning',
    startTime: '08:00',
    endTime: '16:00',
    hoursLabel: '08:00–16:00',
  },
  Evening: {
    label: 'Evening',
    startTime: '14:00',
    endTime: '23:00',
    hoursLabel: '14:00–23:00',
  },
  Split: {
    label: 'Split',
    startTime: '10:00',
    endTime: '22:00',
    hoursLabel: '10:00–22:00',
  },
  Off: {
    label: 'Day Off',
    startTime: '',
    endTime: '',
    hoursLabel: 'Off',
  },
};

export interface WeekDayColumn {
  dateKey: string;
  dayShort: string;
  dateShort: string;
  isToday: boolean;
}

export function getCurrentWeekDays(referenceDate = new Date()): WeekDayColumn[] {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const todayKey = format(referenceDate, 'yyyy-MM-dd');
  return Array.from({ length: 7 }).map((_, idx) => {
    const day = addDays(weekStart, idx);
    const dateKey = format(day, 'yyyy-MM-dd');
    return {
      dateKey,
      dayShort: format(day, 'EEE'),
      dateShort: format(day, 'dd MMM'),
      isToday: dateKey === todayKey,
    };
  });
}

export function createSchedulesForStaff(
  staffList: Staff[],
  referenceDate = new Date()
): ScheduledShift[] {
  const weekDays = getCurrentWeekDays(referenceDate);
  const schedules: ScheduledShift[] = [];

  staffList.forEach((member, staffIdx) => {
    const restDayIdx = (staffIdx + 1) % 7;
    weekDays.forEach((day, dayIdx) => {
      const isOff = dayIdx === restDayIdx && member.status === 'Off Duty' ? true : dayIdx === restDayIdx && !day.isToday;
      const shiftType: ScheduleShiftType = isOff ? 'Off' : member.shift;
      const preset = SHIFT_PRESETS[shiftType];

      schedules.push({
        id: `sched-${member.id}-${day.dateKey}`,
        staffId: member.id,
        outletId: member.outletId,
        date: day.dateKey,
        shiftType,
        startTime: preset.startTime,
        endTime: preset.endTime,
      });
    });
  });

  return schedules;
}

export function createInitialTimeEntriesForStaff(
  staffList: Staff[],
  now = new Date()
): TimeEntry[] {
  const entries: TimeEntry[] = [];
  const nowMs = now.getTime();

  staffList.forEach((member, idx) => {
    if (member.status === 'On Duty' || member.status === 'Break') {
      // Seed realistic clock-in 1h to 6h ago so elapsed counters look live & authentic
      const offsetMinutes =
        member.shift === 'Morning'
          ? 220 + ((idx * 17) % 140)
          : member.shift === 'Split'
            ? 170 + ((idx * 23) % 120)
            : 75 + ((idx * 19) % 110);

      const clockInDate = new Date(nowMs - offsetMinutes * 60 * 1000);
      const breakStartAt =
        member.status === 'Break'
          ? new Date(nowMs - (10 + (idx % 12)) * 60 * 1000).toISOString()
          : undefined;

      entries.push({
        id: `te-${member.id}-active`,
        staffId: member.id,
        outletId: member.outletId,
        clockInAt: clockInDate.toISOString(),
        breakStartAt,
        totalBreakMinutes: member.status === 'On Duty' && idx % 3 === 0 ? 15 : 0,
        status: member.status === 'Break' ? 'On Break' : 'Clocked In',
        shiftType: member.shift as ShiftSlot,
      });
    } else if (idx % 2 === 0) {
      // Seed a completed morning/prior shift for some off-duty staff so history is populated
      const endMs = nowMs - (45 + (idx % 90)) * 60 * 1000;
      const startMs = endMs - (360 + (idx % 120)) * 60 * 1000;
      entries.push({
        id: `te-${member.id}-done`,
        staffId: member.id,
        outletId: member.outletId,
        clockInAt: new Date(startMs).toISOString(),
        clockOutAt: new Date(endMs).toISOString(),
        totalBreakMinutes: 20,
        status: 'Clocked Out',
        shiftType: member.shift as ShiftSlot,
      });
    }
  });

  return entries;
}

export function calcEntryWorkedMinutes(entry: TimeEntry, nowMs = Date.now()): number {
  const startMs = new Date(entry.clockInAt).getTime();
  const endMs = entry.clockOutAt ? new Date(entry.clockOutAt).getTime() : nowMs;
  const activeBreakMs =
    entry.status === 'On Break' && entry.breakStartAt
      ? Math.max(0, nowMs - new Date(entry.breakStartAt).getTime())
      : 0;
  const grossMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
  const breakMins = entry.totalBreakMinutes + Math.floor(activeBreakMs / 60000);
  return Math.max(0, grossMinutes - breakMins);
}

export function formatMinutesAsDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours.toString().padStart(2, '0')}h ${rem.toString().padStart(2, '0')}m`;
}
