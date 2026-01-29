import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, Plus, Edit2, Trash2, Calendar, Dog, MessageSquare, Copy, Navigation, UserPlus, Receipt } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { clientsAPI, petsAPI, appointmentsAPI, servicesAPI } from '../lib/api';
import { formatDate, formatTime, formatCurrency, cn } from '../lib/utils';
import { AppointmentModal } from '../components/AppointmentModal';
import { toast } from 'sonner';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
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
    first_name: '',
    surname: '',
    phone: '',
    email: '',
    street_address: '',
    suburb: '',
    state: '',
    postcode: ''
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
      const [clientRes, petsRes, apptsRes, servicesRes] = await Promise.all([
        clientsAPI.get(id),
        petsAPI.list(id),
        appointmentsAPI.list({ clientId: id }),
        servicesAPI.list()
      ]);
      setClient(clientRes.data);
      setPets(petsRes.data);
      setAppointments(apptsRes.data);
      setServices(servicesRes.data || []);
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
    if (!editingPet) return;
    if (!confirm('Delete this pet?')) return;
    
    try {
      await petsAPI.delete(editingPet.id);
      toast.success('Pet deleted');
      setShowPetModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete pet');
    }
  };

  const openClientModal = () => {
    if (client) {
      setClientForm({
        first_name: client.first_name || client.name?.split(' ')[0] || '',
        surname: client.surname || client.name?.split(' ').slice(1).join(' ') || '',
        phone: client.phone || '',
        email: client.email || '',
        street_address: client.street_address || '',
        suburb: client.suburb || '',
        state: client.state || '',
        postcode: client.postcode || ''
      });
    }
    setShowClientModal(true);
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    try {
      await clientsAPI.update(id, clientForm);
      toast.success('Customer updated');
      setShowClientModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update customer');
    }
  };

  const handleDeleteClient = async () => {
    if (!confirm('Delete this customer and all their data?')) return;
    
    try {
      await clientsAPI.delete(id);
      toast.success('Customer deleted');
      navigate('/customers');
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handlePhoneClick = () => {
    setShowPhoneOptions(true);
  };

  const handleAddressClick = () => {
    setShowAddressOptions(true);
  };

  const saveToContacts = () => {
    if (!client) return;
    
    const firstName = client.first_name || client.name?.split(' ')[0] || '';
    const lastName = client.surname || client.name?.split(' ').slice(1).join(' ') || '';
    const streetAddress = client.street_address || '';
    const suburb = client.suburb || '';
    const state = client.state || '';
    const postcode = client.postcode || '';
    
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${lastName};${firstName};;;`,
      `FN:${client.name || `${firstName} ${lastName}`.trim()}`,
      client.phone ? `TEL;TYPE=CELL:${client.phone}` : '',
      client.email ? `EMAIL:${client.email}` : '',
      streetAddress || suburb || state || postcode ? `ADR;TYPE=HOME:;;${streetAddress};${suburb};${state};${postcode};Australia` : '',
      'END:VCARD'
    ].filter(line => line).join('\r\n');
    
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${client.name || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Contact downloaded');
  };

  const handleAppointmentClick = (appt) => {
    navigate(`/?date=${appt.date_time.split('T')[0]}&appointment=${appt.id}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!client) return null;

  return (
    <Layout>
      <div className="space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')} data-testid="back-btn">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-maya-text">Customer Details</h1>
        </div>

        {/* Customer Info Card */}
        <div className="card-maya">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-maya-primary-light flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-primary">
                {client.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-maya-text">{client.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={openClientModal} className="h-7 px-2 text-xs" data-testid="edit-client-btn">
                  <Edit2 size={12} className="mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={saveToContacts} className="h-7 px-2 text-xs" data-testid="save-to-contacts-btn">
                  <UserPlus size={12} className="mr-1" />
                  Save
                </Button>
              </div>
              <div className="flex flex-col gap-1 mt-3 text-sm text-maya-text-muted">
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

          {/* Pets Section - Directly under customer info */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-maya-text flex items-center gap-2">
                <Dog size={16} />
                Pets
              </h3>
              <Button variant="ghost" size="sm" onClick={() => openPetModal()} className="h-7 px-2 text-xs" data-testid="add-pet-btn">
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>
            {pets.length > 0 ? (
              <div className="space-y-2">
                {pets.map((pet) => (
                  <div 
                    key={pet.id} 
                    className="flex items-center justify-between p-2 bg-maya-cream rounded-lg cursor-pointer hover:bg-maya-primary-light transition-colors"
                    onClick={() => openPetModal(pet)}
                    data-testid={`pet-${pet.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <Dog className="text-primary" size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-maya-text text-sm">{pet.name}</p>
                        {pet.breed && <p className="text-xs text-maya-text-muted">{pet.breed}</p>}
                      </div>
                    </div>
                    <Edit2 size={14} className="text-maya-text-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-maya-text-muted text-center py-2">No pets added</p>
            )}
          </div>
        </div>

        {/* Appointments Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-maya-text">Appointments</h2>
          </div>
          
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="upcoming">
                Upcoming ({appointments.filter(appt => {
                  const apptDateStr = appt.date_time;
                  const apptDate = new Date(apptDateStr.endsWith('Z') ? apptDateStr : apptDateStr + 'Z');
                  const now = new Date();
                  const isFuture = apptDate >= now;
                  const isActive = !['cancelled', 'no_show', 'completed'].includes(appt.status);
                  return isFuture && isActive;
                }).length})
              </TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <div className="space-y-2">
                {appointments.filter(appt => {
                  const apptDateStr = appt.date_time;
                  const apptDate = new Date(apptDateStr.endsWith('Z') ? apptDateStr : apptDateStr + 'Z');
                  const now = new Date();
                  const isFuture = apptDate >= now;
                  const isActive = !['cancelled', 'no_show', 'completed'].includes(appt.status);
                  return isFuture && isActive;
                }).sort((a, b) => new Date(a.date_time) - new Date(b.date_time)).map((appt) => (
                  <div
                    key={appt.id}
                    className="card-maya p-3 cursor-pointer hover:shadow-md transition-shadow"
                    data-testid={`appt-${appt.id}`}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-maya-primary-light flex items-center justify-center">
                          <Calendar className="text-primary" size={18} />
                        </div>
                        <div>
                          <p className="font-medium text-maya-text text-sm">
                            {formatDate(appt.date_time)} at {formatTime(appt.date_time)}
                          </p>
                          {appt.pets?.length > 0 && (
                            <p className="text-xs text-maya-text-muted">
                              {appt.pets.map(p => p.pet_name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary text-sm">{formatCurrency(appt.total_price)}</p>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          appt.status === 'scheduled' && "bg-maya-info text-white",
                          appt.status === 'confirmed' && "bg-green-500 text-white"
                        )}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {appointments.filter(appt => {
                  const apptDateStr = appt.date_time;
                  const apptDate = new Date(apptDateStr.endsWith('Z') ? apptDateStr : apptDateStr + 'Z');
                  const now = new Date();
                  const isFuture = apptDate >= now;
                  const isActive = !['cancelled', 'no_show', 'completed'].includes(appt.status);
                  return isFuture && isActive;
                }).length === 0 && (
                  <div className="text-center py-8 text-maya-text-muted">
                    <Calendar className="mx-auto mb-2 opacity-50" size={32} />
                    <p className="text-sm">No upcoming appointments</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="past">
              <div className="space-y-2">
                {appointments.filter(appt => {
                  const apptDateStr = appt.date_time;
                  const apptDate = new Date(apptDateStr.endsWith('Z') ? apptDateStr : apptDateStr + 'Z');
                  const now = new Date();
                  const isPast = apptDate < now;
                  const isCompleted = appt.status === 'completed';
                  const isCancelled = ['cancelled', 'no_show'].includes(appt.status);
                  return isPast || isCompleted || isCancelled;
                }).sort((a, b) => new Date(b.date_time) - new Date(a.date_time)).map((appt) => (
                  <div
                    key={appt.id}
                    className="card-maya p-3 cursor-pointer hover:shadow-md transition-shadow opacity-75"
                    data-testid={`appt-${appt.id}`}
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <Calendar className="text-gray-500" size={18} />
                        </div>
                        <div>
                          <p className="font-medium text-maya-text text-sm">
                            {formatDate(appt.date_time)} at {formatTime(appt.date_time)}
                          </p>
                          {appt.pets?.length > 0 && (
                            <p className="text-xs text-maya-text-muted">
                              {appt.pets.map(p => p.pet_name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-500 text-sm">{formatCurrency(appt.total_price)}</p>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          appt.status === 'completed' && "bg-maya-success text-white",
                          appt.status === 'cancelled' && "bg-gray-400 text-white",
                          appt.status === 'no_show' && "bg-maya-error text-white"
                        )}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {appointments.filter(appt => {
                  const apptDateStr = appt.date_time;
                  const apptDate = new Date(apptDateStr.endsWith('Z') ? apptDateStr : apptDateStr + 'Z');
                  const now = new Date();
                  const isPast = apptDate < now;
                  const isCancelled = ['cancelled', 'no_show'].includes(appt.status);
                  return isPast || isCancelled;
                }).length === 0 && (
                  <div className="text-center py-8 text-maya-text-muted">
                    <Calendar className="mx-auto mb-2 opacity-50" size={32} />
                    <p className="text-sm">No past appointments</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Pet Modal */}
      <Dialog open={showPetModal} onOpenChange={setShowPetModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPet ? 'Edit Pet' : 'Add Pet'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePetSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Name *</Label>
              <Input
                value={petForm.name}
                onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                placeholder="Pet's name"
                data-testid="pet-name-input"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Breed</Label>
              <Input
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                placeholder="e.g., Golden Retriever"
                data-testid="pet-breed-input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Age</Label>
              <Input
                value={petForm.age}
                onChange={(e) => setPetForm({ ...petForm, age: e.target.value })}
                placeholder="e.g., 3 years"
                data-testid="pet-age-input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Notes</Label>
              <Textarea
                value={petForm.notes}
                onChange={(e) => setPetForm({ ...petForm, notes: e.target.value })}
                placeholder="Special instructions..."
                data-testid="pet-notes-input"
                rows={2}
              />
            </div>
            <DialogFooter className="gap-2">
              {editingPet && (
                <Button type="button" variant="destructive" size="sm" onClick={handleDeletePet}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPetModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" size="sm" data-testid="save-pet-btn">
                {editingPet ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={showClientModal} onOpenChange={setShowClientModal}>
        <DialogContent className="max-w-md w-[95vw] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleClientSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-3 px-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-sm">First Name *</Label>
                  <Input
                    value={clientForm.first_name}
                    onChange={(e) => setClientForm({ ...clientForm, first_name: e.target.value })}
                    placeholder="First name"
                    data-testid="client-firstname-input"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Surname</Label>
                  <Input
                    value={clientForm.surname}
                    onChange={(e) => setClientForm({ ...clientForm, surname: e.target.value })}
                    placeholder="Surname"
                    data-testid="client-surname-input"
                  />
                </div>
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
              <div className="space-y-1">
                <Label className="text-sm">Street Address</Label>
                <Input
                  value={clientForm.street_address}
                  onChange={(e) => setClientForm({ ...clientForm, street_address: e.target.value })}
                  placeholder="123 Main Street"
                  data-testid="client-street-input"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pb-3">
                <div className="space-y-1">
                  <Label className="text-sm">Suburb</Label>
                  <Input
                    value={clientForm.suburb}
                    onChange={(e) => setClientForm({ ...clientForm, suburb: e.target.value })}
                    placeholder="Suburb"
                    data-testid="client-suburb-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">State</Label>
                  <Input
                    value={clientForm.state}
                    onChange={(e) => setClientForm({ ...clientForm, state: e.target.value })}
                    placeholder="VIC"
                    data-testid="client-state-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Postcode</Label>
                  <Input
                    value={clientForm.postcode}
                    onChange={(e) => setClientForm({ ...clientForm, postcode: e.target.value })}
                    placeholder="3000"
                    data-testid="client-postcode-input"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 px-4 py-3 border-t shrink-0">
              <div className="flex gap-2 w-full">
                <Button type="button" variant="outline" onClick={() => setShowClientModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="btn-maya-primary flex-1" data-testid="save-client-btn">
                  Save
                </Button>
              </div>
              <Button type="button" variant="ghost" className="text-red-500 w-full" onClick={handleDeleteClient}>
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
            <DialogTitle>{client?.phone}</DialogTitle>
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
              <Phone size={16} className="mr-2" /> Call
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                window.location.href = `sms:${client.phone}`;
                setShowPhoneOptions(false);
              }}
            >
              <MessageSquare size={16} className="mr-2" /> Text Message
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                navigator.clipboard.writeText(client.phone);
                toast.success('Phone number copied');
                setShowPhoneOptions(false);
              }}
            >
              <Copy size={16} className="mr-2" /> Copy Number
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Options Popup */}
      <Dialog open={showAddressOptions} onOpenChange={setShowAddressOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Address</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-maya-text-muted mb-3">{client?.address}</p>
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                const encodedAddress = encodeURIComponent(client.address);
                window.open(`https://maps.apple.com/?q=${encodedAddress}`, '_blank');
                setShowAddressOptions(false);
              }}
            >
              <Navigation size={16} className="mr-2" /> Open in Maps
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                navigator.clipboard.writeText(client.address);
                toast.success('Address copied');
                setShowAddressOptions(false);
              }}
            >
              <Copy size={16} className="mr-2" /> Copy Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
