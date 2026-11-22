/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  History,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isWithinInterval } from "date-fns";

import { useDashboard } from "@/hooks/use-dashboard";
import { ITEMS } from "@/lib/mock-data";
import { StockItem, StockTransfer } from "@/types";
import { DataTable } from "@/components/common/DataTable";
import { formatDateRangeLabel } from "@/components/common/DateRangePicker";
import { StockTransferForm } from "@/components/inventory/StockTransferForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StockFilter = "all" | "below-reorder" | "healthy";
type InventoryView = "levels" | "transfers";

interface TransferModalPreset {
  itemName?: string;
  fromOutletId?: string;
  toOutletId?: string;
}

function isCriticalStock(item: StockItem): boolean {
  return (
    item.onHand < item.reorderLevel &&
    item.onHand <= Math.max(1, Math.floor(item.reorderLevel / 2))
  );
}

export const Inventory: React.FC = () => {
  const {
    outlets,
    selectedOutletId,
    setSelectedOutletId,
    dateRange,
    bills,
    stockItems,
    stockTransfers,
    restockStockItem,
    fulfillPurchaseOrder,
    setGlobalReorderPoint,
    adjustItemReorderPoint,
    resetInventory,
  } = useDashboard();

  const [activeView, setActiveView] = React.useState<InventoryView>("levels");
  const [globalReorderInput, setGlobalReorderInput] = React.useState<string>("10");
  const [activeFilter, setActiveFilter] = React.useState<StockFilter>("all");
  const [transferModalOpen, setTransferModalOpen] = React.useState(false);
  const [transferPreset, setTransferPreset] = React.useState<TransferModalPreset>({});

  const outletNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    outlets.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [outlets]);

  const usageByStockId = React.useMemo(() => {
    const itemIdToStockId = new Map<string, string>();
    ITEMS.forEach((item) => itemIdToStockId.set(item.id, item.stockItemId));
    const map = new Map<string, number>();
    bills.forEach((bill) => {
      if (bill.status === "Cancelled") return;
      bill.items.forEach((bi) => {
        const baseStockId = itemIdToStockId.get(bi.itemId);
        if (!baseStockId) return;
        const fullKey = `${bill.outletId}::${baseStockId}`;
        map.set(fullKey, (map.get(fullKey) || 0) + bi.qty * 0.25);
      });
    });
    return map;
  }, [bills]);

  const outletScopedItems = React.useMemo(() => {
    if (selectedOutletId === "all") return stockItems;
    return stockItems.filter((item) => item.outletId === selectedOutletId);
  }, [stockItems, selectedOutletId]);

  const outletScopedTransfers = React.useMemo(() => {
    return stockTransfers.filter((t) => {
      const matchesOutlet =
        selectedOutletId === "all" ||
        t.fromOutletId === selectedOutletId ||
        t.toOutletId === selectedOutletId;
      if (!matchesOutlet) return false;
      return isWithinInterval(new Date(t.transferredAt), {
        start: dateRange.from,
        end: dateRange.to,
      });
    });
  }, [stockTransfers, selectedOutletId, dateRange]);

  const belowReorderItems = React.useMemo(
    () => outletScopedItems.filter((item) => item.onHand < item.reorderLevel),
    [outletScopedItems]
  );

  const criticalItemsCount = React.useMemo(
    () => belowReorderItems.filter(isCriticalStock).length,
    [belowReorderItems]
  );

  const healthyItemsCount = outletScopedItems.length - belowReorderItems.length;

  const totalShortfallUnits = React.useMemo(
    () =>
      belowReorderItems.reduce(
        (sum, item) => sum + Math.max(0, item.reorderLevel - item.onHand),
        0
      ),
    [belowReorderItems]
  );

  const filteredItems = React.useMemo(() => {
    if (activeFilter === "below-reorder") {
      return belowReorderItems;
    }
    if (activeFilter === "healthy") {
      return outletScopedItems.filter((item) => item.onHand >= item.reorderLevel);
    }
    return outletScopedItems;
  }, [outletScopedItems, belowReorderItems, activeFilter]);

  const openTransferForRow = React.useCallback(
    (rowItem: StockItem) => {
      const peers = stockItems.filter(
        (s) => s.name === rowItem.name && s.outletId !== rowItem.outletId
      );

      if (rowItem.onHand < rowItem.reorderLevel) {
        // Low stock row: pre-fill as destination, pick outlet with highest stock as source
        const richestSource = [...peers].sort((a, b) => b.onHand - a.onHand)[0];
        setTransferPreset({
          itemName: rowItem.name,
          fromOutletId: richestSource?.outletId,
          toOutletId: rowItem.outletId,
        });
      } else {
        // Healthy row: pre-fill as source, pick lowest-stock outlet as destination
        const neediestDest = [...peers].sort((a, b) => a.onHand - b.onHand)[0];
        setTransferPreset({
          itemName: rowItem.name,
          fromOutletId: rowItem.outletId,
          toOutletId: neediestDest?.outletId,
        });
      }
      setTransferModalOpen(true);
    },
    [stockItems]
  );

  const openBlankTransfer = React.useCallback(() => {
    setTransferPreset({
      fromOutletId: selectedOutletId !== "all" ? selectedOutletId : undefined,
    });
    setTransferModalOpen(true);
  }, [selectedOutletId]);

  const handleApplyGlobalReorder = React.useCallback(
    (thresholdValue?: number) => {
      const parsed = thresholdValue ?? Number.parseInt(globalReorderInput, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        toast.error("Please enter a valid reorder point (minimum 1).");
        return;
      }
      const clamped = Math.min(100, Math.max(1, parsed));
      setGlobalReorderInput(String(clamped));
      const flagged = setGlobalReorderPoint(clamped, selectedOutletId);
      const scopeLabel =
        selectedOutletId === "all"
          ? "all outlets"
          : outletNameById.get(selectedOutletId) || "selected outlet";
      toast.success(
        `Reorder point set to ${clamped} across ${scopeLabel} (${flagged} item${flagged === 1 ? "" : "s"} flagged).`
      );
    },
    [globalReorderInput, setGlobalReorderPoint, selectedOutletId, outletNameById]
  );

  const handleRestockItem = React.useCallback(
    (item: StockItem) => {
      const res = restockStockItem(item.id);
      if (res) {
        const outletLabel = outletNameById.get(item.outletId) || "outlet";
        toast.success(`Restocked ${res.itemName} at ${outletLabel} (+${res.addedQty} ${res.unit}).`);
      }
    },
    [restockStockItem, outletNameById]
  );

  const handleGeneratePurchaseOrder = React.useCallback(() => {
    const orderedCount = fulfillPurchaseOrder(selectedOutletId);
    if (orderedCount === 0) {
      toast.info("All inventory items in the current view are above their reorder points.");
      return;
    }
    toast.success(
      `Purchase order fulfilled for ${orderedCount} low-stock item${orderedCount === 1 ? "" : "s"}.`
    );
  }, [fulfillPurchaseOrder, selectedOutletId]);

  const handleResetInventory = React.useCallback(() => {
    resetInventory();
    setGlobalReorderInput("10");
    setActiveFilter("all");
    toast.info("Inventory levels, reorder points, and transfer ledger reset to baseline.");
  }, [resetInventory]);

  const columns: ColumnDef<StockItem, unknown>[] = React.useMemo(() => {
    const baseCols: ColumnDef<StockItem, unknown>[] = [
      {
        accessorKey: "name",
        header: "Ingredient / Item",
        cell: ({ row }) => {
          const item = row.original;
          const isLow = item.onHand < item.reorderLevel;
          const deficit = Math.max(0, item.reorderLevel - item.onHand);
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900">{item.name}</span>
              {isLow && (
                <span className="text-xs text-rose-600 font-medium">
                  {deficit} {item.unit} below reorder point
                </span>
              )}
            </div>
          );
        },
      },
    ];

    if (selectedOutletId === "all") {
      baseCols.push({
        accessorKey: "outletId",
        header: "Outlet",
        cell: ({ row }) => {
          const outletName = outletNameById.get(row.original.outletId) || row.original.outletId;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-44">{outletName}</span>
            </span>
          );
        },
      });
    }

    baseCols.push(
      {
        id: "status",
        header: "Reorder Status",
        cell: ({ row }) => {
          const item = row.original;
          const isLow = item.onHand < item.reorderLevel;
          const critical = isCriticalStock(item);

          if (critical) {
            return (
              <Badge
                variant="outline"
                className="bg-rose-100 text-rose-800 border-rose-300 gap-1.5 font-semibold shadow-2xs"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Critical Low
              </Badge>
            );
          }

          if (isLow) {
            return (
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-900 border-amber-300 gap-1.5 font-semibold shadow-2xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Below Reorder
              </Badge>
            );
          }

          return (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              In Stock
            </Badge>
          );
        },
      },
      {
        accessorKey: "onHand",
        header: "On Hand",
        cell: ({ row }) => {
          const item = row.original;
          const isLow = item.onHand < item.reorderLevel;
          const critical = isCriticalStock(item);
          const ratio = Math.min(
            100,
            Math.round((item.onHand / Math.max(1, item.reorderLevel * 2)) * 100)
          );

          return (
            <div className="w-36 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "font-mono tabular-nums font-semibold",
                    critical
                      ? "text-rose-700"
                      : isLow
                        ? "text-amber-800"
                        : "text-slate-900"
                  )}
                >
                  {item.onHand} {item.unit}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  min {item.reorderLevel}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    critical
                      ? "bg-rose-500"
                      : isLow
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  )}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "reorderLevel",
        header: "Reorder Point",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-500 hover:text-slate-900"
                onClick={(e) => {
                  e.stopPropagation();
                  adjustItemReorderPoint(item.id, -1);
                }}
                aria-label={`Decrease reorder point for ${item.name}`}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="min-w-12 text-center font-mono tabular-nums text-xs font-semibold text-slate-700">
                {item.reorderLevel} {item.unit}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-500 hover:text-slate-900"
                onClick={(e) => {
                  e.stopPropagation();
                  adjustItemReorderPoint(item.id, 1);
                }}
                aria-label={`Increase reorder point for ${item.name}`}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          );
        },
      },
      {
        id: "periodUsage",
        header: "Period Usage",
        cell: ({ row }) => {
          const used = usageByStockId.get(row.original.id) || 0;
          return (
            <span className="font-mono tabular-nums text-xs text-slate-600">
              {used > 0 ? `${used.toFixed(1)} ${row.original.unit}` : `0.0 ${row.original.unit}`}
            </span>
          );
        },
      },
      {
        accessorKey: "expiryDate",
        header: "Expiry",
        cell: ({ row }) =>
          row.original.expiryDate
            ? new Date(row.original.expiryDate).toLocaleDateString()
            : "N/A",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const item = row.original;
          const isLow = item.onHand < item.reorderLevel;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openTransferForRow(item);
                }}
                className="h-8 px-2.5 text-xs gap-1.5 border-slate-200 text-slate-700 hover:text-orange-700 hover:border-orange-200 hover:bg-orange-50"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Transfer
              </Button>
              <Button
                type="button"
                variant={isLow ? "default" : "ghost"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestockItem(item);
                }}
                className={cn(
                  isLow
                    ? "bg-orange-500 hover:bg-orange-600 text-white h-8 px-3 text-xs"
                    : "text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-8 px-3 text-xs"
                )}
              >
                {isLow ? "Restock Now" : "Order More"}
              </Button>
            </div>
          );
        },
      }
    );

    return baseCols;
  }, [selectedOutletId, outletNameById, usageByStockId, adjustItemReorderPoint, openTransferForRow, handleRestockItem]);

  const transferColumns: ColumnDef<StockTransfer, unknown>[] = React.useMemo(
    () => [
      {
        accessorKey: "itemName",
        header: "Item Transferred",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900">{t.itemName}</span>
              {t.notes && <span className="text-xs text-slate-500">{t.notes}</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-800 border-orange-200 font-mono tabular-nums font-semibold"
          >
            {row.original.quantity} {row.original.unit}
          </Badge>
        ),
      },
      {
        accessorKey: "fromOutletName",
        header: "Source (Before → After)",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-800">{t.fromOutletName}</span>
              <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-500">
                {t.sourceBefore} {t.unit}
                <ArrowRight className="w-3 h-3 text-rose-500" />
                <span className="font-semibold text-rose-700">
                  {t.sourceAfter} {t.unit}
                </span>
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "toOutletName",
        header: "Destination (Before → After)",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-800">{t.toOutletName}</span>
              <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-500">
                {t.destBefore} {t.unit}
                <ArrowRight className="w-3 h-3 text-emerald-500" />
                <span className="font-semibold text-emerald-700">
                  {t.destAfter} {t.unit}
                </span>
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "transferredAt",
        header: "Recorded",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex flex-col text-xs">
              <span className="text-slate-700 font-medium">
                {formatDistanceToNow(new Date(t.transferredAt), { addSuffix: true })}
              </span>
              <span className="text-slate-400">{t.transferredBy}</span>
            </div>
          );
        },
      },
    ],
    []
  );

  const getRowClassName = React.useCallback((item: StockItem) => {
    if (isCriticalStock(item)) {
      return "bg-rose-50/85 hover:bg-rose-100/75 border-l-4 border-l-rose-500";
    }
    if (item.onHand < item.reorderLevel) {
      return "bg-amber-50/85 hover:bg-amber-100/75 border-l-4 border-l-amber-500";
    }
    return "";
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
          <p className="text-slate-500 text-sm">
            Real-time multi-outlet stock levels, reorder alerts, and transfers · Usage &amp; moves for{" "}
            <span className="font-medium text-slate-700">{formatDateRangeLabel(dateRange.from, dateRange.to)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={openBlankTransfer}
          >
            <ArrowLeftRight className="w-4 h-4 text-orange-600" /> Transfer Stock
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleResetInventory}
          >
            <RotateCcw className="w-4 h-4" /> Reset Baseline
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleGeneratePurchaseOrder}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Purchase Order{belowReorderItems.length > 0 ? ` (${belowReorderItems.length})` : ""}
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          onClick={() => {
            setActiveView("levels");
            setActiveFilter((prev) => (prev === "below-reorder" ? "all" : "below-reorder"));
          }}
          className={cn(
            "cursor-pointer transition-all",
            belowReorderItems.length > 0
              ? "bg-amber-50/90 border-amber-200 hover:border-amber-300"
              : "bg-emerald-50/60 border-emerald-200"
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  belowReorderItems.length > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                )}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  "text-2xl font-bold font-mono tabular-nums",
                  belowReorderItems.length > 0 ? "text-amber-900" : "text-emerald-800"
                )}
              >
                {belowReorderItems.length}
              </span>
            </div>
            <h4
              className={cn(
                "font-semibold",
                belowReorderItems.length > 0 ? "text-amber-950" : "text-emerald-950"
              )}
            >
              Below Reorder Point
            </h4>
            <p
              className={cn(
                "text-xs mt-1",
                belowReorderItems.length > 0 ? "text-amber-800/80" : "text-emerald-700/80"
              )}
            >
              {criticalItemsCount > 0
                ? `${criticalItemsCount} critical low · Click to filter`
                : belowReorderItems.length > 0
                  ? "Click to filter flagged items"
                  : "All items above reorder threshold"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-800">
                {outletScopedItems.length}
              </span>
            </div>
            <h4 className="font-semibold text-slate-900">Tracked Stock Entries</h4>
            <p className="text-xs text-slate-500 mt-1">
              {healthyItemsCount} healthy · {belowReorderItems.length} flagged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold font-mono tabular-nums text-rose-700">
                {totalShortfallUnits} kg
              </span>
            </div>
            <h4 className="font-semibold text-slate-900">Reorder Shortfall</h4>
            <p className="text-xs text-slate-500 mt-1">
              Deficit to restore reorder thresholds
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveView("transfers")}
          className="cursor-pointer transition-all hover:border-orange-200"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold font-mono tabular-nums text-orange-700">
                {outletScopedTransfers.length}
              </span>
            </div>
            <h4 className="font-semibold text-slate-900">Stock Transfers</h4>
            <p className="text-xs text-slate-500 mt-1">
              Inter-outlet moves · Click to open ledger
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Workspace Switcher & Outlet Scope */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <Tabs
          value={activeView}
          onValueChange={(value) => setActiveView(value as InventoryView)}
        >
          <TabsList className="bg-slate-100">
            <TabsTrigger value="levels" className="gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" />
              Inventory Levels
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1.5 text-xs">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Stock Transfers
              <span className="rounded bg-orange-100 px-1.5 py-0.5 font-mono text-[10px] text-orange-800">
                {outletScopedTransfers.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Label htmlFor="inventory-outlet-scope" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Outlet View:
          </Label>
          <select
            id="inventory-outlet-scope"
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-orange-400"
          >
            <option value="all">All Outlets ({outlets.length})</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} ({outlet.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeView === "levels" ? (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <Tabs
              value={activeFilter}
              onValueChange={(value) => setActiveFilter(value as StockFilter)}
            >
              <TabsList className="bg-slate-100">
                <TabsTrigger value="all" className="gap-1.5 text-xs">
                  All Items
                  <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                    {outletScopedItems.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="below-reorder" className="gap-1.5 text-xs">
                  Below Reorder
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px]",
                      belowReorderItems.length > 0
                        ? "bg-amber-200 text-amber-900"
                        : "bg-slate-200/80 text-slate-700"
                    )}
                  >
                    {belowReorderItems.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="healthy" className="gap-1.5 text-xs">
                  Healthy
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                    {healthyItemsCount}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                <Label
                  htmlFor="global-reorder-point"
                  className="text-xs font-medium text-slate-600 whitespace-nowrap"
                >
                  Set Reorder Point:
                </Label>
                <Input
                  id="global-reorder-point"
                  type="number"
                  min={1}
                  max={100}
                  value={globalReorderInput}
                  onChange={(e) => setGlobalReorderInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyGlobalReorder();
                    }
                  }}
                  className="h-8 w-20 font-mono tabular-nums text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => handleApplyGlobalReorder()}
                >
                  Apply to All
                </Button>
              </div>
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                {[10, 15, 20, 25].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={globalReorderInput === String(preset) ? "secondary" : "ghost"}
                    className="h-7 px-2 font-mono text-xs"
                    onClick={() => handleApplyGlobalReorder(preset)}
                  >
                    {preset} kg
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredItems}
            searchPlaceholder="Search inventory..."
            getRowClassName={getRowClassName}
          />
        </>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <Card className="xl:col-span-5 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowLeftRight className="w-5 h-5 text-orange-600" />
                Record Inter-Outlet Transfer
              </CardTitle>
              <CardDescription>
                Move stock between outlets. Source and destination balances update automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockTransferForm />
            </CardContent>
          </Card>

          <Card className="xl:col-span-7 border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5 text-slate-600" />
                Transfer History Ledger
              </CardTitle>
              <CardDescription>
                Completed transfers with automatic before/after outlet inventory counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={transferColumns}
                data={outletScopedTransfers}
                searchPlaceholder="Search transfers by item or outlet..."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Stock Transfer Dialog */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-orange-600" />
              Transfer Stock Between Outlets
            </DialogTitle>
            <DialogDescription>
              Deduct stock from a source outlet and add it to a destination outlet in real time.
            </DialogDescription>
          </DialogHeader>
          <StockTransferForm
            initialItemName={transferPreset.itemName}
            initialFromOutletId={transferPreset.fromOutletId}
            initialToOutletId={transferPreset.toOutletId}
            onCompleted={() => setTransferModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
