/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";

import { getBills, OUTLETS, addLiveBill, STOCK, INITIAL_STOCK_TRANSFERS, createInitialStock, STAFF } from '../lib/mock-data';
import { Bill, Outlet, ScheduledShift, ScheduleShiftType, Staff, StockItem, StockTransfer, TimeEntry } from '../types';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { useSpeech } from './use-speech';
import { formatCurrency } from '../lib/utils';
import {
  createInitialTimeEntriesForStaff,
  createSchedulesForStaff,
} from '../lib/shift-tracking';

export interface TransferStockInput {
  itemName: string;
  fromOutletId: string;
  toOutletId: string;
  quantity: number;
  notes?: string;
}

export interface TransferStockResult {
  success: boolean;
  error?: string;
  transfer?: StockTransfer;
}

export interface AssignShiftInput {
  staffId: string;
  outletId: string;
  date: string;
  shiftType: ScheduleShiftType;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface DashboardContextType {
  selectedOutletId: string | 'all';
  setSelectedOutletId: (id: string | 'all') => void;
  dateRange: { from: Date; to: Date };
  setDateRange: (range: { from: Date; to: Date }) => void;
  bills: Bill[];
  outlets: Outlet[];
  addNewOutlet: (name: string, city: string) => void;
  refreshData: () => void;
  lastUpdated: Date;
  isLiveFeedPaused: boolean;
  toggleLiveFeed: () => void;
  stockItems: StockItem[];
  stockTransfers: StockTransfer[];
  transferStock: (input: TransferStockInput) => TransferStockResult;
  restockStockItem: (stockId: string) => { itemName: string; addedQty: number; unit: string } | null;
  fulfillPurchaseOrder: (outletFilterId: string | 'all') => number;
  setGlobalReorderPoint: (threshold: number, outletFilterId: string | 'all') => number;
  adjustItemReorderPoint: (stockId: string, delta: number) => void;
  resetInventory: () => void;
  staffMembers: Staff[];
  shiftSchedules: ScheduledShift[];
  timeEntries: TimeEntry[];
  clockInStaff: (staffId: string) => Staff | null;
  clockOutStaff: (staffId: string) => Staff | null;
  toggleBreakStaff: (staffId: string) => Staff | null;
  assignShiftSchedule: (input: AssignShiftInput) => void;
}

const DashboardContext = React.createContext<DashboardContextType | undefined>(undefined);

interface DashboardProviderProps {
  children: React.ReactNode;
  initialOutletId?: string | 'all';
  userId?: string;
}

const OUTLET_STORAGE_PREFIX = 'petpooja-selected-outlet-v1';

function readPersistedOutletId(
  storageKey: string,
  validOutlets: Outlet[],
  fallback: string | 'all'
): string | 'all' {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return fallback;
    if (saved === 'all') return 'all';
    if (validOutlets.some((o) => o.id === saved)) return saved;
    return fallback;
  } catch {
    return fallback;
  }
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({
  children,
  initialOutletId = 'all',
  userId,
}) => {
  const storageKey = `${OUTLET_STORAGE_PREFIX}:${userId || 'default'}`;
  const [outlets, setOutlets] = React.useState<Outlet[]>(() => [...OUTLETS]);
  const [selectedOutletId, setSelectedOutletIdState] = React.useState<string | 'all'>(() =>
    readPersistedOutletId(storageKey, OUTLETS, initialOutletId)
  );

  React.useEffect(() => {
    setSelectedOutletIdState(readPersistedOutletId(storageKey, outlets, initialOutletId));
  }, [storageKey, initialOutletId, outlets]);

  const setSelectedOutletId = React.useCallback(
    (id: string | 'all') => {
      setSelectedOutletIdState(id);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, id);
        } catch {
          // Ignore storage quota issues
        }
      }
    },
    [storageKey]
  );

  const [dateRange, setDateRange] = React.useState({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [stockItems, setStockItems] = React.useState<StockItem[]>(() =>
    STOCK.map((item) => ({ ...item }))
  );
  const [stockTransfers, setStockTransfers] = React.useState<StockTransfer[]>(() => [
    ...INITIAL_STOCK_TRANSFERS,
  ]);

  const SHIFT_STATE_STORAGE_KEY = 'petpooja-shift-time-tracking-v1';
  const [staffMembers, setStaffMembers] = React.useState<Staff[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(SHIFT_STATE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { staffMembers?: Staff[] };
          if (Array.isArray(parsed.staffMembers) && parsed.staffMembers.length > 0) {
            const existingIds = new Set(parsed.staffMembers.map((s) => s.id));
            const missingSeeded = STAFF.filter((s) => !existingIds.has(s.id)).map((s) => ({ ...s }));
            return [...parsed.staffMembers, ...missingSeeded];
          }
        }
      } catch {
        // Fallback to fresh seed
      }
    }
    return STAFF.map((s) => ({ ...s }));
  });

  const [shiftSchedules, setShiftSchedules] = React.useState<ScheduledShift[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(SHIFT_STATE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            staffMembers?: Staff[];
            shiftSchedules?: ScheduledShift[];
          };
          if (Array.isArray(parsed.shiftSchedules) && parsed.shiftSchedules.length > 0) {
            const existingStaffIds = new Set((parsed.staffMembers || []).map((s) => s.id));
            const newStaff = STAFF.filter((s) => !existingStaffIds.has(s.id));
            const extraSchedules = newStaff.length > 0 ? createSchedulesForStaff(newStaff) : [];
            return [...parsed.shiftSchedules, ...extraSchedules];
          }
        }
      } catch {
        // Fallback
      }
    }
    return createSchedulesForStaff(STAFF);
  });

  const [timeEntries, setTimeEntries] = React.useState<TimeEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(SHIFT_STATE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            staffMembers?: Staff[];
            timeEntries?: TimeEntry[];
          };
          if (Array.isArray(parsed.timeEntries) && parsed.timeEntries.length > 0) {
            const existingStaffIds = new Set((parsed.staffMembers || []).map((s) => s.id));
            const newStaff = STAFF.filter((s) => !existingStaffIds.has(s.id));
            const extraEntries =
              newStaff.length > 0 ? createInitialTimeEntriesForStaff(newStaff) : [];
            return [...parsed.timeEntries, ...extraEntries];
          }
        }
      } catch {
        // Fallback
      }
    }
    return createInitialTimeEntriesForStaff(STAFF);
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        SHIFT_STATE_STORAGE_KEY,
        JSON.stringify({ staffMembers, shiftSchedules, timeEntries })
      );
    } catch {
      // Ignore storage quota issues
    }
  }, [staffMembers, shiftSchedules, timeEntries]);

  const [lastUpdated, setLastUpdated] = React.useState(new Date());
  const [isLiveFeedPaused, setIsLiveFeedPaused] = React.useState(false);
  const { speak } = useSpeech();
  const processedBillIds = React.useRef<Set<string>>(new Set());
  const isFirstLoad = React.useRef(true);

  const refreshData = React.useCallback(() => {
    const data = getBills(
      dateRange.from,
      dateRange.to,
      selectedOutletId === 'all' ? undefined : selectedOutletId
    );
    setBills([...data]);
    setLastUpdated(new Date());
  }, [dateRange.from, dateRange.to, selectedOutletId]);

  const toggleLiveFeed = React.useCallback(() => {
    setIsLiveFeedPaused((prev) => {
      const next = !prev;
      if (!next) {
        const data = getBills(
          dateRange.from,
          dateRange.to,
          selectedOutletId === 'all' ? undefined : selectedOutletId
        );
        setBills([...data]);
        setLastUpdated(new Date());
      }
      return next;
    });
  }, [dateRange.from, dateRange.to, selectedOutletId]);

  // Monitor for new bills and trigger audio alerts
  React.useEffect(() => {
    if (bills.length === 0) return;

    // On first load, just populate the processed IDs
    if (isFirstLoad.current) {
      bills.forEach(b => processedBillIds.current.add(b.id));
      isFirstLoad.current = false;
      return;
    }

    bills.forEach(bill => {
      if (!processedBillIds.current.has(bill.id)) {
        processedBillIds.current.add(bill.id);

        // Check for specific notification conditions
        if (bill.status === 'Cancelled') {
          speak(`Alert. Order number ${bill.id.split('-').pop()} has been cancelled.`);
        } else if (bill.isHighPriority) {
          speak(`High priority order received. Order number ${bill.id.split('-').pop()} for ${formatCurrency(bill.total)}.`);
        }
      }
    });
  }, [bills, speak]);

  const addNewOutlet = async (name: string, city: string) => {
    const { addOutlet, OUTLETS, STOCK: UPDATED_STOCK, STAFF: UPDATED_STAFF } = await import('../lib/mock-data');
    const created = addOutlet(name, city);
    setOutlets([...OUTLETS]);
    const newOutletStock = UPDATED_STOCK.filter((s) => s.outletId === created.id).map((s) => ({ ...s }));
    if (newOutletStock.length > 0) {
      setStockItems((prev) => [...prev, ...newOutletStock]);
    }
    const newOutletStaff = UPDATED_STAFF.filter((s) => s.outletId === created.id).map((s) => ({ ...s }));
    if (newOutletStaff.length > 0) {
      setStaffMembers((prev) => [...prev, ...newOutletStaff]);
      setShiftSchedules((prev) => [...prev, ...createSchedulesForStaff(newOutletStaff)]);
      setTimeEntries((prev) => [...prev, ...createInitialTimeEntriesForStaff(newOutletStaff)]);
    }
    refreshData();
  };

  const transferStock = React.useCallback(
    (input: TransferStockInput): TransferStockResult => {
      const { itemName, fromOutletId, toOutletId, quantity, notes } = input;

      if (!fromOutletId || !toOutletId) {
        return { success: false, error: 'Please select both source and destination outlets.' };
      }
      if (fromOutletId === toOutletId) {
        return { success: false, error: 'Source and destination outlets must be different.' };
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { success: false, error: 'Transfer quantity must be greater than zero.' };
      }

      const sourceItem = stockItems.find(
        (s) => s.outletId === fromOutletId && s.name === itemName
      );
      if (!sourceItem) {
        return { success: false, error: 'Selected item was not found at the source outlet.' };
      }
      if (quantity > sourceItem.onHand) {
        return {
          success: false,
          error: `Insufficient stock at source (${sourceItem.onHand} ${sourceItem.unit} available).`,
        };
      }

      const fromOutlet = outlets.find((o) => o.id === fromOutletId);
      const toOutlet = outlets.find((o) => o.id === toOutletId);
      if (!fromOutlet || !toOutlet) {
        return { success: false, error: 'Invalid outlet selected.' };
      }

      const destItem = stockItems.find(
        (s) => s.outletId === toOutletId && s.name === itemName
      );

      const sourceBefore = sourceItem.onHand;
      const sourceAfter = sourceBefore - quantity;
      const destBefore = destItem ? destItem.onHand : 0;
      const destAfter = destBefore + quantity;

      setStockItems((prev) => {
        const updated = prev.map((item) => {
          if (item.id === sourceItem.id) {
            return { ...item, onHand: item.onHand - quantity };
          }
          if (destItem && item.id === destItem.id) {
            return { ...item, onHand: item.onHand + quantity };
          }
          return item;
        });

        if (!destItem) {
          updated.push({
            id: `${toOutletId}::${sourceItem.id.split('::')[1] || Date.now()}`,
            outletId: toOutletId,
            name: sourceItem.name,
            unit: sourceItem.unit,
            onHand: quantity,
            reorderLevel: sourceItem.reorderLevel,
            expiryDate: sourceItem.expiryDate,
          });
        }

        return updated;
      });

      const transfer: StockTransfer = {
        id: `trf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        itemName: sourceItem.name,
        unit: sourceItem.unit,
        quantity,
        fromOutletId,
        fromOutletName: fromOutlet.name,
        toOutletId,
        toOutletName: toOutlet.name,
        sourceBefore,
        sourceAfter,
        destBefore,
        destAfter,
        notes: notes?.trim() || undefined,
        transferredBy: `Inventory Manager (${fromOutlet.city})`,
        transferredAt: new Date().toISOString(),
      };

      setStockTransfers((prev) => [transfer, ...prev]);

      return { success: true, transfer };
    },
    [stockItems, outlets]
  );

  const restockStockItem = React.useCallback(
    (stockId: string) => {
      const target = stockItems.find((s) => s.id === stockId);
      if (!target) return null;
      const addedQty = Math.max(20, target.reorderLevel * 2 - target.onHand);
      setStockItems((prev) =>
        prev.map((item) =>
          item.id === stockId ? { ...item, onHand: item.onHand + addedQty } : item
        )
      );
      return { itemName: target.name, addedQty, unit: target.unit };
    },
    [stockItems]
  );

  const fulfillPurchaseOrder = React.useCallback(
    (outletFilterId: string | 'all') => {
      const matchingLow = stockItems.filter(
        (item) =>
          (outletFilterId === 'all' || item.outletId === outletFilterId) &&
          item.onHand < item.reorderLevel
      );
      if (matchingLow.length === 0) return 0;

      const lowIds = new Set(matchingLow.map((item) => item.id));
      setStockItems((prev) =>
        prev.map((item) => {
          if (!lowIds.has(item.id)) return item;
          return { ...item, onHand: Math.max(20, item.reorderLevel * 2) };
        })
      );
      return matchingLow.length;
    },
    [stockItems]
  );

  const setGlobalReorderPoint = React.useCallback(
    (threshold: number, outletFilterId: string | 'all') => {
      const clamped = Math.min(100, Math.max(1, threshold));
      const flagged = stockItems.filter(
        (item) =>
          (outletFilterId === 'all' || item.outletId === outletFilterId) &&
          item.onHand < clamped
      ).length;

      setStockItems((prev) =>
        prev.map((item) =>
          outletFilterId === 'all' || item.outletId === outletFilterId
            ? { ...item, reorderLevel: clamped }
            : item
        )
      );
      return flagged;
    },
    [stockItems]
  );

  const adjustItemReorderPoint = React.useCallback((stockId: string, delta: number) => {
    setStockItems((prev) =>
      prev.map((item) =>
        item.id === stockId
          ? { ...item, reorderLevel: Math.max(1, Math.min(100, item.reorderLevel + delta)) }
          : item
      )
    );
  }, []);

  const resetInventory = React.useCallback(() => {
    setStockItems(createInitialStock());
    setStockTransfers([...INITIAL_STOCK_TRANSFERS]);
  }, []);

  const clockInStaff = React.useCallback(
    (staffId: string): Staff | null => {
      const target = staffMembers.find((s) => s.id === staffId);
      if (!target) return null;
      const nowIso = new Date().toISOString();

      setStaffMembers((prev) =>
        prev.map((member) =>
          member.id === staffId ? { ...member, status: 'On Duty' } : member
        )
      );

      setTimeEntries((prev) => {
        const hasActive = prev.some(
          (entry) => entry.staffId === staffId && entry.status !== 'Clocked Out'
        );
        if (hasActive) {
          return prev.map((entry) => {
            if (entry.staffId !== staffId || entry.status === 'Clocked Out') return entry;
            const addedBreak =
              entry.status === 'On Break' && entry.breakStartAt
                ? Math.max(1, Math.round((Date.now() - new Date(entry.breakStartAt).getTime()) / 60000))
                : 0;
            return {
              ...entry,
              status: 'Clocked In',
              breakStartAt: undefined,
              totalBreakMinutes: entry.totalBreakMinutes + addedBreak,
            };
          });
        }
        const newEntry: TimeEntry = {
          id: `te-${staffId}-${Date.now()}`,
          staffId,
          outletId: target.outletId,
          clockInAt: nowIso,
          totalBreakMinutes: 0,
          status: 'Clocked In',
          shiftType: target.shift,
        };
        return [newEntry, ...prev];
      });

      return { ...target, status: 'On Duty' };
    },
    [staffMembers]
  );

  const clockOutStaff = React.useCallback(
    (staffId: string): Staff | null => {
      const target = staffMembers.find((s) => s.id === staffId);
      if (!target) return null;
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      setStaffMembers((prev) =>
        prev.map((member) =>
          member.id === staffId ? { ...member, status: 'Off Duty' } : member
        )
      );

      setTimeEntries((prev) =>
        prev.map((entry) => {
          if (entry.staffId !== staffId || entry.status === 'Clocked Out') return entry;
          const addedBreak =
            entry.status === 'On Break' && entry.breakStartAt
              ? Math.max(0, Math.round((nowMs - new Date(entry.breakStartAt).getTime()) / 60000))
              : 0;
          return {
            ...entry,
            status: 'Clocked Out',
            clockOutAt: nowIso,
            breakStartAt: undefined,
            totalBreakMinutes: entry.totalBreakMinutes + addedBreak,
          };
        })
      );

      return { ...target, status: 'Off Duty' };
    },
    [staffMembers]
  );

  const toggleBreakStaff = React.useCallback(
    (staffId: string): Staff | null => {
      const target = staffMembers.find((s) => s.id === staffId);
      if (!target || target.status === 'Off Duty') return null;

      const nextStatus: Staff['status'] = target.status === 'Break' ? 'On Duty' : 'Break';
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      setStaffMembers((prev) =>
        prev.map((member) =>
          member.id === staffId ? { ...member, status: nextStatus } : member
        )
      );

      setTimeEntries((prev) =>
        prev.map((entry) => {
          if (entry.staffId !== staffId || entry.status === 'Clocked Out') return entry;
          if (nextStatus === 'Break') {
            return {
              ...entry,
              status: 'On Break',
              breakStartAt: nowIso,
            };
          }
          const addedBreak = entry.breakStartAt
            ? Math.max(1, Math.round((nowMs - new Date(entry.breakStartAt).getTime()) / 60000))
            : 0;
          return {
            ...entry,
            status: 'Clocked In',
            breakStartAt: undefined,
            totalBreakMinutes: entry.totalBreakMinutes + addedBreak,
          };
        })
      );

      return { ...target, status: nextStatus };
    },
    [staffMembers]
  );

  const assignShiftSchedule = React.useCallback((input: AssignShiftInput) => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    setShiftSchedules((prev) => {
      const idx = prev.findIndex(
        (s) => s.staffId === input.staffId && s.date === input.date
      );
      const nextItem: ScheduledShift = {
        id: idx >= 0 ? prev[idx].id : `sched-${input.staffId}-${input.date}`,
        staffId: input.staffId,
        outletId: input.outletId,
        date: input.date,
        shiftType: input.shiftType,
        startTime: input.shiftType === 'Off' ? '' : input.startTime,
        endTime: input.shiftType === 'Off' ? '' : input.endTime,
        notes: input.notes?.trim() || undefined,
      };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = nextItem;
        return copy;
      }
      return [...prev, nextItem];
    });

    if (input.date === todayKey && input.shiftType !== 'Off') {
      const nextShift = input.shiftType;
      setStaffMembers((prev) =>
        prev.map((member) =>
          member.id === input.staffId ? { ...member, shift: nextShift } : member
        )
      );
    }
  }, []);

  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Stream live incoming orders across outlets unless paused
  React.useEffect(() => {
    if (isLiveFeedPaused) return;
    const interval = setInterval(() => {
      const pool = OUTLETS;
      if (pool.length > 0) {
        const targetOutletId =
          selectedOutletId === 'all'
            ? pool[Math.floor(Math.random() * pool.length)].id
            : selectedOutletId;
        addLiveBill(targetOutletId, { forceStandard: true });
      }
      refreshData();
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedOutletId, refreshData, isLiveFeedPaused]);

  return (
    <DashboardContext.Provider value={{
      selectedOutletId,
      setSelectedOutletId,
      dateRange,
      setDateRange,
      bills,
      outlets,
      addNewOutlet,
      refreshData,
      lastUpdated,
      isLiveFeedPaused,
      toggleLiveFeed,
      stockItems,
      stockTransfers,
      transferStock,
      restockStockItem,
      fulfillPurchaseOrder,
      setGlobalReorderPoint,
      adjustItemReorderPoint,
      resetInventory,
      staffMembers,
      shiftSchedules,
      timeEntries,
      clockInStaff,
      clockOutStaff,
      toggleBreakStaff,
      assignShiftSchedule,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = React.useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};
