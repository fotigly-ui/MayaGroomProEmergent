import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, List, Grid3X3, Calendar as CalendarIcon } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { appointmentsAPI, clientsAPI, petsAPI, servicesAPI } from '../lib/api';
import { cn, getTimeSlots, isToday, formatTime, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { AppointmentModal } from '../components/AppointmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';

const timeSlots = getTimeSlots(7, 19);

export default function CalendarPage() {
  const { settings } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // week, month, list
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return addDays(weekStart, i);
  });

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

  const getAppointmentsForSlot = (date, hour) => {
    return appointments.filter(appt => {
      const apptDate = new Date(appt.date_time);
      return isSameDay(apptDate, date) && apptDate.getHours() === hour;
    });
  };

  const getAppointmentsForDay = (date) => {
    return appointments.filter(appt => isSameDay(new Date(appt.date_time), date));
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                      <div key={i} className="p-2 text-maya-text-muted font-medium">{day}</div>
                    ))}
                    {monthDates.map((date, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('week');
                        }}
                        className={cn(
                          "p-2 rounded-lg hover:bg-maya-primary-light transition-colors",
                          !isSameMonth(date, currentDate) && "text-maya-text-muted/50",
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

        {/* Calendar View */}
        <div className="card-maya p-0 overflow-hidden">
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
  return (
    <div className="overflow-x-auto">
      {/* Week Header */}
      <div className="week-header">
        <div className="p-3 border-r border-maya-border" />
        {dates.map((date, i) => (
          <div 
            key={i} 
            className={cn(
              "week-header-cell border-r border-maya-border last:border-r-0",
              isToday(date) && "text-primary"
            )}
          >
            <div className="text-xs text-maya-text-muted uppercase tracking-wide">
              {format(date, 'EEE')}
            </div>
            <div className={cn(
              "day-number mt-1 text-lg font-semibold",
              isToday(date) && "today"
            )}>
              {format(date, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time Grid */}
      <div className="relative">
        {timeSlots.map((slot) => (
          <div key={slot.hour} className="calendar-grid">
            {/* Time Label */}
            <div className="p-2 border-r border-b border-maya-border flex items-start justify-end">
              <span className="time-label">{slot.label}</span>
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
                  className="time-slot border-r border-b border-maya-border last:border-r-0 relative cursor-pointer hover:bg-maya-primary-light/30 transition-colors"
                  onClick={() => onSlotClick(date, slot.hour)}
                  data-testid={`slot-${format(date, 'yyyy-MM-dd')}-${slot.hour}`}
                >
                  {slotAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="appointment-block"
                      onClick={(e) => onAppointmentClick(appt, e)}
                      data-testid={`appointment-${appt.id}`}
                      style={{
                        height: `${Math.max(appt.total_duration, 30)}px`,
                        minHeight: '24px'
                      }}
                    >
                      <div className="font-medium truncate">{appt.client_name}</div>
                      {appt.pets?.length > 0 && (
                        <div className="text-white/80 truncate text-[10px]">
                          {appt.pets.map(p => p.pet_name).join(', ')}
                        </div>
                      )}
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
    <div className="p-4">
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
                "min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all hover:border-primary",
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
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map((appt) => (
                  <div
                    key={appt.id}
                    onClick={(e) => onAppointmentClick(appt, e)}
                    className="text-xs bg-primary text-white rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary-hover"
                  >
                    {appt.client_name}
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-xs text-maya-text-muted">
                    +{dayAppointments.length - 3} more
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
      <div className="empty-state">
        <CalendarIcon className="empty-state-icon mx-auto" />
        <p className="text-lg font-medium">No appointments this week</p>
        <p className="text-sm mt-1">Click "New Appointment" to schedule one</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-maya-border">
      {sortedAppointments.map((appt) => (
        <div
          key={appt.id}
          onClick={(e) => onAppointmentClick(appt, e)}
          className="p-4 hover:bg-maya-cream cursor-pointer transition-colors"
          data-testid={`list-appointment-${appt.id}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-maya-text">{appt.client_name}</div>
              <div className="text-sm text-maya-text-muted">
                {format(new Date(appt.date_time), 'EEE, MMM d')} at {formatTime(appt.date_time, use24Hour)}
              </div>
              {appt.pets?.length > 0 && (
                <div className="text-sm text-maya-text-muted mt-1">
                  Pets: {appt.pets.map(p => p.pet_name).join(', ')}
                </div>
              )}
            </div>
            <div className="text-right">
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
