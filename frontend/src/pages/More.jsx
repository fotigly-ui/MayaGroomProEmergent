import React from 'react';
import { Link } from 'react-router-dom';
import { Layout, PageHeader } from '../components/Layout';
import { Scissors, Package, Clock, Settings, ArrowRight, FileText } from 'lucide-react';

const menuItems = [
  { 
    path: '/services', 
    icon: Scissors, 
    label: 'Services', 
    description: 'Manage grooming services' 
  },
  { 
    path: '/items', 
    icon: Package, 
    label: 'Items', 
    description: 'Retail products' 
  },
  { 
    path: '/invoices', 
    icon: FileText, 
    label: 'Invoices', 
    description: 'Billing & invoices' 
  },
  { 
    path: '/waitlist', 
    icon: Clock, 
    label: 'Waitlist', 
    description: 'Clients waiting' 
  },
  { 
    path: '/settings', 
    icon: Settings, 
    label: 'Settings', 
    description: 'Business settings' 
  },
];

export default function More() {
  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="More" 
          subtitle="Additional features and settings"
        />

        <div className="grid gap-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="card-maya card-maya-interactive flex items-center justify-between"
              data-testid={`more-${item.label.toLowerCase()}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-maya-primary-light flex items-center justify-center">
                  <item.icon className="text-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-maya-text">{item.label}</h3>
                  <p className="text-sm text-maya-text-muted">{item.description}</p>
                </div>
              </div>
              <ArrowRight className="text-maya-text-muted" size={20} />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
