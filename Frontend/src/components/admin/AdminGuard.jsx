import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import AdminLayout from './AdminLayout';
import Forbidden from '@/Pages/Forbidden';
import { API_URL } from '@/Entities/api';

export default function AdminGuard() {
  const navigate = useNavigate();
  const { getToken, signOut } = useAuth();

  const [status, setStatus] = useState('loading');
  const [adminData, setAdminData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const checkAdminSession = async () => {
      setStatus('loading');

      try {
        const token = await getToken();

        const response = await fetch(`${API_URL}/admin/session`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          setAdminData(data);
          setStatus('authorized');
          return;
        }

        if (response.status === 403) {
          setStatus('forbidden');
          return;
        }

        setStatus('error');
      } catch {
        if (isMounted) {
          setStatus('error');
        }
      }
    };

    checkAdminSession();

    return () => {
      isMounted = false;
    };
  }, [getToken]);

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate('/');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading admin panel...
      </div>
    );
  }

  if (status !== 'authorized') {
    return <Forbidden />;
  }

  return (
    <AdminLayout adminName={adminData?.username} onLogout={handleLogout}>
      <Outlet />
    </AdminLayout>
  );
}
