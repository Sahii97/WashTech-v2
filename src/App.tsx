import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverView from './pages/DriverView';
import AdminDashboard from './pages/AdminDashboard';

function DevNav() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('superadmin') === 'false') return null;
  return (
    <nav className="bg-white border-b border-slate-200 px-4 py-2 flex gap-1 text-sm sticky top-0 z-50 shadow-sm">
      <span className="text-slate-400 text-xs font-mono self-center mr-2">v2.0</span>
      {[
        { to: '/', label: 'Booking' },
        { to: '/manager', label: 'Manager' },
        { to: '/driver', label: 'Driver' },
        { to: '/admin', label: 'Admin' },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DevNav />
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/driver" element={<DriverView />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
