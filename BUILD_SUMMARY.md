# Gromify - Pet Grooming Appointment App
## Complete Build Summary

---

## 🏗️ TECH STACK

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TailwindCSS, Shadcn/UI, Lucide React Icons |
| **Backend** | FastAPI (Python), Pydantic |
| **Database** | MongoDB |
| **Authentication** | JWT (JSON Web Tokens) |
| **SMS** | Twilio Integration |
| **Backup** | Supabase Integration |

---

## 📱 APPLICATION SCREENS

### 1. LOGIN PAGE (`/login`)
**File:** `Login.jsx`

**Features:**
- Email/password authentication
- User registration (new accounts)
- JWT token-based session management
- Redirects to Calendar after successful login

**Status:** ✅ Complete

---

### 2. CALENDAR / SCHEDULE PAGE (`/` - Home)
**File:** `Calendar.jsx` (58KB - Main application screen)

**Features:**
- **Week View** with full-week header showing Mon-Sun
- **Day Selection** - Click any day to view appointments for that day
- **Current Time Indicator** - Red line showing current time
- **Auto-scroll to Current Time** - On page load, scrolls to show current time
- **Time Slots** - 24-hour format (00:00 - 23:59) with 15-minute intervals
- **Zoom** - Pinch to zoom in/out on mobile (adjusts slot height)
- **Today Button** - Quick navigation to current date + scrolls to current time

**Appointment Features:**
- **Create** - Click on empty time slot to create new appointment
- **View Details** - Click on appointment to see details modal
- **Edit** - Edit button in details modal opens edit form
- **Drag & Drop** - Drag appointments to reschedule (with confirmation)
- **Color Coding** by status:
  - Blue: Confirmed
  - Yellow: Pending
  - Green: Completed
  - Red: Cancelled/No-show
- **Overlapping Appointments** - Displayed side-by-side when times overlap
- **Full Width** - Single appointments take full grid width

**Recurring Appointments:**
- Create daily, weekly, or monthly recurring series
- Edit single occurrence or entire series
- Delete single or entire series
- Creates 52 occurrences for weekly appointments

**Review & Checkout Modal:**
- Select services from dropdown (from Services menu)
- Select products from dropdown (from Items menu)
- Quantity +/- buttons
- Apply discount (fixed $ or %)
- GST calculation (included in prices)
- Generate invoice on completion
- Marks appointment as "Completed"

**Status:** ✅ Complete

---

### 3. CUSTOMERS PAGE (`/customers`)
**File:** `Customers.jsx`

**Features:**
- **List View** - All customers with search
- **Search** - Filter by name, phone, or email
- **Add New Customer** - Button to create new customer
- **Customer Cards** showing:
  - Name
  - Phone (clickable → Call/SMS/Copy options)
  - Email (clickable → opens email client)
  - Number of pets
- **Click to View Details** - Navigate to customer detail page

**Status:** ✅ Complete

---

### 4. CUSTOMER DETAIL PAGE (`/customers/:id`)
**File:** `CustomerDetail.jsx`

**Features:**
- **Customer Info Card:**
  - Name with Edit button inline
  - Phone (clickable → Call/SMS/Copy popup)
  - Email (clickable → mailto link)
  - Address (clickable → Google Maps/Waze/Apple Maps/Copy popup)
  - No-show count badge

- **Edit Customer Modal:**
  - Name, Phone, Email, Address fields
  - Mobile-optimized layout
  - Delete Customer option

- **Pets Tab:**
  - List all pets for this customer
  - Add Pet button
  - Pet cards with: Name, Breed, Age, Notes
  - Edit/Delete pets

- **Appointments Tab:**
  - Past appointments
  - Future appointments
  - Click to view appointment details

**Status:** ✅ Complete

---

### 5. SERVICES PAGE (`/services`)
**File:** `Services.jsx`

**Features:**
- **List all grooming services**
- **Add New Service** button
- **Service Cards showing:**
  - Service name
  - Duration (minutes)
  - Price (includes GST)
- **Edit/Delete services**
- Services appear in appointment checkout dropdown

**Status:** ✅ Complete

---

### 6. ITEMS PAGE (`/items`)
**File:** `Items.jsx`

**Features:**
- **List all products for sale**
- **Add New Item** button
- **Item Cards showing:**
  - Item name
  - Price (includes GST)
  - Stock quantity (optional)
- **Edit/Delete items**
- Items appear in appointment checkout dropdown

**Status:** ✅ Complete

---

### 7. INVOICES PAGE (`/invoices`)
**File:** `Invoices.jsx`

**Features:**
- **List all invoices** with status filter (All/Draft/Sent/Paid/Overdue)
- **Invoice Cards showing:**
  - Invoice number (INV-YYYYMM-XXXX)
  - Client name
  - Total amount
  - Status badge (color-coded)
  - Date

- **Create New Invoice:**
  - Select customer
  - Add line items (name, qty, price)
  - Apply discount
  - GST calculated (included in prices)
  - Notes field

- **View Invoice Modal (Mobile-Optimized):**
  - Business info header
  - Bill To section
  - Line items with quantity × price
  - Discount display (if applied)
  - GST (included) breakdown
  - Total
  - Mark as Sent/Paid buttons
  - Print button

**Status:** ✅ Complete

---

### 8. WAITLIST PAGE (`/waitlist`)
**File:** `Waitlist.jsx`

**Features:**
- **Manage waitlist entries**
- Add customers waiting for appointments
- Priority ordering
- Convert to appointment

**Status:** ✅ Complete

---

### 9. SETTINGS PAGE (`/settings`)
**File:** `Settings.jsx` (35KB)

**Tabs:**

#### Business Tab
- Business name
- ABN (Australian Business Number)
- Address
- Phone, Email
- Logo upload

#### Payment Tab
- PayID
- Bank details (BSB, Account Number, Account Name)

#### SMS Tab
- **Enable SMS Toggle**
- **SMS Mode:** Manual / Automatic
- **Twilio Configuration:**
  - Account SID
  - Auth Token
  - Phone Number
- **Auto-Send Options:**
  - Confirmation Requests (X days before)
  - Appointment Reminders (X hours before)
- **Message Templates (7 templates):**
  1. Appointment Booked
  2. Appointment Changed
  3. Appointment Rescheduled
  4. Appointment Cancelled
  5. No Show
  6. Confirmation Request
  7. 24-Hour Reminder
- **Template Variables:** `{client_name}`, `{pet_names}`, `{date}`, `{time}`, `{business_name}`, `{business_phone}`

#### Preferences Tab
- 24-hour time format toggle
- Dark mode toggle (partial)
- Default appointment duration

#### Backup Tab
- Manual backup to Supabase
- Last backup timestamp
- Backup status

**Status:** ✅ Complete

---

### 10. MORE PAGE (`/more`)
**File:** `More.jsx`

**Features:**
- Navigation links to less-used features
- Logout button

**Status:** ✅ Complete

---

## 🔗 API ENDPOINTS

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user account |
| POST | `/api/auth/login` | Login, returns JWT token |
| GET | `/api/auth/me` | Get current user info |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update settings |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/clients` | Create client |
| GET | `/api/clients` | List clients (with search) |
| GET | `/api/clients/{id}` | Get single client |
| PUT | `/api/clients/{id}` | Update client |
| DELETE | `/api/clients/{id}` | Delete client |

### Pets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pets` | Create pet |
| GET | `/api/pets?client_id=` | List pets (filter by client) |
| GET | `/api/pets/{id}` | Get single pet |
| PUT | `/api/pets/{id}` | Update pet |
| DELETE | `/api/pets/{id}` | Delete pet |

### Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/services` | Create service |
| GET | `/api/services` | List all services |
| GET | `/api/services/{id}` | Get single service |
| PUT | `/api/services/{id}` | Update service |
| DELETE | `/api/services/{id}` | Delete service |

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/items` | Create item |
| GET | `/api/items` | List all items |
| PUT | `/api/items/{id}` | Update item |
| DELETE | `/api/items/{id}` | Delete item |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appointments` | Create appointment (+ recurring) |
| GET | `/api/appointments` | List appointments (date range filter) |
| GET | `/api/appointments/{id}` | Get single appointment |
| PUT | `/api/appointments/{id}` | Update (single or series) |
| DELETE | `/api/appointments/{id}?delete_series=` | Delete (single or series) |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices` | List invoices (status filter) |
| GET | `/api/invoices/{id}` | Get invoice with business info |
| PUT | `/api/invoices/{id}` | Update invoice |
| DELETE | `/api/invoices/{id}` | Delete invoice |

### Waitlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/waitlist` | Add to waitlist |
| GET | `/api/waitlist` | List waitlist |
| PUT | `/api/waitlist/{id}` | Update entry |
| DELETE | `/api/waitlist/{id}` | Remove from waitlist |

### SMS
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sms/templates` | Get SMS templates |
| PUT | `/api/sms/templates` | Update templates |
| POST | `/api/sms/send` | Send SMS |
| GET | `/api/sms/messages` | Get SMS history |
| POST | `/api/sms/preview` | Preview SMS message |

### Backup
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backup` | Trigger manual backup |
| GET | `/api/backup/status` | Get backup status |

---

## 📊 DATABASE SCHEMA

### Users
```javascript
{
  id: UUID,
  email: String,
  password_hash: String,
  created_at: DateTime
}
```

### Clients
```javascript
{
  id: UUID,
  user_id: UUID,
  name: String,
  phone: String,
  email: String,
  address: String,
  no_show_count: Number,
  created_at: DateTime
}
```

### Pets
```javascript
{
  id: UUID,
  user_id: UUID,
  client_id: UUID,
  name: String,
  breed: String,
  age: String,
  notes: String
}
```

### Services
```javascript
{
  id: UUID,
  user_id: UUID,
  name: String,
  duration: Number (minutes),
  price: Number (includes GST)
}
```

### Items
```javascript
{
  id: UUID,
  user_id: UUID,
  name: String,
  price: Number,
  stock: Number
}
```

### Appointments
```javascript
{
  id: UUID,
  user_id: UUID,
  client_id: UUID,
  client_name: String,
  date_time: DateTime,
  end_time: DateTime,
  status: "confirmed" | "pending" | "completed" | "cancelled" | "no_show",
  pets: [{
    pet_id: UUID,
    pet_name: String,
    services: [{ service_id, price }],
    items: [{ item_id, price }],
    noService: Boolean
  }],
  notes: String,
  is_recurring: Boolean,
  recurring_id: UUID (links series),
  recurring_value: Number,
  recurring_unit: "day" | "week" | "month",
  total_duration: Number,
  total_price: Number
}
```

### Invoices
```javascript
{
  id: UUID,
  invoice_number: "INV-YYYYMM-XXXX",
  user_id: UUID,
  client_id: UUID,
  appointment_id: UUID (optional),
  client_name: String,
  items: [{ name, quantity, unit_price, total }],
  subtotal: Number,
  discount: Number,
  gst_amount: Number,
  total: Number,
  status: "draft" | "sent" | "paid" | "overdue",
  notes: String,
  created_at: DateTime
}
```

### Settings
```javascript
{
  user_id: UUID,
  business_name: String,
  abn: String,
  address: String,
  phone: String,
  email: String,
  gst_enabled: Boolean,
  gst_rate: Number (default 10),
  sms_enabled: Boolean,
  sms_mode: "manual" | "automatic",
  twilio_sid: String,
  twilio_token: String,
  twilio_phone: String,
  sms_templates: { ... },
  // Payment details
  pay_id: String,
  bank_name: String,
  bsb: String,
  account_number: String,
  account_name: String
}
```

---

## ✅ COMPLETED FEATURES

1. **User Authentication** - Login/Register with JWT
2. **Calendar View** - Week view with day selection, current time indicator
3. **Auto-scroll to Current Time** - Calendar opens showing current time
4. **Appointments CRUD** - Create, read, update, delete
5. **Recurring Appointments** - Daily/weekly/monthly with series management
6. **Customer Management** - Full CRUD with contact popups
7. **Pet Management** - CRUD linked to customers
8. **Services Management** - Define grooming services with pricing
9. **Items Management** - Products for sale
10. **Review & Checkout Flow** - Service/product selection, discounts, invoice generation
11. **Invoice Management** - Create, view, status updates, mobile-optimized
12. **GST Calculation** - Prices include GST, displayed on invoices
13. **SMS Templates** - 7 editable templates with variables
14. **Phone/Address Popups** - Call/SMS/Copy and Maps integration
15. **Drag & Drop Reschedule** - With confirmation dialog
16. **Appointment Status Colors** - Visual status indicators
17. **Waitlist Management** - Basic functionality
18. **Settings Management** - Business, payment, SMS, preferences
19. **Supabase Backup** - Manual backup functionality

---

## 🚧 PENDING / FUTURE FEATURES

1. **Dark Mode** - Partially implemented, needs completion
2. **Address Autocomplete** - Google Places API integration
3. **Save Contact to Phone** - Export customer as vCard
4. **Calendar Header Pinning** - Fixed header during scroll
5. **Month/List Views** - Alternative calendar views
6. **Customer Appointment History** - Enhanced view in customer detail
7. **Individual Occurrence Editing** - Edit single recurring without affecting series
8. **Automatic SMS Sending** - Twilio integration for auto-send
9. **Push Notifications** - Appointment reminders
10. **Multi-user/Staff Management** - Multiple staff calendars
11. **Online Booking** - Customer self-booking portal
12. **Reporting/Analytics** - Revenue, appointment stats

---

## 🔧 TECHNICAL NOTES

### Frontend Port: 3000
### Backend Port: 8001
### API Prefix: `/api`

### Environment Variables
**Frontend (.env):**
- `REACT_APP_BACKEND_URL` - API base URL

**Backend (.env):**
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `JWT_SECRET` - JWT signing secret

### Hot Reload
- Both frontend and backend have hot reload enabled
- Supervisor manages services
- Restart command: `sudo supervisorctl restart frontend/backend`

---

## 📱 MOBILE RESPONSIVENESS

All screens are mobile-optimized:
- Calendar: Touch-friendly, pinch to zoom
- Modals: Max-width constraints, scrollable
- Forms: Stacked layouts on mobile
- Buttons: Touch-friendly sizes
- Navigation: Bottom nav bar on mobile

---

*Last Updated: January 15, 2025*
