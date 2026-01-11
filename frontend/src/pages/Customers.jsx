import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Phone, Mail, MapPin, ChevronRight, AlertTriangle } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { clientsAPI } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function Customers() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async (searchTerm = '') => {
    setLoading(true);
    try {
      const res = await clientsAPI.list(searchTerm);
      setClients(res.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    fetchClients(value);
  };

  const openModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || ''
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', address: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editingClient) {
        await clientsAPI.update(editingClient.id, formData);
        toast.success('Client updated');
      } else {
        await clientsAPI.create(formData);
        toast.success('Client created');
      }
      setShowModal(false);
      fetchClients(search);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save client');
    }
  };

  const handleDelete = async () => {
    if (!editingClient || !window.confirm('Delete this client and all their pets?')) return;
    
    try {
      await clientsAPI.delete(editingClient.id);
      toast.success('Client deleted');
      setShowModal(false);
      fetchClients(search);
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="Customers" 
          subtitle={`${clients.length} total clients`}
          action={
            <Button 
              onClick={() => openModal()} 
              className="btn-maya-primary"
              data-testid="add-customer-btn"
            >
              <Plus size={18} className="mr-2" />
              Add Customer
            </Button>
          }
        />

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-maya-text-muted" size={20} />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={handleSearch}
            className="pl-10 input-maya"
            data-testid="search-customers"
          />
        </div>

        {/* Clients List */}
        <div className="grid gap-4">
          {clients.map((client) => (
            <Link
              key={client.id}
              to={`/customers/${client.id}`}
              className="card-maya card-maya-interactive flex items-center justify-between fade-in"
              data-testid={`client-card-${client.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-maya-text">{client.name}</h3>
                  {client.no_show_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-maya-warning bg-yellow-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={12} />
                      {client.no_show_count} no-show{client.no_show_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-maya-text-muted">
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={14} />
                      {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={14} />
                      {client.email}
                    </span>
                  )}
                  {client.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {client.address}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="text-maya-text-muted group-hover:text-primary transition-colors" />
            </Link>
          ))}

          {clients.length === 0 && !loading && (
            <div className="empty-state">
              <p className="text-lg font-medium">No customers found</p>
              <p className="text-sm mt-1">
                {search ? 'Try a different search term' : 'Add your first customer to get started'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Customer name"
                data-testid="customer-name-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+61 4XX XXX XXX"
                data-testid="customer-phone-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                data-testid="customer-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Street address"
                data-testid="customer-address-input"
              />
            </div>
            <DialogFooter className="gap-2">
              {editingClient && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" data-testid="save-customer-btn">
                {editingClient ? 'Update' : 'Create'} Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
