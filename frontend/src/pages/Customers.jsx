import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Phone, Mail, MapPin, ChevronRight, AlertTriangle, Dog, Trash2 } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { clientsAPI, petsAPI } from '../lib/api';
import { toast } from 'sonner';

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
  // Pets to add with new customer
  const [newPets, setNewPets] = useState([]);

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
      setNewPets([]);
    } else {
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', address: '' });
      // Start with one empty pet form for new customers
      setNewPets([{ name: '', breed: '', age: '', notes: '' }]);
    }
    setShowModal(true);
  };

  const addPetForm = () => {
    setNewPets([...newPets, { name: '', breed: '', age: '', notes: '' }]);
  };

  const removePetForm = (index) => {
    setNewPets(newPets.filter((_, i) => i !== index));
  };

  const updatePetForm = (index, field, value) => {
    const updated = [...newPets];
    updated[index] = { ...updated[index], [field]: value };
    setNewPets(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Validate at least one pet for new customers
    if (!editingClient) {
      const validPets = newPets.filter(p => p.name.trim());
      if (validPets.length === 0) {
        toast.error('Please add at least one pet');
        return;
      }
    }

    try {
      let clientId;
      
      if (editingClient) {
        await clientsAPI.update(editingClient.id, formData);
        clientId = editingClient.id;
        toast.success('Client updated');
      } else {
        // Create client first
        const clientRes = await clientsAPI.create(formData);
        clientId = clientRes.data.id;
        
        // Then create all pets
        const validPets = newPets.filter(p => p.name.trim());
        for (const pet of validPets) {
          await petsAPI.create({ ...pet, client_id: clientId });
        }
        
        toast.success(`Client created with ${validPets.length} pet(s)`);
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-maya-text-muted pointer-events-none" size={20} />
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-maya-text">Customer Information</h3>
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
            </div>

            {/* Pets Section - Only for new customers */}
            {!editingClient && (
              <div className="space-y-4 border-t border-maya-border pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-maya-text flex items-center gap-2">
                    <Dog size={18} />
                    Pets *
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPetForm}
                  >
                    <Plus size={14} className="mr-1" />
                    Add Pet
                  </Button>
                </div>

                {newPets.map((pet, index) => (
                  <div key={index} className="p-3 bg-maya-cream rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Pet {index + 1}</Label>
                      {newPets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePetForm(index)}
                          className="text-maya-error h-6 px-2"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3">
                      <Input
                        placeholder="Pet name *"
                        value={pet.name}
                        onChange={(e) => updatePetForm(index, 'name', e.target.value)}
                        data-testid={`pet-name-${index}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Breed"
                          value={pet.breed}
                          onChange={(e) => updatePetForm(index, 'breed', e.target.value)}
                        />
                        <Input
                          placeholder="Age"
                          value={pet.age}
                          onChange={(e) => updatePetForm(index, 'age', e.target.value)}
                        />
                      </div>
                      <Textarea
                        placeholder="Notes (allergies, temperament...)"
                        value={pet.notes}
                        onChange={(e) => updatePetForm(index, 'notes', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                ))}

                {newPets.length === 0 && (
                  <p className="text-sm text-maya-text-muted text-center py-2">
                    Click "Add Pet" to add pets for this customer
                  </p>
                )}
              </div>
            )}

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
