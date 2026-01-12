import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, List, Grid3X3, Calendar as CalendarIcon } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { appointmentsAPI, clientsAPI, servicesAPI } from '../lib/api';
import { cn, getTimeSlots, isToday, formatTime, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { AppointmentModal } from '../components/AppointmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';

// Full day coverage: 00:00 to 23:00
const timeSlots = getTimeSlots(0, 23);

export default function CalendarPage() {
  const { settings } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [popoverMonth, setPopoverMonth] = useState(new Date());

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return addDays(weekStart, i);
  });

  const popoverMonthDates = eachDayOfInterval({
    start: startOfWeek(startOfMonth(popoverMonth), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(endOfMonth(popoverMonth), { weekStartsOn: 1 }), 41)
  }).slice(0, 42);

  const monthDates = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), 41)
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

  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

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

  return (
    <Layout>
      <div className="p-4 md:p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Month/Year with Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  className="text-xl md:text-2xl font-bold text-maya-text hover:text-primary transition-colors cursor-pointer"
                  data-testid="calendar-month-trigger"
                >
                  {format(currentDate, 'MMMM yyyy')}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4">
                  {/* Month Navigation in Popover */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPopoverMonth(subMonths(popoverMonth, 1))}
                      data-testid="popover-prev-month"
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="font-semibold text-maya-text">
                      {format(popoverMonth, 'MMMM yyyy')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPopoverMonth(addMonths(popoverMonth, 1))}
                      data-testid="popover-next-month"
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                      <div key={i} className="p-2 text-maya-text-muted font-medium">{day}</div>
                    ))}
                    {popoverMonthDates.map((date, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('week');
                        }}
                        className={cn(
                          "p-2 rounded-lg hover:bg-maya-primary-light transition-colors",
                          !isSameMonth(date, popoverMonth) && "text-maya-text-muted/50",
                          isToday(date) && "bg-primary text-white hover:bg-primary-hover",
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

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={navigatePrev}
                data-testid="calendar-prev"
                className="text-maya-text-muted hover:text-primary"
              >
                <ChevronLeft size={20} />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToToday}
                data-testid="calendar-today"
                className="text-maya-text-muted hover:text-primary"
              >
                Today
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={navigateNext}
                data-testid="calendar-next"
                className="text-maya-text-muted hover:text-primary"
              >
                <ChevronRight size={20} />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-white rounded-lg border border-maya-border p-1">
              <button
                onClick={() => setViewMode('week')}
                data-testid="view-week"
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === 'week' ? "bg-primary text-white" : "text-maya-text-muted hover:text-primary"
                )}
              >
                <Grid3X3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('month')}
                data-testid="view-month"
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === 'month' ? "bg-primary text-white" : "text-maya-text-muted hover:text-primary"
                )}
              >
                <CalendarIcon size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                data-testid="view-list"
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === 'list' ? "bg-primary text-white" : "text-maya-text-muted hover:text-primary"
                )}
              >
                <List size={18} />
              </button>
            </div>

            {/* New Appointment */}
            <Button 
              onClick={() => {
                setSelectedSlot(new Date());
                setSelectedAppointment(null);
                setShowModal(true);
              }}
              data-testid="new-appointment-btn"
              className="btn-maya-primary"
            >
              <Plus size={18} className="mr-2" />
              <span className="hidden md:inline">New Appointment</span>
              <span className="md:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Calendar View - Takes remaining height */}
        <div className="card-maya p-0 overflow-hidden flex-1 min-h-0">
          {viewMode === 'week' && (
            <WeekView
              dates={weekDates}
              timeSlots={timeSlots}
              appointments={appointments}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              use24Hour={settings?.use_24_hour_clock ?? true}
            />
          )}

          {viewMode === 'month' && (
            <MonthView
              currentDate={currentDate}
              dates={monthDates}
              appointments={appointments}
              onDayClick={(date) => {
                setCurrentDate(date);
                setViewMode('week');
              }}
              onAppointmentClick={handleAppointmentClick}
            />
          )}

          {viewMode === 'list' && (
            <ListView
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
              use24Hour={settings?.use_24_hour_clock ?? true}
            />
          )}
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

function WeekView({ dates, timeSlots, appointments, onSlotClick, onAppointmentClick, use24Hour }) {
  const gridRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (gridRef.current) {
      const now = new Date();
      const hour = now.getHours();
      const slotHeight = 48; // Height of each time slot
      const scrollPosition = hour * slotHeight - 100;
      gridRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const slotHeight = 48;
    const position = hour * slotHeight + (minutes / 60) * slotHeight;
    return position;
  };

  // Check if today is in the current week view
  const isTodayInWeek = dates.some(date => isToday(date));
  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="h-full flex flex-col">
      {/* Week Header - Sticky */}
      <div className="flex border-b border-maya-border bg-white flex-shrink-0 sticky top-0 z-20">
        <div className="w-12 md:w-16 flex-shrink-0 border-r border-maya-border" />
        {dates.map((date, i) => (
          <div 
            key={i} 
            className={cn(
              "flex-1 min-w-0 py-2 px-1 text-center border-r border-maya-border last:border-r-0",
              isToday(date) && "bg-primary/10"
            )}
          >
            <div className={cn(
              "text-xs uppercase tracking-wide",
              isToday(date) ? "text-primary font-semibold" : "text-maya-text-muted"
            )}>
              {format(date, 'EEE')}
            </div>
            <div className={cn(
              "text-sm md:text-lg font-semibold mt-0.5",
              isToday(date) && "text-primary"
            )}>
              {format(date, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time Grid - Scrollable */}
      <div className="flex-1 overflow-auto relative" ref={gridRef}>
        {/* Current Time Indicator - Spans full width */}
        {isTodayInWeek && (
          <div 
            className="absolute z-10 pointer-events-none left-0 right-0 flex items-center"
            style={{ top: `${currentTimePosition}px` }}
          >
            {/* Time label on the left */}
            <div className="w-12 md:w-16 flex-shrink-0 flex justify-end pr-1">
              <span className="text-[10px] font-bold text-red-500 bg-white px-1 rounded">
                {format(currentTime, 'HH:mm')}
              </span>
            </div>
            {/* Red line across the entire week */}
            <div className="flex-1 h-[2px] bg-red-500 relative">
              {/* Flashing dot at the start */}
              <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-pulse left-0 -top-[3px]" />
            </div>
          </div>
        )}

        {/* Time Rows */}
        {timeSlots.map((slot) => (
          <div key={slot.hour} className="flex border-b border-maya-border/50" style={{ height: '48px' }}>
            {/* Time Label */}
            <div className="w-12 md:w-16 flex-shrink-0 border-r border-maya-border flex items-start justify-end pr-2 pt-1 bg-gray-50/50">
              <span className="text-[10px] md:text-xs text-maya-text-muted">{slot.label}</span>
            </div>
            
            {/* Day Columns */}
            {dates.map((date, dayIndex) => {
              const slotAppointments = appointments.filter(appt => {
                const apptDate = new Date(appt.date_time);
                return isSameDay(apptDate, date) && apptDate.getHours() === slot.hour;
              });

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "flex-1 min-w-0 border-r border-maya-border/50 last:border-r-0 relative cursor-pointer hover:bg-maya-primary-light/20 transition-colors",
                    isToday(date) && "bg-primary/5"
                  )}
                  onClick={() => onSlotClick(date, slot.hour)}
                  data-testid={`slot-${format(date, 'yyyy-MM-dd')}-${slot.hour}`}
                >
                  {slotAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="absolute inset-x-0.5 bg-primary text-white rounded-sm px-1 py-0.5 overflow-hidden cursor-pointer hover:bg-primary-hover z-10 shadow-sm"
                      onClick={(e) => onAppointmentClick(appt, e)}
                      data-testid={`appointment-${appt.id}`}
                      style={{
                        top: '2px',
                        minHeight: '40px',
                        height: `${Math.max((appt.total_duration / 60) * 48, 40)}px`
                      }}
                    >
                      <div className="text-[10px] md:text-xs font-medium truncate leading-tight">
                        {appt.client_name}
                      </div>
                      {appt.pets?.length > 0 && (
                        <div className="text-[9px] md:text-[10px] text-white/80 truncate leading-tight">
                          {appt.pets.map(p => p.pet_name).join(', ')}
                        </div>
                      )}
                      <div className="text-[9px] text-white/70 truncate hidden md:block">
                        {formatCurrency(appt.total_price)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({ currentDate, dates, appointments, onDayClick, onAppointmentClick }) {
  return (
    <div className="p-4 h-full overflow-auto">
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-maya-text-muted py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          const dayAppointments = appointments.filter(appt => 
            isSameDay(new Date(appt.date_time), date)
          );
          
          return (
            <div
              key={i}
              onClick={() => onDayClick(date)}
              className={cn(
                "min-h-[80px] md:min-h-[100px] p-1 md:p-2 rounded-lg border cursor-pointer transition-all hover:border-primary",
                !isSameMonth(date, currentDate) && "bg-gray-50 opacity-50",
                isToday(date) && "border-primary border-2"
              )}
            >
              <div className={cn(
                "text-sm font-medium mb-1",
                isToday(date) ? "text-primary" : "text-maya-text"
              )}>
                {format(date, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayAppointments.slice(0, 2).map((appt) => (
                  <div
                    key={appt.id}
                    onClick={(e) => onAppointmentClick(appt, e)}
                    className="text-[10px] md:text-xs bg-primary text-white rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary-hover"
                  >
                    {appt.client_name}
                  </div>
                ))}
                {dayAppointments.length > 2 && (
                  <div className="text-[10px] text-maya-text-muted">
                    +{dayAppointments.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ appointments, onAppointmentClick, use24Hour }) {
  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(a.date_time) - new Date(b.date_time)
  );

  if (sortedAppointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <CalendarIcon className="w-12 h-12 text-maya-text-muted mb-4" />
        <p className="text-lg font-medium text-maya-text">No appointments this week</p>
        <p className="text-sm text-maya-text-muted mt-1">Click "New" to schedule one</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-maya-border overflow-auto h-full">
      {sortedAppointments.map((appt) => (
        <div
          key={appt.id}
          onClick={(e) => onAppointmentClick(appt, e)}
          className="p-4 hover:bg-maya-cream cursor-pointer transition-colors"
          data-testid={`list-appointment-${appt.id}`}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-maya-text truncate">{appt.client_name}</div>
              <div className="text-sm text-maya-text-muted">
                {format(new Date(appt.date_time), 'EEE, MMM d')} at {formatTime(appt.date_time, use24Hour)}
              </div>
              {appt.pets?.length > 0 && (
                <div className="text-sm text-maya-text-muted mt-1 truncate">
                  {appt.pets.map(p => p.pet_name).join(', ')}
                </div>
              )}
            </div>
            <div className="text-right ml-4 flex-shrink-0">
              <div className="font-semibold text-primary">{formatCurrency(appt.total_price)}</div>
              <div className={cn(
                "text-xs px-2 py-1 rounded-full inline-block mt-1",
                appt.status === 'scheduled' && "bg-maya-info text-white",
                appt.status === 'completed' && "bg-maya-success text-white",
                appt.status === 'cancelled' && "bg-gray-400 text-white",
                appt.status === 'no_show' && "bg-maya-error text-white"
              )}>
                {appt.status}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
