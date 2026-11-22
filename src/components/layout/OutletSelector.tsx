/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { Check, ChevronDown, MapPin, Search, Store, X } from 'lucide-react';
import { toast } from 'sonner';

import { useDashboard } from '@/hooks/use-dashboard';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type BranchGroupFilter = 'all' | 'tinkus' | 'indore' | 'other';

export const OutletSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { selectedOutletId, setSelectedOutletId, outlets } = useDashboard();
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [groupFilter, setGroupFilter] = React.useState<BranchGroupFilter>('all');

  const selectedOutlet =
    selectedOutletId === 'all'
      ? null
      : outlets.find((o) => o.id === selectedOutletId) || null;

  const filteredOutlets = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return outlets.filter((outlet) => {
      const isTinku = outlet.name.toLowerCase().includes('tinku');
      const isIndore = outlet.city === 'Indore';
      if (groupFilter === 'tinkus' && !isTinku) return false;
      if (groupFilter === 'indore' && !isIndore) return false;
      if (groupFilter === 'other' && isIndore) return false;
      if (!q) return true;
      return (
        outlet.name.toLowerCase().includes(q) ||
        outlet.city.toLowerCase().includes(q)
      );
    });
  }, [outlets, search, groupFilter]);

  const tinkusOutlets = filteredOutlets.filter((o) =>
    o.name.toLowerCase().includes('tinku')
  );
  const indoreOtherCafes = filteredOutlets.filter(
    (o) => o.city === 'Indore' && !o.name.toLowerCase().includes('tinku')
  );
  const otherCityOutlets = filteredOutlets.filter((o) => o.city !== 'Indore');

  const handleSelectOutlet = (id: string | 'all', label: string) => {
    if (id !== selectedOutletId) {
      setSelectedOutletId(id);
      toast.success(`Switched branch filter to ${label}`);
    }
    setOpen(false);
  };

  const renderBranchSection = (
    heading: string,
    items: typeof outlets,
    accentHeading?: boolean
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mt-1.5 first:mt-0">
        <div
          className={cn(
            'px-2.5 py-1 text-[11px] font-semibold tracking-wide',
            accentHeading
              ? 'text-orange-600 dark:text-orange-400 bg-orange-50/70 dark:bg-orange-500/10'
              : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-neutral-800/70'
          )}
        >
          {heading} ({items.length})
        </div>
        <div className="py-0.5">
          {items.map((outlet) => {
            const isActive = selectedOutletId === outlet.id;
            const isAssigned = user?.assignedOutletId === outlet.id;
            return (
              <button
                key={outlet.id}
                type="button"
                onClick={() => handleSelectOutlet(outlet.id, outlet.name)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left text-xs rounded-md transition-colors cursor-pointer',
                  isActive
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Check
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      isActive ? 'text-orange-600 dark:text-orange-400 opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{outlet.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1">
                  {isAssigned ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Assigned
                    </span>
                  ) : (
                    outlet.city
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch('');
        }
      }}
    >
      <PopoverTrigger
        aria-label="Filter dashboard by restaurant branch"
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs',
          className
        )}
      >
        <Store className="w-4 h-4 text-orange-500 shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[200px]">
          {selectedOutlet ? selectedOutlet.name : `All Outlets (${outlets.length})`}
        </span>
        {selectedOutlet && (
          <span className="hidden md:inline-flex items-center gap-0.5 text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            <MapPin className="w-3 h-3" />
            {selectedOutlet.city}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 sm:w-96 p-0 overflow-hidden">
        {/* Search & Group Filter */}
        <div className="p-2.5 border-b border-slate-200 dark:border-neutral-800 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branch or city..."
              aria-label="Search restaurant branches"
              className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-orange-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear branch search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-neutral-800">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'tinkus', label: "Tinku's" },
                { id: 'indore', label: 'Indore' },
                { id: 'other', label: 'Other Cities' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGroupFilter(tab.id)}
                className={cn(
                  'flex-1 py-1 px-2 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer',
                  groupFilter === tab.id
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* All Outlets + Branch List */}
        <div className="max-h-72 overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => handleSelectOutlet('all', `All Outlets (${outlets.length})`)}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-md transition-colors cursor-pointer mb-1',
              selectedOutletId === 'all'
                ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 font-semibold'
                : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 font-medium'
            )}
          >
            <div className="flex items-center gap-2">
              <Check
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  selectedOutletId === 'all'
                    ? 'text-orange-600 dark:text-orange-400 opacity-100'
                    : 'opacity-0'
                )}
              />
              <span>All Outlets Combined</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {outlets.length} branches
            </span>
          </button>

          {filteredOutlets.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No restaurant branches match "{search}".
            </p>
          ) : (
            <>
              {renderBranchSection("Tinku's Cafe · Indore", tinkusOutlets, true)}
              {renderBranchSection('Indore, MP Cafes & Restaurants', indoreOtherCafes)}
              {renderBranchSection('Other Cities', otherCityOutlets)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-900 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Selection saved across reloads</span>
          {selectedOutletId !== 'all' && (
            <button
              type="button"
              onClick={() => handleSelectOutlet('all', `All Outlets (${outlets.length})`)}
              className="text-orange-600 dark:text-orange-400 font-medium hover:underline cursor-pointer"
            >
              Show All
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
