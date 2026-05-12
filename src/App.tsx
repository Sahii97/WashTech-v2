import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import CaptainView from './pages/CaptainView';
import AdminDashboard from './pages/AdminDashboard';
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
  if (params.get('superadmin') === 'false') return null;
  const [dark, setDark] = useDark();
  return (
    <nav dir="rtl" className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center gap-1 text-sm sticky top-0 z-50 shadow-sm">
      {[
        { to: '/',        label: 'الحجز'    },
        { to: '/manager', label: 'المدير'   },
        { to: '/driver',  label: 'الكابتن'  },
        { to: '/admin',   label: 'الإدارة'  },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
      <button
        onClick={() => setDark(d => !d)}
        className="mr-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={dark ? 'وضع النهار' : 'الوضع الليلي'}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  );
}

export default function App() {
  useDark(); // apply dark class on mount
  return (
    <BrowserRouter>
      <DevNav />
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/driver" element={<CaptainView />} />
        <Route path="/captain" element={<CaptainView />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/action" element={<ActionPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
