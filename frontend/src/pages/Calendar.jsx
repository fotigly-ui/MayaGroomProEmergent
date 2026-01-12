import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Send, MessageSquare } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { appointmentsAPI, clientsAPI, servicesAPI } from '../lib/api';
import { cn, isToday, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { AppointmentModal } from '../components/AppointmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Business hours: 6am to 10pm (each hour = 60px height)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const HOUR_HEIGHT = 60; // pixels per hour

export default function CalendarPage() {
  const { settings } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [popoverMonth, setPopoverMonth] = useState(new Date());
  
  // Drag and drop state
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState(null);
  
  // SMS prompt state
  const [showSmsPrompt, setShowSmsPrompt] = useState(false);
  
  const scrollRef = useRef(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return addDays(weekStart, i);
  });

  const popoverMonthDates = eachDayOfInterval({
    start: startOfWeek(startOfMonth(popoverMonth), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(endOfMonth(popoverMonth), { weekStartsOn: 1 }), 41)
  }).slice(0, 42);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
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
  }, [currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPopoverMonth(currentDate);
  }, [currentDate]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const hour = now.getHours();
      const scrollPosition = (hour - 6) * HOUR_HEIGHT - 100;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  const navigatePrev = () => setCurrentDate(subWeeks(currentDate, 1));
  const navigateNext = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleSlotClick = (date, hour) => {
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
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

  // Drag and drop handlers
  const handleDragStart = (e, appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
  };

  const handleDragOver = (e, date, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedAppointment) {
      setDragPreview({ date, hour });
    }
  };

  const handleDrop = async (e, date, hour) => {
    e.preventDefault();
    if (!draggedAppointment) return;
    
    const newDateTime = new Date(date);
    newDateTime.setHours(hour, 0, 0, 0);
    
    // Show confirmation dialog
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
    
    try {
      const token = localStorage.getItem('maya_token');
      const res = await axios.post(`${API_URL}/sms/send`, {
        client_id: pendingReschedule.appointment.client_id,
        message_type: 'appointment_rescheduled',
        appointment_id: pendingReschedule.appointment.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.status === 'sent') {
        toast.success('SMS sent');
      } else if (res.data.status === 'pending') {
        const cleanPhone = res.data.phone.replace(/\D/g, '');
        window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(res.data.message)}`;
        toast.success('Opening messaging app...');
      }
    } catch (error) {
      toast.error('Failed to send SMS');
    }
    
    setShowSmsPrompt(false);
    setPendingReschedule(null);
  };

  const skipSMS = () => {
    setShowSmsPrompt(false);
    setPendingReschedule(null);
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (date) => {
    return appointments.filter(appt => 
      isSameDay(new Date(appt.date_time), date)
    );
  };

  // Current time indicator
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getCurrentTimePosition = () => {
    const hour = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    if (hour < 6 || hour > 22) return null;
    return ((hour - 6) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT);
  };

  const currentTimePos = getCurrentTimePosition();
  const isTodayInWeek = weekDates.some(d => isToday(d));

  // Calculate appointment position and height
  const getAppointmentStyle = (appt) => {
    const apptDate = new Date(appt.date_time);
    const hour = apptDate.getHours();
    const minutes = apptDate.getMinutes();
    const duration = appt.total_duration || 60;
    
    const top = (hour - 6) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;
    
    return {
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`,
      minHeight: '30px'
    };
  };

  return (
    <Layout>
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreVertical size={20} className="text-gray-600" />
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-lg font-semibold text-gray-900 hover:text-primary flex items-center gap-1">
                  {format(currentDate, 'MMMM yyyy')}
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
                        onClick={() => { setCurrentDate(date); }}
                        className={cn(
                          "p-2 rounded-full hover:bg-gray-100 transition-colors",
                          !isSameMonth(date, popoverMonth) && "text-gray-300",
                          isToday(date) && "bg-primary text-white hover:bg-primary",
                          isSameDay(date, currentDate) && !isToday(date) && "ring-2 ring-primary"
                        )}
                      >
                        {format(date, 'd')}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <button
            onClick={() => { setSelectedSlot(new Date()); setSelectedAppointment(null); setShowModal(true); }}
            className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full hover:bg-primary-hover"
            data-testid="new-appointment-btn"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Week Header */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <div className="w-12 flex-shrink-0" />
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 py-2 text-center border-l border-gray-100 first:border-l-0",
                isToday(date) && "bg-gray-50"
              )}
            >
              <div className={cn(
                "text-xs font-medium uppercase",
                isToday(date) ? "text-primary" : "text-gray-500"
              )}>
                {format(date, 'EEE').charAt(0)}
              </div>
              <div className={cn(
                "text-sm font-semibold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full",
                isToday(date) && "bg-gray-800 text-white"
              )}>
                {format(date, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto relative" ref={scrollRef}>
          {/* Current Time Indicator */}
          {currentTimePos !== null && isTodayInWeek && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              style={{ top: `${currentTimePos}px` }}
            >
              <div className="w-12 flex justify-end pr-1">
                <span className="text-[10px] font-bold text-red-500 bg-white px-1">
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
            <div
              className="fixed z-50 bg-primary text-white px-3 py-2 rounded-lg shadow-lg pointer-events-none text-sm font-medium"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              Moving to: {format(dragPreview.date, 'EEE d')} at {String(dragPreview.hour).padStart(2, '0')}:00
            </div>
          )}

          {/* Time Grid Background */}
          <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
            {/* Hour lines */}
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex"
                style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              >
                <div className="w-12 flex-shrink-0 pr-2 text-right">
                  <span className="text-[10px] text-gray-400">
                    {hour.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex-1 flex border-t border-gray-100">
                  {weekDates.map((date, dayIndex) => {
                    const isDropTarget = dragPreview && 
                      isSameDay(dragPreview.date, date) && 
                      dragPreview.hour === hour;
                    
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "flex-1 border-l border-gray-100 first:border-l-0 cursor-pointer hover:bg-blue-50/30",
                          isToday(date) && "bg-gray-50/50",
                          isDropTarget && "bg-primary/20"
                        )}
                        onClick={() => handleSlotClick(date, hour)}
                        onDragOver={(e) => handleDragOver(e, date, hour)}
                        onDrop={(e) => handleDrop(e, date, hour)}
                        data-testid={`slot-${format(date, 'yyyy-MM-dd')}-${hour}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Appointments - positioned absolutely to span their duration */}
            <div className="absolute top-0 left-12 right-0 flex pointer-events-none">
              {weekDates.map((date, dayIndex) => (
                <div key={dayIndex} className="flex-1 relative">
                  {getAppointmentsForDay(date).map((appt) => {
                    const style = getAppointmentStyle(appt);
                    
                    return (
                      <div
                        key={appt.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleAppointmentClick(appt, e)}
                        className={cn(
                          "absolute left-1 right-1 bg-blue-100 border-l-4 border-blue-500 rounded-r-md px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto hover:bg-blue-200 transition-colors shadow-sm",
                          draggedAppointment?.id === appt.id && "opacity-50 ring-2 ring-primary"
                        )}
                        style={style}
                        data-testid={`appointment-${appt.id}`}
                      >
                        {/* Checkbox indicator */}
                        <div className="absolute top-1 right-1 w-4 h-4 rounded border border-gray-300 bg-white" />
                        
                        <div className="text-xs font-semibold text-gray-900 truncate pr-5">
                          {appt.client_name}
                          {appt.pets?.length > 0 && (
                            <span className="font-normal text-gray-600">
                              {' '}({appt.pets.map(p => p.pet_name).join(' & ')})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-600">
                          {format(new Date(appt.date_time), 'HH:mm')}
                        </div>
                        {/* Show services if there's enough height */}
                        {parseInt(style.height) > 50 && (
                          <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                            {appt.pets?.flatMap(p => 
                              services
                                .filter(s => p.services?.includes(s.id))
                                .map(s => s.name)
                            ).filter(Boolean).join(', ') || 'No services'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        open={showModal}
        onClose={handleModalClose}
        onSave={handleSaveAppointment}
        appointment={selectedAppointment}
        initialDate={selectedSlot}
        clients={clients}
        services={services}
      />

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Reschedule</DialogTitle>
          </DialogHeader>
          {pendingReschedule && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Move <span className="font-semibold">{pendingReschedule.appointment.client_name}</span>'s appointment?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">From:</span>
                  <span className="font-medium">
                    {format(pendingReschedule.oldDateTime, 'EEE, MMM d')} at {format(pendingReschedule.oldDateTime, 'HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">To:</span>
                  <span className="font-medium text-primary">
                    {format(pendingReschedule.newDateTime, 'EEE, MMM d')} at {format(pendingReschedule.newDateTime, 'HH:mm')}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowConfirmDialog(false);
              setPendingReschedule(null);
            }}>
              Cancel
            </Button>
            <Button className="btn-maya-primary" onClick={confirmReschedule}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Prompt Dialog */}
      <Dialog open={showSmsPrompt} onOpenChange={setShowSmsPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              Notify Customer?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Would you like to send an SMS to notify the customer about the reschedule?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={skipSMS}>
              No, Skip
            </Button>
            <Button className="btn-maya-primary" onClick={sendRescheduleSMS}>
              <Send size={16} className="mr-2" />
              Yes, Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
