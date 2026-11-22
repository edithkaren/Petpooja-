/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = 'Placed' | 'Preparing' | 'Served' | 'Paid' | 'Cancelled';
export type OrderType = 'Dine-in' | 'Takeaway' | 'Online';
export type OrderSource = 'Direct' | 'Swiggy' | 'Zomato' | 'Magicpin';
export type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Wallet';

export interface Outlet {
  id: string;
  name: string;
  city: string;
  currency: string;
}

export interface BillItem {
  itemId: string;
  name: string;
  category: string;
  qty: number;
  unitPrice: number;
  modifiers: string[];
  lineTotal: number;
}

export interface Payment {
  mode: PaymentMode;
  amount: number;
}

export interface Bill {
  id: string;
  outletId: string;
  createdAt: string;
  orderType: OrderType;
  source: OrderSource;
  tableNo?: string;
  staffId: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payments: Payment[];
  status: OrderStatus;
  customerName?: string;
  customerPhone?: string;
  isHighPriority?: boolean;
  cancellationReason?: string;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  price: number;
  isVeg: boolean;
  stockItemId: string;
}

export interface StockItem {
  id: string;
  outletId: string;
  name: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  expiryDate?: string;
}

export interface StockTransfer {
  id: string;
  itemName: string;
  unit: string;
  quantity: number;
  fromOutletId: string;
  fromOutletName: string;
  toOutletId: string;
  toOutletName: string;
  sourceBefore: number;
  sourceAfter: number;
  destBefore: number;
  destAfter: number;
  notes?: string;
  transferredBy: string;
  transferredAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  visits: number;
  lifetimeSpend: number;
  lastVisitAt: string;
  segment: 'New' | 'Repeat' | 'Lapsed' | 'VIP';
}

export type StaffRole = 'Owner' | 'Manager' | 'Cashier' | 'Head Chef' | 'Chef' | 'Kitchen Team';
export type StaffDepartment = 'Management' | 'Front of House' | 'Kitchen';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  department: StaffDepartment;
  station?: string;
  shift: 'Morning' | 'Evening' | 'Split';
  status: 'On Duty' | 'Break' | 'Off Duty';
  outletId: string;
}

export interface DashboardStats {
  grossSales: number;
  netSales: number;
  billsCount: number;
  avgBillValue: number;
  covers: number;
  avgSpendPerGuest: number;
  salesChange: number;
  billsChange: number;
}

export type StaffActivityType =
  | 'Login'
  | 'Logout'
  | 'BillGenerated'
  | 'OrderCancelled'
  | 'TableAssigned'
  | 'KOTPrepared'
  | 'PrepCompleted';

export interface StaffActivity {
  id: string;
  staffId: string;
  type: StaffActivityType;
  timestamp: string;
  description: string;
  metadata?: any;
}

export type ShiftSlot = 'Morning' | 'Evening' | 'Split';
export type ScheduleShiftType = ShiftSlot | 'Off';

export interface ScheduledShift {
  id: string;
  staffId: string;
  outletId: string;
  date: string; // YYYY-MM-DD
  shiftType: ScheduleShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes?: string;
}

export type TimeEntryStatus = 'Clocked In' | 'On Break' | 'Clocked Out';

export interface TimeEntry {
  id: string;
  staffId: string;
  outletId: string;
  clockInAt: string;
  clockOutAt?: string;
  breakStartAt?: string;
  totalBreakMinutes: number;
  status: TimeEntryStatus;
  shiftType: ShiftSlot;
}
