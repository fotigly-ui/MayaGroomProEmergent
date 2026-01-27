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
    street_address: '',
    suburb: '',
    state: '',
    postcode: ''
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
        street_address: client.street_address || client.address || '',
        suburb: client.suburb || '',
        state: client.state || '',
        postcode: client.postcode || ''
      });
      setNewPets([]);
    } else {
      setEditingClient(null);
      setFormData({ name: '', phone: '', email: '', street_address: '', suburb: '', state: '', postcode: '' });
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
      
      // Combine address fields for storage
      const clientData = {
        ...formData,
        address: [formData.street_address, formData.suburb, formData.state, formData.postcode].filter(Boolean).join(', ')
      };
      
      if (editingClient) {
        await clientsAPI.update(editingClient.id, clientData);
        clientId = editingClient.id;
        toast.success('Client updated');
      } else {
        // Create client first
        const clientRes = await clientsAPI.create(clientData);
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
          actions={
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
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={handleSearch}
            className="input-maya"
            style={{ paddingLeft: '2.75rem' }}
            data-testid="search-customers"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-maya-text-muted pointer-events-none" size={18} />
        </div>

        {/* Clients List */}
        <div className="grid gap-1.5">
          {clients.map((client) => (
            <Link
              key={client.id}
              to={`/customers/${client.id}`}
              className="card-maya card-maya-interactive flex items-center justify-between fade-in py-1.5 px-2.5"
              data-testid={`client-card-${client.id}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base text-maya-text">{client.name}</h3>
                  {client.no_show_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-maya-warning bg-yellow-50 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle size={10} />
                      {client.no_show_count}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5 mt-0.5 text-xs text-maya-text-muted">
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} />
                      {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={11} />
                      {client.email}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="text-maya-text-muted group-hover:text-primary transition-colors" size={16} />
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
                <Label>Street Address</Label>
                <Input
                  value={formData.street_address}
                  onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                  placeholder="123 Main Street"
                  data-testid="customer-street-input"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>Suburb</Label>
                  <Input
                    value={formData.suburb}
                    onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                    placeholder="Suburb"
                    data-testid="customer-suburb-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="VIC"
                    data-testid="customer-state-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    placeholder="3000"
                    data-testid="customer-postcode-input"
                  />
                </div>
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
