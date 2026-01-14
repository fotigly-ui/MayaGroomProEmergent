import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { appointmentsAPI, petsAPI } from '../lib/api';
import { formatCurrency, formatDuration } from '../lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, MessageSquare, Send, FileText, RefreshCw, Check, Search, X, Edit, Phone, MapPin } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Simple checkbox
function SimpleCheckbox({ checked, onChange, testId }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-primary border-primary' : 'bg-white border-gray-300 dark:border-gray-600'
      }`}
    >
      {checked && <Check size={12} className="text-white" />}
    </button>
  );
}

// Simple toggle
function SimpleToggle({ checked, onChange, testId }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// Open native SMS
const openNativeSMS = (phone, message = '') => {
  const cleanPhone = phone.replace(/\D/g, '');
  window.location.href = `sms:${cleanPhone}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
};

export function AppointmentModal({ 
  open, 
  onClose, 
  onSave, 
  appointment, 
  initialDate, 
  clients = [], 
  services = [] 
}) {
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientPets, setClientPets] = useState([]);
  const [dateTime, setDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [appointmentPets, setAppointmentPets] = useState([]);
  const [customPrices, setCustomPrices] = useState({}); // Store custom prices: {petIndex-serviceId: price}
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringValue, setRecurringValue] = useState('');
  const [recurringUnit, setRecurringUnit] = useState('week');
  
  // SMS prompt
  const [showSmsPrompt, setShowSmsPrompt] = useState(false);
  const [smsMessageType, setSmsMessageType] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  
  // Recurring dialog
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [recurringAction, setRecurringAction] = useState('single');

  const isEditing = !!appointment;
  
  // Get selected client
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === clientId);
  }, [clients, clientId]);

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name?.toLowerCase().includes(search) || 
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search)
    );
  }, [clients, clientSearch]);

  const handleSendSMS = (messageType) => {
    if (!selectedClient?.phone) {
      toast.error('Client phone number not available');
      return;
    }
    
    let message = '';
    const apptDate = dateTime ? new Date(dateTime) : new Date();
    
    switch (messageType) {
      case 'appointment_booked':
        message = `Hi ${selectedClient.name}, your appointment has been booked for ${format(apptDate, 'EEEE, MMMM d')} at ${format(apptDate, 'HH:mm')}.`;
        break;
      case 'appointment_rescheduled':
        message = `Hi ${selectedClient.name}, your appointment has been rescheduled to ${format(apptDate, 'EEEE, MMMM d')} at ${format(apptDate, 'HH:mm')}.`;
        break;
      case 'appointment_cancelled':
        message = `Hi ${selectedClient.name}, your appointment has been cancelled. Please contact us to reschedule.`;
        break;
      case 'no_show':
        message = `Hi ${selectedClient.name}, we missed you at your appointment today. Please contact us to reschedule.`;
        break;
      case 'confirmation_request':
        message = `Hi ${selectedClient.name}, please confirm your appointment on ${format(apptDate, 'EEEE, MMMM d')} at ${format(apptDate, 'HH:mm')}. Reply YES to confirm.`;
        break;
      default:
        message = `Hi ${selectedClient.name}, this is a reminder about your appointment.`;
    }
    
    openNativeSMS(selectedClient.phone, message);
    toast.success('Opening messaging app...');
  };

  const promptSmsAfterAction = (messageType, callback) => {
    setSmsMessageType(messageType);
    setPendingAction(() => callback);
    setShowSmsPrompt(true);
  };

  const handleSmsPromptResponse = (sendSms) => {
    setShowSmsPrompt(false);
    if (sendSms) {
      handleSendSMS(smsMessageType);
    }
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!appointment) return;
    
    setInvoiceLoading(true);
    try {
      const token = localStorage.getItem('maya_token');
      const res = await fetch(`${API_URL}/invoices/from-appointment/${appointment.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      toast.success(`Invoice ${data.invoice_number} created!`);
      window.location.href = '/invoices';
    } catch (error) {
      toast.error('Failed to generate invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (appointment) {
        setClientId(appointment.client_id);
        setClientSearch(appointment.client_name || '');
        setDateTime(format(new Date(appointment.date_time), "yyyy-MM-dd'T'HH:mm"));
        setNotes(appointment.notes || '');
        setStatus(appointment.status);
        setAppointmentPets(appointment.pets?.map(p => ({
          ...p,
          services: p.services || [],
          items: p.items || []
        })) || []);
        setIsRecurring(appointment.is_recurring || false);
        setRecurringValue(appointment.recurring_value?.toString() || '');
        setRecurringUnit(appointment.recurring_unit || 'week');
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
    setClientSearch('');
    setClientPets([]);
    setDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setNotes('');
    setStatus('scheduled');
    setAppointmentPets([]);
    setIsRecurring(false);
    setRecurringValue('');
    setRecurringUnit('week');
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

  const handleClientSelect = (client) => {
    setClientId(client.id);
    setClientSearch(client.name);
    setShowClientDropdown(false);
    setAppointmentPets([]);
    fetchClientPets(client.id);
  };

  const clearClient = () => {
    setClientId('');
    setClientSearch('');
    setClientPets([]);
    setAppointmentPets([]);
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
      updated[index] = { ...updated[index], pet_id: value, pet_name: pet?.name || '' };
    } else if (field === 'pet_name') {
      updated[index] = { ...updated[index], pet_name: value };
    } else if (field === 'services') {
      updated[index] = { ...updated[index], services: value };
    }
    setAppointmentPets(updated);
  };

  const toggleService = (petIndex, serviceId) => {
    const updated = [...appointmentPets];
    const currentServices = updated[petIndex]?.services || [];
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
        const service = (services || []).find(s => s.id === serviceId);
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

    if (isEditing && appointment?.is_recurring && !showRecurringDialog) {
      setShowRecurringDialog(true);
      return;
    }

    setLoading(true);
    try {
      const recValue = parseInt(recurringValue) || 1;
      const data = {
        client_id: clientId,
        date_time: new Date(dateTime).toISOString(),
        notes,
        is_recurring: isRecurring,
        recurring_value: isRecurring ? recValue : null,
        recurring_unit: isRecurring ? recurringUnit : null,
        pets: appointmentPets.filter(p => p.pet_name).map(p => ({
          pet_name: p.pet_name,
          pet_id: p.pet_id || null,
          services: p.services || [],
          items: p.items || []
        }))
      };

      if (isEditing) {
        await appointmentsAPI.update(appointment.id, { ...data, status, update_series: recurringAction === 'series' });
        toast.success('Appointment updated');
        setLoading(false); // Reset loading state
        promptSmsAfterAction('appointment_rescheduled', () => {
          setShowRecurringDialog(false);
          onSave();
        });
      } else {
        await appointmentsAPI.create(data);
        toast.success('Appointment created');
        setLoading(false); // Reset loading state
        promptSmsAfterAction('appointment_booked', () => {
          setShowRecurringDialog(false);
          onSave();
        });
      }
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error(error.response?.data?.detail || 'Failed to save appointment');
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    
    if (isEditing && (newStatus === 'cancelled' || newStatus === 'no_show')) {
      setLoading(true);
      try {
        await appointmentsAPI.update(appointment.id, { status: newStatus });
        toast.success(`Marked as ${newStatus === 'no_show' ? 'No Show' : 'Cancelled'}`);
        const messageType = newStatus === 'cancelled' ? 'appointment_cancelled' : 'no_show';
        promptSmsAfterAction(messageType, () => onSave());
      } catch (error) {
        toast.error('Failed to update status');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    
    // If recurring, ask if delete series
    if (appointment.is_recurring && appointment.recurring_id) {
      const choice = window.confirm('Delete this appointment or entire series?\n\nOK = Delete Series\nCancel = Delete Only This One');
      const deleteSeries = choice;
      
      setLoading(true);
      try {
        await appointmentsAPI.delete(appointment.id, { params: { delete_series: deleteSeries } });
        toast.success(deleteSeries ? 'Series deleted' : 'Appointment deleted');
        promptSmsAfterAction('appointment_cancelled', () => onSave());
      } catch (error) {
        toast.error('Failed to delete appointment');
        setLoading(false);
      }
    } else {
      if (!window.confirm('Are you sure you want to delete this appointment?')) return;

      setLoading(true);
      try {
        await appointmentsAPI.delete(appointment.id);
        toast.success('Appointment deleted');
        promptSmsAfterAction('appointment_cancelled', () => onSave());
      } catch (error) {
        toast.error('Failed to delete appointment');
        setLoading(false);
      }
    }
  };

  const { totalDuration, totalPrice } = calculateTotals();
  const safeServices = services || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              {isEditing ? 'Edit Appointment' : 'New Appointment'}
              {appointment?.is_recurring && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <RefreshCw size={12} /> Recurring
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection - Simple Button */}
            <div className="space-y-2">
              <Label>Client *</Label>
              {!clientId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.href = '/clients'}
                  className="w-full justify-center h-12"
                >
                  <Plus size={18} className="mr-2" />
                  Add Customer
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="font-medium">{selectedClient?.name}</div>
                    {selectedClient?.phone && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const phone = selectedClient.phone;
                          window.location.href = `tel:${phone.replace(/\D/g, '')}`;
                        }}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm mt-1"
                      >
                        <Phone size={12} /> {selectedClient.phone}
                      </button>
                    )}
                    {selectedClient?.address && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const address = selectedClient.address;
                          const encodedAddress = encodeURIComponent(address);
                          window.location.href = `maps://?q=${encodedAddress}`;
                        }}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm mt-1"
                      >
                        <MapPin size={12} /> {selectedClient.address}
                      </button>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={clearClient}>
                    <X size={16} />
                  </Button>
                </div>
              )}
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

            {/* Status */}
            {isEditing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Recurring */}
            <div className="space-y-3 p-4 bg-maya-cream dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Recurring Appointment</Label>
                  <p className="text-sm text-maya-text-muted">Repeat automatically</p>
                </div>
                <SimpleToggle checked={isRecurring} onChange={setIsRecurring} testId="recurring-toggle" />
              </div>
              
              {isRecurring && (
                <div className="flex items-center gap-2 mt-3">
                  <Label className="whitespace-nowrap">Repeat every</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={recurringValue}
                    onChange={(e) => setRecurringValue(e.target.value)}
                    placeholder="1"
                    className="w-20"
                    data-testid="recurring-value"
                  />
                  <Select value={recurringUnit} onValueChange={setRecurringUnit}>
                    <SelectTrigger className="w-28" data-testid="recurring-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day(s)</SelectItem>
                      <SelectItem value="week">Week(s)</SelectItem>
                      <SelectItem value="month">Month(s)</SelectItem>
                      <SelectItem value="year">Year(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Pets & Services */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Pets & Services</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPetToAppointment} data-testid="add-pet-btn">
                  <Plus size={16} className="mr-1" /> Add Pet
                </Button>
              </div>

              {appointmentPets.map((pet, index) => (
                <div key={pet.id} className="p-4 border border-maya-border dark:border-gray-700 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      {clientPets.length > 0 ? (
                        <Select
                          value={pet.pet_id || 'custom'}
                          onValueChange={(value) => {
                            if (value === 'custom') {
                              updatePetInAppointment(index, 'pet_id', '');
                              updatePetInAppointment(index, 'pet_name', '');
                            } else {
                              updatePetInAppointment(index, 'pet_id', value);
                            }
                          }}
                        >
                          <SelectTrigger data-testid={`select-pet-${index}`}>
                            <SelectValue placeholder="Select pet" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientPets.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.breed && `(${p.breed})`}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Enter manually...</SelectItem>
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
                      {pet.pet_id === '' && clientPets.length > 0 && (
                        <Input
                          placeholder="Enter pet name"
                          value={pet.pet_name}
                          onChange={(e) => updatePetInAppointment(index, 'pet_name', e.target.value)}
                          className="mt-2"
                        />
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePetFromAppointment(index)} className="text-maya-error hover:bg-red-50">
                      <Trash2 size={18} />
                    </Button>
                  </div>

                  {safeServices.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-maya-text-muted">Services</Label>
                      <div className="space-y-2">
                        {safeServices.map((service) => {
                          const isSelected = (pet.services || []).includes(service.id);
                          const priceKey = `${index}-${service.id}`;
                          const currentPrice = customPrices[priceKey] !== undefined ? customPrices[priceKey] : service.price;
                          
                          return (
                            <div key={service.id} className="flex items-start gap-2 p-2 rounded-lg border border-maya-border dark:border-gray-700 hover:bg-maya-cream dark:hover:bg-gray-800">
                              <SimpleCheckbox
                                checked={isSelected}
                                onChange={() => toggleService(index, service.id)}
                                testId={`service-${service.id}-pet-${index}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{service.name}</div>
                                <div className="text-xs text-maya-text-muted">{formatDuration(service.duration)}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={currentPrice}
                                  onChange={(e) => {
                                    setCustomPrices(prev => ({...prev, [priceKey]: parseFloat(e.target.value) || 0}));
                                  }}
                                  className="w-20 h-8 text-sm"
                                  disabled={!isSelected}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {appointmentPets.length === 0 && (
                <div className="text-center py-4 text-maya-text-muted border border-dashed border-maya-border dark:border-gray-700 rounded-lg">
                  Click "Add Pet" to add pets
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions..." data-testid="appointment-notes" rows={3} />
            </div>

            {/* Totals */}
            <div className="bg-maya-cream dark:bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-maya-text-muted">Total Duration:</span>
                <span className="font-medium">{formatDuration(totalDuration || 60)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-maya-text-muted">Total Price:</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(totalPrice)}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              {isEditing && (
                <>
                  <Button type="button" variant="outline" onClick={handleGenerateInvoice} disabled={invoiceLoading}>
                    {invoiceLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <FileText size={16} className="mr-2" />}
                    Invoice
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline">
                        <MessageSquare size={16} className="mr-2" /> SMS
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleSendSMS('confirmation_request')}>
                        <Send size={14} className="mr-2" /> Confirmation Request
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendSMS('appointment_rescheduled')}>
                        <Send size={14} className="mr-2" /> Rescheduled Notice
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendSMS('appointment_cancelled')}>
                        <Send size={14} className="mr-2" /> Cancellation Notice
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                    Delete
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" disabled={loading} data-testid="save-appointment-btn">
                {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                {isEditing ? 'Update' : 'Create'} Appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SMS Prompt */}
      <Dialog open={showSmsPrompt} onOpenChange={setShowSmsPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              Send SMS to Customer?
            </DialogTitle>
          </DialogHeader>
          <p className="text-maya-text-muted text-sm">Notify the customer about this change?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleSmsPromptResponse(false)}>No, Skip</Button>
            <Button className="btn-maya-primary" onClick={() => handleSmsPromptResponse(true)}>
              <Send size={16} className="mr-2" /> Yes, Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Dialog */}
      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Recurring Appointment</DialogTitle>
          </DialogHeader>
          <p className="text-maya-text-muted">Update only this occurrence or the entire series?</p>
          <div className="space-y-3 mt-4">
            <Button
              className="w-full justify-start"
              variant={recurringAction === 'single' ? 'default' : 'outline'}
              onClick={() => setRecurringAction('single')}
            >
              Only this appointment
            </Button>
            <Button
              className="w-full justify-start"
              variant={recurringAction === 'series' ? 'default' : 'outline'}
              onClick={() => setRecurringAction('series')}
            >
              All appointments in series
            </Button>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowRecurringDialog(false)}>Cancel</Button>
            <Button className="btn-maya-primary" onClick={handleSubmit}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
