# Updated Firebase Security Rules - With Layouts Support

## Copy these rules to Firebase Console:

https://console.firebase.google.com/project/qr-ordering-system-c80d4/firestore/rules

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
    
    // Layouts - read by anyone, write by authenticated users
    match /layouts/{layoutId} {
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
      
      // Customers subcollection - read/write by anyone
      match /customers/{customerId} {
        allow read, write: if true;
      }
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

## The Key Change:

Added this section for `layouts`:
```javascript
// Layouts - read by anyone, write by authenticated users
match /layouts/{layoutId} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

## Steps:
1. Go to Firebase Console (link above)
2. Replace ALL the rules with the new ones above
3. Click "Publish"
