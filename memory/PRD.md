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
- [x] Customer appointments tab with Upcoming/Past filter and counts

### Recent Fixes (January 28, 2025)
- [x] **Recurring appointment reschedule timezone fix** - Backend now uses full datetime offset calculation instead of just hour/minute difference
- [x] **Invoice check endpoint** - Added `/api/invoices/check/{appointment_id}` to check if appointment has existing invoice
- [x] **"Review & Checkout" vs "View Invoice" button** - Calendar details modal now shows correct button based on invoice existence
- [x] **Upcoming appointments date filtering** - Fixed UTC date parsing with 'Z' suffix in CustomerDetail.jsx
- [x] Timeline position corrected (80px per hour)
- [x] GST calculation fixed (prices are GST-inclusive)
- [x] Checkout prices are now editable
- [x] Edit/Save buttons moved under customer name
- [x] Change Password moved to Business tab in Settings

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
