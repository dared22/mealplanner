import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { API_URL } from '@/Entities/api';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  Utensils,
} from 'lucide-react';

function formatMetricValue(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}

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

function getGrowthPresentation(wowPercent) {
  const value = Number.isFinite(wowPercent) ? Math.round(wowPercent) : 0;
  if (value > 0) {
    return {
      value,
      icon: ArrowUpRight,
      className: 'text-emerald-600',
    };
  }
  if (value < 0) {
    return {
      value,
      icon: ArrowDownRight,
      className: 'text-rose-600',
    };
  }
  return {
    value,
    icon: Minus,
    className: 'text-muted-foreground',
  };
}

function StatCard({ icon: Icon, label, value, wowPercent, helper }) {
  const growth = getGrowthPresentation(wowPercent);
  const GrowthIcon = growth.icon;
  const growthText = `${growth.value > 0 ? '+' : ''}${growth.value}%`;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
        </div>
        <div className="text-xs text-muted-foreground">Last 7 days</div>
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <div className="text-3xl font-semibold text-foreground">{formatMetricValue(value)}</div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${growth.className}`}>
          <GrowthIcon className="h-4 w-4" />
          {growthText}
        </div>
      </div>
      {helper && <div className="mt-2 text-sm text-muted-foreground">{helper}</div>}
    </div>
  );
}

function HealthStrip({ status, lastChecked }) {
  const normalizedStatus = status || 'unknown';
  const displayStatus = `${normalizedStatus.charAt(0).toUpperCase()}${normalizedStatus.slice(1)}`;
  const healthStyles = {
    healthy: 'bg-emerald-100 text-emerald-700',
    degraded: 'bg-amber-100 text-amber-700',
    down: 'bg-rose-100 text-rose-700',
    unknown: 'bg-slate-100 text-slate-600',
  };
  const badgeClass = healthStyles[normalizedStatus] || healthStyles.unknown;

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium text-foreground">System Health</div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {displayStatus}
        </span>
        <div className="ml-auto text-xs text-muted-foreground">
          Last checked {formatRelativeTime(lastChecked)}
        </div>
      </div>
    </div>
  );
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
        <StatCard
          icon={Users}
          label="Users"
          value={users?.total}
          wowPercent={users?.wow_percent}
          helper={`New this week: ${formatMetricValue(users?.current_week)}`}
        />
        <StatCard
          icon={Utensils}
          label="Recipes"
          value={recipes?.total}
          wowPercent={recipes?.wow_percent}
          helper={`New this week: ${formatMetricValue(recipes?.current_week)}`}
        />
      </div>

      <HealthStrip status={health?.status} lastChecked={lastUpdated} />
    </div>
  );
}
