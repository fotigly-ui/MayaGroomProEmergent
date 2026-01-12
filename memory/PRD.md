# Maya Groom Pro - Product Requirements Document

## Original Problem Statement
Build a pet grooming appointment app called "Maya Groom Pro" with database structure including: Settings, Clients, Pets, Services, Items, Appointments, Appointment_Pets, Appointment_Items, Waitlist, and Recurring Templates.

## User Personas
- **Primary User**: Pet grooming business owner in Australia
- **Use Case**: Single-user appointment management system for managing clients, pets, services, and scheduling

## Core Requirements
1. **Authentication**: JWT-based user authentication
2. **Calendar**: Week/Month/List views with time slots
3. **Client Management**: CRUD for clients with no-show tracking
4. **Pet Management**: CRUD for pets linked to clients
5. **Services**: Grooming services with duration and pricing
6. **Items**: Retail products/add-ons
7. **Appointments**: Full booking system with services per pet
8. **Waitlist**: Queue management for waiting clients
9. **Settings**: Australian business settings (ABN, GST, BSB banking)
10. **Backup**: Supabase automated backup integration

## Design Choices
- **Theme**: Terracotta/warm orange (#C75B2A) on cream (#F5EBE0)
- **Typography**: Outfit (headings), Plus Jakarta Sans (body)
- **Style**: Square Appointments-inspired with unique artisan aesthetic
- **Mobile**: Bottom navigation (Calendar, Invoices, Customers, More)
- **Desktop**: Left sidebar navigation

## What's Been Implemented (January 2026)

### Core Features
- [x] User authentication (register/login/JWT)
- [x] Calendar with week/month/list views
- [x] Client management with no-show tracking
- [x] Pet management (per client)
- [x] Services catalog with duration/price
- [x] Items/products catalog
- [x] Waitlist management with required date and timeframe
- [x] Appointment booking with pets and services
- [x] Business settings (Australian format)
- [x] Mobile-responsive layout
- [x] Warm terracotta theme

### Calendar Features (January 12, 2026)
- [x] **Week view**: Monday to Sunday display (Square Appointments style)
- [x] **Time slots**: 06:00 to 22:00 (business hours)
- [x] **Current time indicator**: Red line with flashing dot spanning full week
- [x] **Month navigation**: Popover with forward/backward month arrows
- [x] **Today highlight**: Dark circle on today's date
- [x] **Drag and drop**: Appointments can be dragged to reschedule
- [x] **Appointment display**: Shows client name, pet names, time, and services

### SMS Notifications System
- [x] Manual mode (copy message to send from own phone)
- [x] Automated mode (via Twilio) - requires user API keys
- [x] **Flexible timing**: Number + Unit selector (hours/days/weeks/months)
- [x] **7 default templates** (pre-populated on user registration)
- [x] Template variables: {client_name}, {pet_names}, {business_name}, {business_phone}, {date}, {time}

### Invoice System
- [x] Create invoices manually or from appointments
- [x] Line items with quantity, unit price, total
- [x] GST calculation (configurable)
- [x] Status tracking: draft, sent, paid, overdue, cancelled
- [x] Invoice numbering (INV-YYYYMM-XXXX)

### Customer/Pet Flow
- [x] Pet creation integrated into new customer form
- [x] At least one pet required when creating new customer

### Backup System
- [x] Supabase automated backup integration
- [x] Manual backup trigger from Settings

## Bug Fixes (January 12, 2026)
- [x] **Fixed recurring toggle error** - Replaced Radix UI Switch with simple toggle button
- [x] **Fixed service selection error** - Fixed Checkbox component import path
- [x] **Fixed calendar layout** - Now shows full week with appointments spanning their duration
- [x] **Fixed current time indicator** - Red line now spans across entire week
- [x] **Added drag & drop confirmation** - Shows dialog before rescheduling with time preview
- [x] **Added SMS prompt** - Asks user to send SMS after booking/reschedule/cancel/no-show
- [x] **Added native SMS app** - Opens device messaging app in manual mode
- [x] **Verified ABN on invoices** - Displays when ABN is set in settings

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Backup**: Supabase (PostgreSQL)

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Core appointment scheduling
- [x] Client/Pet management
- [x] Mobile layout
- [x] Fix script errors in appointment modal

### P1 (High Priority)
- [ ] **Recurring appointments**: Complete series management (update/delete single vs all)
- [ ] **Drag-and-drop rescheduling**: For desktop and mobile
- [ ] **Pinch-to-zoom**: For mobile calendar
- [ ] Twilio SMS testing (requires user API keys)

### P2 (Medium Priority)
- [ ] Dashboard analytics
- [ ] Client appointment history view
- [ ] Export data to CSV
- [ ] Email reminders

### P3 (Nice to Have)
- [ ] Client self-booking portal
- [ ] Multi-staff scheduling
- [ ] Inventory management
- [ ] Reporting dashboard

## Test Results (Latest: January 12, 2026)
- **Backend**: 22/22 API tests passed (100%)
- **Frontend**: All tested features working (100%)
- **Test file**: `/app/tests/test_backend_api.py`
- **Test report**: `/app/test_reports/iteration_4.json`

## Test Credentials
- Email: test@maya.com
- Password: test123
- Test client: John Doe (with pet "Buddy")
- Test service: Full Groom (60 min, $80)
