import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { appointmentsAPI, petsAPI } from '../lib/api';
import { formatCurrency, formatDuration } from '../lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, MessageSquare, Copy, Send } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export function AppointmentModal({ 
  open, 
  onClose, 
  onSave, 
  appointment, 
  initialDate, 
  clients, 
  services 
}) {
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientPets, setClientPets] = useState([]);
  const [dateTime, setDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [appointmentPets, setAppointmentPets] = useState([]);

  const isEditing = !!appointment;

  const handleSendSMS = async (messageType) => {
    if (!appointment) return;
    
    setSmsLoading(true);
    try {
      const token = localStorage.getItem('maya_token');
      const res = await axios.post(`${API_URL}/sms/send`, {
        client_id: appointment.client_id,
        message_type: messageType,
        appointment_id: appointment.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.status === 'sent') {
        toast.success('SMS sent successfully');
      } else if (res.data.status === 'pending') {
        // Copy to clipboard for manual sending
        await navigator.clipboard.writeText(res.data.message);
        toast.success(
          <div>
            <p className="font-medium">Message copied to clipboard!</p>
            <p className="text-sm mt-1">Send to: {res.data.phone}</p>
          </div>
        );
      } else {
        toast.error('Failed to send SMS: ' + (res.data.error || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Failed to send SMS');
    } finally {
      setSmsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (appointment) {
        setClientId(appointment.client_id);
        setDateTime(format(new Date(appointment.date_time), "yyyy-MM-dd'T'HH:mm"));
        setNotes(appointment.notes || '');
        setStatus(appointment.status);
        setAppointmentPets(appointment.pets?.map(p => ({
          ...p,
          services: p.services || [],
          items: p.items || []
        })) || []);
        fetchClientPets(appointment.client_id);
      } else {
        resetForm();
        if (initialDate) {
          setDateTime(format(initialDate, "yyyy-MM-dd'T'HH:mm"));
        }
      }
    }
  }, [open, appointment, initialDate]);

  const resetForm = () => {
    setClientId('');
    setClientPets([]);
    setDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setNotes('');
    setStatus('scheduled');
    setAppointmentPets([]);
  };

  const fetchClientPets = async (cId) => {
    if (!cId) {
      setClientPets([]);
      return;
    }
    try {
      const res = await petsAPI.list(cId);
      setClientPets(res.data);
    } catch (error) {
      console.error('Error fetching pets:', error);
    }
  };

  const handleClientChange = (cId) => {
    setClientId(cId);
    setAppointmentPets([]);
    fetchClientPets(cId);
  };

  const addPetToAppointment = () => {
    setAppointmentPets([
      ...appointmentPets,
      { id: Date.now().toString(), pet_name: '', pet_id: '', services: [], items: [] }
    ]);
  };

  const removePetFromAppointment = (index) => {
    setAppointmentPets(appointmentPets.filter((_, i) => i !== index));
  };

  const updatePetInAppointment = (index, field, value) => {
    const updated = [...appointmentPets];
    if (field === 'pet_id') {
      const pet = clientPets.find(p => p.id === value);
      updated[index] = {
        ...updated[index],
        pet_id: value,
        pet_name: pet?.name || ''
      };
    } else if (field === 'pet_name') {
      updated[index] = { ...updated[index], pet_name: value };
    } else if (field === 'services') {
      updated[index] = { ...updated[index], services: value };
    }
    setAppointmentPets(updated);
  };

  const toggleService = (petIndex, serviceId) => {
    const updated = [...appointmentPets];
    const currentServices = updated[petIndex].services || [];
    if (currentServices.includes(serviceId)) {
      updated[petIndex].services = currentServices.filter(s => s !== serviceId);
    } else {
      updated[petIndex].services = [...currentServices, serviceId];
    }
    setAppointmentPets(updated);
  };

  const calculateTotals = () => {
    let totalDuration = 0;
    let totalPrice = 0;

    appointmentPets.forEach(pet => {
      (pet.services || []).forEach(serviceId => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
          totalDuration += service.duration;
          totalPrice += service.price;
        }
      });
    });

    return { totalDuration, totalPrice };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }

    if (appointmentPets.length === 0 || !appointmentPets.some(p => p.pet_name)) {
      toast.error('Please add at least one pet');
      return;
    }

    setLoading(true);
    try {
      const data = {
        client_id: clientId,
        date_time: new Date(dateTime).toISOString(),
        notes,
        pets: appointmentPets.filter(p => p.pet_name).map(p => ({
          pet_name: p.pet_name,
          pet_id: p.pet_id || null,
          services: p.services || [],
          items: p.items || []
        }))
      };

      if (isEditing) {
        await appointmentsAPI.update(appointment.id, { ...data, status });
        toast.success('Appointment updated');
      } else {
        await appointmentsAPI.create(data);
        toast.success('Appointment created');
      }
      
      onSave();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error(error.response?.data?.detail || 'Failed to save appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment || !window.confirm('Are you sure you want to delete this appointment?')) {
      return;
    }

    setLoading(true);
    try {
      await appointmentsAPI.delete(appointment.id);
      toast.success('Appointment deleted');
      onSave();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('Failed to delete appointment');
    } finally {
      setLoading(false);
    }
  };

  const { totalDuration, totalPrice } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {isEditing ? 'Edit Appointment' : 'New Appointment'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.phone && `- ${client.phone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <Label>Date & Time *</Label>
            <Input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              data-testid="appointment-datetime"
              required
            />
          </div>

          {/* Status (only for editing) */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pets & Services */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Pets & Services</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPetToAppointment}
                data-testid="add-pet-btn"
              >
                <Plus size={16} className="mr-1" />
                Add Pet
              </Button>
            </div>

            {appointmentPets.map((pet, index) => (
              <div key={pet.id} className="p-4 border border-maya-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    {clientPets.length > 0 ? (
                      <Select
                        value={pet.pet_id || ''}
                        onValueChange={(value) => updatePetInAppointment(index, 'pet_id', value)}
                      >
                        <SelectTrigger data-testid={`select-pet-${index}`}>
                          <SelectValue placeholder="Select pet or type name" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientPets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.breed && `(${p.breed})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Pet name"
                        value={pet.pet_name}
                        onChange={(e) => updatePetInAppointment(index, 'pet_name', e.target.value)}
                        data-testid={`pet-name-${index}`}
                      />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePetFromAppointment(index)}
                    className="text-maya-error hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>

                {/* Services for this pet */}
                <div className="space-y-2">
                  <Label className="text-sm text-maya-text-muted">Services</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-maya-border hover:bg-maya-cream cursor-pointer"
                      >
                        <Checkbox
                          checked={(pet.services || []).includes(service.id)}
                          onCheckedChange={() => toggleService(index, service.id)}
                          data-testid={`service-${service.id}-pet-${index}`}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{service.name}</div>
                          <div className="text-xs text-maya-text-muted">
                            {formatDuration(service.duration)} - {formatCurrency(service.price)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {appointmentPets.length === 0 && (
              <div className="text-center py-4 text-maya-text-muted border border-dashed border-maya-border rounded-lg">
                Click "Add Pet" to add pets to this appointment
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              data-testid="appointment-notes"
              rows={3}
            />
          </div>

          {/* Totals */}
          <div className="bg-maya-cream rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-maya-text-muted">Total Duration:</span>
              <span className="font-medium">{formatDuration(totalDuration || 60)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-maya-text-muted">Total Price:</span>
              <span className="font-bold text-lg text-primary">{formatCurrency(totalPrice)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <>
                {/* SMS Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={smsLoading}
                      data-testid="sms-dropdown-btn"
                    >
                      {smsLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <MessageSquare size={16} className="mr-2" />}
                      Send SMS
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleSendSMS('confirmation_request')}>
                      <Send size={14} className="mr-2" /> Confirmation Request
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSendSMS('reminder_24h')}>
                      <Send size={14} className="mr-2" /> 24h Reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSendSMS('appointment_changed')}>
                      <Send size={14} className="mr-2" /> Appointment Changed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSendSMS('appointment_rescheduled')}>
                      <Send size={14} className="mr-2" /> Rescheduled Notice
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSendSMS('appointment_cancelled')}>
                      <Send size={14} className="mr-2" /> Cancellation Notice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  data-testid="delete-appointment-btn"
                >
                  Delete
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="btn-maya-primary"
              disabled={loading}
              data-testid="save-appointment-btn"
            >
              {loading && <Loader2 className="animate-spin mr-2" size={18} />}
              {isEditing ? 'Update' : 'Create'} Appointment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
