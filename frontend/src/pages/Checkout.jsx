import React from 'react';
import { Layout } from '../components/Layout';
import { ShoppingBag, Calendar, Clock, DollarSign } from 'lucide-react';

export default function Checkout() {
  return (
    <Layout>
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-maya-text">Checkout</h1>
          <p className="text-maya-text-muted">Process payments for appointments</p>
        </div>

        <div className="card-maya text-center py-12">
          <ShoppingBag className="mx-auto text-maya-text-muted mb-4" size={48} />
          <h2 className="text-xl font-semibold text-maya-text">No active checkout</h2>
          <p className="text-maya-text-muted mt-2">
            Select an appointment from the calendar to process checkout
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card-maya">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-maya-info/10 flex items-center justify-center">
                <Calendar className="text-maya-info" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-maya-text">0</p>
                <p className="text-sm text-maya-text-muted">Today's checkouts</p>
              </div>
            </div>
          </div>
          <div className="card-maya">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-maya-success/10 flex items-center justify-center">
                <DollarSign className="text-maya-success" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-maya-text">$0</p>
                <p className="text-sm text-maya-text-muted">Today's revenue</p>
              </div>
            </div>
          </div>
          <div className="card-maya">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-maya-warning/10 flex items-center justify-center">
                <Clock className="text-maya-warning" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-maya-text">0</p>
                <p className="text-sm text-maya-text-muted">Pending</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
