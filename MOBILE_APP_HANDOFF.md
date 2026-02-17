# Maya Groom Pro - Mobile App Handoff Document

## Executive Summary
Convert the existing **Maya Groom Pro** web application into a native mobile app using **Expo (React Native)**. The app is a comprehensive pet grooming appointment management system designed for small business owners.

---

## 1. ORIGINAL PROBLEM STATEMENT

Build a pet grooming appointment management application with:
- User authentication with forgot/change password
- Calendar with multiple views (day, week, month, list)
- Appointment management including recurring appointments
- Client and pet management
- Invoicing and checkout system with PDF generation
- Two-way Google Calendar sync
- SMS appointment reminders (automated via Twilio)
- Mobile-first UI with unique terracotta/orange design theme

---

## 2. TARGET USER

**Primary User**: Pet grooming business owner
- **Business**: Maya's Pet Grooming (Australia)
- **Primary Device**: iPhone
- **Use Case**: Daily operations - scheduling appointments, managing clients, sending invoices
- **Location**: Australia (affects date/time formats, GST, currency AUD)

---

## 3. DESIGN SYSTEM

### 3.1 Color Palette
```
Primary (Terracotta/Orange):
- primary: #C75B2A
- primary-hover: #B04A1E  
- primary-light: #F2DCD3

Neutral (Cream/Warm):
- cream: #F5EBE0 (main background)
- cream-dark: #EBE0D6
- text: #2D2A26
- text-muted: #6B665F
- border: #E6D5C3

Status Colors:
- success: #4A7C59
- warning: #D9A44A
- error: #D94A4A
- info: #4A6FA5
```

### 3.2 Typography
```
Fonts:
- Headings: 'Outfit' (weights: 300-700)
- Body: 'Plus Jakarta Sans' (weights: 300-700)
- Monospace: 'JetBrains Mono' (weights: 400, 500)
```

### 3.3 Logo
```
URL: https://customer-assets.emergentagent.com/job_d578d077-528c-4967-bdf0-53c37dcde83a/artifacts/6dvktlo7_14F224AC-7591-4953-AD6C-171CC58B1D16.png

Logo shows: Mountain/paw print icon with "MAYA GROOM PRO" text in terracotta color
```

### 3.4 Design Principles
- Warm, inviting aesthetic (cream backgrounds, soft shadows)
- Subtle texture overlay on backgrounds
- Rounded corners (0.75rem default)
- Soft shadows: `0 4px 20px -2px rgba(45, 42, 38, 0.05)`
- Float shadows for cards: `0 10px 40px -10px rgba(199, 91, 42, 0.15)`

---

## 4. APP SCREENS & FEATURES

### 4.1 Authentication Screens

#### Login Screen
- Email input
- Password input
- "Sign In" button (terracotta)
- "Forgot Password?" link
- Toggle to Register tab
- Logo at top

#### Register Screen
- Business Name input
- Email input
- Password input
- Confirm Password input
- "Create Account" button

#### Forgot Password
- Email input
- Shows temporary password on screen (MOCKED - real email not implemented)

---

### 4.2 Calendar Screen (Main Screen)

**Header (Fixed/Pinned)**:
- Month/Year selector (e.g., "Feb 2026") - opens month picker popover
- "Calendar" / "List" view toggle dropdown
- "Today" button
- "+" button to add appointment

**Week Day Selector (Fixed/Pinned)**:
- Horizontal scrollable week days (MON-SUN)
- Shows date numbers (16, 17, 18...)
- Current day highlighted with terracotta circle
- Left/Right arrows to navigate weeks

**Day View (Scrollable)**:
- 24-hour timeline (00:00 - 23:59)
- 15-minute intervals
- Time slots on left side
- Red line indicating current time with time label (e.g., "12:52")
- Appointments displayed as colored blocks
- Tap appointment to open details
- Drag appointments to reschedule
- Pinch to zoom in/out

**List View**:
- Shows appointments as cards grouped by date
- Client name, pet names, time, duration, price

**Appointment Cards Display**:
- Client name (bold)
- Pet name(s)
- Time range
- Total price
- Status indicator (scheduled, completed, cancelled, no_show)
- Staggered layout for overlapping appointments

---

### 4.3 Appointment Detail Modal

**When tapping an appointment**:
- Client name (clickable - goes to client detail)
- Date & time
- Pet(s) with services assigned
- Total duration & price
- Notes
- Status

**Action Buttons**:
- "Edit" - opens edit modal
- "Review & Checkout" OR "View Invoice" (if already invoiced)
- Delete option

---

### 4.4 New/Edit Appointment Modal

**Fields**:
- Client selector (searchable dropdown with "Add Customer" button)
- Date/Time picker
- Duration (auto-calculated from services)
- Pet(s) section:
  - Add pet button
  - For each pet: pet name selector, services multi-select, items multi-select
- Recurring toggle:
  - If ON: frequency (daily/weekly/monthly/yearly) + interval number
- Notes textarea

**Buttons**:
- Cancel
- Save / Create

---

### 4.5 Customers Screen

**Header**:
- "Customers" title
- Search input
- "Add Customer" button

**Customer List**:
- Scrollable list of customer cards
- Each card shows: Name, Phone, Email
- Tap to view customer detail

---

### 4.6 Customer Detail Screen

**Header**:
- Back button
- Customer name
- Edit button

**Customer Info Card**:
- Full name
- Phone (clickable to call)
- Email (clickable to email)
- Address (with copy button and Waze navigation button)

**Pets Section**:
- List of customer's pets
- Each pet shows: Name, Breed, Age, Notes
- "Add Pet" button

**Appointments Tabs**:
- "Upcoming" tab - future appointments
- "Past" tab - completed/cancelled appointments
- Each appointment card shows: Date, Time, Pets, Services, Status, Price

**Actions**:
- "Book Appointment" button

---

### 4.7 Services Screen

**Header**:
- "Services" title
- "Add Service" button

**Service List**:
- Name
- Duration (minutes)
- Price ($)
- Edit/Delete actions

**Add/Edit Service Modal**:
- Name input
- Duration input (minutes)
- Price input

---

### 4.8 Items Screen

**Header**:
- "Items" title
- "Add Item" button

**Item List**:
- Name
- Price ($)
- Edit/Delete actions

**Add/Edit Item Modal**:
- Name input
- Price input

---

### 4.9 Invoices Screen

**Header**:
- "Invoices" title
- Filter dropdown (All, Draft, Sent, Paid, Overdue)

**Invoice List**:
- Invoice number (e.g., "INV-0001")
- Client name
- Date
- Total amount
- Status badge (color-coded)

**Invoice Detail / Edit Screen**:
- Invoice number
- Client info (name, email, phone, address)
- Line items table:
  - Name, Qty, Unit Price, Total
  - Add/remove items
- Subtotal
- Discount input
- GST amount (if enabled)
- Total
- Notes
- Status selector
- Due date picker

**Send Invoice Feature**:
- Generates PDF invoice
- Opens share sheet (iOS) to send via Email/SMS/WhatsApp
- Copy email/phone buttons for quick access

---

### 4.10 Checkout Screen

- Select client
- Add line items
- Apply discount
- Calculate GST
- Generate invoice
- Print/Share invoice

---

### 4.11 Settings Screen

**Organized in Tabs**:

#### Business Tab
- Business Name
- ABN (Australian Business Number)
- Phone
- Email
- Address
- Logo upload

#### Payment Tab
- PayID
- Bank Name
- BSB
- Account Number
- Account Name

#### Tax Tab
- GST Enabled toggle
- GST Rate (default 10%)

#### SMS Tab
- Enable SMS toggle
- SMS Mode: Manual / Automated
- If Automated: Twilio credentials (Account SID, Auth Token, Phone Number)
- Auto-Send Options:
  - Confirmation Request: toggle + timing (X days/weeks before)
  - Appointment Reminder: toggle + timing (X hours/days before)

#### Message Templates
- Appointment Booked template
- Appointment Changed template
- Appointment Rescheduled template
- Appointment Cancelled template
- Confirmation Request template
- 24-Hour Reminder template
- Each template: name, message text with variables, enabled toggle

#### Calendar Tab
- Use 24-hour clock toggle
- Google Calendar Connection:
  - "Connect Google Calendar" button
  - If connected: "Disconnect" button

#### Account Tab
- Change Password form (Current, New, Confirm)

---

### 4.12 More Menu (Bottom Sheet)

Accessed via "More" in bottom navigation:
- Invoices
- Checkout
- Settings
- Logout

---

## 5. BOTTOM NAVIGATION BAR

Fixed at bottom of screen:
1. **Calendar** (calendar icon) - Main screen
2. **Customers** (people icon)
3. **Services** (scissors icon)
4. **Items** (box icon)
5. **More** (hamburger menu icon)

Active state: Terracotta color + bold text
Inactive state: Muted gray + medium font weight

---

## 6. API ENDPOINTS

### Base URL
The existing backend is at: `https://grooming-hub-49.preview.emergentagent.com/api`

### Authentication
```
POST /api/auth/register
  Body: { email, password, business_name }
  Response: { access_token, token_type }

POST /api/auth/login
  Body: { email, password }
  Response: { access_token, token_type }

POST /api/auth/forgot-password
  Body: { email }
  Response: { message, temporary_password? }

POST /api/auth/change-password
  Headers: Authorization: Bearer <token>
  Body: { current_password, new_password }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response: User object
```

### Settings
```
GET /api/settings
PUT /api/settings
  Body: SettingsUpdate object
```

### Clients
```
GET /api/clients?search=<query>
POST /api/clients
GET /api/clients/{client_id}
PUT /api/clients/{client_id}
DELETE /api/clients/{client_id}
```

### Pets
```
GET /api/pets?client_id=<id>
POST /api/pets
GET /api/pets/{pet_id}
PUT /api/pets/{pet_id}
DELETE /api/pets/{pet_id}
```

### Services
```
GET /api/services
POST /api/services
PUT /api/services/{service_id}
DELETE /api/services/{service_id}
```

### Items
```
GET /api/items
POST /api/items
PUT /api/items/{item_id}
DELETE /api/items/{item_id}
```

### Appointments
```
GET /api/appointments?start_date=<ISO>&end_date=<ISO>
POST /api/appointments
GET /api/appointments/{appointment_id}
PUT /api/appointments/{appointment_id}
DELETE /api/appointments/{appointment_id}?delete_series=<bool>
```

### Invoices
```
GET /api/invoices?status=<filter>
POST /api/invoices
POST /api/invoices/from-appointment/{appointment_id}
GET /api/invoices/{invoice_id}
GET /api/invoices/by-number/{invoice_number}
GET /api/invoices/check/{appointment_id}
PUT /api/invoices/{invoice_id}
DELETE /api/invoices/{invoice_id}
```

### SMS
```
GET /api/sms/templates
PUT /api/sms/templates
POST /api/sms/send
GET /api/sms/messages
PUT /api/sms/messages/{message_id}/status
POST /api/sms/preview
```

### Reminders
```
GET /api/reminders/status
POST /api/reminders/trigger
```

### Google Calendar
```
GET /api/auth/google/connect
GET /api/auth/google/callback
POST /api/auth/google/disconnect
```

### Waitlist
```
GET /api/waitlist
POST /api/waitlist
PUT /api/waitlist/{waitlist_id}
DELETE /api/waitlist/{waitlist_id}
```

### Dashboard
```
GET /api/dashboard/stats
```

---

## 7. DATA MODELS

### User
```typescript
{
  id: string;
  email: string;
  password_hash: string;
  google_tokens?: object;
  google_calendar_connected?: boolean;
  created_at: datetime;
}
```

### Settings
```typescript
{
  id: string;
  user_id: string;
  business_name: string;
  abn: string;
  phone: string;
  email: string;
  address: string;
  pay_id: string;
  bank_name: string;
  bsb: string;
  account_number: string;
  account_name: string;
  gst_enabled: boolean;
  gst_rate: number; // default 10
  use_24_hour_clock: boolean;
  logo_data_url: string;
  // SMS
  sms_enabled: boolean;
  sms_mode: "manual" | "automated";
  sms_provider: "twilio" | "";
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  sms_templates: object;
  // Reminders
  send_confirmation_request: boolean;
  confirmation_request_value: number;
  confirmation_request_unit: "days" | "weeks" | "months";
  send_24h_reminder: boolean;
  reminder_value: number;
  reminder_unit: "hours" | "days";
}
```

### Client
```typescript
{
  id: string;
  user_id: string;
  name: string;
  first_name: string;
  surname: string;
  phone: string;
  email: string;
  address: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
  no_show_count: number;
  last_no_show: string | null;
  created_at: datetime;
}
```

### Pet
```typescript
{
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  breed: string;
  age: string;
  notes: string;
  created_at: datetime;
}
```

### Service
```typescript
{
  id: string;
  user_id: string;
  name: string;
  duration: number; // minutes
  price: number;
  type: "service";
  created_at: datetime;
}
```

### Item
```typescript
{
  id: string;
  user_id: string;
  name: string;
  price: number;
  type: "item";
  created_at: datetime;
}
```

### Appointment
```typescript
{
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  date_time: datetime;
  end_time: datetime;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string;
  is_recurring: boolean;
  recurring_value: number | null;
  recurring_unit: "day" | "week" | "month" | "year" | null;
  recurring_id: string | null;
  pets: AppointmentPet[];
  total_duration: number;
  total_price: number;
  google_event_id?: string;
  reminder_24h_sent?: boolean;
  confirmation_sent?: boolean;
  created_at: datetime;
}
```

### AppointmentPet
```typescript
{
  id: string;
  pet_name: string;
  pet_id: string | null;
  services: string[]; // Service IDs
  items: string[]; // Item IDs
}
```

### Invoice
```typescript
{
  id: string;
  invoice_number: string; // e.g., "INV-0001"
  user_id: string;
  appointment_id: string | null;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  gst_amount: number;
  total: number;
  notes: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
  paid_date: string | null;
  created_at: datetime;
}
```

### InvoiceItem
```typescript
{
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}
```

---

## 8. KEY FEATURES IMPLEMENTATION NOTES

### 8.1 Calendar - Pinch to Zoom
- Implement pinch gesture to zoom calendar grid
- Zoom levels affect the height of time slots
- Store zoom level in state

### 8.2 Calendar - Drag to Reschedule
- Long press on appointment to enter drag mode
- Drag to new time slot
- Confirm reschedule
- If recurring: ask "Update this occurrence only" or "Update entire series"

### 8.3 Calendar - Current Time Indicator
- Red horizontal line at current time
- Shows time label (e.g., "12:52")
- Auto-scroll to current time on load
- Position calculation: `(hours * 80 + minutes/60 * 80) * zoomLevel`

### 8.4 Recurring Appointments
- When creating: choose frequency (daily, weekly, monthly, yearly) and interval
- Creates multiple appointments with same `recurring_id`
- When editing: option to update single or entire series
- When deleting: option to delete single or entire series

### 8.5 Invoice PDF Generation
- Use react-native equivalent of jsPDF or expo-print
- Professional layout with:
  - Business logo and info at top
  - "INVOICE" title with number
  - Bill To section
  - Items table
  - Subtotal, Discount, GST, Total
  - Payment details
  - Notes

### 8.6 Share Invoice
- Generate PDF
- Use Expo Sharing API to open share sheet
- Allow sending via Email, SMS, WhatsApp, etc.

### 8.7 Google Calendar Sync
- OAuth flow opens in browser/webview
- Stores tokens in user document
- Two-way sync:
  - Creating appointment → creates Google Calendar event
  - Updating appointment → updates Google Calendar event
  - Deleting appointment → deletes Google Calendar event

### 8.8 SMS Reminders
- Backend scheduler runs every 15 minutes
- Checks for appointments in reminder window
- Sends SMS via Twilio (if configured)
- Tracks sent status to avoid duplicates

---

## 9. AUTHENTICATION FLOW

1. App launches → Check for stored token in AsyncStorage
2. If token exists → Validate with `/api/auth/me`
3. If valid → Navigate to Calendar screen
4. If invalid/missing → Navigate to Login screen
5. On login success → Store token, fetch settings, navigate to Calendar
6. On logout → Clear token, navigate to Login

---

## 10. ERROR HANDLING

- Show toast notifications for errors
- Handle network errors gracefully
- Show loading states during API calls
- Validate forms before submission
- Handle session expiry (401) → redirect to login

---

## 11. OFFLINE CONSIDERATIONS

- Cache frequently accessed data (clients, services, items)
- Show cached data when offline
- Queue actions for sync when back online (optional enhancement)

---

## 12. TEST CREDENTIALS

```
Email: foti@mayaspetgrooming.com.au
Password: Maya2024!
```

---

## 13. BACKEND INFORMATION

**Backend URL**: https://grooming-hub-49.preview.emergentagent.com
**Technology**: FastAPI + MongoDB
**Authentication**: JWT Bearer tokens (24-hour expiry)

The backend is fully functional and tested. No changes needed - just connect the mobile app to the existing API.

---

## 14. PRIORITY FEATURES FOR MVP

1. ✅ Authentication (Login, Register, Logout)
2. ✅ Calendar view with appointments
3. ✅ Create/Edit/Delete appointments
4. ✅ Client management
5. ✅ Pet management
6. ✅ Services & Items management
7. ✅ Basic invoicing
8. ⏳ PDF invoice generation & sharing
9. ⏳ Google Calendar sync
10. ⏳ SMS reminders

---

## 15. NICE-TO-HAVE FEATURES (POST-MVP)

- Push notifications for reminders
- Offline mode with sync
- Dark mode
- Analytics dashboard
- Barcode/QR scanning for products
- Customer-facing booking portal
- Payment processing integration

---

## 16. SCREENSHOTS REFERENCE

The web app is available at: https://grooming-hub-49.preview.emergentagent.com

Login with test credentials to see:
- Calendar layout and interactions
- Customer detail page
- Invoice design
- Settings organization

---

## 17. CONTACT

For questions about the existing implementation, refer to:
- `/app/backend/server.py` - All API logic
- `/app/frontend/src/pages/` - All screen implementations
- `/app/memory/PRD.md` - Product requirements

---

**END OF HANDOFF DOCUMENT**
