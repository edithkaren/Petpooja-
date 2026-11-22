/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { DashboardProvider } from './hooks/use-dashboard';
import { ThemeProvider } from './hooks/use-theme';
import { AuthProvider, useAuth } from './hooks/use-auth';
import { Shell } from './components/layout/Shell';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { DailyMonitoring } from './pages/DailyMonitoring';
import { Sales } from './pages/Sales';
import { Reports } from './pages/Reports';
import { Inventory } from './pages/Inventory';
import { Customers } from './pages/Customers';
import { StaffPage } from './pages/Staff';
import { Settings } from './pages/Settings';
import { CustomerReviewView } from './components/common/CustomerReviewView';
import { Toaster } from 'sonner';

function AppContent() {
  const { user } = useAuth();
  const [activePage, setActivePage] = React.useState('dashboard');
  const [reviewQuery, setReviewQuery] = React.useState<{
    billId: string;
    outletId?: string;
    shortRef?: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const reviewBillId = params.get('review');
    if (!reviewBillId) return null;
    return {
      billId: reviewBillId,
      outletId: params.get('outlet') || undefined,
      shortRef: params.get('ref') || undefined,
    };
  });

  React.useEffect(() => {
    setActivePage('dashboard');
  }, [user?.id]);

  if (reviewQuery) {
    return (
      <CustomerReviewView
        billId={reviewQuery.billId}
        outletId={reviewQuery.outletId}
        shortRef={reviewQuery.shortRef}
        onExitStandalone={() => {
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('review');
            url.searchParams.delete('outlet');
            url.searchParams.delete('ref');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
          setReviewQuery(null);
        }}
      />
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const initialOutletId =
    user.role === 'manager' && user.assignedOutletId ? user.assignedOutletId : 'all';

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'daily-monitoring':
        return <DailyMonitoring />;
      case 'sales':
        return <Sales />;
      case 'reports':
        return <Reports />;
      case 'inventory':
        return <Inventory />;
      case 'customers':
        return <Customers />;
      case 'staff':
        return <StaffPage />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <DashboardProvider initialOutletId={initialOutletId} userId={user.id}>
      <Shell activePage={activePage} onPageChange={setActivePage}>
        {renderPage()}
      </Shell>
    </DashboardProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
