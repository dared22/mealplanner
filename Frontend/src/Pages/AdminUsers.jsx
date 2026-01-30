import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '@/Entities/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_LIMIT = 20;

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const formatDateParam = (value, isEnd = false) => {
  if (!value) return null;
  return `${value}T${isEnd ? '23:59:59' : '00:00:00'}Z`;
};

const getStatusBadge = (isActive) => {
  if (isActive) {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-rose-100 text-rose-700';
};

export default function AdminUsers() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [inputs, setInputs] = useState({
    search: '',
    startDate: '',
    endDate: '',
  });
  const [filters, setFilters] = useState({
    search: '',
    startDate: '',
    endDate: '',
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
      search: inputs.search.trim(),
      startDate: inputs.startDate,
      endDate: inputs.endDate,
    });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const clearFilters = () => {
    setInputs({ search: '', startDate: '', endDate: '' });
    setFilters({ search: '', startDate: '', endDate: '' });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const fetchUsers = async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }

      const params = new URLSearchParams();
      if (filters.search) {
        params.set('search', filters.search);
      }
      const startDate = formatDateParam(filters.startDate, false);
      const endDate = formatDateParam(filters.endDate, true);
      if (startDate) {
        params.set('start_date', startDate);
      }
      if (endDate) {
        params.set('end_date', endDate);
      }
      params.set('limit', String(pagination.limit));
      params.set('offset', String(pagination.offset));

      const response = await fetch(`${API_URL}/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setUsers(data.items || []);
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
    fetchUsers();
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
        Loading users...
      </div>
    );
  }

  if (status === 'error') {
    const errorMessage = error?.message || 'Something went wrong while fetching users.';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Failed to load users</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="default" onClick={fetchUsers} className="gap-2">
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
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground">
          Search for users, filter by signup date, and review account status.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="user-search">
              Search
            </label>
            <Input
              id="user-search"
              placeholder="Search name or email"
              value={inputs.search}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="start-date">
              Signup start date
            </label>
            <Input
              id="start-date"
              type="date"
              value={inputs.startDate}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="end-date">
              Signup end date
            </label>
            <Input
              id="end-date"
              type="date"
              value={inputs.endDate}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, endDate: event.target.value }))
              }
            />
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
            <div className="text-sm font-medium text-foreground">All users</div>
            <div className="text-xs text-muted-foreground">
              {pagination.total} total users
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            No users match your filters. Try adjusting the search or date range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">User</th>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Signup date</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const statusLabel = user.is_active ? 'Active' : 'Suspended';
                  return (
                    <tr key={user.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {user.username || 'Unnamed user'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                            user.is_active,
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/users/${user.id}`}
                          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          View details
                        </Link>
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
