# Firebase Restaurant Document Setup

## The Issue
The table layout page is not showing because the app cannot find the restaurant document in Firebase Firestore.

## What the Automated Test Found
The Puppeteer test revealed:
- Console log: "Restaurant rest_001 not found in Firebase"
- `restaurantId` remains `undefined` after login
- TableLayoutDesigner shows error: "Restaurant ID not found"

## Solution: Create the Restaurant Document

### Step 1: Open Firebase Console
1. Go to https://console.firebase.google.com
2. Select your project: **qr-ordering-system-c80d4**

### Step 2: Navigate to Firestore Database
1. Click on **Firestore Database** in the left sidebar
2. If you see "Get started", click it to enable Firestore
3. Choose **Start in test mode** (for development)

### Step 3: Create the Restaurant Document
1. Click **+ Start collection**
2. Collection ID: `restaurants`
3. Click **Next**
4. Document ID: `rest_001` (must be exactly this)
5. Add the following fields:

| Field Name | Type | Value |
|------------|------|-------|
| name | string | The Gourmet Kitchen |
| taxRate | number | 0.08 |
| currency | string | USD |
| isActive | boolean | true |
| layoutConfigured | boolean | false |

6. Click **Save**

### Step 4: Verify Document Was Created
You should see the document `rest_001` in the `restaurants` collection with all fields.

### Step 5: Test the App
1. Refresh the admin app in your browser
2. Log in with your credentials
3. Check the browser console - you should see:
   ```
   Restaurant found: {name: 'The Gourmet Kitchen', ...}
   RestaurantId set to: rest_001
   ```
4. The Table Layout Designer page should now load properly

## Expected Behavior After Fix
1. ✅ Login page appears
2. ✅ After login, app fetches restaurant document
3. ✅ `restaurantId` is set to 'rest_001'
4. ✅ User is redirected to `/layout` (table layout page)
5. ✅ TableLayoutDesigner component renders with Add Table button
6. ✅ User can drag and drop tables on the canvas
7. ✅ After saving layout, other pages become accessible

## Troubleshooting

### If you still see "Restaurant not found":
1. Double-check the document ID is exactly `rest_001` (case-sensitive)
2. Verify the collection name is `restaurants` (plural)
3. Check Firebase Console → Firestore → Rules - ensure you have read/write access
4. Clear browser cache and refresh

### If Firestore is not enabled:
1. Go to Firebase Console
2. Click "Firestore Database"
3. Click "Create database"
4. Select "Start in test mode"
5. Choose your preferred location
6. Click "Enable"

### Check Firestore Security Rules
Your rules should allow authenticated users to read/write:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Next Steps After Restaurant Document is Created
1. **Configure Table Layout**: Add tables by dragging them onto the canvas
2. **Save Layout**: Click "Save Layout" button (sets `layoutConfigured: true`)
3. **Generate QR Codes**: Navigate to QR Codes page to generate codes for each table
4. **Test Customer App**: Use QR codes to test the customer ordering flow

## Files Modified to Add Better Error Handling
- `/admin-app/src/App.js` - Added comprehensive error UI with instructions
- Added debug logging throughout authentication and restaurant fetch
- Created this documentation to guide the setup process
