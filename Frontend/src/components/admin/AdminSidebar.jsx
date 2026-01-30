import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminSidebar() {
  const location = useLocation();

  // Derive active section from current path
  const getActiveSection = () => {
    const path = location.pathname;
    if (path === '/admin') return 'dashboard';
    if (path.startsWith('/admin/users')) return 'users';
    if (path.startsWith('/admin/recipes')) return 'recipes';
    if (path.startsWith('/admin/logs')) return 'logs';
    return '';
  };

  const activeSection = getActiveSection();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/admin',
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      path: '/admin/users',
    },
    {
      id: 'recipes',
      label: 'Recipe Database',
      icon: BookOpen,
      path: '/admin/recipes',
    },
    {
      id: 'logs',
      label: 'Activity Logs',
      icon: ScrollText,
      path: '/admin/logs',
    },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border h-full flex flex-col">
      {/* Logo/Title */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
