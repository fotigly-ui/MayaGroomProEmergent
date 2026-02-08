# Maya Pet Grooming App - Product Requirements Document

## Original Problem Statement
Build a pet grooming appointment application with features including:
- User authentication with forgot/change password
- Calendar with multiple views (day, week, month, list)
- Appointment management including recurring appointments
- Client and pet management
- Invoicing and checkout system
- Two-way Google Calendar sync
- Mobile-optimized UI with unique terracotta/orange design

## User Personas
- **Primary User**: Pet grooming business owner (Maya's Pet Grooming)
- **Platform**: Primarily uses iPhone for daily operations

## Core Requirements
### Authentication
- [x] Login/Logout
- [x] JWT-based auth
- [x] Password reset (MOCKED - shows temp password on screen)
- [ ] Real email-based password reset

### Calendar
- [x] Day view with week navigation
- [x] Week view with pinned header
- [x] Month view popover
- [x] List view
- [x] 24-hour time slots (00:00-23:59, 15-min intervals)
- [x] Current time indicator (red line)
- [x] "Today" button navigation
- [x] Drag and drop rescheduling
- [x] Recurring appointment support
- [x] Staggered layout for overlapping appointments
- [ ] Text overflow fix when zooming out

### Appointments
- [x] Create/Edit/Delete appointments
- [x] Recurring appointments (daily, weekly, monthly)
- [x] Appointment detail view
- [x] Review & Checkout flow
- [x] Google Calendar two-way sync

### Clients & Pets
- [x] Client management (CRUD)
- [x] Pet management linked to clients
- [x] Past/future appointments view
- [x] Contact info display (phone, email, address)
- [x] Clickable phone/email links
- [x] Copy address & Waze navigation

### Invoicing
- [x] Invoice creation from appointments
- [x] Line items with services/products
- [x] Discount support
- [x] GST calculation
- [x] PDF invoice generation
- [x] Share invoice via iOS Share Sheet (PDF)
- [x] Send invoice via email

## Technology Stack
- **Frontend**: React 19, TailwindCSS, Shadcn/UI, date-fns, jspdf, jspdf-autotable
- **Backend**: FastAPI, Pydantic, Motor (MongoDB async driver)
- **Database**: MongoDB
- **Authentication**: JWT tokens with bcrypt password hashing

## What's Been Implemented (December 2024)

### Latest Session
- Fixed "Send Invoice" feature for iOS compatibility
- Added jsPDF for PDF generation
- Implemented Web Share API for sharing PDF invoices via SMS/WhatsApp
- Fixed email sending with simplified body for iOS Mail compatibility
- Fixed login stability (bcrypt string encoding issue)
- Added list view for calendar
- Implemented staggered layout for overlapping appointments
- Added "Send Invoice" button to invoices page and checkout modal

### Previous Sessions
- Full authentication system
- Calendar with all views
- Appointment CRUD with recurring support
- Client/Pet management
- Invoicing system
- Google Calendar two-way sync
- Mobile-optimized UI

## Known Issues
- **MOCKED**: Forgot Password shows temp password on screen instead of sending email
- **P2 BUG**: Text overflow in appointment boxes when zooming out calendar

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High)
- None currently

### P2 (Medium)
- Text overflow fix on calendar zoom

### P3 (Low/Future)
- Convert to native mobile app
- Dark mode implementation
- Backend refactoring (decompose server.py into modules)
- Analytics dashboard
- Remove unused packages (react-google-autocomplete)
- Implement real email-based password reset

## File Structure
```
/app/
├── backend/
│   ├── server.py          # Monolithic FastAPI app (needs refactoring)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Calendar.jsx    # Main calendar (1800+ lines)
│   │   │   ├── Invoices.jsx    # Invoice management
│   │   │   ├── Customers.jsx
│   │   │   └── CustomerDetail.jsx
│   │   └── components/
│   ├── package.json
│   └── .env
└── memory/
    └── PRD.md
```

## Test Credentials
- Email: foti@mayaspetgrooming.com.au
- Password: Maya2024!
