/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  PackageCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { useDashboard } from "@/hooks/use-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockTransferFormProps {
  initialItemName?: string;
  initialFromOutletId?: string;
  initialToOutletId?: string;
  onCompleted?: () => void;
  compact?: boolean;
}

export const StockTransferForm: React.FC<StockTransferFormProps> = ({
  initialItemName,
  initialFromOutletId,
  initialToOutletId,
  onCompleted,
  compact = false,
}) => {
  const { outlets, stockItems, selectedOutletId, transferStock } = useDashboard();

  const itemOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    stockItems.forEach((s) => {
      if (!map.has(s.name)) {
        map.set(s.name, s.unit);
      }
    });
    return Array.from(map.entries()).map(([name, unit]) => ({ name, unit }));
  }, [stockItems]);

  const defaultFromId = React.useMemo(() => {
    if (initialFromOutletId && outlets.some((o) => o.id === initialFromOutletId)) {
      return initialFromOutletId;
    }
    if (selectedOutletId !== "all" && outlets.some((o) => o.id === selectedOutletId)) {
      return selectedOutletId;
    }
    return outlets[0]?.id ?? "";
  }, [initialFromOutletId, selectedOutletId, outlets]);

  const defaultToId = React.useMemo(() => {
    if (
      initialToOutletId &&
      initialToOutletId !== defaultFromId &&
      outlets.some((o) => o.id === initialToOutletId)
    ) {
      return initialToOutletId;
    }
    return outlets.find((o) => o.id !== defaultFromId)?.id ?? "";
  }, [initialToOutletId, defaultFromId, outlets]);

  const [itemName, setItemName] = React.useState<string>(
    () => initialItemName || itemOptions[0]?.name || ""
  );
  const [fromOutletId, setFromOutletId] = React.useState<string>(defaultFromId);
  const [toOutletId, setToOutletId] = React.useState<string>(defaultToId);
  const [quantity, setQuantity] = React.useState<string>("5");
  const [notes, setNotes] = React.useState<string>("");

  React.useEffect(() => {
    if (initialItemName) {
      setItemName(initialItemName);
    } else if (!itemName && itemOptions[0]?.name) {
      setItemName(itemOptions[0].name);
    }
  }, [initialItemName, itemName, itemOptions]);

  React.useEffect(() => {
    if (initialFromOutletId) {
      setFromOutletId(initialFromOutletId);
    }
    if (initialToOutletId && initialToOutletId !== initialFromOutletId) {
      setToOutletId(initialToOutletId);
    } else if (initialFromOutletId) {
      setToOutletId((prev) =>
        prev === initialFromOutletId
          ? outlets.find((o) => o.id !== initialFromOutletId)?.id ?? ""
          : prev
      );
    }
  }, [initialFromOutletId, initialToOutletId, outlets]);

  const sourceStock = React.useMemo(
    () => stockItems.find((s) => s.outletId === fromOutletId && s.name === itemName),
    [stockItems, fromOutletId, itemName]
  );

  const destStock = React.useMemo(
    () => stockItems.find((s) => s.outletId === toOutletId && s.name === itemName),
    [stockItems, toOutletId, itemName]
  );

  const fromOutlet = outlets.find((o) => o.id === fromOutletId);
  const toOutlet = outlets.find((o) => o.id === toOutletId);
  const unit = sourceStock?.unit ?? destStock?.unit ?? "kg";

  const parsedQty = Number.parseInt(quantity, 10);
  const validPositiveQty = !Number.isNaN(parsedQty) && parsedQty > 0;
  const availableQty = sourceStock?.onHand ?? 0;
  const exceedsSource = validPositiveQty && parsedQty > availableQty;
  const sameOutlet = Boolean(fromOutletId && toOutletId && fromOutletId === toOutletId);

  const sourceAfter = Math.max(0, availableQty - (validPositiveQty ? parsedQty : 0));
  const destBefore = destStock?.onHand ?? 0;
  const destAfter = destBefore + (validPositiveQty ? parsedQty : 0);

  const sourceDropsBelowReorder =
    Boolean(sourceStock) &&
    validPositiveQty &&
    !exceedsSource &&
    sourceAfter < (sourceStock?.reorderLevel ?? 10);

  const destRestoredHealthy =
    Boolean(destStock) &&
    validPositiveQty &&
    destBefore < (destStock?.reorderLevel ?? 10) &&
    destAfter >= (destStock?.reorderLevel ?? 10);

  const canSubmit =
    Boolean(itemName) &&
    Boolean(fromOutletId) &&
    Boolean(toOutletId) &&
    !sameOutlet &&
    validPositiveQty &&
    !exceedsSource &&
    availableQty > 0;

  const handleSwapOutlets = () => {
    setFromOutletId(toOutletId);
    setToOutletId(fromOutletId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const result = transferStock({
      itemName,
      fromOutletId,
      toOutletId,
      quantity: parsedQty,
      notes,
    });

    if (!result.success || !result.transfer) {
      toast.error(result.error || "Unable to record stock transfer.");
      return;
    }

    const t = result.transfer;
    toast.success(
      `Transferred ${t.quantity} ${t.unit} of ${t.itemName}: ${t.fromOutletName} (${t.sourceBefore} → ${t.sourceAfter} ${t.unit}) to ${t.toOutletName} (${t.destBefore} → ${t.destAfter} ${t.unit}).`
    );
    setNotes("");
    setQuantity("5");
    onCompleted?.();
  };

  const selectClassName =
    "h-9 w-full rounded-lg border border-input bg-white px-3 py-1.5 text-sm text-slate-900 shadow-2xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="transfer-item" className="text-xs font-semibold text-slate-700">
          Ingredient / Stock Item
        </Label>
        <select
          id="transfer-item"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className={selectClassName}
        >
          {itemOptions.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name} ({opt.unit})
            </option>
          ))}
        </select>
      </div>

      <div
        className={cn(
          "grid gap-3 items-end",
          compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[1fr_auto_1fr]"
        )}
      >
        <div className="space-y-1.5">
          <Label htmlFor="transfer-from" className="text-xs font-semibold text-slate-700">
            Source Outlet (Deduct Stock)
          </Label>
          <select
            id="transfer-from"
            value={fromOutletId}
            onChange={(e) => {
              const nextFrom = e.target.value;
              setFromOutletId(nextFrom);
              if (nextFrom === toOutletId) {
                const alt = outlets.find((o) => o.id !== nextFrom)?.id ?? "";
                setToOutletId(alt);
              }
            }}
            className={selectClassName}
          >
            {outlets.map((outlet) => {
              const outletStock = stockItems.find(
                (s) => s.outletId === outlet.id && s.name === itemName
              );
              return (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} ({outletStock?.onHand ?? 0} {unit} avail)
                </option>
              );
            })}
          </select>
        </div>

        <div className={cn("flex", compact ? "justify-end" : "justify-center pb-0.5")}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-200"
            onClick={handleSwapOutlets}
            title="Swap source and destination outlets"
            aria-label="Swap source and destination outlets"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transfer-to" className="text-xs font-semibold text-slate-700">
            Destination Outlet (Add Stock)
          </Label>
          <select
            id="transfer-to"
            value={toOutletId}
            onChange={(e) => setToOutletId(e.target.value)}
            className={selectClassName}
          >
            {outlets.map((outlet) => {
              const outletStock = stockItems.find(
                (s) => s.outletId === outlet.id && s.name === itemName
              );
              const isLow =
                outletStock !== undefined && outletStock.onHand < outletStock.reorderLevel;
              return (
                <option key={outlet.id} value={outlet.id} disabled={outlet.id === fromOutletId}>
                  {outlet.name} ({outletStock?.onHand ?? 0} {unit}
                  {isLow ? " · LOW" : ""})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="transfer-qty" className="text-xs font-semibold text-slate-700">
              Transfer Quantity ({unit})
            </Label>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              Max: {availableQty} {unit}
            </span>
          </div>
          <Input
            id="transfer-qty"
            type="number"
            min={1}
            max={Math.max(1, availableQty)}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={cn(
              "h-9 font-mono tabular-nums",
              exceedsSource && "border-rose-400 focus-visible:ring-rose-200"
            )}
          />
          <div className="flex flex-wrap items-center gap-1 pt-1">
            {[5, 10, 15].map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                disabled={preset > availableQty}
                onClick={() => setQuantity(String(preset))}
                className="h-6 px-2 text-[11px] font-mono"
              >
                {preset} {unit}
              </Button>
            ))}
            {availableQty > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity(String(availableQty))}
                className="h-6 px-2 text-[11px] font-mono text-orange-700 border-orange-200 hover:bg-orange-50"
              >
                Max ({availableQty})
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transfer-notes" className="text-xs font-semibold text-slate-700">
            Transfer Note (Optional)
          </Label>
          <Input
            id="transfer-notes"
            type="text"
            placeholder="e.g. Weekend rush rebalance"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Live Inventory Impact Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div
          className={cn(
            "rounded-lg border p-3 bg-white",
            sourceDropsBelowReorder ? "border-amber-300 bg-amber-50/60" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              Source Balance
            </span>
            {sourceDropsBelowReorder && (
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] gap-1 px-1.5 py-0"
              >
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                Below Reorder
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-slate-800 truncate">
            {fromOutlet?.name ?? "Select source"}
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono tabular-nums text-sm">
            <span className="text-slate-500">
              {availableQty} {unit}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span
              className={cn(
                "font-bold",
                exceedsSource
                  ? "text-rose-600"
                  : sourceDropsBelowReorder
                    ? "text-amber-800"
                    : "text-slate-900"
              )}
            >
              {exceedsSource ? "Insufficient" : `${sourceAfter} ${unit}`}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg border p-3 bg-white",
            destRestoredHealthy ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Store className="w-3.5 h-3.5 text-orange-500" />
              Destination Balance
            </span>
            {destRestoredHealthy && (
              <Badge
                variant="outline"
                className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1 px-1.5 py-0"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Restored
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-slate-800 truncate">
            {toOutlet?.name ?? "Select destination"}
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono tabular-nums text-sm">
            <span className="text-slate-500">
              {destBefore} {unit}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-emerald-700">
              {destAfter} {unit}
            </span>
          </div>
        </div>
      </div>

      {exceedsSource && (
        <p className="text-xs font-medium text-rose-600">
          Cannot transfer {parsedQty} {unit}: only {availableQty} {unit} available at{" "}
          {fromOutlet?.name}.
        </p>
      )}
      {sameOutlet && (
        <p className="text-xs font-medium text-rose-600">
          Source and destination outlets must be different locations.
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
        >
          <PackageCheck className="w-4 h-4" />
          Record Stock Transfer
        </Button>
      </div>
    </form>
  );
};
