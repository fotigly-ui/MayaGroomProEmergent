import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Menu, 
  Settings,
  Scissors,
  Package,
  Clock,
  LogOut,
  FileText,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-maya-text">{title}</h1>
        {subtitle && <p className="text-maya-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, logout } = useAuth();

  const navItems = [
    { path: '/', icon: Calendar, label: 'Calendar' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/services', icon: Scissors, label: 'Services' },
    { path: '/products', icon: ShoppingBag, label: 'Products' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
  ];

  const mobileNavItems = [
    { path: '/', icon: Calendar, label: 'Calendar' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/services', icon: Scissors, label: 'Services' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-maya-border hidden md:flex flex-col p-6 z-40">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">Maya Groom Pro</h1>
          {settings?.business_name && (
            <p className="text-sm text-maya-text-muted mt-1">{settings.business_name}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  isActive 
                    ? "bg-primary text-white"
                    : "text-maya-text-muted hover:bg-maya-primary-light hover:text-primary"
                )}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="mt-auto space-y-1">
          <Link
            to="/settings"
            data-testid="nav-settings"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
              location.pathname === '/settings'
                ? "bg-primary text-white"
                : "text-maya-text-muted hover:bg-maya-primary-light hover:text-primary"
            )}
          >
            <Settings size={20} strokeWidth={1.5} />
            <span>Settings</span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-maya-text-muted hover:bg-red-50 hover:text-red-600 w-full"
          >
            <LogOut size={20} strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="md:ml-64">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-maya-border z-50">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full",
                  isActive ? "text-primary" : "text-maya-text-muted"
                )}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => navigate('/settings')}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full",
              location.pathname === '/settings' ? "text-primary" : "text-maya-text-muted"
            )}
          >
            <Menu size={20} strokeWidth={1.5} />
            <span className="text-xs mt-1">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
