import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import TableLayoutPage from './pages/admin/TableLayoutPage';
import QRCodePage from './pages/admin/QRCodePage';
import MenuManagementPage from './pages/admin/MenuManagementPage';
import CustomerLanding from './pages/customer/CustomerLanding';
import MenuOrderPage from './pages/customer/MenuOrderPage';
import CustomerSignup from './pages/customer/CustomerSignup';
import PastBillsPage from '@/pages/admin/PastBillsPage';
import KitchenPage from './pages/admin/KitchenPage';
import BarPage from './pages/admin/BarPage';
import AccountsPage from './pages/admin/AccountsPage';
import PrinterPage from './pages/admin/PrinterPage';
import LiveBillsPage from './pages/admin/LiveBillsPage';
import TPVPage from './pages/admin/TPVPage';
import ReservationsPage from './pages/admin/ReservationsPage';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<CustomerLanding />} />
            <Route path="/signup" element={<CustomerSignup />} />
            <Route path="/order" element={<MenuOrderPage />} />

            {/* Admin Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/layout" replace />} />
              <Route path="layout" element={<TableLayoutPage />} />
              <Route path="qr-codes" element={<QRCodePage />} />
              <Route path="menu" element={<MenuManagementPage />} />
              <Route path="kitchen" element={<KitchenPage />} />
              <Route path="bar" element={<BarPage />} />
              <Route path="live-bills" element={<LiveBillsPage />} />
              <Route path="tpv" element={<TPVPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="printers" element={<PrinterPage />} />
              <Route path="bills" element={<PastBillsPage />} />
              <Route path="reservations" element={<ReservationsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
