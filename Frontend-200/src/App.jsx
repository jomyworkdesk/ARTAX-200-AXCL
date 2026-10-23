import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from './components/Snackbar';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import ArtaxPortal from './pages/ArtaxPortal';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Purchase from './pages/Purchase';
import Errors from './pages/Errors';
import Failed from './pages/Failed';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Master from './pages/Master';
import Seller from './pages/Seller';
import Buyer from './pages/Buyer';
import LogFile from './pages/LogFile';

function App() {
  return (
    <SnackbarProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/artax-portal" element={<ArtaxPortal />} />
          
          {/* Main Application Routes guarded by Layout and ProtectedRoute */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="invoices" element={<Invoices initialDocumentType="invoice" />} />
              <Route path="creditnote" element={<Invoices initialDocumentType="creditNote" />} />
              <Route path="purchase" element={<Purchase initialDocumentType="purchase" />} />
              <Route path="ap-creditnote" element={<Purchase initialDocumentType="apCreditNote" />} />
              <Route path="issues" element={<Navigate to="/issues/errors" replace />} />
              <Route path="issues/errors" element={<Errors />} />
              <Route path="issues/failed" element={<Failed />} />
              <Route path="errors" element={<Errors />} />
              <Route path="failed" element={<Failed />} />
              <Route path="clients" element={<Clients />} />
              <Route path="settings" element={<Settings />} />
              <Route path="configure" element={<Navigate to="/configure/master" replace />} />
              <Route path="configure/master" element={<Master />} />
              <Route path="configure/seller" element={<Seller />} />
              <Route path="configure/buyer/*" element={<Buyer />} />
              <Route path="logs" element={<LogFile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SnackbarProvider>
  );
}

export default App;
