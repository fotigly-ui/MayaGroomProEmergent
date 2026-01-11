import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  ShoppingBag, 
  Menu, 
  Settings,
  Scissors,
  Package,
  Clock,
  LogOut,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_d578d077-528c-4967-bdf0-53c37dcde83a/artifacts/6dvktlo7_14F224AC-7591-4953-AD6C-171CC58B1D16.png";

const navItems = [
  { path: '/', icon: Calendar, label: 'Calendar' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/services', icon: Scissors, label: 'Services' },
  { path: '/items', icon: Package, label: 'Items' },
  { path: '/waitlist', icon: Clock, label: 'Waitlist' },
];

const mobileNavItems = [
  { path: '/', icon: Calendar, label: 'Calendar' },
  { path: '/checkout', icon: ShoppingBag, label: 'Checkout' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/more', icon: Menu, label: 'More' },
];

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F5EBE0]">
      {/* Desktop Sidebar - Only visible on md and up */}
      <aside className="fixed left-0 top-0 bottom-0 w-[280px] bg-white border-r border-maya-border hidden md:flex flex-col p-6 z-40">
        {/* Logo */}
        <div className="logo-container mb-8">
          <img src={LOGO_URL} alt="Maya Groom Pro" />
          <span className="logo-text">
            {settings?.business_name || 'Maya Groom Pro'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
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
                <item.icon size={20} strokeWidth={1.5} />
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
            onClick={handleLogout}
            data-testid="logout-btn"
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-maya-text-muted hover:bg-red-50 hover:text-maya-error w-full"
          >
            <LogOut size={20} strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content - Offset on desktop for sidebar */}
      <main className="min-h-screen md:ml-[280px] pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav md:hidden">
        {mobileNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/more' && ['/services', '/items', '/waitlist', '/settings'].includes(location.pathname));
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              className={cn("nav-item", isActive && "active")}
            >
              <item.icon size={24} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-maya-text">{title}</h1>
        {subtitle && <p className="text-maya-text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
