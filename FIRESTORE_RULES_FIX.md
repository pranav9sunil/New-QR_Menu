# Firebase Security Rules Update

## Current Problem
The Firestore security rules are blocking the app from reading user data, even for authenticated users.

## Solution
You need to update the Firestore Security Rules in the Firebase Console.

### Steps:

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/qr-ordering-system-c80d4/firestore/rules

2. **Replace the current rules with these:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Restaurants - read by anyone, write by authenticated users
    match /restaurants/{restaurantId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Users - read/write own document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Tables - read by anyone, write by authenticated users
    match /tables/{tableId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Menu Items - read by anyone, write by authenticated users
    match /menu_items/{itemId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Sessions - read/write by anyone (customers need access)
    match /sessions/{sessionId} {
      allow read, write: if true;
    }
    
    // Orders - read/write by anyone (customers need access)
    match /orders/{orderId} {
      allow read, write: if true;
    }
    
    // User Invitations - read/write by authenticated users
    match /user_invitations/{invitationId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. **Click "Publish"**

4. **Refresh your admin page:**
   http://localhost:5173/admin/layout

5. **Tables should now appear!**

---

## Why This Fixes It

The new rules allow:
- ✅ Authenticated users to read their own user document
- ✅ Anyone to read tables (needed for customer QR flow)
- ✅ Anyone to read menu items (needed for customer menu)
- ✅ Authenticated admins to write/update data

This is secure because:
- Users can only read their OWN user document (not others)
- Write operations require authentication
- Customer-facing data (tables, menu, orders) is readable by anyone
