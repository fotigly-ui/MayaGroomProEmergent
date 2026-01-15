import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Send, MessageSquare, Phone, Copy, MapPin, Navigation, Calendar as CalendarIcon, Edit, Trash2, DollarSign, Receipt, Percent } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { appointmentsAPI, clientsAPI, servicesAPI, itemsAPI, invoicesAPI } from '../lib/api';
import { cn, isToday, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { AppointmentModal } from '../components/AppointmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// 24-hour coverage: 00:00 to 23:45 in 15-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      slots.push({ hour, minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();
const SLOT_HEIGHT = 20;

// Status colors
const STATUS_COLORS = {
  scheduled: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900' },
  confirmed: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900' },
  completed: { bg: 'bg-gray-100', border: 'border-gray-500', text: 'text-gray-900' },
  cancelled: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900' },
  no_show: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900' }
};

export default function CalendarPage() {
  const { settings } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [popoverMonth, setPopoverMonth] = useState(new Date());
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  
  // Drag state
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  
  // Dialogs
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPhoneMenu, setShowPhoneMenu] = useState(false); // Added for phone popup
  const [showAddressMenu, setShowAddressMenu] = useState(false); // Added for address popup
  const [pendingReschedule, setPendingReschedule] = useState(null);
  const [showSmsPrompt, setShowSmsPrompt] = useState(false);
  const [showPhoneOptions, setShowPhoneOptions] = useState(false);
  const [showAddressOptions, setShowAddressOptions] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Checkout state
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [checkoutDiscount, setCheckoutDiscount] = useState({ type: 'fixed', value: 0 });
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [items, setItems] = useState([]); // Products/items for sale
  
  const scrollRef = useRef(null);
  const hasScrolledToTime = useRef(false);

  // Function to scroll to current time
  const scrollToCurrentTime = useCallback(() => {
    if (scrollRef.current && !hasScrolledToTime.current) {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const slotIndex = hour * 4 + Math.floor(minutes / 15);
      // Account for 120px padding at top
      const scrollPosition = slotIndex * SLOT_HEIGHT * zoomLevel - 100 + 120;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
      hasScrolledToTime.current = true;
    }
  }, [zoomLevel]);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return addDays(weekStart, i);
  });

  const popoverMonthDates = eachDayOfInterval({
    start: startOfWeek(startOfMonth(popoverMonth), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(endOfMonth(popoverMonth), { weekStartsOn: 1 }), 41)
  }).slice(0, 42);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 7);
      
      const [apptRes, clientsRes, servicesRes, itemsRes] = await Promise.all([
        appointmentsAPI.list({
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString()
        }),
        clientsAPI.list(),
        servicesAPI.list(),
        itemsAPI.list()
      ]);
      
      setAppointments(apptRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPopoverMonth(selectedDate);
  }, [selectedDate]);

  // Scroll to current time on first load
  useEffect(() => {
    if (!loading && !hasScrolledToTime.current) {
      const timer = setTimeout(() => {
        scrollToCurrentTime();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, scrollToCurrentTime]);

  // Pinch to zoom handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDistance / initialPinchDistance;
      
      if (scale > 1.05) {
        setZoomLevel(prev => Math.min(prev * 1.05, 3));
        setInitialPinchDistance(currentDistance);
      } else if (scale < 0.95) {
        setZoomLevel(prev => Math.max(prev * 0.95, 0.5));
        setInitialPinchDistance(currentDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDistance(null);
  };

  const navigatePrev = () => setSelectedDate(subWeeks(selectedDate, 1));
  const navigateNext = () => setSelectedDate(addWeeks(selectedDate, 1));
  
  const goToToday = () => {
    setSelectedDate(new Date());
    hasScrolledToTime.current = false; // Reset to allow scroll
    // Scroll to current time after state updates
    setTimeout(() => {
      if (scrollRef.current) {
        const now = new Date();
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const slotIndex = hour * 4 + Math.floor(minutes / 15);
        // Account for 120px padding
        const scrollPosition = slotIndex * SLOT_HEIGHT * zoomLevel - 100 + 120;
        scrollRef.current.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        });
        hasScrolledToTime.current = true;
      }
    }, 300);
  };

  const handleSlotClick = (hour, minute) => {
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hour, minute, 0, 0);
    setSelectedSlot(slotDate);
    setSelectedAppointment(null);
    setShowModal(true);
  };

  const handleAppointmentClick = (appointment, e) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setSelectedSlot(null);
    setShowDetailsModal(true); // Show details modal first
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedAppointment(null);
    setSelectedSlot(null);
  };

  const handleSaveAppointment = () => {
    fetchData();
    handleModalClose();
  };

  // Contact actions
  const handlePhoneClick = (phone, e) => {
    e.stopPropagation();
    setSelectedContact({ phone });
    setShowPhoneOptions(true);
  };

  const handleAddressClick = (address, e) => {
    e.stopPropagation();
    setSelectedContact({ address });
    setShowAddressOptions(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openNativeCall = (phone) => {
    window.location.href = `tel:${phone.replace(/\D/g, '')}`;
  };

  const openNativeSMS = (phone, message = '') => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.location.href = `sms:${cleanPhone}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
  };

  const openInMaps = (address, app) => {
    const encodedAddress = encodeURIComponent(address);
    if (app === 'apple') {
      window.location.href = `maps://?q=${encodedAddress}`;
    } else if (app === 'google') {
      window.location.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    } else if (app === 'waze') {
      window.location.href = `https://waze.com/ul?q=${encodedAddress}`;
    }
  };

  // Drag handlers
  const handleDragStart = (e, appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
  };

  const handleDragOver = (e, hour, minute) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedAppointment) {
      setDragPreview({ hour, minute });
    }
  };

  const handleDrop = async (e, hour, minute) => {
    e.preventDefault();
    if (!draggedAppointment) return;
    
    const newDateTime = new Date(selectedDate);
    newDateTime.setHours(hour, minute, 0, 0);
    
    setPendingReschedule({
      appointment: draggedAppointment,
      newDateTime,
      oldDateTime: new Date(draggedAppointment.date_time)
    });
    setShowConfirmDialog(true);
    
    setDraggedAppointment(null);
    setDragPreview(null);
  };

  const handleDragEnd = () => {
    setDraggedAppointment(null);
    setDragPreview(null);
  };

  const confirmReschedule = async () => {
    if (!pendingReschedule) return;
    
    try {
      await appointmentsAPI.update(pendingReschedule.appointment.id, {
        date_time: pendingReschedule.newDateTime.toISOString()
      });
      toast.success('Appointment rescheduled');
      fetchData();
      setShowConfirmDialog(false);
      setShowSmsPrompt(true);
    } catch (error) {
      toast.error('Failed to reschedule');
    }
  };

  const sendRescheduleSMS = async () => {
    if (!pendingReschedule) return;
    
    // Get client phone directly and open native SMS
    const client = clients.find(c => c.id === pendingReschedule.appointment.client_id);
    if (client?.phone) {
      const message = `Hi ${client.name}, your appointment has been rescheduled to ${format(pendingReschedule.newDateTime, 'EEEE, MMMM d')} at ${format(pendingReschedule.newDateTime, 'HH:mm')}.`;
      openNativeSMS(client.phone, message);
      toast.success('Opening messaging app...');
    } else {
      toast.error('Client phone not available');
    }
    
    setShowSmsPrompt(false);
    setPendingReschedule(null);
  };

  const skipSMS = () => {
    setShowSmsPrompt(false);
    setPendingReschedule(null);
  };

  // Get appointments for selected day
  const selectedDayAppointments = appointments.filter(appt => 
    isSameDay(new Date(appt.date_time), selectedDate)
  );

  // Group overlapping appointments
  const getOverlappingGroups = () => {
    const sorted = [...selectedDayAppointments].sort((a, b) => 
      new Date(a.date_time) - new Date(b.date_time)
    );
    
    const groups = [];
    let currentGroup = [];
    
    sorted.forEach((appt) => {
      const apptStart = new Date(appt.date_time);
      const apptEnd = new Date(apptStart.getTime() + (appt.total_duration || 60) * 60000);
      
      if (currentGroup.length === 0) {
        currentGroup.push(appt);
      } else {
        // Check overlap with ALL in current group
        const hasOverlap = currentGroup.some(existingAppt => {
          const existingStart = new Date(existingAppt.date_time);
          const existingEnd = new Date(existingStart.getTime() + (existingAppt.total_duration || 60) * 60000);
          return apptStart < existingEnd && apptEnd > existingStart;
        });
        
        if (hasOverlap) {
          currentGroup.push(appt);
        } else {
          groups.push([...currentGroup]);
          currentGroup = [appt];
        }
      }
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  // Current time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getCurrentTimePosition = () => {
    const hour = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const slotIndex = hour * 4 + Math.floor(minutes / 15);
    const offsetInSlot = (minutes % 15) / 15;
    return (slotIndex + offsetInSlot) * SLOT_HEIGHT * zoomLevel;
  };

  const currentTimePos = getCurrentTimePosition();
  const isSelectedDateToday = isToday(selectedDate);

  // Appointment style
  const getAppointmentStyle = (appt, groupSize, indexInGroup) => {
    const apptDate = new Date(appt.date_time);
    const hour = apptDate.getHours();
    const minutes = apptDate.getMinutes();
    const duration = appt.total_duration || 60;
    
    const slotIndex = hour * 4 + Math.floor(minutes / 15);
    const offsetInSlot = (minutes % 15) / 15;
    const top = (slotIndex + offsetInSlot) * SLOT_HEIGHT * zoomLevel;
    const height = (duration / 15) * SLOT_HEIGHT * zoomLevel;
    
    const width = groupSize > 1 ? `${100 / groupSize}%` : '100%';
    const left = groupSize > 1 ? `${(indexInGroup / groupSize) * 100}%` : '0';
    
    return { top: `${top}px`, height: `${Math.max(height, 40)}px`, minHeight: '40px', width, left };
  };

  const groups = getOverlappingGroups();

  return (
    <Layout>
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        {/* FIXED Header - Month - POSITION FIXED */}
        <div className="fixed top-0 left-0 right-0 flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-30">

          <Popover>
            <PopoverTrigger asChild>
              <button className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary flex items-center gap-1">
                {format(selectedDate, 'MMMM yyyy')}
                <ChevronRight size={16} className="rotate-90" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setPopoverMonth(subMonths(popoverMonth, 1))}>
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="font-semibold">{format(popoverMonth, 'MMMM yyyy')}</span>
                  <Button variant="ghost" size="icon" onClick={() => setPopoverMonth(addMonths(popoverMonth, 1))}>
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i} className="p-2 text-gray-500 font-medium">{day}</div>
                  ))}
                  {popoverMonthDates.map((date, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(date); }}
                      className={cn(
                        "p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                        !isSameMonth(date, popoverMonth) && "text-gray-300 dark:text-gray-600",
                        isToday(date) && "bg-primary text-white hover:bg-primary",
                        isSameDay(date, selectedDate) && !isToday(date) && "ring-2 ring-primary"
                      )}
                    >
                      {format(date, 'd')}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="text-xs"
              data-testid="today-btn"
            >
              <CalendarIcon size={14} className="mr-1" />
              Today
            </Button>
            <button
              onClick={() => { setSelectedSlot(new Date()); setSelectedAppointment(null); setShowModal(true); }}
              className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary-hover"
              data-testid="new-appointment-btn"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* FIXED Week Day Selector - POSITION FIXED */}
        <div className="fixed top-[57px] left-0 right-0 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-20">

          <button onClick={navigatePrev} className="px-2 flex items-center text-gray-400 hover:text-primary">
            <ChevronLeft size={20} />
          </button>
          {weekDates.map((date, i) => (
            <button
              key={i}
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex-1 py-3 text-center transition-colors",
                isSameDay(date, selectedDate) && "bg-gray-50 dark:bg-gray-800"
              )}
            >
              <div className={cn(
                "text-xs font-medium uppercase",
                isSameDay(date, selectedDate) ? "text-primary" : "text-gray-500 dark:text-gray-400"
              )}>
                {format(date, 'EEE').charAt(0)}
              </div>
              <div className={cn(
                "text-sm font-semibold mt-1 w-8 h-8 mx-auto flex items-center justify-center rounded-full",
                isSameDay(date, selectedDate) && "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900",
                isToday(date) && !isSameDay(date, selectedDate) && "text-primary"
              )}>
                {format(date, 'd')}
              </div>
            </button>
          ))}
          <button onClick={navigateNext} className="px-2 flex items-center text-gray-400 hover:text-primary">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* SCROLLABLE Calendar Grid - ADD TOP PADDING FOR FIXED HEADERS */}
        <div 
          className="flex-1 overflow-y-auto relative touch-pan-y bg-white dark:bg-gray-900"
          style={{paddingTop: '120px'}}
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Current Time Indicator */}
          {isSelectedDateToday && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              style={{ top: `${currentTimePos}px` }}
            >
              <div className="w-14 flex justify-end pr-1">
                <span className="text-[10px] font-bold text-red-500 bg-white dark:bg-gray-900 px-1">
                  {format(currentTime, 'HH:mm')}
                </span>
              </div>
              <div className="flex-1 relative">
                <div className="absolute left-0 w-2 h-2 bg-red-500 rounded-full -top-[3px]" />
                <div className="h-[2px] bg-red-500" />
              </div>
            </div>
          )}

          {/* Drag Preview */}
          {dragPreview && draggedAppointment && (
            <div className="fixed z-50 bg-primary text-white px-3 py-2 rounded-lg shadow-lg pointer-events-none text-sm font-medium" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              Moving to {String(dragPreview.hour).padStart(2, '0')}:{String(dragPreview.minute).padStart(2, '0')}
            </div>
          )}

          {/* Time Grid */}
          <div className="relative" style={{ height: `${TIME_SLOTS.length * SLOT_HEIGHT * zoomLevel}px` }}>
            {TIME_SLOTS.map((slot, i) => {
              const isHourMark = slot.minute === 0;
              const isDropTarget = dragPreview && dragPreview.hour === slot.hour && dragPreview.minute === slot.minute;
              
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute left-0 right-0 flex cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/20",
                    isHourMark ? "border-t border-gray-200 dark:border-gray-700" : "border-t border-gray-100/50 dark:border-gray-800/50",
                    isDropTarget && "bg-primary/20"
                  )}
                  style={{ top: `${i * SLOT_HEIGHT * zoomLevel}px`, height: `${SLOT_HEIGHT * zoomLevel}px` }}
                  onClick={() => handleSlotClick(slot.hour, slot.minute)}
                  onDragOver={(e) => handleDragOver(e, slot.hour, slot.minute)}
                  onDrop={(e) => handleDrop(e, slot.hour, slot.minute)}
                >
                  <div className="w-14 flex-shrink-0 pr-2 text-right">
                    {isHourMark && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{slot.label}</span>
                    )}
                  </div>
                  <div className="flex-1" />
                </div>
              );
            })}

            {/* Appointments */}
            {groups.map((group) => (
              group.map((appt, apptIndex) => {
                const style = getAppointmentStyle(appt, group.length, apptIndex);
                const client = clients.find(c => c.id === appt.client_id);
                const colors = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
                
                return (
                  <div
                    key={appt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, appt)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleAppointmentClick(appt, e)}
                    className={cn(
                      "absolute border-l-4 rounded-r-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:opacity-90 transition-colors shadow-md z-10 overflow-hidden",
                      colors.bg, colors.border, colors.text,
                      draggedAppointment?.id === appt.id && "opacity-50 ring-2 ring-primary"
                    )}
                    style={{
                      ...style,
                      left: `64px`, // Fixed: Always start after time column (56px time + 8px padding)
                      width: group.length > 1 ? `calc((100% - 72px) / ${group.length})` : 'calc(100% - 72px)',
                      minWidth: '120px',
                      marginLeft: group.length > 1 ? `${apptIndex * (100 / group.length)}%` : '0'
                    }}
                    data-testid={`appointment-${appt.id}`}
                  >
                    <div className="text-xs font-semibold leading-tight mb-0.5 truncate">
                      {appt.client_name}
                      {appt.pets?.length > 0 && (
                        <span className="font-normal opacity-80 truncate">
                          {' '}({appt.pets.map(p => p.pet_name).join(' & ')})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] opacity-90 leading-tight truncate">
                      {format(new Date(appt.date_time), 'HH:mm')}
                    </div>
                    {/* Services - ALWAYS show */}
                    <div className="text-[11px] font-medium opacity-80 mt-1 leading-tight truncate">
                      {appt.pets?.flatMap(p => 
                        services.filter(s => p.services?.includes(s.id)).map(s => s.name)
                      ).filter(Boolean).join(', ') || 'No service'}
                    </div>
                  </div>
                );
              })
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AppointmentModal
        open={showModal}
        onClose={handleModalClose}
        onSave={handleSaveAppointment}
        appointment={selectedAppointment}
        initialDate={selectedSlot}
        clients={clients}
        services={services}
      />

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Reschedule</DialogTitle>
          </DialogHeader>
          {pendingReschedule && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Move <span className="font-semibold">{pendingReschedule.appointment.client_name}</span>'s appointment?
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-16">From:</span>
                  <span className="font-medium">{format(pendingReschedule.oldDateTime, 'HH:mm')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-16">To:</span>
                  <input
                    type="time"
                    value={format(pendingReschedule.newDateTime, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDT = new Date(pendingReschedule.newDateTime);
                      newDT.setHours(parseInt(hours), parseInt(minutes));
                      setPendingReschedule({...pendingReschedule, newDateTime: newDT});
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm font-medium text-primary"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => { setShowConfirmDialog(false); setPendingReschedule(null); }} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="outline" onClick={() => {
              setShowConfirmDialog(false);
              setSelectedAppointment(pendingReschedule.appointment);
              setShowModal(true);
              setPendingReschedule(null);
            }} className="w-full sm:w-auto">
              <Edit size={16} className="mr-2" /> Edit Details
            </Button>
            <Button className="btn-maya-primary w-full sm:w-auto" onClick={confirmReschedule}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSmsPrompt} onOpenChange={setShowSmsPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              Notify Customer?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">Send SMS to notify about the reschedule?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={skipSMS}>No, Skip</Button>
            <Button className="btn-maya-primary" onClick={sendRescheduleSMS}>
              <Send size={16} className="mr-2" /> Yes, Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPhoneOptions} onOpenChange={setShowPhoneOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Contact Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => { openNativeCall(selectedContact?.phone); setShowPhoneOptions(false); }}>
              <Phone size={16} className="mr-2" /> Call {selectedContact?.phone}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { openNativeSMS(selectedContact?.phone); setShowPhoneOptions(false); }}>
              <MessageSquare size={16} className="mr-2" /> Send SMS
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { copyToClipboard(selectedContact?.phone); setShowPhoneOptions(false); }}>
              <Copy size={16} className="mr-2" /> Copy Number
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddressOptions} onOpenChange={setShowAddressOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Navigate to Address</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{selectedContact?.address}</p>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => { openInMaps(selectedContact?.address, 'apple'); setShowAddressOptions(false); }}>
              <MapPin size={16} className="mr-2" /> Apple Maps
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { openInMaps(selectedContact?.address, 'google'); setShowAddressOptions(false); }}>
              <Navigation size={16} className="mr-2" /> Google Maps
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { openInMaps(selectedContact?.address, 'waze'); setShowAddressOptions(false); }}>
              <Navigation size={16} className="mr-2" /> Waze
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { copyToClipboard(selectedContact?.address); setShowAddressOptions(false); }}>
              <Copy size={16} className="mr-2" /> Copy Address
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              {/* Client Info - Make Name Clickable & Show Contact Options */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    window.location.href = `/customers/${selectedAppointment.client_id}`;
                  }}
                  className="font-semibold text-lg hover:text-primary transition-colors text-left block mb-2"
                >
                  {selectedAppointment.client_name}
                </button>
                {selectedAppointment.pets?.length > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {selectedAppointment.pets.map(p => p.pet_name).join(', ')}
                  </div>
                )}
                
                {/* Contact Actions */}
                {clients.find(c => c.id === selectedAppointment.client_id) && (
                  <div className="flex gap-2 mt-2">
                    {clients.find(c => c.id === selectedAppointment.client_id)?.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPhoneMenu(true)}
                        className="flex-1"
                      >
                        <Phone size={14} className="mr-1" /> Call/SMS
                      </Button>
                    )}
                    {clients.find(c => c.id === selectedAppointment.client_id)?.address && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddressMenu(true)}
                        className="flex-1"
                      >
                        <MapPin size={14} className="mr-1" /> Navigate
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
                  <div className="font-medium">{format(new Date(selectedAppointment.date_time), 'EEE, MMM d, yyyy')}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Time</div>
                  <div className="font-medium">{format(new Date(selectedAppointment.date_time), 'HH:mm')} - {format(new Date(selectedAppointment.end_time), 'HH:mm')}</div>
                </div>
              </div>
              
              {/* Services */}
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Services</div>
                <div className="space-y-2">
                  {selectedAppointment.pets?.map((pet, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">{pet.pet_name}:</span>{' '}
                      {services.filter(s => pet.services?.includes(s.id)).map(s => s.name).join(', ') || 'No services'}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Total */}
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">${selectedAppointment.total_price?.toFixed(2) || '0.00'}</span>
              </div>
              
              {/* Notes */}
              {selectedAppointment.notes && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">{selectedAppointment.notes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDetailsModal(false);
                setShowModal(true); // Open edit modal
              }}
              className="w-full sm:w-auto"
            >
              <Edit size={16} className="mr-2" /> Edit
            </Button>
            <Button 
              className="btn-maya-primary w-full sm:w-auto"
              disabled={selectedAppointment?.status === 'completed'}
              onClick={() => {
                // Initialize checkout items from appointment services
                const checkoutItemsInit = [];
                if (selectedAppointment.pets) {
                  selectedAppointment.pets.forEach(pet => {
                    if (pet.services) {
                      pet.services.forEach(svc => {
                        const service = services.find(s => s.id === svc.service_id || s.id === svc);
                        if (service) {
                          checkoutItemsInit.push({
                            id: `svc-${pet.pet_id}-${service.id}`,
                            type: 'service',
                            name: `${service.name} (${pet.pet_name})`,
                            quantity: 1,
                            unit_price: svc.price || service.price,
                            total: svc.price || service.price
                          });
                        }
                      });
                    }
                  });
                }
                setCheckoutItems(checkoutItemsInit);
                setCheckoutDiscount({ type: 'fixed', value: 0 });
                setCheckoutNotes('');
                setShowDetailsModal(false);
                setShowCheckoutModal(true);
              }}
            >
              <Receipt size={16} className="mr-2" /> 
              {selectedAppointment?.status === 'completed' ? 'Completed' : 'Review & Checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Options Menu - In Calendar */}
      <Dialog open={showPhoneMenu} onOpenChange={setShowPhoneMenu}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone size={18} className="text-primary" />
              Contact Options
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedAppointment && clients.find(c => c.id === selectedAppointment.client_id) && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const phone = clients.find(c => c.id === selectedAppointment.client_id)?.phone?.replace(/\D/g, '');
                    window.location.href = `tel:${phone}`;
                    setShowPhoneMenu(false);
                  }}
                >
                  <Phone size={16} className="mr-2" /> Call
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const phone = clients.find(c => c.id === selectedAppointment.client_id)?.phone?.replace(/\D/g, '');
                    window.location.href = `sms:${phone}`;
                    setShowPhoneMenu(false);
                  }}
                >
                  <MessageSquare size={16} className="mr-2" /> Send SMS
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const phone = clients.find(c => c.id === selectedAppointment.client_id)?.phone;
                    navigator.clipboard.writeText(phone || '');
                    toast.success('Phone number copied!');
                    setShowPhoneMenu(false);
                  }}
                >
                  <Copy size={16} className="mr-2" /> Copy Number
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Options Menu - In Calendar */}
      <Dialog open={showAddressMenu} onOpenChange={setShowAddressMenu}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              Navigate
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedAppointment && clients.find(c => c.id === selectedAppointment.client_id) && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const address = encodeURIComponent(clients.find(c => c.id === selectedAppointment.client_id)?.address || '');
                    window.location.href = `maps://?q=${address}`;
                    setShowAddressMenu(false);
                  }}
                >
                  <MapPin size={16} className="mr-2" /> Apple Maps
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const address = encodeURIComponent(clients.find(c => c.id === selectedAppointment.client_id)?.address || '');
                    window.location.href = `https://www.google.com/maps/search/?api=1&query=${address}`;
                    setShowAddressMenu(false);
                  }}
                >
                  <MapPin size={16} className="mr-2" /> Google Maps
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const address = encodeURIComponent(clients.find(c => c.id === selectedAppointment.client_id)?.address || '');
                    window.location.href = `https://waze.com/ul?q=${address}`;
                    setShowAddressMenu(false);
                  }}
                >
                  <Navigation size={16} className="mr-2" /> Waze
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="text-primary" size={20} />
              Review & Checkout
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-6">
              {/* Client & Appointment Info */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-maya-text">{selectedAppointment.client_name}</h3>
                    <p className="text-sm text-maya-text-muted mt-1">
                      {format(new Date(selectedAppointment.date_time), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-sm text-maya-text-muted">
                      {format(new Date(selectedAppointment.date_time), 'h:mm a')} - {format(new Date(selectedAppointment.end_time), 'h:mm a')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      selectedAppointment.status === 'completed' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {selectedAppointment.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Services Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-maya-text">Services</h4>
                  <Select onValueChange={(serviceId) => {
                    const service = services.find(s => s.id === serviceId);
                    if (service) {
                      setCheckoutItems([...checkoutItems, {
                        id: `svc-${Date.now()}`,
                        type: 'service',
                        name: service.name,
                        quantity: 1,
                        unit_price: service.price,
                        total: service.price
                      }]);
                    }
                  }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="+ Add Service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - {formatCurrency(service.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  {checkoutItems.filter(i => i.type === 'service').map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                      <div className="flex-1">
                        <p className="font-medium text-maya-text">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => {
                              const updated = checkoutItems.map(i => 
                                i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1), total: Math.max(1, i.quantity - 1) * i.unit_price } : i
                              );
                              setCheckoutItems(updated);
                            }}>-</Button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => {
                              const updated = checkoutItems.map(i => 
                                i.id === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i
                              );
                              setCheckoutItems(updated);
                            }}>+</Button>
                        </div>
                        <span className="font-semibold w-20 text-right">{formatCurrency(item.total)}</span>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-6 w-6 p-0"
                          onClick={() => setCheckoutItems(checkoutItems.filter(i => i.id !== item.id))}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {checkoutItems.filter(i => i.type === 'service').length === 0 && (
                    <p className="text-sm text-maya-text-muted text-center py-3">No services added</p>
                  )}
                </div>
              </div>

              {/* Products Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-maya-text">Products</h4>
                  <Select onValueChange={(itemId) => {
                    const product = items.find(i => i.id === itemId);
                    if (product) {
                      setCheckoutItems([...checkoutItems, {
                        id: `item-${Date.now()}`,
                        type: 'item',
                        name: product.name,
                        quantity: 1,
                        unit_price: product.price,
                        total: product.price
                      }]);
                    }
                  }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="+ Add Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - {formatCurrency(item.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Products List */}
                <div className="space-y-2">
                  {checkoutItems.filter(i => i.type === 'item').map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                      <div className="flex-1">
                        <p className="font-medium text-maya-text">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => {
                              const updated = checkoutItems.map(i => 
                                i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1), total: Math.max(1, i.quantity - 1) * i.unit_price } : i
                              );
                              setCheckoutItems(updated);
                            }}>-</Button>
                          <span className="w-6 text-center">{item.quantity}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => {
                              const updated = checkoutItems.map(i => 
                                i.id === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i
                              );
                              setCheckoutItems(updated);
                            }}>+</Button>
                        </div>
                        <span className="font-semibold w-20 text-right">{formatCurrency(item.total)}</span>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-6 w-6 p-0"
                          onClick={() => setCheckoutItems(checkoutItems.filter(i => i.id !== item.id))}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {checkoutItems.filter(i => i.type === 'item').length === 0 && (
                    <p className="text-sm text-maya-text-muted text-center py-3">No products added</p>
                  )}
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-3">
                <h4 className="font-semibold text-maya-text">Discount</h4>
                <div className="flex gap-3 items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Select 
                    value={checkoutDiscount.type} 
                    onValueChange={(v) => setCheckoutDiscount({ ...checkoutDiscount, type: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">$ Fixed</SelectItem>
                      <SelectItem value="percent">% Percent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="w-24"
                    value={checkoutDiscount.value || ''}
                    onChange={(e) => setCheckoutDiscount({ ...checkoutDiscount, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h4 className="font-semibold text-maya-text">Notes</h4>
                <Textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Payment notes, special instructions..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Totals */}
              <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl p-5 space-y-3">
                {(() => {
                  const subtotal = checkoutItems.reduce((sum, item) => sum + (item.total || 0), 0);
                  const discountAmount = checkoutDiscount.type === 'percent' 
                    ? subtotal * (checkoutDiscount.value || 0) / 100 
                    : (checkoutDiscount.value || 0);
                  const total = Math.max(0, subtotal - discountAmount);
                  const gstAmount = total * 10 / 110;
                  
                  return (
                    <>
                      <div className="flex justify-between text-gray-300">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-green-400">
                          <span>Discount</span>
                          <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-400 text-sm">
                        <span>GST (incl.)</span>
                        <span>{formatCurrency(gstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-2xl font-bold border-t border-gray-700 pt-3">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setShowCheckoutModal(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              className="btn-maya-primary w-full sm:w-auto"
              disabled={checkoutItems.length === 0 || selectedAppointment?.status === 'completed'}
              onClick={async () => {
                if (checkoutItems.length === 0) {
                  toast.error('Please add at least one item');
                  return;
                }
                try {
                  const subtotal = checkoutItems.reduce((sum, item) => sum + (item.total || 0), 0);
                  const discountAmount = checkoutDiscount.type === 'percent' 
                    ? subtotal * (checkoutDiscount.value || 0) / 100 
                    : (checkoutDiscount.value || 0);
                  
                  // Create invoice
                  const invoiceData = {
                    client_id: selectedAppointment.client_id,
                    appointment_id: selectedAppointment.id,
                    items: checkoutItems.map(i => ({
                      name: i.name,
                      quantity: i.quantity,
                      unit_price: i.unit_price,
                      total: i.total
                    })),
                    notes: checkoutNotes,
                    discount: discountAmount,
                  };
                  
                  const response = await invoicesAPI.create(invoiceData);
                  console.log('Invoice created:', response);
                  
                  // Update appointment status to completed
                  await appointmentsAPI.update(selectedAppointment.id, { status: 'completed' });
                  
                  toast.success('Invoice created successfully!');
                  setShowCheckoutModal(false);
                  setSelectedAppointment(null);
                  fetchData();
                } catch (error) {
                  console.error('Checkout error:', error);
                  toast.error(error.response?.data?.detail || 'Failed to process checkout');
                }
              }}
            >
              <DollarSign size={16} className="mr-2" /> 
              {selectedAppointment?.status === 'completed' ? 'Already Completed' : 'Complete & Generate Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>>
      </Dialog>
    </Layout>
  );
}
