import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Send, MessageSquare, Phone, Copy, MapPin, Navigation, Calendar as CalendarIcon, Edit, Trash2, DollarSign, Receipt, Percent, Mail, Share2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { appointmentsAPI, clientsAPI, servicesAPI, itemsAPI, invoicesAPI } from '../lib/api';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { AppointmentModal } from '../components/AppointmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Google Calendar imported appointment color
const GOOGLE_IMPORT_COLORS = { 
  bg: 'bg-purple-100', 
  border: 'border-purple-500', 
  text: 'text-purple-900' 
};

export default function CalendarPage() {
  const { settings } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [popoverMonth, setPopoverMonth] = useState(new Date());
  
  // Track if we need to open an appointment from URL
  const pendingAppointmentId = useRef(searchParams.get('appointment'));
  const pendingDate = useRef(searchParams.get('date'));
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  
  // View mode state
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  
  // Drag state
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  
  // Dialogs
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRecurringRescheduleDialog, setShowRecurringRescheduleDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPhoneMenu, setShowPhoneMenu] = useState(false); // Added for phone popup
  const [showAddressMenu, setShowAddressMenu] = useState(false); // Added for address popup
  const [showSendInvoiceDialog, setShowSendInvoiceDialog] = useState(false); // For send invoice popup
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
  const [appointmentInvoice, setAppointmentInvoice] = useState(null); // Track if selected appointment has invoice
  
  const scrollRef = useRef(null);
  const hasScrolledToTime = useRef(false);
  const currentTimeRef = useRef(null);
  
  // Handle navigation from customer detail page via URL params
  useEffect(() => {
    const dateParam = searchParams.get('date');
    const appointmentParam = searchParams.get('appointment');
    
    if (dateParam) {
      // Parse the date and navigate to it
      const targetDate = new Date(dateParam + 'T12:00:00');
      if (!isNaN(targetDate.getTime())) {
        setSelectedDate(targetDate);
        hasScrolledToTime.current = false;
      }
      
      // Store appointment ID to open after data loads
      if (appointmentParam) {
        pendingAppointmentId.current = appointmentParam;
        pendingDate.current = dateParam;
      }
      
      // Clear URL params after reading
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  // Handle legacy location.state navigation
  useEffect(() => {
    if (location.state?.scrollToDate) {
      setSelectedDate(new Date(location.state.scrollToDate));
      hasScrolledToTime.current = false;
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
  
  // Open pending appointment from URL navigation (after data loads)
  useEffect(() => {
    const openPendingAppointment = async () => {
      if (!loading && pendingAppointmentId.current) {
        // First try to find in current appointments
        let targetAppt = appointments.find(a => a.id === pendingAppointmentId.current);
        
        // If not found, fetch directly from API (appointment might be in a different week)
        if (!targetAppt) {
          try {
            const token = localStorage.getItem('maya_token');
            const response = await axios.get(`${API_URL}/appointments/${pendingAppointmentId.current}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            targetAppt = response.data;
          } catch (error) {
            console.error('Failed to fetch appointment:', error);
          }
        }
        
        if (targetAppt) {
          // Navigate to the correct date if needed
          const apptDate = new Date(targetAppt.date_time);
          if (!isSameDay(apptDate, selectedDate)) {
            setSelectedDate(apptDate);
          }
          
          // Open the appointment details modal
          setSelectedAppointment(targetAppt);
          setAppointmentInvoice(null);
          setShowDetailsModal(true);
          
          // Check for existing invoice
          try {
            const token = localStorage.getItem('maya_token');
            const response = await axios.get(`${API_URL}/invoices/check/${targetAppt.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setAppointmentInvoice(response.data);
          } catch (error) {
            console.error('Error checking invoice:', error);
            setAppointmentInvoice({ has_invoice: false });
          }
        }
        
        // Clear pending appointment
        pendingAppointmentId.current = null;
        pendingDate.current = null;
      }
    };
    
    openPendingAppointment();
  }, [loading, appointments, selectedDate]);
  
  // Reset scroll flag when returning to today's date
  useEffect(() => {
    if (isToday(selectedDate)) {
      hasScrolledToTime.current = false;
    }
  }, [selectedDate]);

  useEffect(() => {
    setPopoverMonth(selectedDate);
  }, [selectedDate]);

  // Current time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Current time indicator position - accounts for 100px padding and zoom level
  // Time grid: SLOT_HEIGHT (20px) × 4 slots per hour = 80px per hour
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    // Each hour = 4 slots × SLOT_HEIGHT = 80px at zoom 1
    // Position = (hours × 80 + minutes/60 × 80) × zoomLevel + 100px padding
    const pixelsPerHour = SLOT_HEIGHT * 4; // 80px
    return (hours * pixelsPerHour + (minutes / 60) * pixelsPerHour) * zoomLevel + 100;
  };
  const currentTimePos = getCurrentTimePosition();
  const isSelectedDateToday = isSameDay(selectedDate, new Date());

  // Auto-scroll to current time on initial load
  useEffect(() => {
    if (!loading && scrollRef.current && isSelectedDateToday && !hasScrolledToTime.current) {
      const timer = setTimeout(() => {
        if (scrollRef.current && currentTimeRef.current) {
          // Use scrollIntoView for more reliable scrolling
          currentTimeRef.current.scrollIntoView({ behavior: 'instant', block: 'center' });
          hasScrolledToTime.current = true;
        } else if (scrollRef.current) {
          // Fallback to manual scroll - 80px per hour
          const now = new Date();
          const hours = now.getHours();
          const minutes = now.getMinutes();
          const pixelsPerHour = SLOT_HEIGHT * 4; // 80px
          // Scroll to show current time with 1 hour before context
          // This ensures 00:00 is visible when scrolling to early morning hours
          const scrollPos = Math.max(0, ((hours - 1) * pixelsPerHour + (minutes / 60) * pixelsPerHour) * zoomLevel);
          scrollRef.current.scrollTop = scrollPos;
          hasScrolledToTime.current = true;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, isSelectedDateToday, zoomLevel]);

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
    hasScrolledToTime.current = false; // Reset to trigger auto-scroll in useEffect
  };

  const handleSlotClick = (hour, minute) => {
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hour, minute, 0, 0);
    setSelectedSlot(slotDate);
    setSelectedAppointment(null);
    setShowModal(true);
  };

  const handleAppointmentClick = async (appointment, e) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setSelectedSlot(null);
    setAppointmentInvoice(null); // Reset invoice state
    
    // Check if this appointment already has an invoice
    try {
      const token = localStorage.getItem('maya_token');
      const response = await axios.get(`${API_URL}/invoices/check/${appointment.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointmentInvoice(response.data);
    } catch (error) {
      console.error('Error checking invoice:', error);
      setAppointmentInvoice({ has_invoice: false });
    }
    
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
    
    // Create a custom drag image to maintain size
    const dragImage = e.currentTarget.cloneNode(true);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.width = e.currentTarget.offsetWidth + 'px';
    dragImage.style.height = e.currentTarget.offsetHeight + 'px';
    dragImage.style.opacity = '0.8';
    document.body.appendChild(dragImage);
    
    e.dataTransfer.setDragImage(dragImage, e.currentTarget.offsetWidth / 2, e.currentTarget.offsetHeight / 2);
    
    // Clean up the drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
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
    
    // The calendar displays times in LOCAL timezone
    // The hour/minute parameters are the visual position (local time)
    // We need to calculate the UTC time that will display at this position
    
    // Get the old appointment's date in UTC
    const oldDateTime = new Date(draggedAppointment.date_time);
    
    // Create a new date for the same day as selectedDate, but with the target time
    // We want: when this UTC time is displayed in local timezone, it shows at hour:minute
    const newDateTime = new Date(selectedDate);
    newDateTime.setHours(hour, minute, 0, 0);
    
    // The newDateTime is now in local time. toISOString() will convert to UTC correctly.
    // This means if user drops at 10:30 local, and local is UTC+11, 
    // the UTC will be 23:30 previous day, which is correct.
    
    setPendingReschedule({
      appointment: draggedAppointment,
      newDateTime,
      oldDateTime
    });
    
    // Check if it's a recurring appointment
    if (draggedAppointment.is_recurring || draggedAppointment.recurring_id) {
      setShowRecurringRescheduleDialog(true);
    } else {
      setShowConfirmDialog(true);
    }
    
    setDraggedAppointment(null);
    setDragPreview(null);
  };

  const handleDragEnd = () => {
    setDraggedAppointment(null);
    setDragPreview(null);
  };

  const confirmReschedule = async (updateSeries = false) => {
    if (!pendingReschedule) return;
    
    try {
      const updateData = {
        date_time: pendingReschedule.newDateTime.toISOString()
      };
      
      // If updating the series, pass the flag
      if (updateSeries && pendingReschedule.appointment.recurring_id) {
        updateData.update_series = true;
      }
      
      await appointmentsAPI.update(pendingReschedule.appointment.id, updateData);
      toast.success(updateSeries ? 'Series rescheduled' : 'Appointment rescheduled');
      fetchData();
      setShowConfirmDialog(false);
      setShowRecurringRescheduleDialog(false);
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
    isSameDay(new Date(appt.date_time), selectedDate) &&
    !['cancelled', 'no_show'].includes(appt.status) // Hide cancelled appointments from calendar
  );

  // Get filtered appointments for list view (includes cancelled/no_show)
  const filteredAppointments = appointments.filter(appt => 
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
      
      if (currentGroup.length === 0) {
        currentGroup.push(appt);
      } else {
        // FIXED: Only group appointments that start at the EXACT same time
        // This means they're truly overlapping and should display side-by-side
        const hasSameStartTime = currentGroup.some(existingAppt => {
          const existingStart = new Date(existingAppt.date_time);
          return existingStart.getTime() === apptStart.getTime();
        });
        
        if (hasSameStartTime) {
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
    
    // Only return top and height - width/left are calculated separately in render
    return { top: `${top}px`, height: `${Math.max(height, 40)}px`, minHeight: '40px' };
  };

  const groups = getOverlappingGroups();

  return (
    <Layout>
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        {/* FIXED Header - Compact Single Line */}
        <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-30">

          <Popover>
            <PopoverTrigger asChild>
              <button className="text-base font-semibold text-gray-900 dark:text-white hover:text-primary flex items-center gap-1">
                {format(selectedDate, 'MMM yyyy')}
                <ChevronRight size={14} className="rotate-90" />
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
          <div className="flex items-center gap-1.5">
            <select 
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="text-sm font-medium border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="calendar">Calendar</option>
              <option value="list">List</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="text-sm font-medium px-3 py-1.5 h-8"
              data-testid="today-btn"
            >
              Today
            </Button>
            <button
              onClick={() => { setSelectedSlot(new Date()); setSelectedAppointment(null); setShowModal(true); }}
              className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary-hover"
              data-testid="new-appointment-btn"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* FIXED Week Day Selector - Compact and Clear */}
        <div className="fixed top-[48px] left-0 right-0 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-20 py-2">
          <button onClick={navigatePrev} className="px-2 flex items-center text-gray-400 hover:text-primary">
            <ChevronLeft size={18} />
          </button>
          {weekDates.map((date, i) => (
            <button
              key={i}
              onClick={() => setSelectedDate(date)}
              className="flex-1 text-center"
            >
              <div className={cn(
                "text-[10px] font-bold uppercase tracking-wide mb-0.5",
                isSameDay(date, selectedDate) ? "text-primary" : "text-gray-800 dark:text-gray-200"
              )}>
                {format(date, 'EEE')}
              </div>
              <div className={cn(
                "text-sm font-bold w-7 h-7 mx-auto flex items-center justify-center rounded-full",
                isSameDay(date, selectedDate) && "bg-primary text-white",
                isToday(date) && !isSameDay(date, selectedDate) && "bg-green-100 text-green-700"
              )}>
                {format(date, 'd')}
              </div>
            </button>
          ))}
          <button onClick={navigateNext} className="px-2 flex items-center text-gray-400 hover:text-primary">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* SCROLLABLE Calendar Grid */}
        {viewMode === 'calendar' ? (
        <div 
          className="flex-1 overflow-y-auto relative touch-pan-y bg-white dark:bg-gray-900"
          style={{paddingTop: '100px'}}
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Current Time Indicator */}
          {isSelectedDateToday && (
            <div
              ref={currentTimeRef}
              className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              style={{ top: `${currentTimePos}px` }}
            >
              <div className="w-14 flex-shrink-0 pr-2 text-right">
                <span className="text-[10px] font-bold text-red-500 bg-white px-1">
                  {format(new Date(), 'HH:mm')}
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
                // Check if appointment was imported from Google Calendar
                const isGoogleImport = appt.notes && appt.notes.includes('Imported from Google Calendar');
                const colors = isGoogleImport ? GOOGLE_IMPORT_COLORS : (STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled);
                
                return (
                  <div
                    key={appt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, appt)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleAppointmentClick(appt, e)}
                    className={cn(
                      "absolute border-l-4 border-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:opacity-90 transition-colors shadow-md overflow-hidden",
                      colors.bg, colors.border, colors.text,
                      draggedAppointment?.id === appt.id && "opacity-50 ring-2 ring-primary",
                      draggedAppointment && draggedAppointment.id !== appt.id && "pointer-events-none"
                    )}
                    style={{
                      ...style,
                      left: group.length > 1 
                        ? `calc(64px + ${apptIndex * 10}px)` 
                        : '64px',
                      width: group.length > 1 
                        ? `calc(100% - 72px - ${(group.length - 1) * 10}px)` 
                        : 'calc(100% - 72px)',
                      minWidth: '120px',
                      zIndex: 10 + apptIndex,
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
        ) : (
        // LIST VIEW
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900" style={{paddingTop: '60px'}}>
          <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No appointments scheduled for this day
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments
                  .sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
                  .map((appt) => {
                    const client = clients.find(c => c.id === appt.client_id);
                    const isGoogleImport = appt.notes && appt.notes.includes('Imported from Google Calendar');
                    const colors = isGoogleImport ? GOOGLE_IMPORT_COLORS : (STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled);
                    
                    return (
                      <div
                        key={appt.id}
                        onClick={() => {
                          setSelectedAppointment(appt);
                          setShowDetailsModal(true);
                        }}
                        className={cn(
                          "border-l-4 border-2 rounded-md p-4 cursor-pointer hover:shadow-lg transition-shadow",
                          colors.bg, colors.border, colors.text
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold">
                              {format(new Date(appt.date_time), 'h:mm a')} - {format(new Date(appt.end_time), 'h:mm a')}
                            </div>
                            <div className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                              {appt.total_duration} min
                            </div>
                          </div>
                          <div className={cn(
                            "text-xs px-2 py-1 rounded-full capitalize",
                            appt.status === 'confirmed' && "bg-green-100 text-green-700",
                            appt.status === 'scheduled' && "bg-blue-100 text-blue-700",
                            appt.status === 'completed' && "bg-gray-100 text-gray-700",
                            appt.status === 'cancelled' && "bg-red-100 text-red-700"
                          )}>
                            {appt.status}
                          </div>
                        </div>
                        <div className="font-semibold text-base mb-1">
                          {appt.client_name}
                        </div>
                        {appt.pets?.length > 0 && (
                          <div className="text-sm mb-2 flex flex-wrap gap-1">
                            {appt.pets.map((pet, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                {pet.pet_name}
                              </span>
                            ))}
                          </div>
                        )}
                        {client && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {client.phone && (
                              <div className="flex items-center gap-2">
                                <Phone size={12} />
                                <span>{client.phone}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-center gap-2">
                                <MapPin size={12} />
                                <span className="text-xs">{client.address}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {appt.pets?.some(p => p.services?.length > 0) && (
                          <div className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                            Services: {appt.pets.flatMap(p => 
                              (p.services || []).map(s => 
                                typeof s === 'string' ? services.find(srv => srv.id === s)?.name : s.service_name
                              )
                            ).filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
        )}
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
                Move <span className="font-semibold">{pendingReschedule.appointment.client_name}&apos;s</span> appointment?
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
            <Button className="btn-maya-primary w-full sm:w-auto" onClick={() => confirmReschedule(false)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Appointment Reschedule Dialog */}
      <Dialog open={showRecurringRescheduleDialog} onOpenChange={setShowRecurringRescheduleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Recurring Appointment</DialogTitle>
          </DialogHeader>
          {pendingReschedule && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This is a recurring appointment. Would you like to reschedule:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16">From:</span>
                  <span className="font-medium">{format(pendingReschedule.oldDateTime, 'HH:mm')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16">To:</span>
                  <input
                    type="time"
                    value={format(pendingReschedule.newDateTime, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDT = new Date(pendingReschedule.newDateTime);
                      newDT.setHours(parseInt(hours), parseInt(minutes));
                      setPendingReschedule({...pendingReschedule, newDateTime: newDT});
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded bg-white text-sm font-medium text-primary"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col">
            <Button 
              variant="outline" 
              onClick={() => { setShowRecurringRescheduleDialog(false); setPendingReschedule(null); }} 
              className="w-full"
            >
              Cancel
            </Button>
            <Button 
              className="btn-maya-primary w-full" 
              onClick={() => confirmReschedule(false)}
            >
              Only This Appointment
            </Button>
            <Button 
              variant="outline" 
              className="w-full border-primary text-primary hover:bg-primary/10" 
              onClick={() => confirmReschedule(true)}
            >
              Entire Series
            </Button>
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
                
                {/* Customer Contact Details - One under the other - Clickable but NOT underlined */}
                {clients.find(c => c.id === selectedAppointment.client_id) && (
                  <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {clients.find(c => c.id === selectedAppointment.client_id)?.phone && (
                      <button
                        onClick={() => setShowPhoneMenu(true)}
                        className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer w-full text-left"
                      >
                        <Phone size={14} className="flex-shrink-0" />
                        <span>{clients.find(c => c.id === selectedAppointment.client_id)?.phone}</span>
                      </button>
                    )}
                    {clients.find(c => c.id === selectedAppointment.client_id)?.email && (
                      <button
                        onClick={() => {
                          const email = clients.find(c => c.id === selectedAppointment.client_id)?.email;
                          window.location.href = `mailto:${email}`;
                        }}
                        className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer w-full text-left"
                      >
                        <Mail size={14} className="flex-shrink-0" />
                        <span className="truncate">{clients.find(c => c.id === selectedAppointment.client_id)?.email}</span>
                      </button>
                    )}
                    {clients.find(c => c.id === selectedAppointment.client_id)?.address && (
                      <button
                        onClick={() => setShowAddressMenu(true)}
                        className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer w-full text-left"
                      >
                        <MapPin size={14} className="flex-shrink-0" />
                        <span className="text-xs">{clients.find(c => c.id === selectedAppointment.client_id)?.address}</span>
                      </button>
                    )}
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
                  <button
                    onClick={() => {
                      setSelectedDate(new Date(selectedAppointment.date_time));
                      setShowDetailsModal(false);
                      hasScrolledToTime.current = false; // Trigger scroll to appointment time
                    }}
                    className="font-medium hover:text-primary transition-colors text-left"
                  >
                    {format(new Date(selectedAppointment.date_time), 'EEE, MMM d, yyyy')}
                  </button>
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
              <Receipt size={16} className="mr-2" /> Review & Checkout
            </Button>
            {appointmentInvoice?.has_invoice && (
              <Button 
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  window.location.href = '/invoices';
                }}
              >
                View Invoice ({appointmentInvoice.invoice_number})
              </Button>
            )}
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
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    const address = clients.find(c => c.id === selectedAppointment.client_id)?.address || '';
                    navigator.clipboard.writeText(address);
                    toast.success('Address copied!');
                    setShowAddressMenu(false);
                  }}
                >
                  <Copy size={16} className="mr-2" /> Copy Address
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Receipt className="text-primary" size={18} />
              Review & Checkout
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {/* Client & Appointment Info */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 border border-primary/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-maya-text">{selectedAppointment.client_name}</h3>
                    <p className="text-xs text-maya-text-muted mt-1">
                      {format(new Date(selectedAppointment.date_time), 'EEE, MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-maya-text-muted">
                      {format(new Date(selectedAppointment.date_time), 'h:mm a')} - {format(new Date(selectedAppointment.end_time), 'h:mm a')}
                    </p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    selectedAppointment.status === 'completed' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {selectedAppointment.status}
                  </span>
                </div>
              </div>

              {/* Services Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-maya-text">Services</h4>
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
                    <div key={item.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-maya-text truncate">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => {
                            const updated = checkoutItems.map(i => 
                              i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1), total: Math.max(1, i.quantity - 1) * i.unit_price } : i
                            );
                            setCheckoutItems(updated);
                          }}>-</Button>
                        <span className="w-4 text-center text-xs">{item.quantity}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => {
                            const updated = checkoutItems.map(i => 
                              i.id === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i
                            );
                            setCheckoutItems(updated);
                          }}>+</Button>
                        <span className="text-xs text-gray-400 mx-1">×</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.unit_price}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const newPrice = parseFloat(value) || 0;
                            const updated = checkoutItems.map(i => 
                              i.id === item.id ? { ...i, unit_price: newPrice, total: i.quantity * newPrice } : i
                            );
                            setCheckoutItems(updated);
                          }}
                          className="w-16 h-6 text-right text-xs px-1"
                        />
                        <span className="font-semibold w-16 text-right text-xs">{formatCurrency(item.total)}</span>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-5 w-5 p-0"
                          onClick={() => setCheckoutItems(checkoutItems.filter(i => i.id !== item.id))}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {checkoutItems.filter(i => i.type === 'service').length === 0 && (
                    <p className="text-xs text-maya-text-muted text-center py-2">No services added</p>
                  )}
                </div>
              </div>

              {/* Products/Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-maya-text">Products/Items</h4>
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
                      <SelectValue placeholder="+ Add Item" />
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

                {/* Products/Items List */}
                <div className="space-y-2">
                  {checkoutItems.filter(i => i.type === 'item').map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-maya-text truncate">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => {
                            const updated = checkoutItems.map(i => 
                              i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1), total: Math.max(1, i.quantity - 1) * i.unit_price } : i
                            );
                            setCheckoutItems(updated);
                          }}>-</Button>
                        <span className="w-4 text-center text-xs">{item.quantity}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => {
                            const updated = checkoutItems.map(i => 
                              i.id === item.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i
                            );
                            setCheckoutItems(updated);
                          }}>+</Button>
                        <span className="text-xs text-gray-400 mx-1">×</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.unit_price}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            const newPrice = parseFloat(value) || 0;
                            const updated = checkoutItems.map(i => 
                              i.id === item.id ? { ...i, unit_price: newPrice, total: i.quantity * newPrice } : i
                            );
                            setCheckoutItems(updated);
                          }}
                          className="w-16 h-6 text-right text-xs px-1"
                        />
                        <span className="font-semibold w-16 text-right text-xs">{formatCurrency(item.total)}</span>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-5 w-5 p-0"
                          onClick={() => setCheckoutItems(checkoutItems.filter(i => i.id !== item.id))}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {checkoutItems.filter(i => i.type === 'item').length === 0 && (
                    <p className="text-xs text-maya-text-muted text-center py-2">No products added</p>
                  )}
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-maya-text">Discount</h4>
                <div className="flex gap-2 items-center p-2 bg-gray-50 rounded-lg">
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
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-maya-text">Notes</h4>
                <Textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Payment notes..."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* Totals */}
              <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg p-3 space-y-2">
                {(() => {
                  const subtotal = checkoutItems.reduce((sum, item) => sum + (item.total || 0), 0);
                  const discountAmount = checkoutDiscount.type === 'percent' 
                    ? subtotal * (checkoutDiscount.value || 0) / 100 
                    : (checkoutDiscount.value || 0);
                  const total = Math.max(0, subtotal - discountAmount);
                  const gstAmount = total * 10 / 110;
                  
                  return (
                    <>
                      <div className="flex justify-between text-gray-300 text-sm">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-green-400 text-sm">
                          <span>Discount</span>
                          <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-400 text-xs">
                        <span>GST (incl.)</span>
                        <span>{formatCurrency(gstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold border-t border-gray-700 pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 px-4 py-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowCheckoutModal(false)} className="flex-1 text-sm">
              Cancel
            </Button>
            {selectedAppointment?.status === 'completed' && (
              <Button 
                variant="outline"
                onClick={() => setShowSendInvoiceDialog(true)}
                className="flex-1 text-sm border-primary text-primary hover:bg-primary/10"
              >
                <Send size={14} className="mr-1" />
                Send Invoice
              </Button>
            )}
            <Button 
              className="btn-maya-primary flex-1 text-sm"
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
              <DollarSign size={14} className="mr-1" /> 
              {selectedAppointment?.status === 'completed' ? 'Completed' : 'Complete & Invoice'}
            </Button>


      {/* Send Invoice Dialog - Share PDF with Web Share API */}
      <Dialog open={showSendInvoiceDialog} onOpenChange={setShowSendInvoiceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          
          {/* Show customer contact info with copy buttons */}
          {selectedAppointment && (() => {
            const client = clients.find(c => c.id === selectedAppointment.client_id);
            const copyToClipboard = (text, label) => {
              navigator.clipboard.writeText(text).then(() => {
                toast.success(`${label} copied!`);
              }).catch(() => {
                toast.error('Failed to copy');
              });
            };
            return (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                <p className="font-medium text-sm mb-2">{client?.name || selectedAppointment.client_name}</p>
                {client?.phone && (
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">📱 {client.phone}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs"
                      onClick={() => copyToClipboard(client.phone, 'Phone')}
                    >
                      <Copy size={12} className="mr-1" /> Copy
                    </Button>
                  </div>
                )}
                {client?.email && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">✉️ {client.email}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs"
                      onClick={() => copyToClipboard(client.email, 'Email')}
                    >
                      <Copy size={12} className="mr-1" /> Copy
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
          
          <p className="text-xs text-gray-500 mb-4">
            Tap below to share the PDF invoice. Select Messages or Mail, then choose the recipient.
          </p>
          
          {/* Single Share Button */}
          <Button
            onClick={async () => {
              try {
                const client = clients.find(c => c.id === selectedAppointment?.client_id);
                
                // Generate PDF - Professional design
                const subtotal = checkoutItems.reduce((sum, item) => sum + (item.total || 0), 0);
                const discountAmount = checkoutDiscount.type === 'percent' 
                  ? subtotal * (checkoutDiscount.value || 0) / 100 
                  : (checkoutDiscount.value || 0);
                const total = subtotal - discountAmount;
                
                const doc = new jsPDF();
                const pageWidth = doc.internal.pageSize.getWidth();
                const brandColor = [200, 100, 50];
                
                // Header bar with brand color
                doc.setFillColor(...brandColor);
                doc.rect(0, 0, pageWidth, 35, 'F');
                
                // Business name in header
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont(undefined, 'bold');
                doc.text(settings?.business_name || 'Maya Pet Grooming', 20, 22);
                
                // INVOICE title on right
                doc.setFontSize(24);
                doc.text('INVOICE', pageWidth - 20, 22, { align: 'right' });
                
                // Reset text color
                doc.setTextColor(60, 60, 60);
                
                // Invoice details
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                const detailsX = pageWidth - 70;
                doc.text('Date:', detailsX, 50);
                doc.text(format(new Date(selectedAppointment?.date_time), 'dd MMM yyyy'), detailsX + 35, 50);
                doc.text('Time:', detailsX, 58);
                doc.text(format(new Date(selectedAppointment?.date_time), 'h:mm a'), detailsX + 35, 58);
                
                // Bill To section
                doc.setFillColor(245, 245, 245);
                doc.rect(20, 45, 80, 35, 'F');
                
                doc.setTextColor(...brandColor);
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('BILL TO', 25, 53);
                
                doc.setTextColor(60, 60, 60);
                doc.setFontSize(10);
                let billToY = 61;
                doc.setFont(undefined, 'bold');
                doc.text(client?.name || selectedAppointment?.client_name || 'Customer', 25, billToY);
                doc.setFont(undefined, 'normal');
                billToY += 6;
                if (client?.address) { 
                  const addressLines = doc.splitTextToSize(client.address, 70);
                  doc.text(addressLines, 25, billToY);
                  billToY += addressLines.length * 5;
                }
                if (client?.phone) { doc.text(client.phone, 25, billToY); billToY += 5; }
                if (client?.email) { doc.text(client.email, 25, billToY); }
                
                // Items table with professional styling
                const tableData = checkoutItems.map(item => [
                  item.name,
                  item.quantity.toString(),
                  `$${item.unit_price.toFixed(2)}`,
                  `$${item.total.toFixed(2)}`
                ]);
                
                autoTable(doc, {
                  startY: 90,
                  head: [['Description', 'Qty', 'Unit Price', 'Amount']],
                  body: tableData,
                  theme: 'plain',
                  headStyles: { 
                    fillColor: brandColor,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10,
                    cellPadding: 4
                  },
                  bodyStyles: {
                    fontSize: 10,
                    cellPadding: 4,
                    textColor: [60, 60, 60]
                  },
                  alternateRowStyles: {
                    fillColor: [250, 250, 250]
                  },
                  columnStyles: {
                    0: { cellWidth: 90 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 35, halign: 'right' },
                    3: { cellWidth: 35, halign: 'right' }
                  },
                  margin: { left: 20, right: 20 }
                });
                
                // Totals section - aligned with table's Amount column
                const finalY = (doc.lastAutoTable?.finalY || 120) + 10;
                const amountColumnRight = pageWidth - 20;
                const amountColumnLeft = amountColumnRight - 35;
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                
                let currentY = finalY;
                if (discountAmount > 0) {
                  doc.text('Discount:', amountColumnLeft - 5, currentY, { align: 'right' });
                  doc.text(`-$${discountAmount.toFixed(2)}`, amountColumnRight, currentY, { align: 'right' });
                  currentY += 10;
                }
                
                // Total with highlight
                const totalBarStart = amountColumnLeft - 45;
                doc.setFillColor(...brandColor);
                doc.rect(totalBarStart, currentY - 6, amountColumnRight - totalBarStart, 12, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('TOTAL:', amountColumnLeft - 5, currentY, { align: 'right' });
                doc.text(`$${total.toFixed(2)}`, amountColumnRight, currentY, { align: 'right' });
                
                // Footer
                const footerY = 280;
                doc.setDrawColor(...brandColor);
                doc.setLineWidth(0.5);
                doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
                
                doc.setFontSize(9);
                doc.setTextColor(120, 120, 120);
                doc.setFont(undefined, 'normal');
                doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
                
                const pdfBlob = doc.output('blob');
                const fileName = `Invoice_${selectedAppointment?.client_name?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                
                // Use Web Share API - allows attaching PDF to SMS/Email
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    files: [file],
                    title: `Invoice - ${selectedAppointment?.client_name}`,
                    text: `Invoice from ${settings?.business_name || 'Maya Pet Grooming'} - Total: $${total.toFixed(2)}`
                  });
                  toast.success('Invoice shared!');
                  setShowSendInvoiceDialog(false);
                } else {
                  doc.save(fileName);
                  toast.success('PDF downloaded');
                  setShowSendInvoiceDialog(false);
                }
              } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Share error:', error);
                toast.error('Could not share PDF');
              }
            }}
            className="w-full h-auto py-4"
            data-testid="share-invoice-btn"
          >
            <Share2 size={20} className="mr-3" />
            <div className="text-left">
              <div className="font-medium">Share Invoice PDF</div>
              <div className="text-xs opacity-80">Send via Messages, Mail, WhatsApp, etc.</div>
            </div>
          </Button>
        </DialogContent>
      </Dialog>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
