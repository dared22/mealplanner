import React from 'react';
import { Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminHeader({ adminName, onLogout }) {
  return (
    <header className="h-16 bg-background border-b border-border px-6 flex items-center justify-between">
      {/* Left: Page Title */}
      <div className="flex items-center">
        <h2 className="text-lg font-semibold text-foreground">Admin Panel</h2>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search users, recipes, logs..."
            className="pl-10 w-full"
          />
        </div>
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
