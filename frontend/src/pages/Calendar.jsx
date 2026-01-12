import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, MoreVertical } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { appointmentsAPI, clientsAPI, servicesAPI } from '../lib/api';
import { cn, isToday, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { AppointmentModal } from '../components/AppointmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';

// Business hours: 6am to 10pm
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

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
  const [draggedAppointment, setDraggedAppointment] = useState(null);
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
      const rowHeight = 60;
      const scrollPosition = (hour - 6) * rowHeight - 100;
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, date, hour) => {
    e.preventDefault();
    if (!draggedAppointment) return;
    
    const newDateTime = new Date(date);
    newDateTime.setHours(hour, 0, 0, 0);
    
    try {
      await appointmentsAPI.update(draggedAppointment.id, {
        date_time: newDateTime.toISOString()
      });
      toast.success('Appointment rescheduled');
      fetchData();
    } catch (error) {
      toast.error('Failed to reschedule');
    }
    setDraggedAppointment(null);
  };

  const handleDragEnd = () => {
    setDraggedAppointment(null);
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
    return ((hour - 6) * 60 + minutes);
  };

  const currentTimePos = getCurrentTimePosition();
  const isTodayInWeek = weekDates.some(d => isToday(d));

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
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
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

          {/* Time Rows */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="flex" style={{ height: '60px' }}>
                {/* Time Label */}
                <div className="w-12 flex-shrink-0 pr-2 pt-0 text-right">
                  <span className="text-[10px] text-gray-400">
                    {hour.toString().padStart(2, '0')}
                  </span>
                </div>
                {/* Day Columns */}
                {weekDates.map((date, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={cn(
                      "flex-1 border-l border-t border-gray-100 relative cursor-pointer hover:bg-blue-50/30",
                      isToday(date) && "bg-gray-50/50"
                    )}
                    onClick={() => handleSlotClick(date, hour)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date, hour)}
                    data-testid={`slot-${format(date, 'yyyy-MM-dd')}-${hour}`}
                  >
                    {/* Appointments for this hour */}
                    {getAppointmentsForDay(date)
                      .filter(appt => new Date(appt.date_time).getHours() === hour)
                      .map((appt) => {
                        const duration = appt.total_duration || 60;
                        const heightPx = (duration / 60) * 60;
                        const minutes = new Date(appt.date_time).getMinutes();
                        const topOffset = (minutes / 60) * 60;
                        
                        return (
                          <div
                            key={appt.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, appt)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => handleAppointmentClick(appt, e)}
                            className={cn(
                              "absolute left-0.5 right-0.5 bg-blue-100 border-l-4 border-blue-500 rounded-r-md px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing z-10 hover:bg-blue-200 transition-colors",
                              draggedAppointment?.id === appt.id && "opacity-50"
                            )}
                            style={{
                              top: `${topOffset}px`,
                              height: `${Math.max(heightPx - 2, 28)}px`,
                              minHeight: '28px'
                            }}
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
                            <div className="text-[10px] text-gray-600 truncate">
                              {format(new Date(appt.date_time), 'HH:mm')}
                            </div>
                            {heightPx > 40 && (
                              <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                {appt.pets?.map(p => 
                                  services
                                    .filter(s => p.services?.includes(s.id))
                                    .map(s => s.name)
                                    .join(', ')
                                ).filter(Boolean).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            ))}
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
    </Layout>
  );
}
