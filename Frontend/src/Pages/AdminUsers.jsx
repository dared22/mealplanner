import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
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

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="text-sm font-medium text-foreground">All users</div>
          <div className="text-xs text-muted-foreground">
            {pagination.total} total users
          </div>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            No users match your filters. Try adjusting the search or date range.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li key={user.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">
                      {user.username || 'Unnamed user'}
                    </div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Signed up {formatDate(user.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
