import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Send, MessageSquare, Phone, Copy, MapPin, Navigation, Calendar as CalendarIcon, Edit } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { appointmentsAPI, clientsAPI, servicesAPI } from '../lib/api';
import { cn, isToday } from '../lib/utils';
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
  const [pendingReschedule, setPendingReschedule] = useState(null);
  const [showSmsPrompt, setShowSmsPrompt] = useState(false);
  const [showPhoneOptions, setShowPhoneOptions] = useState(false);
  const [showAddressOptions, setShowAddressOptions] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const scrollRef = useRef(null);
  const hasScrolledToTime = useRef(false);

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
      
      const [apptRes, clientsRes, servicesRes] = await Promise.all([
        appointmentsAPI.list({
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString()
        }),
        clientsAPI.list(),
        servicesAPI.list()
      ]);
      
      setAppointments(apptRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
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
    if (scrollRef.current && !hasScrolledToTime.current) {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const slotIndex = hour * 4 + Math.floor(minutes / 15);
      const scrollPosition = slotIndex * SLOT_HEIGHT * zoomLevel - 100;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
      hasScrolledToTime.current = true;
    }
  }, [loading, zoomLevel]);

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
    hasScrolledToTime.current = false; // Will trigger scroll to current time
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
    setShowModal(true);
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
                    {/* Price */}
                    {appt.total_price > 0 && (
                      <div className="text-[10px] opacity-70 mt-0.5 truncate">
                        ${appt.total_price.toFixed(2)}
                      </div>
                    )}
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
    </Layout>
  );
}
