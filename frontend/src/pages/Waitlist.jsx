import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Calendar, User } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { waitlistAPI, clientsAPI, servicesAPI, petsAPI } from '../lib/api';
import { formatDate, cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Waitlist() {
  const [entries, setEntries] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    preferred_services: [],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [waitlistRes, clientsRes, servicesRes] = await Promise.all([
        waitlistAPI.list(),
        clientsAPI.list(),
        servicesAPI.list()
      ]);
      setEntries(waitlistRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
    } catch (error) {
      toast.error('Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setFormData({ client_id: '', preferred_services: [], notes: '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error('Please select a client');
      return;
    }

    try {
      await waitlistAPI.create(formData);
      toast.success('Added to waitlist');
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to add to waitlist');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove from waitlist?')) return;
    
    try {
      await waitlistAPI.delete(id);
      toast.success('Removed from waitlist');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  const getServiceNames = (serviceIds) => {
    return serviceIds
      .map(id => services.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="Waitlist" 
          subtitle={`${entries.length} clients waiting`}
          action={
            <Button onClick={openModal} className="btn-maya-primary" data-testid="add-waitlist-btn">
              <Plus size={18} className="mr-2" />
              Add to Waitlist
            </Button>
          }
        />

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div 
              key={entry.id} 
              className="card-maya flex items-center justify-between fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
              data-testid={`waitlist-entry-${entry.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-maya-primary-light flex items-center justify-center text-primary font-bold">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-maya-text flex items-center gap-2">
                    <User size={16} className="text-maya-text-muted" />
                    {entry.client_name}
                  </h3>
                  <div className="text-sm text-maya-text-muted mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      Added {formatDate(entry.date_added)}
                    </span>
                  </div>
                  {entry.preferred_services?.length > 0 && (
                    <p className="text-sm text-maya-text-muted mt-1">
                      Services: {getServiceNames(entry.preferred_services)}
                    </p>
                  )}
                  {entry.notes && (
                    <p className="text-sm text-maya-text-muted mt-1 italic">
                      "{entry.notes}"
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(entry.id)}
                className="text-maya-error hover:bg-red-50"
                data-testid={`delete-waitlist-${entry.id}`}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          ))}

          {entries.length === 0 && !loading && (
            <div className="empty-state">
              <Clock className="empty-state-icon mx-auto" />
              <p className="text-lg font-medium">Waitlist is empty</p>
              <p className="text-sm mt-1">Add clients who are waiting for an appointment</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Waitlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select 
                value={formData.client_id} 
                onValueChange={(v) => setFormData({ ...formData, client_id: v })}
              >
                <SelectTrigger data-testid="waitlist-client-select">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Services</Label>
              <div className="grid grid-cols-2 gap-2">
                {services.map((service) => (
                  <label
                    key={service.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                      formData.preferred_services.includes(service.id)
                        ? "border-primary bg-maya-primary-light"
                        : "border-maya-border hover:bg-maya-cream"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.preferred_services.includes(service.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            preferred_services: [...formData.preferred_services, service.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            preferred_services: formData.preferred_services.filter(id => id !== service.id)
                          });
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm">{service.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any specific requests or availability..."
                data-testid="waitlist-notes"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" data-testid="save-waitlist-btn">
                Add to Waitlist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
