import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '@/Entities/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_LIMIT = 20;

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
};

const formatDateParam = (value, isEnd = false) => {
  if (!value) return null;
  return `${value}T${isEnd ? '23:59:59' : '00:00:00'}Z`;
};

const statusStyles = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  critical: 'bg-rose-200 text-rose-800',
};

const getStatusBadge = (status) => statusStyles[status] || 'bg-slate-100 text-slate-700';

const formatActor = (entry) => {
  const label = entry.actor_label || entry.actor_id || 'System';
  return { label, type: entry.actor_type || 'system' };
};

const formatActionType = (value) =>
  value
    ? value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : '—';

export default function AdminLogs() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [inputs, setInputs] = useState({
    startDate: '',
    endDate: '',
    actorType: 'all',
    status: 'all',
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    actorType: 'all',
    status: 'all',
  });

  const totalPages = useMemo(() => {
    if (!pagination.total) return 1;
    return Math.max(1, Math.ceil(pagination.total / pagination.limit));
  }, [pagination.limit, pagination.total]);

  const currentPage = useMemo(() => {
    return Math.floor(pagination.offset / pagination.limit) + 1;
  }, [pagination.limit, pagination.offset]);

  const canGoBack = pagination.offset > 0;
  const canGoNext = pagination.offset + pagination.limit < pagination.total;

  const applyFilters = () => {
    setFilters({
      startDate: inputs.startDate,
      endDate: inputs.endDate,
      actorType: inputs.actorType,
      status: inputs.status,
    });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const clearFilters = () => {
    setInputs({ startDate: '', endDate: '', actorType: 'all', status: 'all' });
    setFilters({ startDate: '', endDate: '', actorType: 'all', status: 'all' });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const fetchLogs = async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }

      const params = new URLSearchParams();
      const startDate = formatDateParam(filters.startDate, false);
      const endDate = formatDateParam(filters.endDate, true);
      if (startDate) {
        params.set('start_date', startDate);
      }
      if (endDate) {
        params.set('end_date', endDate);
      }
      if (filters.actorType !== 'all') {
        params.set('actor_type', filters.actorType);
      }
      if (filters.status !== 'all') {
        params.set('status', filters.status);
      }
      params.set('limit', String(pagination.limit));
      params.set('offset', String(pagination.offset));

      const response = await fetch(`${API_URL}/admin/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setLogs(data.items || []);
      if (data.pagination) {
        setPagination({
          total: data.pagination.total,
          limit: data.pagination.limit,
          offset: data.pagination.offset,
        });
      } else {
        setPagination((prev) => ({ ...prev, total: 0 }));
      }
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.offset, pagination.limit]);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && canGoBack) {
      setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
    }
    if (direction === 'next' && canGoNext) {
      setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading activity logs...
      </div>
    );
  }

  if (status === 'error') {
    const errorMessage = error?.message || 'Something went wrong while fetching activity logs.';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Failed to load activity logs</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="default" onClick={fetchLogs} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  const startIndex = pagination.total === 0 ? 0 : pagination.offset + 1;
  const endIndex = Math.min(pagination.offset + pagination.limit, pagination.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-muted-foreground">
          Review admin, user, and system activity with status and date filters.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="log-start-date">
              Start date
            </label>
            <Input
              id="log-start-date"
              type="date"
              value={inputs.startDate}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="log-end-date">
              End date
            </label>
            <Input
              id="log-end-date"
              type="date"
              value={inputs.endDate}
              onChange={(event) => setInputs((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="log-actor-type">
              Actor type
            </label>
            <select
              id="log-actor-type"
              value={inputs.actorType}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, actorType: event.target.value }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="system">System</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="log-status">
              Status
            </label>
            <select
              id="log-status"
              value={inputs.status}
              onChange={(event) => setInputs((prev) => ({ ...prev, status: event.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={applyFilters}>Apply filters</Button>
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">All events</div>
            <div className="text-xs text-muted-foreground">{pagination.total} total entries</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            No activity logs match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Timestamp</th>
                  <th className="px-6 py-3 text-left font-medium">Action</th>
                  <th className="px-6 py-3 text-left font-medium">Actor</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((entry) => {
                  const actor = formatActor(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">
                          {formatActionType(entry.action_type)}
                        </div>
                        {entry.action_detail && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {entry.action_detail}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="font-medium text-foreground">{actor.label}</div>
                        <div className="text-xs text-muted-foreground">{actor.type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                            entry.status,
                          )}`}
                        >
                          {entry.status || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="text-xs text-muted-foreground">
            Showing {startIndex}-{endIndex} of {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={!canGoBack}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={!canGoNext}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
