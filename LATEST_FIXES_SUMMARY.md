# Latest Fixes - User Feedback Implementation

## Date: January 2026
## Issues Addressed from User Feedback

---

## ✅ FIXES IMPLEMENTED

### 1. **Calendar Headers - NOW COMPLETELY STABLE** 
**Problem**: Month header and week selector were scrolling with content.

**Solution**:
- Changed month header to `sticky top-0` with `z-30`
- Changed week selector to `sticky top-[57px]` with `z-20`
- These elements now stay fixed at top while only time grid scrolls

**Files Modified**: `/app/frontend/src/pages/Calendar.jsx`

---

### 2. **Wider Appointment Blocks with All Details Visible**
**Problem**: Appointment blocks were too narrow, details were cut off or hidden.

**Solution**:
- Changed width from `calc(${style.width} - 60px)` to `calc(100% - 64px)` for single appointments
- Changed `minWidth` to `140px` to ensure minimum readable size
- Changed `overflow-hidden` to `overflow-visible` to prevent text clipping
- **Always show service names** on appointment blocks (removed height conditional)
- Increased font sizes: text-xs → text-xs (name), text-[11px] (time & services)
- Service names always display, not hidden behind height check

**Files Modified**: `/app/frontend/src/pages/Calendar.jsx` (lines 555-590)

---

### 3. **Service Type Displayed on Appointments**
**Problem**: Appointment blocks didn't show what service was booked.

**Solution**:
- Service names now ALWAYS visible on appointment blocks
- Displays all services for all pets: "Full Grooming, Nail Cutting"
- Shows "No service" if none selected
- Positioned below time with proper styling

**Files Modified**: `/app/frontend/src/pages/Calendar.jsx`

---

### 4. **"Add Customer" Button with Popup Selection**
**Problem**: No dedicated button to open customer list.

**Solution**:
- Added "Add Customer" button next to search input
- Button opens the dropdown showing all matching customers
- Clicking button focuses search and shows full customer list
- Better UX for finding and selecting customers

**Files Modified**: `/app/frontend/src/components/AppointmentModal.jsx` (lines 421-443)

---

### 5. **Edit Time/Date in Reschedule Dialog**
**Problem**: Had to open full appointment modal to change time during reschedule.

**Solution**:
- Added time input field in reschedule confirmation dialog
- User can now adjust time directly in the confirmation without opening another screen
- Still has "Edit Details" button for full edit if needed
- Time picker updates `pendingReschedule.newDateTime` in real-time

**Files Modified**: `/app/frontend/src/pages/Calendar.jsx` (lines 640-670)

---

### 6. **Single $ Sign (Not $$)**
**Problem**: Currency showed as "A$75.00" or "$$75.00".

**Solution**:
- Changed `formatCurrency()` function from `Intl.NumberFormat` to simple format
- Now returns: `$75.00` (single $ sign)
- Applied throughout app (services, items, invoices, totals)

**Files Modified**: `/app/frontend/src/lib/utils.js` (line 28-30)

---

### 7. **Adjustable Prices for Services/Items**
**Problem**: Couldn't adjust price when adding service to appointment (e.g., change $15 to $10 or $20).

**Solution**:
- Added `customPrices` state to store adjusted prices
- Each service now has an editable price input field next to checkbox
- Price input format: `$ [input field]`
- Prices can be adjusted per pet per service
- Custom prices persist during appointment creation
- `calculateTotals()` function uses custom prices if set, otherwise defaults to service/item price

**Implementation**:
- Added state: `const [customPrices, setCustomPrices] = useState({})`
- Price key format: `${petIndex}-${serviceId}` or `${petIndex}-item-${itemId}`
- Input field: `<Input type="number" step="0.01" min="0" className="w-20 h-8" />`

**Files Modified**: `/app/frontend/src/components/AppointmentModal.jsx` (lines 73, 281-305, 649-675)

---

### 8. **GST Calculation on Invoices**
**Problem**: User wanted GST included in pricing.

**Solution**:
- GST is already implemented in backend! 
- User settings has `gst_enabled` (true/false) and `gst_rate` (default 10%)
- Backend automatically calculates GST on invoices:
  - Subtotal = sum of all items/services
  - GST Amount = subtotal × (gst_rate / 100)
  - Total = subtotal + GST Amount
- Invoice shows:
  - Subtotal: $100.00
  - GST (10%): $10.00
  - Total: $110.00

**Status**: Already working in backend, no changes needed!

---

## 📝 TECHNICAL DETAILS

### Calendar Header Sticky Implementation
```jsx
{/* Month Header */}
<div className="sticky top-0 ... z-30 flex-shrink-0">

{/* Week Selector */}
<div className="sticky top-[57px] ... z-20 flex-shrink-0">

{/* Scrollable Grid */}
<div className="flex-1 overflow-y-auto ...">
```

### Appointment Block Styling
- Minimum width: 140px
- Full width for single appointments: `calc(100% - 64px)`
- Staggered width for overlapping: `calc(${style.width} - 4px)`
- Service names always visible (no height check)
- Increased padding and font sizes

### Custom Price Implementation
```jsx
// State
const [customPrices, setCustomPrices] = useState({});

// Usage
const priceKey = `${petIndex}-${serviceId}`;
const currentPrice = customPrices[priceKey] ?? service.price;

// Update
setCustomPrices(prev => ({...prev, [priceKey]: newPrice}));

// Calculate total
const price = customPrices[priceKey] ?? service.price;
totalPrice += parseFloat(price);
```

---

## 🧪 TESTING NEEDED

1. **Calendar Headers**: Scroll calendar vertically, verify headers don't move
2. **Appointment Display**: Check appointment blocks show all info (client, pet, time, services, price)
3. **Add Customer Button**: Click button, select customer from list
4. **Reschedule with Time Edit**: Drag appointment, adjust time in dialog, confirm
5. **Currency Format**: Check $ sign appears once (not $$ or A$)
6. **Adjustable Prices**: Create appointment, select service, change price from default
7. **GST on Invoices**: Generate invoice, verify GST calculation appears if enabled in settings

---

## 📂 FILES MODIFIED

1. `/app/frontend/src/pages/Calendar.jsx` - Headers sticky, appointment blocks wider, reschedule dialog
2. `/app/frontend/src/components/AppointmentModal.jsx` - Add Customer button, adjustable prices
3. `/app/frontend/src/lib/utils.js` - Currency format (single $)

---

## 🚀 NEXT STEPS

1. Test all fixes with manual testing
2. User verification
3. Address any remaining issues

