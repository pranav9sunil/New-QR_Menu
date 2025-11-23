# QR Ordering System

A modern restaurant ordering system that eliminates the need for waitstaff by allowing customers to scan QR codes at their tables to place orders.

## Features

### Admin Dashboard
- 🔐 Secure Firebase authentication
- 📋 Table layout management with drag-and-drop
- 🔍 Zoom controls and dual view modes (simple/realistic)
- 📱 QR code generation and download
- 🍽️ Menu management (CRUD operations)
- 👥 User invitation system
- 📊 Responsive design for all devices

### Customer Interface
- 🏠 Beautiful landing page  
- 📄 PDF menu download
- 🛒 Shopping cart system
- 💰 Automatic tax calculation
- 📱 Mobile-first design

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Firestore + Authentication)
- **Routing**: React Router v6
- **QR Codes**: qrcode library
- **PDF**: jsPDF

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase account

### Installation

1. Clone the repository
```bash
cd frontend
npm install
```

2. Initialize Firebase data
   - Open `initialize-firebase.html` in a browser
   - Click "Initialize Firebase Data"
   - Wait for completion

3. Start the development server
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173)

### Login Credentials

```
Email: psunil@asu.edu
Password: user123
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── admin/       # Admin-specific components
│   │   ├── customer/    # Customer-facing components
│   │   ├── shared/      # Shared components
│   │   └── ui/          # shadcn UI components
│   ├── contexts/        # React contexts
│   ├── pages/           # Page components
│   │   ├── admin/       # Admin pages
│   │   └── customer/    # Customer pages
│   ├── config/          # Configuration files
│   ├── lib/             # Utility functions
│   ├── types/           # TypeScript types
│   └── App.tsx          # Main app component
└── public/              # Static assets
```

## Usage

### Admin Workflow

1. **Login**: Access the admin dashboard at `/login`
2. **Configure Tables**: Design your restaurant layout with drag-and-drop
3. **Manage Menu**: Add, edit, or remove menu items
4. **Generate QR Codes**: Create and download QR codes for tables
5. **Invite Users**: Add staff members to access the system

### Customer Workflow

1. **Landing Page**: Visit the restaurant website
2. **Scan QR Code**: Scan the code at your table (or use the link)
3. **Browse Menu**: View items by category
4. **Place Order**: Add items to cart and checkout
5. **Confirmation**: Receive order confirmation

## Firebase Collections

- `restaurants` - Restaurant information
- `users` - User profiles and roles
- `tables` - Table configurations
- `menu_items` - Menu items with prices
- `orders` - Customer orders
- `user_invitations` - Pending user invitations

## Development

### Running Tests

Testing can be done manually using the browser or automated with Selenium:

```bash
# Manual testing at http://localhost:5173
npm run dev

# Automated testing (future implementation)
npm run test:e2e
```

### Building for Production

```bash
npm run build
```

### Firebase Security Rules

Update Firestore rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Future Enhancements

- [ ] Order management dashboard for kitchen
- [ ] Real-time order status updates
- [ ] Payment integration (Stripe)
- [ ] Email notifications
- [ ] Analytics and reporting
- [ ] Multi-restaurant support
- [ ] Table reservations
- [ ] Dietary restrictions/allergen filters

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
