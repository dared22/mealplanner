import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { API_URL } from '@/Entities/api';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

function formatRelativeTime(date) {
  if (!date) {
    return 'just now';
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMetrics = async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }
      const response = await fetch(`${API_URL}/admin/dashboard/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setMetrics(data);
      setStatus('ready');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading dashboard metrics...
      </div>
    );
  }

  if (status === 'error') {
    const errorMessage = error?.message || 'Something went wrong while fetching dashboard data.';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Failed to load metrics</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage}
          </p>
        </div>
        <Button variant="default" onClick={fetchMetrics} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const { users, recipes, health } = metrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of user growth, recipe inventory, and system health.
          </p>
        </div>
        {lastUpdated && (
          <div className="text-xs text-muted-foreground">
            Last updated {formatRelativeTime(lastUpdated)}
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Users</div>
          <div className="mt-3 space-y-1 text-sm">
            <div>Total users: {users?.total ?? 'N/A'}</div>
            <div>New this week: {users?.current_week ?? 'N/A'}</div>
            <div>Previous week: {users?.previous_week ?? 'N/A'}</div>
            <div>Week over week: {users?.wow_percent ?? 'N/A'}%</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Recipes</div>
          <div className="mt-3 space-y-1 text-sm">
            <div>Total recipes: {recipes?.total ?? 'N/A'}</div>
            <div>New this week: {recipes?.current_week ?? 'N/A'}</div>
            <div>Previous week: {recipes?.previous_week ?? 'N/A'}</div>
            <div>Week over week: {recipes?.wow_percent ?? 'N/A'}%</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="font-medium text-foreground">System Health</div>
          <div className="text-muted-foreground">Status: {health?.status ?? 'unknown'}</div>
          <div className="ml-auto text-xs text-muted-foreground">
            Last checked {formatRelativeTime(lastUpdated)}
          </div>
        </div>
      </div>
    </div>
  );
}
