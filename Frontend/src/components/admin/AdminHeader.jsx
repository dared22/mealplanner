import React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminHeader({ adminName, onLogout }) {
  return (
    <header className="h-16 bg-background border-b border-border px-6 flex items-center justify-between">
      {/* Left: Page Title */}
      <div className="flex items-center">
        <h2 className="text-lg font-semibold text-foreground">Admin Panel</h2>
      </div>

      {/* Right: Admin Name + Logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{adminName || 'Admin'}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </Button>
      </div>
    </header>
  );
}
