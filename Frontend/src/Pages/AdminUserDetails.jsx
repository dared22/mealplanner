import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '@/Entities/api';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const getStatusBadge = (isActive) => {
  if (isActive) {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-rose-100 text-rose-700';
};

const getPlanBadge = (status) => {
  switch (status) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'error':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export default function AdminUserDetails() {
  const { userId } = useParams();
  const { getToken } = useAuth();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const preferences = useMemo(() => user?.preferences || [], [user]);

  const fetchUser = async () => {
    if (!userId) return;
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      setUser(data);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading user details...
      </div>
    );
  }

  if (status === 'error') {
    const errorMessage = error?.message || 'Something went wrong while fetching user details.';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Failed to load user</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="default" onClick={fetchUser} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Link to="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
            Back to users
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">User Details</h1>
          <p className="text-muted-foreground">
            Inspect preferences, meal plans, and manage account status.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(user.is_active)}`}
          >
            {user.is_active ? 'Active' : 'Suspended'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Name</div>
              <div className="text-sm font-medium text-foreground">
                {user.username || '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Email</div>
              <div className="text-sm font-medium text-foreground">{user.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Signup date</div>
              <div className="text-sm font-medium text-foreground">
                {formatDateTime(user.created_at)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Clerk ID</div>
              <div className="text-sm font-medium text-foreground break-all">
                {user.clerk_user_id || '—'}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Account</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Admin</span>
              <span className="font-medium text-foreground">{user.is_admin ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-foreground">
                {user.is_active ? 'Active' : 'Suspended'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Preference History</h2>
            <p className="text-sm text-muted-foreground">
              Each submission includes the saved preferences and generated plan payloads.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {preferences.length} {preferences.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        {preferences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            No preferences submitted yet.
          </div>
        ) : (
          <div className="space-y-4">
            {preferences.map((preference) => {
              const rawData = preference?.raw_data || {};
              const planPayload = rawData?.generated_plan || null;
              return (
                <div
                  key={preference.id}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Submitted</div>
                      <div className="text-sm font-medium text-foreground">
                        {formatDateTime(preference.submitted_at)}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getPlanBadge(
                        preference.plan_status
                      )}`}
                    >
                      {preference.plan_status || 'unknown'}
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="text-xs uppercase text-muted-foreground">Preferences payload</div>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                        {JSON.stringify(rawData, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="text-xs uppercase text-muted-foreground">Generated plan</div>
                      {planPayload ? (
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                          {JSON.stringify(planPayload, null, 2)}
                        </pre>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No plan payload stored for this preference.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
