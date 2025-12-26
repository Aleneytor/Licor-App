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
import DeveloperPage from './pages/DeveloperPage';

import ScrollToTop from './components/ScrollToTop';
import { ProductProvider } from './context/ProductContext';
import { OrderProvider } from './context/OrderContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { AnalyticsProvider } from './context/AnalyticsContext'; // NEW
import NotificationToast from './components/NotificationToast';
import DevTools from './components/DevTools';

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
                <AnalyticsProvider>
                  <ScrollToTop />
                  <NotificationToast />
                  <DevTools />
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/complete-registration" element={<CompleteRegistration />} />

                    {/* Protected Routes */}
                    <Route element={<PrivateRoute />}>
                      <Route path="/" element={<MainLayout />}>
                        <Route index element={<Navigate to="/vender" replace />} />
                        <Route path="vender" element={<SalesPage />} />
                        <Route path="caja" element={<CashPage />} />
                        <Route path="pendientes" element={<PendingPage />} />
                        <Route path="ajustes" element={<SettingsPage />} />
                        <Route path="developer" element={<DeveloperPage />} /> {/* NEW */}
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