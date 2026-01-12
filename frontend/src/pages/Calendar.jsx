import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, List, Grid3X3, Calendar as CalendarIcon, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [popoverMonth, setPopoverMonth] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, 0.5-2 range

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

  // Sync popover month with current date when it changes
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

  const handleSlotClick = (date, hour, minutes = 0) => {
    const slotDate = new Date(date);
    slotDate.setHours(hour, minutes, 0, 0);
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

  const handleReschedule = async (appointmentId, newDateTime) => {
    try {
      await appointmentsAPI.update(appointmentId, {
        date_time: newDateTime.toISOString()
      });
      toast.success('Appointment rescheduled');
      fetchData();
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Failed to reschedule appointment');
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 flex flex-col h-full">
        {/* Header - Fixed, does not zoom */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
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
            {/* Zoom Controls - only show in week view */}
            {viewMode === 'week' && (
              <div className="flex items-center bg-white rounded-lg border border-maya-border p-1 mr-2">
                <button
                  onClick={handleZoomOut}
                  data-testid="zoom-out"
                  disabled={zoomLevel <= 0.5}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    zoomLevel <= 0.5 ? "text-maya-text-muted/40 cursor-not-allowed" : "text-maya-text-muted hover:text-primary"
                  )}
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-maya-text-muted px-2 min-w-[40px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  data-testid="zoom-in"
                  disabled={zoomLevel >= 2}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    zoomLevel >= 2 ? "text-maya-text-muted/40 cursor-not-allowed" : "text-maya-text-muted hover:text-primary"
                  )}
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            )}

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

        {/* Calendar View - This is where zoom applies */}
        <div className="card-maya p-0 overflow-hidden flex-1">
          {viewMode === 'week' && (
            <WeekView
              dates={weekDates}
              timeSlots={timeSlots}
              appointments={appointments}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              onReschedule={handleReschedule}
              use24Hour={settings?.use_24_hour_clock ?? true}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
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

function WeekView({ dates, timeSlots, appointments, onSlotClick, onAppointmentClick, onReschedule, use24Hour, zoomLevel, onZoomChange }) {
  const gridRef = useRef(null);
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [touchStartY, setTouchStartY] = useState(null);
  const [initialDistance, setInitialDistance] = useState(null);

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
      const startHour = timeSlots[0]?.hour || 7;
      const slotHeight = 60 * zoomLevel;
      const scrollPosition = (hour - startHour) * slotHeight - 100;
      gridRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [zoomLevel, timeSlots]);

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const startHour = timeSlots[0]?.hour || 7;
    const endHour = timeSlots[timeSlots.length - 1]?.hour || 19;
    
    if (hour < startHour || hour > endHour) return null;
    
    const slotHeight = 60 * zoomLevel;
    const position = (hour - startHour) * slotHeight + (minutes / 60) * slotHeight;
    return position;
  };

  // Get today's column index
  const getTodayColumnIndex = () => {
    return dates.findIndex(date => isToday(date));
  };

  // Handle pinch-to-zoom for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialDistance(distance);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialDistance) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDistance / initialDistance;
      
      if (scale > 1.1) {
        onZoomChange(prev => Math.min(prev + 0.1, 2));
        setInitialDistance(currentDistance);
        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(10);
      } else if (scale < 0.9) {
        onZoomChange(prev => Math.max(prev - 0.1, 0.5));
        setInitialDistance(currentDistance);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }
  };

  const handleTouchEnd = () => {
    setInitialDistance(null);
  };

  // Drag & Drop handlers
  const handleDragStart = (e, appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDragOver = (e, date, hour, quarter = 0) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const minutes = quarter * 15;
    setDragOverSlot({ date, hour, minutes });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e, date, hour, quarter = 0) => {
    e.preventDefault();
    if (!draggedAppointment) return;
    
    const minutes = quarter * 15;
    const newDateTime = new Date(date);
    newDateTime.setHours(hour, minutes, 0, 0);
    
    // Haptic feedback on drop
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    
    await onReschedule(draggedAppointment.id, newDateTime);
    setDraggedAppointment(null);
    setDragOverSlot(null);
  };

  const handleDragEnd = () => {
    setDraggedAppointment(null);
    setDragOverSlot(null);
  };

  // Touch-based drag for mobile
  const handleAppointmentTouchStart = (e, appointment) => {
    setDraggedAppointment(appointment);
    setTouchStartY(e.touches[0].clientY);
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleAppointmentTouchMove = (e) => {
    if (!draggedAppointment || !gridRef.current) return;
    
    const touch = e.touches[0];
    const gridRect = gridRef.current.getBoundingClientRect();
    
    // Find which slot we're over
    const relativeY = touch.clientY - gridRect.top + gridRef.current.scrollTop;
    const relativeX = touch.clientX - gridRect.left;
    
    const slotHeight = 60 * zoomLevel;
    const columnWidth = (gridRect.width - 60) / 7; // 60px for time label
    
    const hourIndex = Math.floor(relativeY / slotHeight);
    const dayIndex = Math.floor((relativeX - 60) / columnWidth);
    const quarterIndex = Math.floor((relativeY % slotHeight) / (slotHeight / 4));
    
    if (dayIndex >= 0 && dayIndex < 7 && hourIndex >= 0 && hourIndex < timeSlots.length) {
      const hour = timeSlots[hourIndex].hour;
      const date = dates[dayIndex];
      setDragOverSlot({ date, hour, minutes: quarterIndex * 15 });
    }
  };

  const handleAppointmentTouchEnd = async (e) => {
    if (draggedAppointment && dragOverSlot) {
      const newDateTime = new Date(dragOverSlot.date);
      newDateTime.setHours(dragOverSlot.hour, dragOverSlot.minutes, 0, 0);
      
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      
      await onReschedule(draggedAppointment.id, newDateTime);
    }
    setDraggedAppointment(null);
    setDragOverSlot(null);
    setTouchStartY(null);
  };

  const currentTimePosition = getCurrentTimePosition();
  const todayColumnIndex = getTodayColumnIndex();

  return (
    <div 
      className="overflow-auto h-full"
      ref={gridRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week Header - Sticky */}
      <div className="week-header sticky top-0 z-20 bg-white">
        <div className="p-3 border-r border-maya-border" style={{ minWidth: '60px' }} />
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
        {/* Current Time Indicator */}
        {currentTimePosition !== null && todayColumnIndex >= 0 && (
          <div 
            className="absolute z-10 pointer-events-none"
            style={{
              top: `${currentTimePosition}px`,
              left: '60px',
              right: 0,
            }}
          >
            <div className="relative flex items-center">
              {/* Line spans all columns but highlight today */}
              <div 
                className="absolute h-[2px] bg-red-500"
                style={{
                  left: `${(100 / 7) * todayColumnIndex}%`,
                  width: `${100 / 7}%`,
                }}
              />
              {/* Flashing dot */}
              <div 
                className="absolute w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg"
                style={{
                  left: `calc(${(100 / 7) * todayColumnIndex}% - 6px)`,
                  top: '-5px',
                }}
              />
            </div>
          </div>
        )}

        {timeSlots.map((slot) => (
          <div 
            key={slot.hour} 
            className="calendar-grid"
            style={{ height: `${60 * zoomLevel}px` }}
          >
            {/* Time Label */}
            <div 
              className="p-2 border-r border-b border-maya-border flex items-start justify-end bg-white"
              style={{ minWidth: '60px', height: `${60 * zoomLevel}px` }}
            >
              <span className="time-label">{slot.label}</span>
            </div>
            
            {/* Day Columns */}
            {dates.map((date, dayIndex) => {
              const slotAppointments = appointments.filter(appt => {
                const apptDate = new Date(appt.date_time);
                return isSameDay(apptDate, date) && apptDate.getHours() === slot.hour;
              });

              const isDropTarget = dragOverSlot && 
                isSameDay(dragOverSlot.date, date) && 
                dragOverSlot.hour === slot.hour;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "time-slot border-r border-b border-maya-border last:border-r-0 relative cursor-pointer transition-colors",
                    isToday(date) && "bg-maya-primary-light/10",
                    isDropTarget && "bg-primary/20"
                  )}
                  style={{ height: `${60 * zoomLevel}px` }}
                  onClick={() => onSlotClick(date, slot.hour)}
                  onDragOver={(e) => handleDragOver(e, date, slot.hour)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, date, slot.hour)}
                  data-testid={`slot-${format(date, 'yyyy-MM-dd')}-${slot.hour}`}
                >
                  {/* 15-minute interval guides for drag & drop */}
                  <div className="absolute inset-0 flex flex-col pointer-events-none">
                    {[0, 1, 2, 3].map((q) => (
                      <div 
                        key={q}
                        className={cn(
                          "flex-1 border-b border-dashed border-transparent",
                          q < 3 && "border-maya-border/30",
                          isDropTarget && dragOverSlot.minutes === q * 15 && "bg-primary/30"
                        )}
                      />
                    ))}
                  </div>

                  {/* Drop zones for 15-min intervals */}
                  <div className="absolute inset-0 flex flex-col">
                    {[0, 1, 2, 3].map((q) => (
                      <div 
                        key={q}
                        className="flex-1"
                        onDragOver={(e) => handleDragOver(e, date, slot.hour, q)}
                        onDrop={(e) => handleDrop(e, date, slot.hour, q)}
                      />
                    ))}
                  </div>

                  {slotAppointments.map((appt) => {
                    const apptDate = new Date(appt.date_time);
                    const minuteOffset = apptDate.getMinutes();
                    const topOffset = (minuteOffset / 60) * 60 * zoomLevel;
                    
                    return (
                      <div
                        key={appt.id}
                        className={cn(
                          "appointment-block absolute left-0 right-0 mx-1",
                          draggedAppointment?.id === appt.id && "opacity-50"
                        )}
                        style={{
                          top: `${topOffset}px`,
                          height: `${Math.max(appt.total_duration * zoomLevel, 30 * zoomLevel)}px`,
                          minHeight: `${24 * zoomLevel}px`,
                          cursor: 'grab',
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleAppointmentTouchStart(e, appt)}
                        onTouchMove={handleAppointmentTouchMove}
                        onTouchEnd={handleAppointmentTouchEnd}
                        onClick={(e) => onAppointmentClick(appt, e)}
                        data-testid={`appointment-${appt.id}`}
                      >
                        <div className="font-medium truncate" style={{ fontSize: `${12 * zoomLevel}px` }}>
                          {appt.client_name}
                        </div>
                        {appt.pets?.length > 0 && zoomLevel >= 0.75 && (
                          <div className="text-white/80 truncate" style={{ fontSize: `${10 * zoomLevel}px` }}>
                            {appt.pets.map(p => p.pet_name).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
