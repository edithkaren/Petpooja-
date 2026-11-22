/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { addDays, subDays, startOfDay, endOfDay, format, isWithinInterval, subMonths, isSameDay } from 'date-fns';
import { Bill, BillItem, Customer, Item, Outlet, Staff, StockItem, StockTransfer, OrderStatus, OrderType, PaymentMode, Payment, OrderSource, StaffActivity } from '../types';

const CATEGORIES = ['Coffee & Shakes', 'Sandwiches & Wraps', 'Pizza & Pasta', 'Fast Food', 'Desserts', 'Main Course', 'Beverages'];
const TOWNS = ['Mumbai', 'Delhi', 'Bangalore', 'Indore'];

export let OUTLETS: Outlet[] = [
  { id: 'ot-1', name: 'Flavors of India', city: 'Mumbai', currency: 'INR' },
  { id: 'ot-2', name: 'Spice Garden', city: 'Delhi', currency: 'INR' },
  { id: 'ot-3', name: 'The Bistro', city: 'Bangalore', currency: 'INR' },
  // Tinku's Cafe Outlets in Indore
  { id: 'ot-tinku-1', name: "Tinku's Cafe - Vijay Nagar", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-2', name: "Tinku's Cafe - Old Palasia", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-3', name: "Tinku's Cafe - MG Road City Centre", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-4', name: "Tinku's Cafe - Sapna Sangeeta", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-5', name: "Tinku's Cafe - Bhawarkua", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-6', name: "Tinku's Cafe - Pipliyahana (Scheme 140)", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-7', name: "Tinku's Cafe - Geeta Bhawan", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-8', name: "Tinku's Cafe - Annapurna Road", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-9', name: "Tinku's Cafe - Sudama Nagar", city: 'Indore', currency: 'INR' },
  { id: 'ot-tinku-10', name: "Tinku's Cafe - Rau", city: 'Indore', currency: 'INR' },
  // Popular Cafes & Restaurants in Indore, MP
  { id: 'ot-indore-1', name: 'Mr. Beans Cafe - Old Palasia', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-2', name: 'Blanco Cafe & Bistro - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-3', name: 'Ohlio Cafe - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-4', name: 'Chapter One Cafe - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-5', name: 'Mitti Cafe - Palasia', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-6', name: 'Bake N Shake - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-7', name: 'Palette Cafe - South Palasia', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-8', name: 'O2 Cafe de la Ville - New Palasia', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-9', name: 'Mama Loca Cafe - Saket Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-10', name: 'Crush Coffee - Old Palasia', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-11', name: 'Cafe Terazza - Scheme 54', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-12', name: 'Nafees Restaurant - Old Palasia', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-13', name: 'Shreemaya Celebration - AB Road', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-14', name: 'Guru Kripa Restaurant - Sarwate', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-15', name: 'Kebabsville (Sayaji) - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-16', name: 'The Creative Kitchen - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-17', name: 'Bapu Ki Kutia - Vijay Nagar', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-18', name: 'Little Italy - Scheme 54', city: 'Indore', currency: 'INR' },
  { id: 'ot-indore-19', name: 'Chappan Chaat House - New Palasia', city: 'Indore', currency: 'INR' },
];

const HEAD_CHEF_NAMES = ['Chef Vikram Kapoor', 'Chef Ananya Rao', 'Chef Arjun Mehta', 'Chef Kabir Khanna', 'Chef Meera Nair'];
const CHEF_NAMES = ['Chef Rohan Verma', 'Chef Priya Iyer', 'Chef Siddharth Joshi', 'Chef Neha Kulkarni', 'Chef Dev Patel', 'Chef Tara Sen'];
const KITCHEN_TEAM_NAMES = ['Amit Kumar', 'Suresh Yadav', 'Pooja Sharma', 'Deepak Singh', 'Ravi Tiwari', 'Karan Chauhan', 'Nisha Gupta'];

const createStaffForOutlet = (outlet: Outlet, outletIndex: number): Staff[] => {
  const headChefName = HEAD_CHEF_NAMES[outletIndex % HEAD_CHEF_NAMES.length];
  const chefA = CHEF_NAMES[(outletIndex * 2) % CHEF_NAMES.length];
  const chefB = CHEF_NAMES[(outletIndex * 2 + 1) % CHEF_NAMES.length];
  const teamA = KITCHEN_TEAM_NAMES[(outletIndex * 3) % KITCHEN_TEAM_NAMES.length];
  const teamB = KITCHEN_TEAM_NAMES[(outletIndex * 3 + 1) % KITCHEN_TEAM_NAMES.length];
  const teamC = KITCHEN_TEAM_NAMES[(outletIndex * 3 + 2) % KITCHEN_TEAM_NAMES.length];

  return [
    {
      id: `staff-${outlet.id}-1`,
      name: `Manager ${outlet.name}`,
      role: 'Manager',
      department: 'Management',
      station: 'Floor & Operations',
      shift: 'Split',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-2`,
      name: `Cashier ${outlet.name}`,
      role: 'Cashier',
      department: 'Front of House',
      station: 'Main POS Counter',
      shift: 'Morning',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-3`,
      name: `Waiter ${outlet.name} A`,
      role: 'Cashier',
      department: 'Front of House',
      station: 'Dining Floor',
      shift: 'Evening',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-hc`,
      name: headChefName,
      role: 'Head Chef',
      department: 'Kitchen',
      station: 'Executive Pass & Quality',
      shift: 'Split',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-c1`,
      name: chefA,
      role: 'Chef',
      department: 'Kitchen',
      station: 'Tandoor & Curry',
      shift: 'Morning',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-c2`,
      name: chefB,
      role: 'Chef',
      department: 'Kitchen',
      station: 'Wok, Grill & Continental',
      shift: 'Evening',
      status: outletIndex % 2 === 0 ? 'On Duty' : 'Break',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-kt1`,
      name: teamA,
      role: 'Kitchen Team',
      department: 'Kitchen',
      station: 'Commis I • Prep & Garde Manger',
      shift: 'Morning',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-kt2`,
      name: teamB,
      role: 'Kitchen Team',
      department: 'Kitchen',
      station: 'Commis II • Fry & Sides',
      shift: 'Evening',
      status: 'On Duty',
      outletId: outlet.id,
    },
    {
      id: `staff-${outlet.id}-kt3`,
      name: teamC,
      role: 'Kitchen Team',
      department: 'Kitchen',
      station: 'Pastry & Utility',
      shift: 'Evening',
      status: 'Off Duty',
      outletId: outlet.id,
    },
  ];
};

export let STAFF: Staff[] = OUTLETS.flatMap((outlet, idx) => createStaffForOutlet(outlet, idx));

export const addOutlet = (name: string, city: string): Outlet => {
  const id = `ot-${OUTLETS.length + 1}`;
  const newOutlet: Outlet = { id, name, city, currency: 'INR' };
  const outletIdx = OUTLETS.length;
  OUTLETS.push(newOutlet);
  STAFF.push(...createStaffForOutlet(newOutlet, outletIdx));
  STOCK.push(...createStockForOutlet(newOutlet, outletIdx));

  // Seed some initial data for this outlet
  for (let i = 0; i < 7; i++) {
    const date = subDays(new Date(), i);
    cachedBills.push(...generateBillsForDay(date, id));
  }

  return newOutlet;
};

const MENU_CATALOG: Array<{ name: string; category: string; price: number; isVeg: boolean }> = [
  { name: "Tinku's Special Cold Coffee", category: 'Coffee & Shakes', price: 140, isVeg: true },
  { name: 'KitKat Crunch Shake', category: 'Coffee & Shakes', price: 180, isVeg: true },
  { name: 'Oreo Thick Shake', category: 'Coffee & Shakes', price: 175, isVeg: true },
  { name: 'Hazelnut Cappuccino', category: 'Coffee & Shakes', price: 160, isVeg: true },
  { name: 'Belgian Dark Chocolate Shake', category: 'Coffee & Shakes', price: 195, isVeg: true },
  { name: 'Classic Iced Americano', category: 'Beverages', price: 130, isVeg: true },
  { name: 'Virgin Mint Mojito', category: 'Beverages', price: 145, isVeg: true },
  { name: 'Masala Cheese Grilled Sandwich', category: 'Sandwiches & Wraps', price: 165, isVeg: true },
  { name: 'Paneer Tikka Club Sandwich', category: 'Sandwiches & Wraps', price: 190, isVeg: true },
  { name: 'Bombay Junglee Sandwich', category: 'Sandwiches & Wraps', price: 155, isVeg: true },
  { name: 'Crispy Paneer Wrap', category: 'Sandwiches & Wraps', price: 175, isVeg: true },
  { name: 'Farmhouse Margherita Pizza', category: 'Pizza & Pasta', price: 295, isVeg: true },
  { name: 'Tandoori Paneer Pizza', category: 'Pizza & Pasta', price: 345, isVeg: true },
  { name: 'White Sauce Alfredo Penne', category: 'Pizza & Pasta', price: 265, isVeg: true },
  { name: 'Pink Sauce Arrabbiata Pasta', category: 'Pizza & Pasta', price: 275, isVeg: true },
  { name: 'Peri Peri Loaded Fries', category: 'Fast Food', price: 150, isVeg: true },
  { name: 'Cheese Corn Nachos Supreme', category: 'Fast Food', price: 195, isVeg: true },
  { name: 'Cheese Garlic Bread', category: 'Fast Food', price: 140, isVeg: true },
  { name: 'Double Cheese Masala Maggi', category: 'Fast Food', price: 110, isVeg: true },
  { name: 'Crispy Veg Burger Meal', category: 'Fast Food', price: 210, isVeg: true },
  { name: 'Sizzling Walnut Brownie', category: 'Desserts', price: 220, isVeg: true },
  { name: 'Nutella Belgian Waffle', category: 'Desserts', price: 210, isVeg: true },
  { name: 'Biscoff Cheesecake Slice', category: 'Desserts', price: 260, isVeg: true },
  { name: 'Paneer Butter Masala Bowl', category: 'Main Course', price: 310, isVeg: true },
  { name: 'Smoked Dal Makhani Combo', category: 'Main Course', price: 285, isVeg: true },
];

export const ITEMS: Item[] = MENU_CATALOG.map((entry, i) => ({
  id: `item-${i + 1}`,
  name: entry.name,
  category: entry.category,
  price: entry.price,
  isVeg: entry.isVeg,
  stockItemId: `stock-${i + 1}`,
}));

const CUSTOMER_NAMES = [
  'Aarav Sharma', 'Priya Verma', 'Rohan Joshi', 'Ananya Patel', 'Kabir Mehta',
  'Sneha Kulkarni', 'Vikram Singh', 'Neha Tiwari', 'Arjun Malhotra', 'Ishita Jain',
  'Siddharth Gupta', 'Meera Nair', 'Aditya Dubey', 'Kavya Agrawal', 'Rahul Chouhan',
  'Pooja Deshmukh', 'Devansh Saxena', 'Tanvi Bhatnagar', 'Karan Solanki', 'Riya Tomar',
];

export const CUSTOMERS: Customer[] = Array.from({ length: 100 }).map((_, i) => ({
  id: `cust-${i + 1}`,
  name: `${CUSTOMER_NAMES[i % CUSTOMER_NAMES.length]}${i >= CUSTOMER_NAMES.length ? ` (${Math.floor(i / CUSTOMER_NAMES.length) + 1})` : ''}`,
  phone: `98${((i * 7919 + 12345678) % 100000000).toString().padStart(8, '0')}`,
  visits: Math.floor(Math.random() * 20) + 1,
  lifetimeSpend: Math.floor(Math.random() * 10000) + 500,
  lastVisitAt: subDays(new Date(), Math.floor(Math.random() * 60)).toISOString(),
  segment: i % 4 === 0 ? 'VIP' : i % 4 === 1 ? 'Repeat' : i % 4 === 2 ? 'New' : 'Lapsed',
}));

const createStockForOutlet = (outlet: Outlet, outletIndex: number): StockItem[] =>
  ITEMS.map((item, itemIdx) => {
    const seed = (outletIndex * 7 + itemIdx * 13) % 45;
    const onHand = seed < 6 ? seed + 3 : seed + 6;
    return {
      id: `${outlet.id}::${item.stockItemId}`,
      outletId: outlet.id,
      name: `${item.name} base`,
      unit: 'kg',
      onHand,
      reorderLevel: 10,
      expiryDate: addDays(new Date(), ((outletIndex + itemIdx) % 10) + 2).toISOString(),
    };
  });

export const createInitialStock = (): StockItem[] =>
  OUTLETS.flatMap((outlet, outletIdx) => createStockForOutlet(outlet, outletIdx));

export let STOCK: StockItem[] = createInitialStock();

export const INITIAL_STOCK_TRANSFERS: StockTransfer[] = [
  {
    id: 'trf-seed-1',
    itemName: "Tinku's Special Cold Coffee base",
    unit: 'kg',
    quantity: 12,
    fromOutletId: 'ot-tinku-1',
    fromOutletName: "Tinku's Cafe - Vijay Nagar",
    toOutletId: 'ot-tinku-5',
    toOutletName: "Tinku's Cafe - Bhawarkua",
    sourceBefore: 36,
    sourceAfter: 24,
    destBefore: 5,
    destAfter: 17,
    notes: 'Evening rush replenishment',
    transferredBy: "Manager Tinku's Cafe - Vijay Nagar",
    transferredAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
  },
  {
    id: 'trf-seed-2',
    itemName: 'Masala Cheese Grilled Sandwich base',
    unit: 'kg',
    quantity: 8,
    fromOutletId: 'ot-tinku-2',
    fromOutletName: "Tinku's Cafe - Old Palasia",
    toOutletId: 'ot-tinku-3',
    toOutletName: "Tinku's Cafe - MG Road City Centre",
    sourceBefore: 29,
    sourceAfter: 21,
    destBefore: 6,
    destAfter: 14,
    notes: 'Central kitchen rebalance',
    transferredBy: "Manager Tinku's Cafe - Old Palasia",
    transferredAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
  {
    id: 'trf-seed-3',
    itemName: 'Belgian Dark Chocolate Shake base',
    unit: 'kg',
    quantity: 10,
    fromOutletId: 'ot-indore-2',
    fromOutletName: 'Blanco Cafe & Bistro - Vijay Nagar',
    toOutletId: 'ot-indore-1',
    toOutletName: 'Mr. Beans Cafe - Old Palasia',
    sourceBefore: 34,
    sourceAfter: 24,
    destBefore: 4,
    destAfter: 14,
    notes: 'Inter-outlet stock balance',
    transferredBy: 'Manager Blanco Cafe & Bistro - Vijay Nagar',
    transferredAt: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
  },
];

const CAFE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 23];

const createSingleBill = (
  date: Date,
  outletId: string,
  index: number,
  options?: { exactTimestamp?: boolean; forceStandard?: boolean }
): Bill => {
  const createdAt = new Date(date);
  if (!options?.exactTimestamp) {
    const hour = CAFE_HOURS[Math.floor(Math.random() * CAFE_HOURS.length)];
    createdAt.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  }

  const itemsCount = Math.floor(Math.random() * 4) + 1;
  const billItems: BillItem[] = Array.from({ length: itemsCount }).map(() => {
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const qty = Math.floor(Math.random() * 3) + 1;
    return {
      itemId: item.id,
      name: item.name,
      category: item.category,
      qty,
      unitPrice: item.price,
      modifiers: [],
      lineTotal: qty * item.price,
    };
  });

  const subtotal = billItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const tax = subtotal * 0.05; // 5% GST
  const discount = Math.random() > 0.8 ? subtotal * 0.1 : 0;
  const total = subtotal + tax - discount;

  const orderType = ['Dine-in', 'Takeaway', 'Online'][Math.floor(Math.random() * 3)] as OrderType;
  const source = orderType === 'Online'
    ? (['Swiggy', 'Zomato', 'Magicpin'][Math.floor(Math.random() * 3)] as OrderSource)
    : ('Direct' as OrderSource);

  const isCancelled = options?.forceStandard ? false : Math.random() > 0.95;
  const status = isCancelled ? 'Cancelled' : ('Paid' as OrderStatus);
  const cancellationReason = isCancelled
    ? ['Customer requested', 'Item out of stock', 'Delivery partner unavailable'][Math.floor(Math.random() * 3)]
    : undefined;

  const payments: Payment[] = [
    {
      mode: ['Cash', 'Card', 'UPI', 'Wallet'][Math.floor(Math.random() * 4)] as PaymentMode,
      amount: isCancelled ? 0 : total,
    },
  ];

  const assignedCustomer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];

  return {
    id: `bill-${outletId}-${createdAt.getTime()}-${index}`,
    outletId,
    createdAt: createdAt.toISOString(),
    orderType,
    source,
    tableNo: orderType === 'Dine-in' ? Math.floor(Math.random() * 20 + 1).toString() : undefined,
    staffId: `staff-${outletId}-${Math.floor(Math.random() * 3) + 1}`,
    customerName: assignedCustomer?.name.replace(/\s*\(\d+\)$/, ''),
    customerPhone: assignedCustomer?.phone,
    items: billItems,
    subtotal,
    tax,
    discount,
    total,
    payments,
    status,
    isHighPriority: options?.forceStandard ? false : total > 2000 || billItems.length > 5,
    cancellationReason,
  };
};

// Function to generate bills for a specific day
const generateBillsForDay = (date: Date, outletId: string): Bill[] => {
  const bills: Bill[] = [];
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFlagship =
    outletId === 'ot-tinku-1' ||
    outletId === 'ot-tinku-2' ||
    outletId === 'ot-indore-2' ||
    outletId === 'ot-indore-12' ||
    outletId === 'ot-indore-13' ||
    outletId === 'ot-indore-15' ||
    outletId === 'ot-1';
  const baseCount = isFlagship ? (isWeekend ? 65 : 48) : (isWeekend ? 45 : 32);
  const count = Math.floor(Math.random() * 18) + baseCount;

  const now = new Date();
  const isToday = isSameDay(date, now);

  for (let i = 0; i < count; i++) {
    const bill = createSingleBill(date, outletId, i);
    // For today, ensure bills aren't placed in the future
    if (isToday && new Date(bill.createdAt) > now) {
      const adjusted = new Date(now.getTime() - Math.floor(Math.random() * 1000 * 60 * 60 * 6));
      bill.createdAt = adjusted.toISOString();
    }
    bills.push(bill);
  }
  return bills;
};

// We store bills in memory or generate them on demand
// For the dashboard, we'll generate them for the last 90 days once
let cachedBills: Bill[] = [];

export const getBills = (startDate: Date, endDate: Date, outletId?: string): Bill[] => {
  if (cachedBills.length === 0) {
    // Seed 90 days
    for (let i = 0; i < 90; i++) {
      const date = subDays(new Date(), i);
      OUTLETS.forEach(outlet => {
        cachedBills.push(...generateBillsForDay(date, outlet.id));
      });
    }
  }

  return cachedBills.filter(bill => {
    const billDate = new Date(bill.createdAt);
    const matchesDate = billDate >= startDate && billDate <= endDate;
    const matchesOutlet = outletId ? bill.outletId === outletId : true;
    return matchesDate && matchesOutlet;
  });
};

export const addLiveBill = (outletId: string, options?: { forceStandard?: boolean }): Bill => {
  const bill = createSingleBill(new Date(), outletId, Math.floor(Math.random() * 10000), {
    exactTimestamp: true,
    forceStandard: options?.forceStandard,
  });
  bill.id = `bill-live-${outletId}-${Date.now().toString().slice(-6)}`;
  bill.status = Math.random() > 0.45 ? 'Placed' : 'Preparing';
  cachedBills.push(bill);
  return bill;
};

export const getStaffActivity = (staffId: string, limit: number = 20): StaffActivity[] => {
  // Ensure bills are loaded
  if (cachedBills.length === 0) {
    getBills(subDays(new Date(), 7), new Date());
  }

  const staff = STAFF.find(s => s.id === staffId);
  if (!staff) return [];

  const activities: StaffActivity[] = [];

  if (staff.department === 'Kitchen') {
    const outletBills = cachedBills
      .filter(b => b.outletId === staff.outletId && b.status !== 'Cancelled')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    outletBills.forEach((bill, index) => {
      const billDate = new Date(bill.createdAt);
      const itemCount = bill.items.reduce((acc, item) => acc + item.qty, 0);

      activities.push({
        id: `act-kot-${staffId}-${bill.id}`,
        staffId,
        type: 'KOTPrepared',
        timestamp: bill.createdAt,
        description:
          staff.role === 'Head Chef'
            ? `Verified & dispatched KOT #${bill.id.slice(-6)} (${itemCount} items)`
            : `Prepared KOT #${bill.id.slice(-6)} at ${staff.station || 'Kitchen'} (${itemCount} items)`,
        metadata: { billId: bill.id, station: staff.station },
      });

      if (index % 4 === 0) {
        const prepTime = new Date(billDate.getTime() - 1000 * 60 * 20).toISOString();
        activities.push({
          id: `act-prep-${staffId}-${index}`,
          staffId,
          type: 'PrepCompleted',
          timestamp: prepTime,
          description: `Completed batch mise-en-place for ${staff.station || 'Kitchen Station'}`,
        });
      }

      if (index % 6 === 0) {
        const loginTime = new Date(billDate.getTime() - 1000 * 60 * 90).toISOString();
        activities.push({
          id: `act-kds-login-${staffId}-${index}`,
          staffId,
          type: 'Login',
          timestamp: loginTime,
          description: `Checked in to Kitchen Display System (${staff.shift} shift)`,
        });
      }
    });

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  const staffBills = cachedBills
    .filter(b => b.staffId === staffId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  staffBills.forEach((bill, index) => {
    const billDate = new Date(bill.createdAt);
    
    activities.push({
      id: `act-bill-${bill.id}`,
      staffId,
      type: 'BillGenerated',
      timestamp: bill.createdAt,
      description: `Generated bill #${bill.id.slice(-6)} for ₹${bill.total.toFixed(0)}`,
      metadata: { billId: bill.id, amount: bill.total }
    });

    if (bill.status === 'Cancelled') {
      const cancelTime = new Date(billDate.getTime() + 1000 * 60 * 5).toISOString();
      activities.push({
        id: `act-cancel-${bill.id}`,
        staffId,
        type: 'OrderCancelled',
        timestamp: cancelTime,
        description: `Cancelled order: ${bill.cancellationReason || 'User request'}`,
        metadata: { billId: bill.id, reason: bill.cancellationReason }
      });
    }

    if (index % 5 === 0) {
      const loginTime = new Date(billDate.getTime() - 1000 * 60 * 60).toISOString();
      activities.push({
        id: `act-login-${index}`,
        staffId,
        type: 'Login',
        timestamp: loginTime,
        description: `Logged in to terminal`
      });
      
      const logoutTime = new Date(billDate.getTime() + 1000 * 60 * 60 * 8).toISOString();
       activities.push({
        id: `act-logout-${index}`,
        staffId,
        type: 'Logout',
        timestamp: logoutTime,
        description: `Logged out after shift completion`
      });
    }
  });

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};
