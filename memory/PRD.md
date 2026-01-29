# Gromify - Pet Grooming Appointment App

## Original Problem Statement
Build a grooming appointment app with:
- User Authentication
- Unique design using logo colors (terracotta/orange), inspired by "Square Appointments"
- Calendar with month, list, and week views
- Recurring appointments with series management
- Client & Pet management
- SMS notifications (Twilio)
- Invoicing & Checkout with GST calculation
- Dark mode

## Build Documentation
**See `/app/BUILD_SUMMARY.md` for complete technical documentation**

## Current Status: MVP COMPLETE ✅

### Completed Features (January 2025)
- [x] User authentication (JWT) with Change Password & Forgot Password
- [x] Calendar with week view, current time indicator, auto-scroll
- [x] Appointments with drag & drop, color-coded status
- [x] Recurring appointments with DST-aware scheduling (Australia/Sydney timezone)
- [x] Customer management with contact popups (Call/SMS/Maps)
- [x] Pets shown under customer info (not in separate tab)
- [x] Services & Items management
- [x] Review & Checkout always available for all appointments
- [x] Each appointment occurrence has independent invoicing
- [x] Invoice generation with GST-inclusive pricing
- [x] SMS templates (6 editable templates)
- [x] Settings (Business with Change Password, Payment, SMS, Data Backup)
- [x] Supabase backup integration
- [x] Mobile-responsive design with hamburger menu
- [x] Save contact to phone (vCard export)

### Critical Fixes (January 29, 2025)

#### Issue 1: Recurring Appointment Times Inconsistent (DST)
**Root Cause:** Daylight Saving Time. Appointments stored in UTC showed different local times (18:00 vs 19:00) when DST changed.
**Fix Applied:** 
- Implemented DST-aware scheduling using `pytz` with `Australia/Sydney` timezone
- New recurring appointments now keep the SAME local time regardless of DST
- Series reschedule also preserves local time consistently
**Test Result:** All 9 test appointments show 19:00 local time (UTC varies between 08:00 and 09:00)

#### Issue 2: Review & Checkout Button
**User Requirement:** All appointments must show "Review & Checkout" - each occurrence independent
**Fix Applied:** 
- "Review & Checkout" button now ALWAYS shown for all appointments
- If invoice exists, "View Invoice" shown as additional button (not replacement)
- Each recurring occurrence can have its own invoice

#### Issue 3: Customer Page Layout
**User Requirement:** Pets under customer info, remove Pets tab, keep only Appointments tab
**Fix Applied:** 
- Pets now displayed directly under customer contact info
- Add Pet button next to Pets section
- Removed Pets tab
- Only Appointments tab remains (with Upcoming/Past sub-tabs)

### Pending Features
- [ ] Dark mode completion
- Condensed service/item rows
**Status:** FIXED

### Pending Features
- [ ] Dark mode completion
- [ ] Month/List calendar views
- [ ] Automatic SMS sending via Twilio
- [ ] Online customer booking portal
- [ ] Reporting & Analytics dashboard

## Upcoming Features (P1)
- [ ] Individual occurrence editing (without affecting series)
- [ ] Invoice deletion backend endpoint (delete button exists in UI)

## Backlog (P2+)
- [ ] Complete Dark Mode implementation
- [ ] Refactor backend server.py into modules
- [ ] Refactor Calendar.jsx into smaller components
- [ ] Remove unused AddressAutocomplete.jsx and react-google-autocomplete package

## Key Files
- `/app/frontend/src/pages/Calendar.jsx` - Main calendar view
- `/app/frontend/src/components/AppointmentModal.jsx` - Appointment create/edit
- `/app/frontend/src/pages/CustomerDetail.jsx` - Customer detail with appointments
- `/app/backend/server.py` - All backend routes and logic
- `/app/frontend/src/lib/api.js` - API utilities

## Database Schema
```
appointments: {
  id, user_id, client_id, date_time, end_time, notes,
  pets: [{pet_id, services: [{service_id, price}]}],
  is_recurring, recurring_id, recurring_value, recurring_unit
}

invoices: {
  id, user_id, appointment_id, client_id, invoice_number, items,
  subtotal, gst_amount, total, status, created_at
}

settings: {
  user_id, business_name, gst_enabled, gst_rate
}
```

## Test Credentials
- Email: foti@mayaspetgrooming.com.au
- Password: Maya2024!

## Test Credentials
- Email: frontendtest@test.com
- Password: test123
