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
- [x] User authentication (JWT)
- [x] Calendar with week view, current time indicator, auto-scroll
- [x] Appointments with drag & drop, color-coded status
- [x] Recurring appointments (daily/weekly/monthly)
- [x] Customer management with contact popups (Call/SMS/Maps)
- [x] Pet management linked to customers
- [x] Services & Items management
- [x] Review & Checkout flow with service/product selection
- [x] Invoice generation with discount & GST
- [x] SMS templates (7 editable templates)
- [x] Settings (Business, Payment, SMS, Preferences)
- [x] Supabase backup integration
- [x] Mobile-responsive design

### Pending Features
- [ ] Dark mode completion
- [ ] Address autocomplete (Google Places)
- [ ] Save contact to phone (vCard export)
- [ ] Month/List calendar views
- [ ] Automatic SMS sending via Twilio
- [ ] Online customer booking portal
- [ ] Reporting & Analytics dashboard
- [x] ~~Price shown on appointment boxes~~ **FIXED**
- [x] ~~Pets not auto-loading from customer~~ **FIXED 2025-01-15**
- [x] ~~Invoice discount not applied~~ **FIXED 2025-01-15**
- [ ] Address autocomplete
- [ ] Save contact to phone
- [ ] Dark mode incomplete

## Upcoming Features (P1)
- [x] ~~"Review & Checkout" flow modal~~ **IMPLEMENTED 2025-01-15**
- [x] ~~Appointment Details view~~ **IMPLEMENTED 2025-01-15**
- [ ] Individual occurrence editing (without affecting series)

## Backlog (P2+)
- [ ] Complete Dark Mode implementation
- [ ] Customer appointment history view
- [ ] Refactor backend server.py into modules
- [ ] Refactor Calendar.jsx and AppointmentModal.jsx into smaller components

## Key Files
- `/app/frontend/src/pages/Calendar.jsx` - Main calendar view
- `/app/frontend/src/components/AppointmentModal.jsx` - Appointment create/edit
- `/app/backend/server.py` - All backend routes and logic
- `/app/frontend/src/lib/api.js` - API utilities

## Database Schema
```
appointments: {
  id, user_id, client_id, date_time, end_time, notes,
  pets: [{pet_id, services: [{service_id, price}]}],
  is_recurring, recurring_id, recurring_value, recurring_unit
}

settings: {
  user_id, business_name, gst_enabled, gst_rate
}
```

## Test Credentials
- Email: frontendtest@test.com
- Password: test123
