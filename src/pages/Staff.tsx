/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { format } from 'date-fns';
import { getStaffActivity } from '@/lib/mock-data';
import { DataTable } from '@/components/common/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Staff, StaffActivity, StaffRole, TimeEntry } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserCircle,
  Shield,
  User,
  Clock,
  ChefHat,
  Flame,
  UtensilsCrossed,
  Users,
  CheckCircle2,
  MapPin,
  LogIn,
  LogOut,
  Coffee,
  CalendarClock,
  Store,
  Timer,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StaffActivityTimeline } from '@/components/dashboard/StaffActivityTimeline';
import {
  ClockedInMonitorView,
  ShiftSchedulerView,
} from '@/components/staff/ShiftTimeTrackingModule';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';
import {
  calcEntryWorkedMinutes,
  formatMinutesAsDuration,
  SHIFT_PRESETS,
} from '@/lib/shift-tracking';
import { toast } from 'sonner';

type StaffPageView = 'directory' | 'clocked_in' | 'scheduler';
type DepartmentFilter = 'all' | 'Kitchen' | 'FOH';
type RoleFilter = 'all' | StaffRole;

export const StaffPage: React.FC = () => {
  const {
    selectedOutletId,
    setSelectedOutletId,
    outlets,
    bills,
    dateRange,
    staffMembers,
    shiftSchedules,
    timeEntries,
    clockInStaff,
    clockOutStaff,
    toggleBreakStaff,
  } = useDashboard();

  const [activeView, setActiveView] = React.useState<StaffPageView>('directory');
  const [selectedStaffId, setSelectedStaffId] = React.useState<string | null>(null);
  const [activities, setActivities] = React.useState<StaffActivity[]>([]);
  const [departmentFilter, setDepartmentFilter] = React.useState<DepartmentFilter>('all');
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all');
  const [statusQuickFilter, setStatusQuickFilter] = React.useState<'all' | 'active'>('all');
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  // Tick elapsed shift durations every 30s
  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const selectedStaff = React.useMemo(
    () => (selectedStaffId ? staffMembers.find((s) => s.id === selectedStaffId) || null : null),
    [selectedStaffId, staffMembers]
  );

  React.useEffect(() => {
    if (selectedStaff) {
      const staffActivities = getStaffActivity(selectedStaff.id, 30);
      setActivities(staffActivities);
    } else {
      setActivities([]);
    }
  }, [selectedStaff]);

  const outletStaff = React.useMemo(() => {
    if (selectedOutletId === 'all') return staffMembers;
    return staffMembers.filter((s) => s.outletId === selectedOutletId);
  }, [selectedOutletId, staffMembers]);

  const activeTimeEntryByStaff = React.useMemo(() => {
    const map = new Map<string, TimeEntry>();
    timeEntries.forEach((entry) => {
      if (entry.status !== 'Clocked Out') {
        map.set(entry.staffId, entry);
      }
    });
    return map;
  }, [timeEntries]);

  const filteredStaff = React.useMemo(() => {
    return outletStaff.filter((s) => {
      if (departmentFilter === 'Kitchen' && s.department !== 'Kitchen') return false;
      if (departmentFilter === 'FOH' && s.department === 'Kitchen') return false;
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (statusQuickFilter === 'active' && s.status === 'Off Duty') return false;
      return true;
    });
  }, [outletStaff, departmentFilter, roleFilter, statusQuickFilter]);

  const summary = React.useMemo(() => {
    const kitchenMembers = outletStaff.filter((s) => s.department === 'Kitchen');
    const clockedInCount = outletStaff.filter((s) => s.status === 'On Duty').length;
    const onBreakCount = outletStaff.filter((s) => s.status === 'Break').length;
    const activeOutletIds = new Set(
      outletStaff.filter((s) => s.status !== 'Off Duty').map((s) => s.outletId)
    );

    const visibleStaffIds = new Set(outletStaff.map((s) => s.id));
    const totalMinutesLogged = timeEntries
      .filter((entry) => visibleStaffIds.has(entry.staffId))
      .reduce((sum, entry) => sum + calcEntryWorkedMinutes(entry, nowMs), 0);

    return {
      total: outletStaff.length,
      kitchenTotal: kitchenMembers.length,
      fohTotal: outletStaff.length - kitchenMembers.length,
      clockedInCount,
      onBreakCount,
      activeNowTotal: clockedInCount + onBreakCount,
      activeOutletsCount: activeOutletIds.size,
      totalHoursLogged: Math.round((totalMinutesLogged / 60) * 10) / 10,
    };
  }, [outletStaff, timeEntries, nowMs]);

  const crossOutletPresence = React.useMemo(() => {
    return outlets
      .map((outlet) => {
        const branchStaff = staffMembers.filter((s) => s.outletId === outlet.id);
        const activeMembers = branchStaff.filter((s) => s.status !== 'Off Duty');
        const onBreak = branchStaff.filter((s) => s.status === 'Break').length;
        return {
          outlet,
          activeCount: activeMembers.length,
          totalCount: branchStaff.length,
          onBreak,
          namesPreview: activeMembers
            .slice(0, 3)
            .map((m) => m.name.replace(/^(Manager|Cashier|Waiter)\s+.*$/, '$1'))
            .join(', '),
        };
      })
      .filter((row) => row.activeCount > 0)
      .sort((a, b) => b.activeCount - a.activeCount);
  }, [outlets, staffMembers]);

  const getOutletLabel = React.useCallback(
    (outletId: string) => {
      const outlet = outlets.find((o) => o.id === outletId);
      return outlet ? `${outlet.name} (${outlet.city})` : outletId;
    },
    [outlets]
  );

  const staffMetrics = React.useMemo(() => {
    const byStaff = new Map<string, { orders: number; sales: number }>();
    const byOutletKitchen = new Map<string, { kots: number; items: number }>();

    bills.forEach((b) => {
      if (b.status === 'Cancelled') return;
      const sEntry = byStaff.get(b.staffId) || { orders: 0, sales: 0 };
      sEntry.orders += 1;
      sEntry.sales += b.total;
      byStaff.set(b.staffId, sEntry);

      const kEntry = byOutletKitchen.get(b.outletId) || { kots: 0, items: 0 };
      kEntry.kots += 1;
      kEntry.items += b.items.reduce((sum, i) => sum + i.qty, 0);
      byOutletKitchen.set(b.outletId, kEntry);
    });

    return { byStaff, byOutletKitchen };
  }, [bills]);

  const getRoleBadge = (role: StaffRole) => {
    switch (role) {
      case 'Owner':
        return {
          icon: <Shield className="w-3 h-3 text-orange-600" />,
          classes: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30',
        };
      case 'Manager':
        return {
          icon: <Shield className="w-3 h-3 text-blue-600" />,
          classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
        };
      case 'Head Chef':
        return {
          icon: <ChefHat className="w-3.5 h-3.5 text-amber-600" />,
          classes: 'bg-amber-50 text-amber-800 border-amber-200 font-medium dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
        };
      case 'Chef':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-rose-600" />,
          classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
        };
      case 'Kitchen Team':
        return {
          icon: <UtensilsCrossed className="w-3 h-3 text-teal-600" />,
          classes: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30',
        };
      default:
        return {
          icon: <User className="w-3 h-3 text-slate-500" />,
          classes: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700',
        };
    }
  };

  const columns: ColumnDef<Staff, any>[] = [
    {
      accessorKey: 'name',
      header: 'Employee Name',
      cell: ({ row }) => {
        const staff = row.original;
        const isKitchen = staff.department === 'Kitchen';
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setSelectedStaffId(staff.id)}
          >
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0',
                staff.role === 'Head Chef'
                  ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300'
                  : isKitchen
                    ? 'bg-orange-50 text-orange-600 group-hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600 dark:bg-neutral-800 dark:text-slate-300'
              )}
            >
              {staff.role === 'Head Chef' ? (
                <ChefHat className="w-5 h-5" />
              ) : staff.role === 'Chef' ? (
                <Flame className="w-4 h-4" />
              ) : staff.role === 'Kitchen Team' ? (
                <UtensilsCrossed className="w-4 h-4" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors block truncate max-w-[200px]">
                {staff.name}
              </span>
              <p className="text-[11px] text-slate-400 font-mono">{staff.id}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.getValue<StaffRole>('role');
        const badge = getRoleBadge(role);
        return (
          <Badge variant="outline" className={cn('font-normal gap-1.5 py-0.5 px-2.5', badge.classes)}>
            {badge.icon}
            {role}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'department',
      header: 'Department & Station',
      cell: ({ row }) => {
        const staff = row.original;
        return (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{staff.department}</p>
            <p className="text-xs text-slate-400">{staff.station || 'General'}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'shift',
      header: 'Shift & Live Clock',
      cell: ({ row }) => {
        const staff = row.original;
        const activeEntry = activeTimeEntryByStaff.get(staff.id);
        const workedMins = activeEntry ? calcEntryWorkedMinutes(activeEntry, nowMs) : 0;

        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                {staff.shift}
              </span>
              <span className="text-slate-300 dark:text-neutral-700">·</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  staff.status === 'On Duty'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : staff.status === 'Break'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {staff.status === 'On Duty' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : staff.status === 'Break' ? (
                  <Coffee className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                {staff.status === 'On Duty' ? 'Clocked In' : staff.status}
              </span>
            </div>
            {activeEntry ? (
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Since {format(new Date(activeEntry.clockInAt), 'HH:mm')} · {formatMinutesAsDuration(workedMins)}
              </p>
            ) : (
              <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                {SHIFT_PRESETS[staff.shift].hoursLabel}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'outletId',
      header: 'Assigned Outlet',
      cell: ({ row }) => {
        const outletId = row.getValue<string>('outletId');
        return (
          <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[200px]">{getOutletLabel(outletId)}</span>
          </div>
        );
      },
    },
    {
      id: 'periodPerformance',
      header: 'Period Activity',
      cell: ({ row }) => {
        const staff = row.original;
        if (staff.department === 'Kitchen') {
          const km = staffMetrics.byOutletKitchen.get(staff.outletId);
          return (
            <div className="text-xs">
              <p className="font-mono font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                {km?.kots || 0} KOTs
              </p>
              <p className="text-slate-400 font-mono tabular-nums">{km?.items || 0} dishes</p>
            </div>
          );
        }
        const sm = staffMetrics.byStaff.get(staff.id);
        return (
          <div className="text-xs">
            <p className="font-mono font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatCurrency(sm?.sales || 0)}
            </p>
            <p className="text-slate-400 font-mono tabular-nums">{sm?.orders || 0} bills</p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Time Clock',
      cell: ({ row }) => {
        const staff = row.original;
        const isOffDuty = staff.status === 'Off Duty';
        const isBreak = staff.status === 'Break';
        return (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {isOffDuty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  clockInStaff(staff.id);
                  toast.success(`${staff.name} clocked in`);
                }}
                className="h-7 px-2.5 text-[11px] gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <LogIn className="w-3 h-3" />
                Clock In
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const updated = toggleBreakStaff(staff.id);
                    if (updated) {
                      toast.success(
                        updated.status === 'Break'
                          ? `${staff.name} started break`
                          : `${staff.name} resumed shift`
                      );
                    }
                  }}
                  className="h-7 px-2 text-[11px] gap-1"
                  title={isBreak ? 'Resume shift' : 'Start break'}
                >
                  <Coffee className="w-3 h-3" />
                  <span>{isBreak ? 'Resume' : 'Break'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clockOutStaff(staff.id);
                    toast.success(`${staff.name} clocked out`);
                  }}
                  className="h-7 px-2 text-[11px] gap-1 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Clock out"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Out</span>
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const handleDepartmentChange = (value: string) => {
    const nextDept = value as DepartmentFilter;
    setDepartmentFilter(nextDept);
    setRoleFilter('all');
  };

  const selectedStaffActiveEntry = selectedStaff
    ? activeTimeEntryByStaff.get(selectedStaff.id) || null
    : null;
  const selectedStaffTimeHistory = React.useMemo(() => {
    if (!selectedStaff) return [];
    return timeEntries
      .filter((e) => e.staffId === selectedStaff.id)
      .sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime())
      .slice(0, 5);
  }, [selectedStaff, timeEntries]);

  const selectedStaffTodaySchedule = React.useMemo(() => {
    if (!selectedStaff) return null;
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    return (
      shiftSchedules.find((s) => s.staffId === selectedStaff.id && s.date === todayKey) || null
    );
  }, [selectedStaff, shiftSchedules]);

  return (
    <div className="space-y-6">
      {/* Page Header & Top-Level Module Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Staff, Shifts & Time Tracking
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Live attendance across outlets, shift scheduling, and kitchen telemetry ·{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {formatDateRangeLabel(dateRange.from, dateRange.to)}
            </span>
          </p>
        </div>

        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as StaffPageView)}>
          <TabsList className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 h-10 p-1">
            <TabsTrigger value="directory" className="text-xs px-3 gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Directory & Clocks ({summary.total})
            </TabsTrigger>
            <TabsTrigger value="clocked_in" className="text-xs px-3 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Clocked-In Monitor ({summary.activeNowTotal})
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="text-xs px-3 gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-orange-500" />
              Shift Scheduler
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Live Attendance & Workforce Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Clocked In Now
              </p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {summary.clockedInCount}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  / {summary.total} staff
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Outlets With Active Staff
              </p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {summary.activeOutletsCount}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  {selectedOutletId === 'all' ? `of ${outlets.length} branches` : 'selected'}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">On Break</p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {summary.onBreakCount}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  currently paused
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Hours Logged Today
              </p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {summary.totalHoursLogged.toFixed(1)}h
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeView === 'clocked_in' ? (
        <ClockedInMonitorView onSelectStaff={(member) => setSelectedStaffId(member.id)} />
      ) : activeView === 'scheduler' ? (
        <ShiftSchedulerView onSelectStaff={(member) => setSelectedStaffId(member.id)} />
      ) : (
        <>
          {/* Cross-Outlet Clocked-In Quick Overview */}
          <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Currently Clocked In Across Outlets
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any branch to filter or switch to the Clocked-In Monitor for live shift timers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('clocked_in')}
                  className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                >
                  Open full Clocked-In Monitor →
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {crossOutletPresence.slice(0, 12).map(({ outlet, activeCount, totalCount, onBreak }) => {
                  const isFocused = selectedOutletId === outlet.id;
                  return (
                    <button
                      key={outlet.id}
                      type="button"
                      onClick={() =>
                        setSelectedOutletId(isFocused ? 'all' : outlet.id)
                      }
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer',
                        isFocused
                          ? 'bg-orange-50 dark:bg-orange-500/15 border-orange-300 dark:border-orange-500/40 text-orange-700 dark:text-orange-300 font-semibold'
                          : 'bg-slate-50/70 dark:bg-neutral-800/50 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:border-orange-300'
                      )}
                    >
                      <span className="truncate max-w-[190px]">{outlet.name}</span>
                      <span className="font-mono tabular-nums text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {activeCount}/{totalCount}
                      </span>
                      {onBreak > 0 && (
                        <span className="font-mono tabular-nums text-[10px] text-amber-600 dark:text-amber-400">
                          ({onBreak} brk)
                        </span>
                      )}
                    </button>
                  );
                })}
                {crossOutletPresence.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setActiveView('clocked_in')}
                    className="px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-neutral-700 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    +{crossOutletPresence.length - 12} more branches
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Department, Role & Clocked-In Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                Role:
              </span>
              {(['all', 'Head Chef', 'Chef', 'Kitchen Team', 'Manager', 'Cashier'] as const).map(
                (role) => (
                  <Button
                    key={role}
                    variant={roleFilter === role ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoleFilter(role)}
                    className={cn(
                      'h-7 text-xs',
                      roleFilter === role
                        ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
                        : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50'
                    )}
                  >
                    {role === 'all' ? 'All Roles' : role}
                  </Button>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusQuickFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                    statusQuickFilter === 'all'
                      ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  All Statuses
                </button>
                <button
                  type="button"
                  onClick={() => setStatusQuickFilter('active')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                    statusQuickFilter === 'active'
                      ? 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  Clocked In Only ({summary.activeNowTotal})
                </button>
              </div>

              <Tabs value={departmentFilter} onValueChange={handleDepartmentChange}>
                <TabsList className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 h-8">
                  <TabsTrigger value="all" className="text-xs px-2.5">
                    All ({summary.total})
                  </TabsTrigger>
                  <TabsTrigger value="Kitchen" className="text-xs px-2.5">
                    Kitchen ({summary.kitchenTotal})
                  </TabsTrigger>
                  <TabsTrigger value="FOH" className="text-xs px-2.5">
                    FOH ({summary.fohTotal})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
            <DataTable
              columns={columns}
              data={filteredStaff}
              searchPlaceholder="Search by name, role, station, or outlet..."
              onRowClick={(staff) => setSelectedStaffId(staff.id)}
            />
          </div>
        </>
      )}

      {/* Staff Detail, Live Time-Clock & Activity Timeline Sheet */}
      <Sheet open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaffId(null)}>
        <SheetContent className="w-full sm:max-w-lg p-0 bg-white dark:bg-neutral-900 flex flex-col">
          <SheetHeader className="p-6 border-b border-slate-100 dark:border-neutral-800 shrink-0">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                  selectedStaff?.department === 'Kitchen'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400'
                )}
              >
                {selectedStaff?.role === 'Head Chef' ? (
                  <ChefHat className="w-7 h-7" />
                ) : selectedStaff?.role === 'Chef' ? (
                  <Flame className="w-6 h-6" />
                ) : selectedStaff?.role === 'Kitchen Team' ? (
                  <UtensilsCrossed className="w-6 h-6" />
                ) : (
                  <UserCircle className="w-7 h-7" />
                )}
              </div>
              <div className="text-left min-w-0">
                <SheetTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {selectedStaff?.name}
                </SheetTitle>
                <SheetDescription className="text-xs font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-slate-700 dark:text-slate-200">{selectedStaff?.role}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedStaff?.station}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedStaff ? getOutletLabel(selectedStaff.outletId) : ''}</span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Live Time-Clock Control & Today's Shift */}
          {selectedStaff && (
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/60 space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Live Time-Clock Status
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        selectedStaff.status === 'On Duty'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : selectedStaff.status === 'Break'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-400'
                      )}
                    >
                      {selectedStaff.status === 'On Duty'
                        ? 'Clocked In'
                        : selectedStaff.status}
                    </span>
                    {selectedStaffActiveEntry && (
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        · {formatMinutesAsDuration(calcEntryWorkedMinutes(selectedStaffActiveEntry, nowMs))} elapsed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedStaff.status === 'Off Duty' ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        clockInStaff(selectedStaff.id);
                        toast.success(`${selectedStaff.name} clocked in`);
                      }}
                      className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Clock In
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = toggleBreakStaff(selectedStaff.id);
                          if (updated) {
                            toast.success(
                              updated.status === 'Break'
                                ? `${selectedStaff.name} started break`
                                : `${selectedStaff.name} resumed shift`
                            );
                          }
                        }}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        {selectedStaff.status === 'Break' ? 'Resume' : 'Break'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clockOutStaff(selectedStaff.id);
                          toast.success(`${selectedStaff.name} clocked out`);
                        }}
                        className="h-8 gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Clock Out
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/70 dark:border-neutral-800">
                <span>
                  Today's Shift:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {selectedStaffTodaySchedule?.shiftType || selectedStaff.shift}
                  </strong>{' '}
                  (
                  {selectedStaffTodaySchedule?.shiftType === 'Off'
                    ? 'Day Off'
                    : selectedStaffTodaySchedule?.startTime && selectedStaffTodaySchedule?.endTime
                      ? `${selectedStaffTodaySchedule.startTime}–${selectedStaffTodaySchedule.endTime}`
                      : SHIFT_PRESETS[selectedStaff.shift].hoursLabel}
                  )
                </span>
                {selectedStaffTimeHistory.length > 0 && (
                  <span className="font-mono tabular-nums">
                    {selectedStaffTimeHistory.length} recent punch(es)
                  </span>
                )}
              </div>

              {selectedStaffTimeHistory.length > 0 && (
                <div className="space-y-1 pt-1">
                  {selectedStaffTimeHistory.slice(0, 3).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300"
                    >
                      <span>
                        {format(new Date(entry.clockInAt), 'dd MMM · HH:mm')}
                        {' → '}
                        {entry.clockOutAt
                          ? format(new Date(entry.clockOutAt), 'HH:mm')
                          : 'Active'}
                      </span>
                      <span className="text-slate-500">
                        {formatMinutesAsDuration(calcEntryWorkedMinutes(entry, nowMs))}
                        {entry.totalBreakMinutes > 0 ? ` (${entry.totalBreakMinutes}m brk)` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-3.5 bg-slate-50/50 dark:bg-neutral-950/30 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                {selectedStaff?.department === 'Kitchen'
                  ? 'Kitchen & KDS Timeline'
                  : 'Activity Timeline'}
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {activities.length} Events
              </span>
            </div>

            <ScrollArea className="flex-1 px-6 py-6">
              <StaffActivityTimeline activities={activities} />
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
