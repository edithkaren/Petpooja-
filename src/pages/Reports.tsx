/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  FileText,
  Users,
  Package,
  CreditCard,
  ChevronRight,
  Star,
  Search,
  Boxes,
  Clock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ReportId,
  ReportMeta,
  ReportTimeframe,
  ReportViewer,
} from "@/components/reports/ReportViewer";
import { useDashboard } from "@/hooks/use-dashboard";
import { endOfDay, isSameDay, startOfDay, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface ReportGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  reports: ReportMeta[];
}

interface ScheduledReport {
  id: string;
  reportName: string;
  frequency: "Daily" | "Weekly" | "Monthly";
  time: string;
  channel: "Email" | "WhatsApp" | "Email + WhatsApp";
  recipient: string;
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "sales",
    title: "Sales Reports",
    icon: TrendingUp,
    reports: [
      {
        id: "daily-sales",
        name: "Daily Sales Summary",
        desc: "Net sales, discounts, GST, and bills count per day",
        group: "Sales Reports",
      },
      {
        id: "outlet-comp",
        name: "Outlet Comparison",
        desc: "Revenue & order performance across all outlets",
        group: "Sales Reports",
        isFavorite: true,
      },
      {
        id: "hourly-sales",
        name: "Hourly Sales Trend",
        desc: "Peak hour analysis from 08:00 to 23:00",
        group: "Sales Reports",
      },
      {
        id: "order-type",
        name: "Sales by Order Type",
        desc: "Dine-in vs Takeaway vs Online (Swiggy, Zomato, Magicpin)",
        group: "Sales Reports",
      },
    ],
  },
  {
    id: "items",
    title: "Item Reports",
    icon: Package,
    reports: [
      {
        id: "top-items",
        name: "Top Selling Items",
        desc: "Best movers ranked by revenue and units sold",
        group: "Item Reports",
        isFavorite: true,
      },
      {
        id: "slow-items",
        name: "Slow Moving Items",
        desc: "Low-demand menu items needing promos or pruning",
        group: "Item Reports",
      },
      {
        id: "cat-sales",
        name: "Sales by Category",
        desc: "Revenue breakdown by menu category",
        group: "Item Reports",
      },
    ],
  },
  {
    id: "financial",
    title: "Financial Reports",
    icon: CreditCard,
    reports: [
      {
        id: "pm-split",
        name: "Payment Mode Split",
        desc: "UPI vs Card vs Cash vs Wallet settlement breakdown",
        group: "Financial Reports",
      },
      {
        id: "tax-summary",
        name: "Tax Report (GST)",
        desc: "Taxable turnover and CGST / SGST collected",
        group: "Financial Reports",
      },
      {
        id: "discounts",
        name: "Discount Audit",
        desc: "Breakdown of discounts offered across outlets",
        group: "Financial Reports",
      },
    ],
  },
  {
    id: "staff-cust",
    title: "Staff & Customers",
    icon: Users,
    reports: [
      {
        id: "staff-perf",
        name: "Staff Performance",
        desc: "Sales, bills handled, and cancellations by cashier/manager",
        group: "Staff & Customers",
      },
      {
        id: "cust-loyalty",
        name: "Customer Loyalty",
        desc: "VIP, Repeat, New, and Lapsed customer spend trends",
        group: "Staff & Customers",
      },
    ],
  },
  {
    id: "inventory",
    title: "Inventory & Operations",
    icon: Boxes,
    reports: [
      {
        id: "low-stock",
        name: "Low Stock & Reorder Alerts",
        desc: "Items below reorder point across all outlet kitchens",
        group: "Inventory & Operations",
        isFavorite: true,
      },
      {
        id: "stock-transfers",
        name: "Inter-Outlet Stock Transfers",
        desc: "Audit log of stock moved between source and destination outlets",
        group: "Inventory & Operations",
      },
    ],
  },
];

const ALL_REPORTS: ReportMeta[] = REPORT_GROUPS.flatMap((g) => g.reports);

export const Reports: React.FC = () => {
  const { outlets, selectedOutletId, dateRange, setDateRange } = useDashboard();
  const [selectedReportId, setSelectedReportId] = React.useState<ReportId | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const timeframe: ReportTimeframe = React.useMemo(() => {
    const now = new Date();
    if (isSameDay(dateRange.from, now) && isSameDay(dateRange.to, now)) return "today";
    if (isSameDay(dateRange.from, subDays(now, 6)) && isSameDay(dateRange.to, now)) return "7d";
    if (isSameDay(dateRange.from, subDays(now, 29)) && isSameDay(dateRange.to, now)) return "30d";
    if (isSameDay(dateRange.from, subDays(now, 89)) && isSameDay(dateRange.to, now)) return "90d";
    return "custom";
  }, [dateRange.from, dateRange.to]);

  const handleTimeframeChange = React.useCallback(
    (tf: ReportTimeframe) => {
      if (tf === "custom") return;
      const now = new Date();
      const daysBack = tf === "today" ? 0 : tf === "7d" ? 6 : tf === "30d" ? 29 : 89;
      setDateRange({
        from: startOfDay(subDays(now, daysBack)),
        to: endOfDay(now),
      });
    },
    [setDateRange]
  );
  const [groupFilter, setGroupFilter] = React.useState<string>("all");
  const [favoriteIds, setFavoriteIds] = React.useState<Set<ReportId>>(
    () => new Set(ALL_REPORTS.filter((r) => r.isFavorite).map((r) => r.id))
  );

  // Schedule Report Modal state
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [schedReportId, setSchedReportId] = React.useState<ReportId>("daily-sales");
  const [schedFreq, setSchedFreq] = React.useState<"Daily" | "Weekly" | "Monthly">("Daily");
  const [schedTime, setSchedTime] = React.useState("23:30");
  const [schedChannel, setSchedChannel] = React.useState<"Email" | "WhatsApp" | "Email + WhatsApp">("Email + WhatsApp");
  const [schedRecipient, setSchedRecipient] = React.useState("ops@tinkuscafe.in");
  const [schedules, setSchedules] = React.useState<ScheduledReport[]>([
    {
      id: "sch-1",
      reportName: "Daily Sales Summary",
      frequency: "Daily",
      time: "23:30",
      channel: "Email + WhatsApp",
      recipient: "owners@tinkuscafe.in",
    },
  ]);

  const toggleFavorite = (e: React.MouseEvent, id: ReportId) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenEodSetup = () => {
    setSchedReportId("daily-sales");
    setSchedFreq("Daily");
    setSchedTime("23:30");
    setSchedChannel("Email + WhatsApp");
    setScheduleOpen(true);
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const reportMeta = ALL_REPORTS.find((r) => r.id === schedReportId);
    if (!reportMeta || !schedRecipient.trim()) {
      toast.error("Please provide a recipient for the scheduled report.");
      return;
    }
    const newSched: ScheduledReport = {
      id: `sch-${Date.now()}`,
      reportName: reportMeta.name,
      frequency: schedFreq,
      time: schedTime,
      channel: schedChannel,
      recipient: schedRecipient.trim(),
    };
    setSchedules((prev) => [newSched, ...prev]);
    toast.success(`Scheduled "${reportMeta.name}" (${schedFreq} at ${schedTime}) via ${schedChannel}.`);
    setScheduleOpen(false);
  };

  const selectedReport = React.useMemo(
    () => ALL_REPORTS.find((r) => r.id === selectedReportId) || null,
    [selectedReportId]
  );

  const visibleGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return REPORT_GROUPS.map((group) => {
      if (groupFilter !== "all" && groupFilter !== "favorites" && group.id !== groupFilter) {
        return null;
      }
      const filteredReports = group.reports.filter((r) => {
        if (groupFilter === "favorites" && !favoriteIds.has(r.id)) return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          group.title.toLowerCase().includes(q)
        );
      });
      if (filteredReports.length === 0) return null;
      return { ...group, reports: filteredReports };
    }).filter((g): g is ReportGroup => g !== null);
  }, [groupFilter, searchQuery, favoriteIds]);

  const activeScopeName =
    selectedOutletId === "all"
      ? `All ${outlets.length} Outlets`
      : outlets.find((o) => o.id === selectedOutletId)?.name || "Selected Outlet";

  if (selectedReport) {
    return (
      <ReportViewer
        report={selectedReport}
        allReports={ALL_REPORTS}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        onSelectReport={(id) => setSelectedReportId(id)}
        onBack={() => setSelectedReportId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight">Analytics & Reports</h2>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              {ALL_REPORTS.length} Live Views Ready
            </Badge>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Click any report to view interactive charts, detailed tables, and CSV exports · Scope:{" "}
            <span className="font-medium text-slate-700">{activeScopeName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(
              [
                { id: "today", label: "Today" },
                { id: "7d", label: "7D" },
                { id: "30d", label: "30D" },
                { id: "90d", label: "90D" },
              ] as Array<{ id: ReportTimeframe; label: string }>
            ).map((tf) => (
              <Button
                key={tf.id}
                type="button"
                variant={timeframe === tf.id ? "default" : "ghost"}
                size="sm"
                onClick={() => handleTimeframeChange(tf.id)}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  timeframe === tf.id
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "text-slate-600"
                )}
              >
                {tf.label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setScheduleOpen(true)}
          >
            <FileText className="w-4 h-4" /> Schedule Report
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
        <Tabs value={groupFilter} onValueChange={setGroupFilter}>
          <TabsList className="bg-slate-100 flex-wrap h-auto">
            <TabsTrigger value="all" className="text-xs">
              All ({ALL_REPORTS.length})
            </TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
              Favorites ({favoriteIds.size})
            </TabsTrigger>
            {REPORT_GROUPS.map((g) => (
              <TabsTrigger key={g.id} value={g.id} className="text-xs">
                {g.title.replace(" Reports", "")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full lg:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Report Groups Grid */}
      {visibleGroups.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-10 text-center text-sm text-slate-500">
            No reports match your current filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {visibleGroups.map((group) => (
            <div key={group.id} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <group.icon className="w-5 h-5 text-orange-500" />
                  <h3>{group.title}</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {group.reports.length} views
                </span>
              </div>
              <div className="grid gap-3">
                {group.reports.map((report) => {
                  const isFav = favoriteIds.has(report.id);
                  return (
                    <Card
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className="hover:border-orange-300 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-orange-50 transition-colors shrink-0">
                            <BarChart3 className="w-5 h-5 text-slate-400 group-hover:text-orange-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 truncate">{report.name}</p>
                              <button
                                type="button"
                                onClick={(e) => toggleFavorite(e, report.id)}
                                className="p-0.5 rounded hover:bg-slate-100"
                                aria-label={isFav ? `Remove ${report.name} from favorites` : `Favorite ${report.name}`}
                              >
                                <Star
                                  className={cn(
                                    "w-3.5 h-3.5 transition-colors",
                                    isFav
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-slate-300 hover:text-amber-400"
                                  )}
                                />
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{report.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="text-[11px] font-medium text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Open View
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Scheduled Deliveries + EOD CTA */}
      <Card className="bg-slate-900 text-white border-none overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <TrendingUp className="w-32 h-32" />
        </div>
        <CardContent className="p-8 relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none mb-3">
              Automated Delivery
            </Badge>
            <h3 className="text-2xl font-bold mb-2">Automated End-of-Day (EOD) Reports</h3>
            <p className="text-slate-400 max-w-lg mb-5 text-sm">
              Schedule any of the {ALL_REPORTS.length} live reports for automatic daily, weekly, or monthly delivery via Email & WhatsApp.
            </p>
            <Button
              type="button"
              onClick={handleOpenEodSetup}
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              Setup EOD Reports
            </Button>
          </div>

          {schedules.length > 0 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 min-w-72 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                Active Schedules ({schedules.length})
              </p>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {schedules.map((sch) => (
                  <div
                    key={sch.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {sch.reportName}
                      </p>
                      <p className="text-slate-400 truncate">
                        {sch.frequency} @ {sch.time} · {sch.channel} ({sch.recipient})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSchedules((prev) => prev.filter((item) => item.id !== sch.id));
                        toast.info(`Removed schedule for ${sch.reportName}.`);
                      }}
                      className="text-slate-400 hover:text-rose-400 shrink-0"
                      aria-label={`Delete schedule for ${sch.reportName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Report Modal */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Automated Report</DialogTitle>
            <DialogDescription>
              Configure recurring delivery for any report view across your selected outlets.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchedule} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sched-report" className="text-xs font-semibold">
                Report
              </Label>
              <select
                id="sched-report"
                value={schedReportId}
                onChange={(e) => setSchedReportId(e.target.value as ReportId)}
                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-orange-400"
              >
                {ALL_REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.group} — {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sched-freq" className="text-xs font-semibold">
                  Frequency
                </Label>
                <select
                  id="sched-freq"
                  value={schedFreq}
                  onChange={(e) => setSchedFreq(e.target.value as "Daily" | "Weekly" | "Monthly")}
                  className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-orange-400"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-time" className="text-xs font-semibold">
                  Delivery Time
                </Label>
                <Input
                  id="sched-time"
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sched-channel" className="text-xs font-semibold">
                Delivery Channel
              </Label>
              <select
                id="sched-channel"
                value={schedChannel}
                onChange={(e) =>
                  setSchedChannel(e.target.value as "Email" | "WhatsApp" | "Email + WhatsApp")
                }
                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-orange-400"
              >
                <option value="Email + WhatsApp">Email + WhatsApp</option>
                <option value="Email">Email</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sched-recipient" className="text-xs font-semibold">
                Recipient Email / Phone
              </Label>
              <Input
                id="sched-recipient"
                type="text"
                value={schedRecipient}
                onChange={(e) => setSchedRecipient(e.target.value)}
                placeholder="owners@tinkuscafe.in"
                className="h-9"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white">
                Save Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
