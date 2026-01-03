import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import SalesPage from './pages/SalesPage';
import CashPage from './pages/CashPage';
import PendingPage from './pages/PendingPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Register from './pages/Register';
import CompleteRegistration from './pages/CompleteRegistration';
import RegistroEmpleado from './pages/RegistroEmpleado';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DeveloperPage from './pages/DeveloperPage';
import ActivateLicense from './pages/ActivateLicense';
import LandingPage from './pages/LandingPage';

import ScrollToTop from './components/ScrollToTop';
import { ProductProvider } from './context/ProductContext';
import { OrderProvider } from './context/OrderContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { AnalyticsProvider } from './context/AnalyticsContext'; // NEW
import NotificationToast from './components/NotificationToast';
import AuthListener from './components/AuthListener';


// Private Route Wrapper
const PrivateRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;

  return user ? <Outlet /> : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ThemeProvider>
          <ProductProvider>
            <OrderProvider>
              <BrowserRouter>
                <AuthListener />
                <AnalyticsProvider>
                  <ScrollToTop />
                  <NotificationToast />

                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/complete-registration" element={<CompleteRegistration />} />
                    <Route path="/registro-empleado" element={<RegistroEmpleado />} />
                    <Route path="/activar/:token" element={<ActivateLicense />} />

                    {/* Protected Routes */}
                    <Route element={<PrivateRoute />}>
                      <Route element={<MainLayout />}>
                        <Route path="/vender" element={<SalesPage />} />
                        <Route path="/caja" element={<CashPage />} />
                        <Route path="/pendientes" element={<PendingPage />} />
                        <Route path="/ajustes" element={<SettingsPage />} />
                        <Route path="/developer" element={<DeveloperPage />} />
                      </Route>
                    </Route>
                  </Routes>
                </AnalyticsProvider>
              </BrowserRouter>
            </OrderProvider>
          </ProductProvider>
        </ThemeProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;