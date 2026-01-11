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
- **Mobile**: Bottom navigation (Calendar, Checkout, Customers, More)
- **Desktop**: Left sidebar navigation

## What's Been Implemented (January 2026)
- [x] User authentication (register/login/JWT)
- [x] Calendar with week/month/list views
- [x] Client management with no-show tracking
- [x] Pet management (per client)
- [x] Services catalog with duration/price
- [x] Items/products catalog
- [x] Waitlist management
- [x] Appointment booking with pets and services
- [x] Business settings (Australian format)
- [x] Mobile-responsive layout
- [x] Supabase backup integration
- [x] Warm terracotta theme

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Backup**: Supabase

## Prioritized Backlog

### P0 (Critical)
- [x] Core appointment scheduling
- [x] Client/Pet management
- [x] Mobile layout fix

### P1 (High Priority)
- [ ] Recurring appointments generation
- [ ] SMS notifications (Twilio integration ready)
- [ ] Checkout/payment processing
- [ ] Invoice generation

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

## Next Tasks
1. Implement SMS notifications using Twilio
2. Build checkout flow with payment options
3. Add recurring appointment auto-generation
4. Create invoice/receipt generation
