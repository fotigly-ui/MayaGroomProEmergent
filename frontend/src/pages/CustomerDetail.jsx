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
import { AppointmentModal } from '../components/AppointmentModal';
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
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
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

  // Open edit client modal
  const openClientModal = () => {
    setClientForm({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || ''
    });
    setShowClientModal(true);
  };

  // Handle client update
  const handleClientSubmit = async (e) => {
    e.preventDefault();
    if (!clientForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await clientsAPI.update(id, clientForm);
      toast.success('Customer updated');
      setShowClientModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update customer');
    }
  };

  // Handle delete client
  const handleDeleteClient = async () => {
    if (!window.confirm('Delete this customer and all their pets?')) return;
    try {
      await clientsAPI.delete(id);
      toast.success('Customer deleted');
      navigate('/customers');
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  // Phone click handler
  const handlePhoneClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPhoneOptions(true);
  };

  // Address click handler
  const handleAddressClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowAddressOptions(true);
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-maya-text">{client.name}</h1>
                <Button variant="outline" size="sm" onClick={openClientModal} data-testid="edit-client-btn">
                  <Edit2 size={14} className="mr-1" />
                  Edit
                </Button>
                {client.no_show_count > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1 text-xs">
                    <span className="text-maya-warning font-medium">{client.no_show_count}</span>
                    <span className="text-maya-text-muted ml-1">no-shows</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 mt-3 text-sm text-maya-text-muted">
                {client.phone && (
                  <button 
                    onClick={handlePhoneClick}
                    className="flex items-center gap-2 hover:text-primary cursor-pointer w-fit"
                    data-testid="client-phone"
                  >
                    <Phone size={14} />
                    {client.phone}
                  </button>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2 hover:text-primary w-fit">
                    <Mail size={14} />
                    {client.email}
                  </a>
                )}
                {client.address && (
                  <button 
                    onClick={handleAddressClick}
                    className="flex items-center gap-2 hover:text-primary cursor-pointer w-fit text-left"
                    data-testid="client-address"
                  >
                    <MapPin size={14} className="flex-shrink-0" />
                    <span className="break-words">{client.address}</span>
                  </button>
                )}
              </div>
            </div>
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
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming">
                <div className="space-y-3">
                  {appointments.filter(appt => new Date(appt.date_time) >= new Date()).map((appt) => (
                    <div
                      key={appt.id}
                      className="card-maya flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow"
                      data-testid={`appt-${appt.id}`}
                      onClick={() => {
                        setSelectedAppointment(appt);
                        setShowAppointmentModal(true);
                      }}
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
                          appt.status === 'confirmed' && "bg-green-500 text-white",
                          appt.status === 'completed' && "bg-maya-success text-white",
                          appt.status === 'cancelled' && "bg-gray-400 text-white",
                          appt.status === 'no_show' && "bg-maya-error text-white"
                        )}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {appointments.filter(appt => new Date(appt.date_time) >= new Date()).length === 0 && (
                    <div className="empty-state">
                      <Calendar className="empty-state-icon mx-auto" />
                      <p>No upcoming appointments</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="past">
                <div className="space-y-3">
                  {appointments.filter(appt => new Date(appt.date_time) < new Date()).map((appt) => (
                    <div
                      key={appt.id}
                      className="card-maya flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow opacity-75"
                      data-testid={`appt-${appt.id}`}
                      onClick={() => {
                        setSelectedAppointment(appt);
                        setShowAppointmentModal(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <Calendar className="text-gray-600" size={18} />
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
                          appt.status === 'confirmed' && "bg-green-500 text-white",
                          appt.status === 'completed' && "bg-maya-success text-white",
                          appt.status === 'cancelled' && "bg-gray-400 text-white",
                          appt.status === 'no_show' && "bg-maya-error text-white"
                        )}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {appointments.filter(appt => new Date(appt.date_time) < new Date()).length === 0 && (
                    <div className="empty-state">
                      <Calendar className="empty-state-icon mx-auto" />
                      <p>No past appointments</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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

      {/* Edit Client Modal */}
      <Dialog open={showClientModal} onOpenChange={setShowClientModal}>
        <DialogContent className="max-w-md w-[95vw] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0">
            <DialogTitle className="text-base sm:text-lg">Edit Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleClientSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-3 px-4 sm:px-6 overflow-y-auto flex-1">
              <div className="space-y-1">
                <Label className="text-sm">Name *</Label>
                <Input
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="Customer name"
                  data-testid="client-name-input"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Phone</Label>
                <Input
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  placeholder="Phone number"
                  data-testid="client-phone-input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Email</Label>
                <Input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="Email address"
                  data-testid="client-email-input"
                />
              </div>
              <div className="space-y-1 pb-3">
                <Label className="text-sm">Address</Label>
                <Textarea
                  value={clientForm.address}
                  onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  placeholder="Start typing address..."
                  data-testid="client-address-input"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t shrink-0">
              <div className="flex gap-2 w-full">
                <Button type="button" variant="outline" onClick={() => setShowClientModal(false)} className="flex-1 text-xs sm:text-sm">
                  Cancel
                </Button>
                <Button type="submit" className="btn-maya-primary flex-1 text-xs sm:text-sm" data-testid="save-client-btn">
                  Save
                </Button>
              </div>
              <Button type="button" variant="ghost" className="text-red-500 text-xs sm:text-sm w-full" onClick={handleDeleteClient}>
                Delete Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Phone Options Popup */}
      <Dialog open={showPhoneOptions} onOpenChange={setShowPhoneOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{client.phone}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                window.location.href = `tel:${client.phone}`;
                setShowPhoneOptions(false);
              }}
            >
              <Phone size={16} className="mr-2" />
              Call
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                window.location.href = `sms:${client.phone}`;
                setShowPhoneOptions(false);
              }}
            >
              <MessageSquare size={16} className="mr-2" />
              Send SMS
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                copyToClipboard(client.phone);
                setShowPhoneOptions(false);
              }}
            >
              <Copy size={16} className="mr-2" />
              Copy Number
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Options Popup */}
      <Dialog open={showAddressOptions} onOpenChange={setShowAddressOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Open in Maps</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`, '_blank');
                setShowAddressOptions(false);
              }}
            >
              <Navigation size={16} className="mr-2" />
              Google Maps
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                window.open(`https://waze.com/ul?q=${encodeURIComponent(client.address)}`, '_blank');
                setShowAddressOptions(false);
              }}
            >
              <Navigation size={16} className="mr-2" />
              Waze
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                window.open(`maps://?q=${encodeURIComponent(client.address)}`, '_blank');
                setShowAddressOptions(false);
              }}
            >
              <MapPin size={16} className="mr-2" />
              Apple Maps
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                copyToClipboard(client.address);
                setShowAddressOptions(false);
              }}
            >
              <Copy size={16} className="mr-2" />
              Copy Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Modal */}
      {showAppointmentModal && (
        <AppointmentModal
          open={showAppointmentModal}
          onClose={() => {
            setShowAppointmentModal(false);
            setSelectedAppointment(null);
          }}
          onSave={() => {
            fetchData(); // Refresh appointments after save
            setShowAppointmentModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
        />
      )}
    </Layout>
  );
}
