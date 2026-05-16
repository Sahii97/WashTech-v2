import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import BookingPage from './pages/BookingPage';
import CaptainView from './pages/CaptainView';
import BackofficeDashboard from './pages/BackofficeDashboard';
import ActionPage from './pages/ActionPage';
import TrackPage from './pages/TrackPage';

export function useDark() {
  const [dark, setDark] = useState(() => localStorage.getItem('wt_dark') === '1');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('wt_dark', dark ? '1' : '0');
  }, [dark]);
  return [dark, setDark] as const;
}

function DevNav() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('dev')) return null;
  const [dark, setDark] = useDark();

  return (
    <nav
      dir="rtl"
      className="sticky top-0 z-50 flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {[
        { to: '/', label: 'الحجز' },
        { to: '/driver', label: 'الكابتن' },
        { to: '/admin', label: 'لوحة التحكم' },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `rounded-lg px-3 py-1.5 font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
      <button
        onClick={() => setDark(d => !d)}
        className="mr-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        title={dark ? 'وضع النهار' : 'الوضع الليلي'}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  );
}

function ManagerRedirect() {
  const search = window.location.search;
  return <Navigate to={`/admin${search}`} replace />;
}

export default function App() {
  useDark();

  return (
    <BrowserRouter>
      <DevNav />
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/manager" element={<ManagerRedirect />} />
        <Route path="/driver" element={<CaptainView />} />
        <Route path="/captain" element={<CaptainView />} />
        <Route path="/admin" element={<BackofficeDashboard />} />
        <Route path="/action" element={<ActionPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
