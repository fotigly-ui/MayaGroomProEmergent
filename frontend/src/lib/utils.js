import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatTime(date, use24Hour = true) {
  return new Date(date).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour
  });
}

export function formatDateTime(date, use24Hour = true) {
  return `${formatDate(date)} ${formatTime(date, use24Hour)}`;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount);
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function getWeekDates(date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function getTimeSlots(startHour = 7, endHour = 19) {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`
    });
  }
  return slots;
}

export function parseTimeToDate(timeString, baseDate = new Date()) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function getStatusColor(status) {
  const colors = {
    scheduled: 'bg-maya-info text-white',
    completed: 'bg-maya-success text-white',
    cancelled: 'bg-maya-text-muted text-white',
    no_show: 'bg-maya-error text-white'
  };
  return colors[status] || colors.scheduled;
}

export function getStatusLabel(status) {
  const labels = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show'
  };
  return labels[status] || status;
}
