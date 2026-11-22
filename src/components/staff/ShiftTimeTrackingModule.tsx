/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Coffee,
  LogOut,
  MapPin,
  Plus,
  Search,
  Store,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { ScheduledShift, ScheduleShiftType, Staff, TimeEntry } from '@/types';
import { useDashboard } from '@/hooks/use-dashboard';
import {
  calcEntryWorkedMinutes,
  formatMinutesAsDuration,
  getCurrentWeekDays,
  SHIFT_PRESETS,
} from '@/lib/shift-tracking';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClockedInMonitorViewProps {
  onSelectStaff: (staff: Staff) => void;
}

export const ClockedInMonitorView: React.FC<ClockedInMonitorViewProps> = ({
  onSelectStaff,
}) => {
  const {
    outlets,
    selectedOutletId,
    setSelectedOutletId,
    staffMembers,
    timeEntries,
    clockOutStaff,
    toggleBreakStaff,
  } = useDashboard();

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'clocked_in' | 'break'>('active');
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const activeEntryByStaff = React.useMemo(() => {
    const map = new Map<string, TimeEntry>();
    timeEntries.forEach((entry) => {
      if (entry.status !== 'Clocked Out') {
        map.set(entry.staffId, entry);
      }
    });
    return map;
  }, [timeEntries]);

  const outletGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const targetOutlets =
      selectedOutletId === 'all'
        ? outlets
        : outlets.filter((o) => o.id === selectedOutletId);

    return targetOutlets
      .map((outlet) => {
        const branchStaff = staffMembers.filter((s) => s.outletId === outlet.id);
        const activeMembers = branchStaff
          .filter((member) => {
            const entry = activeEntryByStaff.get(member.id);
            if (!entry) return false;
            if (statusFilter === 'clocked_in' && entry.status !== 'Clocked In') return false;
            if (statusFilter === 'break' && entry.status !== 'On Break') return false;
            if (!q) return true;
            return (
              member.name.toLowerCase().includes(q) ||
              member.role.toLowerCase().includes(q) ||
              (member.station || '').toLowerCase().includes(q) ||
              outlet.name.toLowerCase().includes(q) ||
              outlet.city.toLowerCase().includes(q)
            );
          })
          .map((member) => ({
            member,
            entry: activeEntryByStaff.get(member.id)!,
          }));

        return {
          outlet,
          totalBranchStaff: branchStaff.length,
          activeMembers,
          totalOnDutyCount: branchStaff.filter((m) => activeEntryByStaff.has(m.id)).length,
        };
      })
      .filter((group) => group.activeMembers.length > 0)
      .sort((a, b) => b.activeMembers.length - a.activeMembers.length);
  }, [outlets, selectedOutletId, staffMembers, activeEntryByStaff, search, statusFilter]);

  const totalActiveCount = React.useMemo(
    () => outletGroups.reduce((sum, g) => sum + g.activeMembers.length, 0),
    [outletGroups]
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter clocked-in staff by name, role, station, or outlet..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5 text-xs">
            {(
              [
                { id: 'active', label: `All Active (${totalActiveCount})` },
                { id: 'clocked_in', label: 'Clocked In' },
                { id: 'break', label: 'On Break' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer',
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {outletGroups.length === 0 ? (
        <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800">
          <CardContent className="py-12 text-center space-y-2">
            <UserCheck className="w-8 h-8 text-slate-300 dark:text-neutral-700 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No staff currently match this active clock-in filter
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clock staff in from the Directory & Live Clocks tab or clear your search filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {outletGroups.map(({ outlet, totalBranchStaff, activeMembers, totalOnDutyCount }) => (
            <Card
              key={outlet.id}
              className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none"
            >
              <CardHeader className="py-3.5 px-4 border-b border-slate-100 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
                      <Store className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="truncate">{outlet.name}</span>
                    </CardTitle>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{outlet.city}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {totalOnDutyCount}/{totalBranchStaff} clocked in
                      </span>
                    </p>
                  </div>

                  {selectedOutletId === 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedOutletId(outlet.id)}
                      className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Focus outlet
                    </button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-slate-100 dark:divide-neutral-800">
                {activeMembers.map(({ member, entry }) => {
                  const workedMins = calcEntryWorkedMinutes(entry, nowMs);
                  const isOnBreak = entry.status === 'On Break';
                  const preset = SHIFT_PRESETS[entry.shiftType];

                  return (
                    <div
                      key={member.id}
                      onClick={() => onSelectStaff(member)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectStaff(member);
                        }
                      }}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {member.name}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {member.role}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-semibold',
                              isOnBreak
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {isOnBreak ? (
                              <Coffee className="w-3 h-3" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {entry.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {member.station || member.department}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {entry.shiftType} ({preset.hoursLabel})
                          </span>
                        </p>
                      </div>

                      <div
                        className="flex items-center justify-between sm:justify-end gap-3 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {formatMinutesAsDuration(workedMins)}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                            In {format(new Date(entry.clockInAt), 'HH:mm')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = toggleBreakStaff(member.id);
                              if (updated) {
                                toast.success(
                                  updated.status === 'Break'
                                    ? `${member.name} started a break`
                                    : `${member.name} resumed shift`
                                );
                              }
                            }}
                            className="h-7 px-2.5 text-[11px] gap-1"
                          >
                            <Coffee className="w-3 h-3" />
                            <span>{isOnBreak ? 'Resume' : 'Break'}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              clockOutStaff(member.id);
                              toast.success(`${member.name} clocked out`);
                            }}
                            className="h-7 px-2.5 text-[11px] gap-1 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Out</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

interface ShiftSchedulerViewProps {
  onSelectStaff: (staff: Staff) => void;
}

export const ShiftSchedulerView: React.FC<ShiftSchedulerViewProps> = ({
  onSelectStaff,
}) => {
  const {
    outlets,
    selectedOutletId,
    staffMembers,
    shiftSchedules,
    assignShiftSchedule,
  } = useDashboard();

  const weekDays = React.useMemo(() => getCurrentWeekDays(), []);
  const [schedulerOutletId, setSchedulerOutletId] = React.useState<string>(() =>
    selectedOutletId !== 'all' ? selectedOutletId : outlets[0]?.id || ''
  );

  React.useEffect(() => {
    if (selectedOutletId !== 'all') {
      setSchedulerOutletId(selectedOutletId);
    } else if (!schedulerOutletId && outlets[0]?.id) {
      setSchedulerOutletId(outlets[0].id);
    }
  }, [selectedOutletId, outlets, schedulerOutletId]);

  const [editingTarget, setEditingTarget] = React.useState<{
    staffId: string;
    date: string;
  } | null>(null);
  const [formStaffId, setFormStaffId] = React.useState('');
  const [formDate, setFormDate] = React.useState(weekDays[0]?.dateKey || '');
  const [formShiftType, setFormShiftType] = React.useState<ScheduleShiftType>('Morning');
  const [formStartTime, setFormStartTime] = React.useState('08:00');
  const [formEndTime, setFormEndTime] = React.useState('16:00');
  const [formNotes, setFormNotes] = React.useState('');

  const branchStaff = React.useMemo(
    () => staffMembers.filter((s) => s.outletId === schedulerOutletId),
    [staffMembers, schedulerOutletId]
  );

  const scheduleLookup = React.useMemo(() => {
    const map = new Map<string, ScheduledShift>();
    shiftSchedules.forEach((s) => {
      map.set(`${s.staffId}::${s.date}`, s);
    });
    return map;
  }, [shiftSchedules]);

  const openEditor = (staffId: string, date: string) => {
    const existing = scheduleLookup.get(`${staffId}::${date}`);
    const defaultType: ScheduleShiftType = existing?.shiftType || 'Morning';
    const preset = SHIFT_PRESETS[defaultType];

    setFormStaffId(staffId);
    setFormDate(date);
    setFormShiftType(defaultType);
    setFormStartTime(existing?.startTime || preset.startTime);
    setFormEndTime(existing?.endTime || preset.endTime);
    setFormNotes(existing?.notes || '');
    setEditingTarget({ staffId, date });
  };

  const handleShiftTypeChange = (nextType: ScheduleShiftType) => {
    setFormShiftType(nextType);
    const preset = SHIFT_PRESETS[nextType];
    setFormStartTime(preset.startTime);
    setFormEndTime(preset.endTime);
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = staffMembers.find((s) => s.id === formStaffId);
    if (!targetMember || !formDate) return;

    assignShiftSchedule({
      staffId: targetMember.id,
      outletId: targetMember.outletId,
      date: formDate,
      shiftType: formShiftType,
      startTime: formStartTime,
      endTime: formEndTime,
      notes: formNotes,
    });
    toast.success(`Updated ${targetMember.name}'s shift for ${formDate}`);
    setEditingTarget(null);
  };

  const activeOutlet = outlets.find((o) => o.id === schedulerOutletId);

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-500" />
                Weekly Shift Roster
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any shift slot to assign or adjust shift timings for{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {activeOutlet ? `${activeOutlet.name} (${activeOutlet.city})` : 'selected branch'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Select branch for shift schedule"
                value={schedulerOutletId}
                onChange={(e) => setSchedulerOutletId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
              >
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.city})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const firstStaff = branchStaff[0];
                  const todayCol = weekDays.find((d) => d.isToday) || weekDays[0];
                  if (firstStaff && todayCol) {
                    openEditor(firstStaff.id, todayCol.dateKey);
                  }
                }}
                disabled={branchStaff.length === 0}
                className="h-9 gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Shift
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-950/60 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 text-left font-semibold w-56">Staff Member</th>
                {weekDays.map((day) => (
                  <th
                    key={day.dateKey}
                    className={cn(
                      'py-3 px-2.5 text-center font-semibold',
                      day.isToday && 'text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-500/10'
                    )}
                  >
                    <div>{day.dayShort}</div>
                    <div className="text-[10px] font-mono font-normal opacity-80">
                      {day.dateShort}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {branchStaff.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => onSelectStaff(member)}
                      className="text-left group cursor-pointer"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors truncate max-w-[200px]">
                        {member.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {member.role} · {member.status}
                      </p>
                    </button>
                  </td>
                  {weekDays.map((day) => {
                    const sched = scheduleLookup.get(`${member.id}::${day.dateKey}`);
                    const shiftType = sched?.shiftType || member.shift;
                    const hoursText =
                      shiftType === 'Off'
                        ? 'Day Off'
                        : sched?.startTime && sched?.endTime
                          ? `${sched.startTime}–${sched.endTime}`
                          : SHIFT_PRESETS[shiftType].hoursLabel;

                    return (
                      <td
                        key={day.dateKey}
                        className={cn(
                          'p-1.5 text-center align-middle',
                          day.isToday && 'bg-orange-50/30 dark:bg-orange-500/5'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openEditor(member.id, day.dateKey)}
                          className={cn(
                            'w-full rounded-lg px-2 py-1.5 text-center transition-colors cursor-pointer border',
                            shiftType === 'Off'
                              ? 'border-dashed border-slate-200 dark:border-neutral-800 text-slate-400 dark:text-slate-500 hover:border-slate-300'
                              : shiftType === 'Morning'
                                ? 'border-blue-200/80 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70'
                                : shiftType === 'Evening'
                                  ? 'border-orange-200/80 dark:border-orange-900/50 bg-orange-50/70 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:bg-orange-100/70'
                                  : 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70'
                          )}
                        >
                          <div className="font-semibold text-[11px]">{shiftType}</div>
                          <div className="font-mono tabular-nums text-[10px] opacity-85">
                            {hoursText}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit / Assign Shift Dialog */}
      <Dialog
        open={!!editingTarget}
        onOpenChange={(open) => !open && setEditingTarget(null)}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Schedule Staff Shift
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update shift slot and working hours for {activeOutlet?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="shift-staff-select" className="text-xs">
                Staff Member
              </Label>
              <select
                id="shift-staff-select"
                value={formStaffId}
                onChange={(e) => setFormStaffId(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 text-xs"
              >
                {branchStaff.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shift-date-select" className="text-xs">
                Date
              </Label>
              <select
                id="shift-date-select"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 text-xs"
              >
                {weekDays.map((day) => (
                  <option key={day.dateKey} value={day.dateKey}>
                    {day.dayShort}, {day.dateShort}
                    {day.isToday ? ' (Today)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 block">
                Shift Slot
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Morning', 'Evening', 'Split', 'Off'] as const).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleShiftTypeChange(slot)}
                    className={cn(
                      'py-2 px-2 rounded-md border text-xs font-medium transition-colors cursor-pointer',
                      formShiftType === slot
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white dark:bg-neutral-950 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {formShiftType !== 'Off' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shift-start" className="text-xs">
                    Start Time
                  </Label>
                  <Input
                    id="shift-start"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="font-mono h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-end" className="text-xs">
                    End Time
                  </Label>
                  <Input
                    id="shift-end"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="font-mono h-9 text-xs"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="shift-notes" className="text-xs">
                Station / Handover Notes (optional)
              </Label>
              <Input
                id="shift-notes"
                type="text"
                placeholder="e.g. Opening espresso bar setup"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Save Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
