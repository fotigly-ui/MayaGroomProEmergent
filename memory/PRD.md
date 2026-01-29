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
- [x] Recurring appointments (daily/weekly/monthly) with series reschedule
- [x] Customer management with contact popups (Call/SMS/Maps)
- [x] Customer form with separate First Name/Surname and Address fields
- [x] Pet management linked to customers
- [x] Services & Items management
- [x] Review & Checkout flow with editable prices for services/items
- [x] Invoice generation with GST-inclusive pricing
- [x] Invoice edit & delete functionality
- [x] SMS templates (6 editable templates)
- [x] Settings (Business with Change Password, Payment, SMS, Data Backup)
- [x] Supabase backup integration
- [x] Mobile-responsive design with hamburger menu
- [x] Save contact to phone (vCard export with proper address fields)
- [x] Customer appointments tab with Upcoming/Past filter

### Bug Investigation & Fixes (January 29, 2025)

#### Issue 1: Recurring Appointment Reschedule
**Root Cause:** The series update functionality was working correctly all along. The issue was that some appointments had lost their `is_recurring` flag during previous operations.
**Status:** VERIFIED WORKING - When appointment has `is_recurring: true` and `recurring_id` set, the series update applies the time offset to all future appointments correctly.
**Test Results:** Successfully moved entire series from 04:15 to 05:15 UTC.

#### Issue 2: Invoice vs Review & Checkout Button
**Fix Applied:** 
- Added `/api/invoices/check/{appointment_id}` endpoint to check if invoice exists
- AppointmentModal.jsx now only shows "View Invoice (INV-xxx)" if invoice exists
- Calendar details modal shows "Review & Checkout" by default, or "View Invoice" if invoice exists
**Status:** FIXED

#### Issue 3: Upcoming Appointments Tab
**Fix Applied:** Fixed UTC date parsing in CustomerDetail.jsx to properly handle dates with 'Z' suffix before comparison with current date.
**Status:** FIXED

#### Issue 4: Review & Checkout Modal Mobile Layout
**Fix Applied:** Completely redesigned modal for mobile:
- `max-h-[85vh]` with scrollable content
- Compact header with border separator  
- Smaller fonts and padding
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
