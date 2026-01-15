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

## Core Requirements

### Calendar Features
- Week view with full-week header, showing appointments for selected day only
- Pinned header (month/year) and week day selector
- Pinch to zoom on calendar grid only
- "Today" button navigates to current date and scrolls to current time
- Red line indicator for current time
- 24-hour time slots (00:00-23:59) with 15-minute intervals
- Drag and drop to reschedule appointments
- Overlapping appointments displayed side-by-side

### Appointments
- Customer selection modal within appointment form
- Recurring appointments (daily, weekly, monthly)
- Edit single occurrence or entire series
- Appointment details view with Edit and "Review & Checkout" buttons
- Editable time/date in reschedule dialog
- Status-based color coding

### Clients & Pets
- View customer past/future appointments
- Phone: Prompt for SMS, Call, or Copy
- Address: Prompt for Maps/Google Maps/Waze

### Invoicing
- Company ABN field in settings
- Checkout flow with add/remove/update services, items, prices, discounts
- GST calculation and display

## Tech Stack
- **Frontend:** React, TailwindCSS, Shadcn/UI, Lucide React
- **Backend:** FastAPI, Pydantic
- **Database:** MongoDB
- **Auth:** JWT
- **SMS:** Twilio

## What's Been Implemented ✅

### 2025-01-14
- [x] User authentication (login/register)
- [x] Client CRUD operations
- [x] Pet CRUD operations
- [x] Services CRUD operations
- [x] Items CRUD operations
- [x] Calendar view with week navigation
- [x] Recurring appointment creation (creates 52 weekly occurrences)
- [x] Customer selection modal in appointment form
- [x] Phone/Address click popups (Call/SMS/Copy options)
- [x] Reduced UI card sizes
- [x] GST settings fields in backend
- [x] **DELETE series fix** - Now deletes ALL appointments in series correctly

## Known Issues (In Progress)

### P0 - Critical
- [x] ~~Delete recurring series only deletes one~~ **FIXED 2025-01-14**
- [x] ~~Edit recurring frequency creates appointments on same day~~ **User confirmed FIXED**
- [ ] Recurring frequency change - verify old occurrences deleted

### P1 - Important  
- [x] ~~"Today" button doesn't scroll to current time~~ **FIXED 2025-01-15**
- [x] ~~Calendar doesn't open at current time~~ **FIXED 2025-01-15**
- [ ] Calendar header not fully pinned when scrolling

### P2 - Minor
- [x] ~~Search icon overlaps search bar (Customers page)~~ **FIXED 2025-01-14**
- [x] ~~Invoice shows duplicate number~~ **FIXED 2025-01-15**
- [x] ~~X close button too small on modals~~ **FIXED 2025-01-14**
- [x] ~~Invoice X overlaps print button~~ **FIXED 2025-01-14**
- [x] ~~Customer card not editable~~ **FIXED 2025-01-15** - Added Edit button and modal
- [x] ~~Contact info not clickable~~ **FIXED 2025-01-15** - Added phone/address popups with Call/SMS/Maps options
- [x] ~~GST added on top of prices~~ **FIXED 2025-01-15** - Changed to GST included calculation
- [x] ~~Price shown on appointment boxes~~ **FIXED 2025-01-15** - Removed price display
- [x] ~~Customer card layout issues~~ **FIXED 2025-01-15** - Edit button inline, contact stacked vertically
- [x] ~~Checkout modal unprofessional~~ **FIXED 2025-01-15** - Redesigned with service/product dropdowns
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
