import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, DollarSign } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { servicesAPI } from '../lib/api';
import { formatCurrency, formatDuration } from '../lib/utils';
import { toast } from 'sonner';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    duration: 60,
    price: 0
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await servicesAPI.list();
      setServices(res.data);
    } catch (error) {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (service = null) => {
    if (service) {
      setEditing(service);
      setFormData({
        name: service.name,
        duration: service.duration,
        price: service.price
      });
    } else {
      setEditing(null);
      setFormData({ name: '', duration: 60, price: 0 });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Service name is required');
      return;
    }

    try {
      if (editing) {
        await servicesAPI.update(editing.id, formData);
        toast.success('Service updated');
      } else {
        await servicesAPI.create(formData);
        toast.success('Service created');
      }
      setShowModal(false);
      fetchServices();
    } catch (error) {
      toast.error('Failed to save service');
    }
  };

  const handleDelete = async () => {
    if (!editing || !window.confirm('Delete this service?')) return;
    
    try {
      await servicesAPI.delete(editing.id);
      toast.success('Service deleted');
      setShowModal(false);
      fetchServices();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="Services" 
          subtitle="Manage your grooming services"
          action={
            <Button onClick={() => openModal()} className="btn-maya-primary" data-testid="add-service-btn">
              <Plus size={18} className="mr-2" />
              Add Service
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div key={service.id} className="card-maya" data-testid={`service-card-${service.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-maya-text text-lg">{service.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-maya-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatDuration(service.duration)}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <DollarSign size={14} />
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openModal(service)}
                  data-testid={`edit-service-${service.id}`}
                >
                  <Edit2 size={16} />
                </Button>
              </div>
            </div>
          ))}

          {services.length === 0 && !loading && (
            <div className="col-span-full empty-state">
              <p className="text-lg font-medium">No services yet</p>
              <p className="text-sm mt-1">Add your grooming services to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Service' : 'New Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Full Groom"
                data-testid="service-name-input"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min="15"
                  step="15"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                  data-testid="service-duration-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Price (AUD)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  data-testid="service-price-input"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {editing && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" data-testid="save-service-btn">
                {editing ? 'Update' : 'Create'} Service
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
