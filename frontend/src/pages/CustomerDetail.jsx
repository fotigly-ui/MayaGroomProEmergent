import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, Plus, Edit2, Trash2, Calendar, Dog, MessageSquare, Copy, Navigation } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { clientsAPI, petsAPI, appointmentsAPI } from '../lib/api';
import { formatDate, formatTime, formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPetModal, setShowPetModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [petForm, setPetForm] = useState({
    name: '',
    breed: '',
    age: '',
    notes: ''
  });
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  
  // Contact action popups
  const [showPhoneOptions, setShowPhoneOptions] = useState(false);
  const [showAddressOptions, setShowAddressOptions] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientRes, petsRes, apptsRes] = await Promise.all([
        clientsAPI.get(id),
        petsAPI.list(id),
        appointmentsAPI.list({ clientId: id })
      ]);
      setClient(clientRes.data);
      setPets(petsRes.data);
      setAppointments(apptsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load customer');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  const openPetModal = (pet = null) => {
    if (pet) {
      setEditingPet(pet);
      setPetForm({
        name: pet.name,
        breed: pet.breed || '',
        age: pet.age || '',
        notes: pet.notes || ''
      });
    } else {
      setEditingPet(null);
      setPetForm({ name: '', breed: '', age: '', notes: '' });
    }
    setShowPetModal(true);
  };

  const handlePetSubmit = async (e) => {
    e.preventDefault();
    if (!petForm.name.trim()) {
      toast.error('Pet name is required');
      return;
    }

    try {
      if (editingPet) {
        await petsAPI.update(editingPet.id, petForm);
        toast.success('Pet updated');
      } else {
        await petsAPI.create({ ...petForm, client_id: id });
        toast.success('Pet added');
      }
      setShowPetModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save pet');
    }
  };

  const handleDeletePet = async () => {
    if (!editingPet || !window.confirm('Delete this pet?')) return;
    
    try {
      await petsAPI.delete(editingPet.id);
      toast.success('Pet deleted');
      setShowPetModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete pet');
    }
  };

  if (loading || !client) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-pulse text-maya-text-muted">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-2 text-maya-text-muted hover:text-primary transition-colors mb-4"
          data-testid="back-to-customers"
        >
          <ArrowLeft size={20} />
          <span>Back to Customers</span>
        </button>

        {/* Client Info Card */}
        <div className="card-maya mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-maya-text">{client.name}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-maya-text-muted">
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-primary">
                    <Phone size={14} />
                    {client.phone}
                  </a>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-primary">
                    <Mail size={14} />
                    {client.email}
                  </a>
                )}
                {client.address && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {client.address}
                  </span>
                )}
              </div>
            </div>
            {client.no_show_count > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-maya-warning font-medium">{client.no_show_count}</span>
                <span className="text-maya-text-muted ml-1">no-shows</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pets" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pets" data-testid="pets-tab">
              Pets ({pets.length})
            </TabsTrigger>
            <TabsTrigger value="appointments" data-testid="appointments-tab">
              Appointments ({appointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pets">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-maya-text">Pets</h2>
              <Button onClick={() => openPetModal()} className="btn-maya-secondary" data-testid="add-pet-btn">
                <Plus size={16} className="mr-2" />
                Add Pet
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {pets.map((pet) => (
                <div key={pet.id} className="card-maya" data-testid={`pet-card-${pet.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-maya-primary-light flex items-center justify-center">
                        <Dog className="text-primary" size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-maya-text">{pet.name}</h3>
                        {pet.breed && <p className="text-sm text-maya-text-muted">{pet.breed}</p>}
                        {pet.age && <p className="text-sm text-maya-text-muted">{pet.age}</p>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openPetModal(pet)}
                      data-testid={`edit-pet-${pet.id}`}
                    >
                      <Edit2 size={16} />
                    </Button>
                  </div>
                  {pet.notes && (
                    <p className="mt-3 text-sm text-maya-text-muted bg-maya-cream rounded-lg p-3">
                      {pet.notes}
                    </p>
                  )}
                </div>
              ))}

              {pets.length === 0 && (
                <div className="col-span-2 empty-state">
                  <Dog className="empty-state-icon mx-auto" />
                  <p>No pets added yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="appointments">
            <h2 className="text-lg font-semibold text-maya-text mb-4">Appointment History</h2>
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="card-maya flex items-center justify-between"
                  data-testid={`appt-${appt.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-maya-primary-light flex items-center justify-center">
                      <Calendar className="text-primary" size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-maya-text">
                        {formatDate(appt.date_time)} at {formatTime(appt.date_time)}
                      </p>
                      {appt.pets?.length > 0 && (
                        <p className="text-sm text-maya-text-muted">
                          {appt.pets.map(p => p.pet_name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{formatCurrency(appt.total_price)}</p>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      appt.status === 'scheduled' && "bg-maya-info text-white",
                      appt.status === 'completed' && "bg-maya-success text-white",
                      appt.status === 'cancelled' && "bg-gray-400 text-white",
                      appt.status === 'no_show' && "bg-maya-error text-white"
                    )}>
                      {appt.status}
                    </span>
                  </div>
                </div>
              ))}

              {appointments.length === 0 && (
                <div className="empty-state">
                  <Calendar className="empty-state-icon mx-auto" />
                  <p>No appointments yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Pet Modal */}
      <Dialog open={showPetModal} onOpenChange={setShowPetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPet ? 'Edit Pet' : 'Add Pet'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePetSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={petForm.name}
                onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                placeholder="Pet's name"
                data-testid="pet-name-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Breed</Label>
              <Input
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                placeholder="e.g., Golden Retriever"
                data-testid="pet-breed-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input
                value={petForm.age}
                onChange={(e) => setPetForm({ ...petForm, age: e.target.value })}
                placeholder="e.g., 3 years"
                data-testid="pet-age-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={petForm.notes}
                onChange={(e) => setPetForm({ ...petForm, notes: e.target.value })}
                placeholder="Special instructions, allergies, temperament..."
                data-testid="pet-notes-input"
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2">
              {editingPet && (
                <Button type="button" variant="destructive" onClick={handleDeletePet}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowPetModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" data-testid="save-pet-btn">
                {editingPet ? 'Update' : 'Add'} Pet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
