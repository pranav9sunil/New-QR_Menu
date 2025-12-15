# QR Restaurant Ordering System - Testing Checklist

## Pre-Deployment Checklist

### ✅ Firebase Configuration
- [ ] Firebase project created
- [ ] Firestore database initialized
- [ ] Firebase Authentication enabled
- [ ] Security rules updated for production
- [ ] Environment variables configured in Vercel

### ✅ Vercel Deployment
- [ ] Project deployed to Vercel
- [ ] Production URL accessible
- [ ] Deployment Protection disabled (no login required)
- [ ] Environment variables set correctly
- [ ] Build completes without errors

---

## Admin Panel Testing

### 1. Login & Authentication
- [ ] Admin can login with correct credentials
- [ ] Invalid credentials show error message
- [ ] Session persists after page refresh
- [ ] Logout works correctly

### 2. Table Layout Management
- [ ] Can add new tables
- [ ] Can edit table names
- [ ] Can change table capacity
- [ ] Can move tables (drag & drop)
- [ ] Can delete tables
- [ ] Table positions save correctly
- [ ] QR codes generate for each table

### 3. Menu Management
- [ ] Can add new menu items
- [ ] Can edit existing items
- [ ] Can delete menu items
- [ ] Can set prices (€ symbol displays)
- [ ] Can upload/set image URLs
- [ ] Can set dietary tags (vegan, vegetarian, gluten-free)
- [ ] Can set spice levels (0-3)
- [ ] Can mark as Chef's Special
- [ ] Can mark as Bestseller
- [ ] **Customization Options:**
  - [ ] Can add customization groups
  - [ ] Can set group name (e.g., "Size", "Toppings")
  - [ ] Can choose single/multiple selection
  - [ ] Can add options with prices
  - [ ] Can remove options
  - [ ] Can remove entire groups
  - [ ] Dialog scrolls when many options added
  - [ ] Customizations save correctly

### 4. QR Code Generation
- [ ] QR codes page loads
- [ ] Can download QR codes for all tables
- [ ] QR codes contain correct URL format
- [ ] QR codes are scannable
- [ ] Each QR code links to correct table

### 5. Kitchen Management
- [ ] New orders appear in real-time
- [ ] Can mark orders as "Preparing"
- [ ] Can mark orders as "Ready"
- [ ] Can mark orders as "Completed"
- [ ] Order status updates in real-time
- [ ] Can view order details
- [ ] Can see customizations for each item
- [ ] Can see special notes
- [ ] Orders grouped by table

### 6. Live Bills Management
- [ ] Can view all active sessions
- [ ] Can see orders for each table
- [ ] Can edit order quantities (+/-)
- [ ] Can apply discounts (percentage/fixed)
- [ ] Can create manual orders
- [ ] Can select table for manual order
- [ ] Can print bills
- [ ] Bill shows correct totals
- [ ] Bill shows tax calculation
- [ ] Bill shows discount if applied
- [ ] Can close sessions

### 7. Past Bills & Accounts
- [ ] Can view past bills
- [ ] Can filter by date range
- [ ] Can search by table/session
- [ ] Revenue totals calculate correctly
- [ ] Can export data
- [ ] Currency displays as €

### 8. Settings
- [ ] Can update restaurant name
- [ ] Can update tax rate
- [ ] Can update logo
- [ ] Settings save correctly
- [ ] Settings persist after logout

---

## Customer Experience Testing

### 1. QR Code Scanning
- [ ] QR code scans successfully on iPhone
- [ ] QR code scans successfully on Android
- [ ] Opens correct signup page
- [ ] Table ID passed correctly in URL
- [ ] No Vercel login required

### 2. Customer Signup
- [ ] Signup page loads correctly
- [ ] Can enter name
- [ ] Can enter phone number
- [ ] Form validation works
- [ ] Can submit signup
- [ ] Redirects to menu after signup
- [ ] Session created in database

### 3. Menu Browsing
- [ ] Menu loads all items
- [ ] Images display correctly
- [ ] Prices show in € 
- [ ] Categories display correctly
- [ ] Can search menu items
- [ ] Can filter by dietary preferences
- [ ] Can filter by Chef's Special
- [ ] Can filter by Bestseller
- [ ] Spice level indicators show
- [ ] Dietary badges display (vegan, vegetarian, gluten-free)

### 4. Item Customization
- [ ] "Customisable" text shows for items with options
- [ ] Clicking item opens customization modal
- [ ] Customization groups display correctly
- [ ] Radio buttons for single selection
- [ ] Checkboxes for multiple selection
- [ ] Prices update when selecting options
- [ ] Can add special notes
- [ ] Can add to cart with customizations

### 5. Cart Management
- [ ] Can add items to cart
- [ ] Cart icon shows item count
- [ ] Can view cart
- [ ] Can increase/decrease quantities
- [ ] Can remove items
- [ ] Subtotal calculates correctly
- [ ] Customizations display in cart
- [ ] Special notes display in cart

### 6. Order Placement
- [ ] Can place order from cart
- [ ] Order confirmation shows
- [ ] Cart clears after order
- [ ] Order appears in Kitchen immediately
- [ ] Can place multiple orders

### 7. Order Tracking
- [ ] Can view "My Orders"
- [ ] Order status updates in real-time
- [ ] Shows "Pending" → "Preparing" → "Ready"
- [ ] Can see order details
- [ ] Can see customizations
- [ ] Past orders display correctly

### 8. Bill Request
- [ ] "Ready to Pay" button visible
- [ ] Can request bill
- [ ] Bill shows all orders
- [ ] Bill shows correct totals
- [ ] Bill shows tax
- [ ] Bill shows discounts (if applied)
- [ ] Can view bill as PDF

---

## Cross-Device Testing

### Desktop
- [ ] Chrome browser
- [ ] Firefox browser
- [ ] Safari browser
- [ ] Edge browser

### Mobile
- [ ] iPhone (Safari)
- [ ] iPhone (Chrome)
- [ ] Android (Chrome)
- [ ] Android (Firefox)

### Tablet
- [ ] iPad
- [ ] Android tablet

---

## Performance Testing

- [ ] Pages load within 3 seconds
- [ ] Real-time updates work smoothly
- [ ] No lag when adding items to cart
- [ ] Images load quickly
- [ ] QR codes generate quickly
- [ ] No console errors in browser

---

## Security Testing

- [ ] Admin routes require authentication
- [ ] Cannot access admin without login
- [ ] Customer cannot access admin panel
- [ ] Firebase security rules prevent unauthorized access
- [ ] No sensitive data in URLs
- [ ] No credentials visible in login page

---

## Data Integrity Testing

- [ ] Orders save correctly to Firestore
- [ ] Sessions track correctly
- [ ] Customer data saves properly
- [ ] Menu items update in real-time
- [ ] Table status updates correctly
- [ ] No data loss on page refresh

---

## Edge Cases

- [ ] Empty cart behavior
- [ ] No menu items available
- [ ] No tables configured
- [ ] Invalid QR code URL
- [ ] Network disconnection handling
- [ ] Multiple customers at same table
- [ ] Concurrent orders from same table
- [ ] Very long item names
- [ ] Very long customization names
- [ ] Many customization options (20+)
- [ ] Large order quantities (99+)

---

## Final Production Checklist

- [ ] All features tested and working
- [ ] No console errors
- [ ] No broken images
- [ ] All links working
- [ ] Currency displays correctly (€)
- [ ] Tax calculations correct
- [ ] QR codes printed and laminated
- [ ] QR codes placed at tables
- [ ] Staff trained on admin panel
- [ ] Admin credentials secured
- [ ] Firebase security rules updated
- [ ] Vercel deployment protection disabled
- [ ] Custom domain configured (optional)
- [ ] Backup plan in place

---

## Post-Launch Monitoring

### Week 1
- [ ] Monitor order flow
- [ ] Check for errors in logs
- [ ] Verify real-time updates
- [ ] Collect staff feedback
- [ ] Collect customer feedback

### Week 2-4
- [ ] Review analytics
- [ ] Optimize slow queries
- [ ] Fix any reported bugs
- [ ] Add requested features

---

## Support Contacts

**Firebase Console:** https://console.firebase.google.com/project/qr-ordering-system-c80d4

**Vercel Dashboard:** https://vercel.com/pranavsunil-3491s-projects/qr-restaurant-ordering

**GitHub Repository:** https://github.com/pranav9sunil/New-QR_Menu

---

## Notes

Use this checklist before launch and periodically after deployment to ensure everything is working correctly.

**Status Key:**
- ✅ = Tested and working
- ❌ = Failed / Needs fixing
- ⚠️ = Partially working / Needs attention
- ⏭️ = Skipped / Not applicable
