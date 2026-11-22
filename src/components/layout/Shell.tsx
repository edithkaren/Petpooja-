/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { 
  LayoutDashboard, 
  IndianRupee, 
  ClipboardList, 
  Package, 
  Users, 
  UserCircle, 
  BarChart3, 
  Settings, 
  Menu, 
  X, 
  Bell,
  ChevronDown,
  RefreshCw,
  Clock,
  Activity,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Briefcase,
  Store,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { OutletSelector } from '@/components/layout/OutletSelector';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTheme } from '@/hooks/use-theme';
import { ROLE_LABELS, UserRole, useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'daily-monitoring', label: 'Daily Monitoring', icon: Activity },
  { id: 'sales', label: 'Sales', icon: IndianRupee },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'staff', label: 'Staff', icon: UserCircle },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
  cafe_owner: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  manager: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
};

const ROLE_ICON_MAP: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  admin: ShieldCheck,
  cafe_owner: Briefcase,
  manager: Store,
};

function getUserInitials(name?: string): string {
  if (!name) return 'U';
  const cleaned = name.replace(/\(.*?\)/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const Shell: React.FC<{ activePage: string; onPageChange: (id: string) => void; children: React.ReactNode }> = ({ 
  activePage, 
  onPageChange, 
  children 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const { lastUpdated, refreshData, outlets, isLiveFeedPaused, toggleLiveFeed } = useDashboard();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleToggleLiveFeed = () => {
    const nextPaused = !isLiveFeedPaused;
    toggleLiveFeed();
    if (nextPaused) {
      toast.info('Live feed paused. Real-time polling stopped for inspection.');
    } else {
      toast.success('Live feed resumed. Real-time polling active.');
    }
  };

  const assignedOutlet = user?.assignedOutletId
    ? outlets.find(o => o.id === user.assignedOutletId)
    : undefined;
  const RoleIcon = user ? ROLE_ICON_MAP[user.role] : UserCircle;

  const handleLogout = () => {
    logout();
    onPageChange('dashboard');
    toast.success('Signed out successfully.');
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
            P
          </div>
          {isSidebarOpen && (
            <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">Petpooja</span>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                activePage === item.id 
                  ? "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400 font-medium" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-800 dark:hover:text-slate-100"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", activePage === item.id ? "text-orange-600 dark:text-orange-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-neutral-800">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <OutletSelector />

            <div className="h-6 w-px bg-slate-200 dark:bg-neutral-800 hidden md:block" />

            <DateRangePicker />

            <div className="h-6 w-px bg-slate-200 dark:bg-neutral-800 hidden lg:block" />

            <div
              className={cn(
                "hidden xl:flex items-center gap-2 text-xs font-medium uppercase tracking-wider",
                isLiveFeedPaused ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isLiveFeedPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                )}
              />
              {isLiveFeedPaused ? 'Paused' : 'Live'}
              <span className="ml-1 font-mono tabular-nums lowercase flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                {isLiveFeedPaused ? 'Frozen at' : 'Updated'} {format(lastUpdated, 'HH:mm:ss')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleLiveFeed}
              aria-pressed={isLiveFeedPaused}
              title={
                isLiveFeedPaused
                  ? 'Resume real-time data polling'
                  : 'Pause real-time data polling to inspect data without view jumping'
              }
              className={cn(
                "h-9 gap-2 px-3 whitespace-nowrap shrink-0 cursor-pointer transition-colors",
                isLiveFeedPaused
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
                  : "border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200"
              )}
            >
              {isLiveFeedPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-medium">Resume Live Feed</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-xs font-medium">Pause Live Feed</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="h-9 gap-2 px-3 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline text-xs font-medium">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline text-xs font-medium">Dark</span>
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={refreshData} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Refresh data">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 relative" title="Notifications">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-neutral-900" />
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 flex items-center justify-center text-xs font-bold border border-orange-200 dark:border-orange-500/30">
                    {getUserInitials(user.name)}
                  </div>
                  <div className="hidden xl:flex flex-col items-start text-left leading-tight">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[130px] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                      <RoleIcon className="w-3 h-3 text-orange-500" />
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-1.5">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2.5 py-2 font-normal">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                            {user.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] shrink-0 gap-1", ROLE_BADGE_STYLES[user.role])}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </div>
                      {user.role === 'manager' && assignedOutlet && (
                        <div className="mt-2 rounded-md bg-slate-50 dark:bg-neutral-800 px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">Assigned: {assignedOutlet.name}</span>
                        </div>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer justify-between px-2.5 py-2">
                    <span className="flex items-center gap-2">
                      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                      <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPageChange('settings')} className="cursor-pointer px-2.5 py-2">
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Outlet Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleLogout} className="cursor-pointer px-2.5 py-2">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
