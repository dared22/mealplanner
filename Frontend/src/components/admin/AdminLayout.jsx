import React from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminLayout({ children, adminName, onLogout }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Sidebar */}
      <AdminSidebar />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <AdminHeader adminName={adminName} onLogout={onLogout} />

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
