import React, { useEffect, useMemo, useState } from 'react';
import { Car, Check, ChevronDown, DollarSign, Eye, EyeOff, LayoutGrid, Moon, RefreshCw, Save, Settings, Sun, Terminal, Trash2, Wallet } from 'lucide-react';
import WashTechLogo from '../components/WashTechLogo';

type Section = 'operations' | 'captains' | 'finance' | 'settings';
type Session = { token: string; role: 'admin'; id: string; name: string };
type Driver = { id: string; name: string; code: string; phone?: string; token?: string };
type Booking = {
  id: string;
  name: string;
  phone: string;
  neighborhood: string;
  carType: string;
  package: string;
  date: string;
  slot: string;
  status: string;
  driverId?: string;
  createdAt: string;
  financials?: { totalAmount: number; captainShare: number; companyShare: number };
};
type FinanceOverview = {
  totalRevenue: number;
  companyRevenue: number;
  captainPayouts: number;
  completedCount: number;
};
type FinanceCaptain = {
  id: string;
  name: string;
  phone?: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalCollected?: number;
};

const STORAGE_KEY = 'wt_backoffice';
const ACTIVE_STATUSES = ['approved', 'accepted', 'on_process', 'on_road'];
const DEFAULT_PRICES: Record<string, number> = {
  basic: 15000,
  standard: 25000,
  premium: 35000,
  'أساسي': 15000,
  'قياسي': 25000,
  'ممتاز': 35000,
};

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (!session) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `منذ ${diff} ث`;
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    accepted: 'bg-blue-100 text-blue-700',
    on_process: 'bg-blue-100 text-blue-700',
    on_road: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-slate-100 text-slate-700',
    closed: 'bg-slate-100 text-slate-600',
    rejected: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    pending: 'انتظار',
    approved: 'مقبول',
    accepted: 'تم الاستلام',
    on_process: 'جاري',
    on_road: 'في الطريق',
    completed: 'مكتمل',
    closed: 'مغلق',
    rejected: 'مرفوض',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls[status] || 'bg-slate-100 text-slate-700'}`}>{labels[status] || status}</span>;
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">{icon}<span>{label}</span></div>
      <div className="text-base font-bold text-slate-900 dark:text-white" dir="ltr">{value}</div>
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function DriverSelect({ drivers, value, onChange }: { drivers: Driver[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
      >
        {drivers.map(driver => (
          <option key={driver.id} value={driver.id}>{driver.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر تسجيل الدخول');
      } else {
        const session: Session = { token: data.token, role: 'admin', id: data.admin.id, name: data.admin.name };
        saveSession(session);
        onLogin(session);
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    }
    setLoading(false);
  }

  return (
    <div dir="rtl" className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6"><WashTechLogo size={32} /></div>
        <h1 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">لوحة التحكم</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">تسجيل دخول الإدارة</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? '...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BackofficeDashboard() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [section, setSection] = useState<Section>('operations');
  const [dark, setDark] = useState(() => localStorage.getItem('wt_dark') === '1');
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverFilter, setDriverFilter] = useState('all');
  const [bookingTab, setBookingTab] = useState<'pending' | 'active' | 'completed' | 'rejected'>('pending');
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [newDriver, setNewDriver] = useState({ name: '', code: '', phone: '' });
  const [message, setMessage] = useState('');
  const [finOverview, setFinOverview] = useState<FinanceOverview | null>(null);
  const [finCaptains, setFinCaptains] = useState<FinanceCaptain[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [financeConfig, setFinanceConfig] = useState({ captainSharePct: 70, basic: 15000, standard: 25000, premium: 35000 });
  const [appConfig, setAppConfig] = useState({ appName: 'WashTech', tagline: '', supportPhone: '', managerPhone: '', automationEnabled: true, wasenderToken: '', adminPassword: '' });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('wt_dark', dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    if (session) setSection('operations');
  }, [session]);

  async function authFetch(url: string, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
    if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetch(url, { ...init, headers });
    if (res.status === 401) {
      saveSession(null);
      setSession(null);
      throw new Error('Unauthorized');
    }
    return res;
  }

  async function loadCore() {
    setLoading(true);
    try {
      const [bookingRes, driverRes] = await Promise.all([fetch('/api/bookings'), fetch('/api/drivers')]);
      const bookingData = await bookingRes.json();
      const driverData = await driverRes.json();
      setBookings(bookingData.bookings || []);
      setDrivers(driverData.drivers || []);

      const [financeRes, financeConfigRes, appConfigRes] = await Promise.all([
        authFetch('/api/admin/finance-overview'),
        authFetch('/api/admin/settings/finance_config'),
        authFetch('/api/admin/settings/app_config'),
      ]);
      const financeData = await financeRes.json();
      const financeConfigData = await financeConfigRes.json();
      const appConfigData = await appConfigRes.json();
      setFinOverview(financeData.overview || null);
      setFinCaptains(financeData.captains || []);
      if (financeConfigData?.value) {
        setFinanceConfig({
          captainSharePct: Math.round((financeConfigData.value.captainSharePct || 0.7) * 100),
          basic: financeConfigData.value.packagePrices?.basic || 15000,
          standard: financeConfigData.value.packagePrices?.standard || 25000,
          premium: financeConfigData.value.packagePrices?.premium || 35000,
        });
      }
      if (appConfigData?.value) setAppConfig(prev => ({ ...prev, ...appConfigData.value }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  }, [session]);

  useEffect(() => {
    if (session) loadCore();
  }, [session]);

  const visibleNav = useMemo(
    () => ([
      { key: 'operations', label: 'العمليات', icon: <LayoutGrid size={20} strokeWidth={1.5} /> },
      { key: 'captains', label: 'الكباتن', icon: <Car size={20} strokeWidth={1.5} /> },
      { key: 'finance', label: 'المالية', icon: <Wallet size={20} strokeWidth={1.5} /> },
      { key: 'settings', label: 'الإعدادات', icon: <Settings size={20} strokeWidth={1.5} /> },
    ]) as { key: Section; label: string; icon: React.ReactNode }[],
    [],
  );

  const priceMap = useMemo<Record<string, number>>(
    () => ({ ...DEFAULT_PRICES, basic: financeConfig.basic, standard: financeConfig.standard, premium: financeConfig.premium }),
    [financeConfig],
  );

  const filteredBookings = useMemo(() => {
    return bookings
      .filter(b =>
        bookingTab === 'pending' ? b.status === 'pending'
          : bookingTab === 'active' ? ACTIVE_STATUSES.includes(b.status)
          : bookingTab === 'completed' ? ['completed', 'closed'].includes(b.status)
          : b.status === 'rejected',
      )
      .filter(b => driverFilter === 'all' ? true : b.driverId === driverFilter);
  }, [bookings, bookingTab, driverFilter]);

  const summaryBookings = useMemo(
    () => bookings.filter(b => (driverFilter === 'all' ? true : b.driverId === driverFilter)),
    [bookings, driverFilter],
  );

  const summaryStats = useMemo(() => ({
    total: summaryBookings.length,
    active: summaryBookings.filter(b => ACTIVE_STATUSES.includes(b.status)).length,
    completed: summaryBookings.filter(b => ['completed', 'closed'].includes(b.status)).length,
    revenue: summaryBookings.reduce((sum, booking) => sum + (booking.financials?.totalAmount || priceMap[booking.package] || priceMap[booking.package?.toLowerCase()] || 0), 0),
  }), [summaryBookings, priceMap]);

  async function performManagerAction(bookingId: string, action: 'approve' | 'reject') {
    const driverId = selectedDrivers[bookingId] || drivers[0]?.id;
    const res = await authFetch('/api/manager/action', {
      method: 'POST',
      body: JSON.stringify({ bookingId, action, driverId }),
    });
    const data = await res.json();
    setMessage(data.success ? 'تم تحديث الحجز' : (data.error || 'تعذر تحديث الحجز'));
    await loadCore();
    setTimeout(() => setMessage(''), 2500);
  }

  async function createCaptain(e: React.FormEvent) {
    e.preventDefault();
    const res = await authFetch('/api/admin/create-driver', { method: 'POST', body: JSON.stringify(newDriver) });
    const data = await res.json();
    setMessage(data.success ? 'تمت إضافة الكابتن' : (data.error || 'تعذر الإضافة'));
    if (data.success) setNewDriver({ name: '', code: '', phone: '' });
    await loadCore();
  }

  async function deleteCaptain(id: string) {
    await authFetch(`/api/admin/driver/${id}`, { method: 'DELETE' });
    await loadCore();
  }

  async function saveSettings() {
    setSettingsLoading(true);
    await Promise.all([
      authFetch('/api/admin/settings/finance_config', {
        method: 'POST',
        body: JSON.stringify({
          value: {
            captainSharePct: financeConfig.captainSharePct / 100,
            packagePrices: { basic: financeConfig.basic, standard: financeConfig.standard, premium: financeConfig.premium },
          },
        }),
      }),
      authFetch('/api/admin/settings/app_config', {
        method: 'POST',
        body: JSON.stringify({ value: appConfig }),
      }),
    ]);
    setSettingsLoading(false);
    setMessage('تم حفظ الإعدادات');
    setTimeout(() => setMessage(''), 2500);
  }

  async function resetData() {
    if (!window.confirm('سيتم حذف الحجوزات الحالية وإعادة ضبط البيانات. هل أنت متأكد؟')) return;
    await authFetch('/api/admin/reset', { method: 'POST' });
    await loadCore();
    setMessage('تمت إعادة الضبط');
    setTimeout(() => setMessage(''), 2500);
  }

  if (!session) return <LoginScreen onLogin={setSession} />;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <WashTechLogo size={32} />
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <div>{session.name}</div>
            <div>إدارة كاملة</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDark(v => !v)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={loadCore} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { saveSession(null); setSession(null); }}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
          >
            خروج
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden h-[calc(100vh-65px)] w-56 flex-col gap-1 border-l border-slate-200 bg-white p-3 lg:flex dark:border-slate-700 dark:bg-slate-900">
          {visibleNav.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                section === item.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </aside>

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 lg:p-6">
          <nav className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
            {visibleNav.map(item => (
              <FilterChip key={item.key} active={section === item.key} onClick={() => setSection(item.key)}>
                {item.label}
              </FilterChip>
            ))}
          </nav>

          {message && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

          {section === 'operations' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="إجمالي الطلبات" value={String(summaryStats.total)} icon={<LayoutGrid className="h-4 w-4 text-slate-500" />} />
                <StatCard label="نشطة" value={String(summaryStats.active)} icon={<RefreshCw className="h-4 w-4 text-blue-500" />} />
                <StatCard label="مكتملة" value={String(summaryStats.completed)} icon={<Check className="h-4 w-4 text-green-500" />} />
                <StatCard label="قيمة الطلبات" value={`${summaryStats.revenue.toLocaleString('ar-IQ')} د.ع`} icon={<DollarSign className="h-4 w-4 text-emerald-500" />} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">تصفية حسب الكابتن</p>
                <div className="flex gap-2 overflow-x-auto">
                  <FilterChip active={driverFilter === 'all'} onClick={() => setDriverFilter('all')}>كل الكباتن</FilterChip>
                  {drivers.map(driver => (
                    <FilterChip key={driver.id} active={driverFilter === driver.id} onClick={() => setDriverFilter(driver.id)}>
                      {driver.name}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto">
                {([
                  ['pending', 'قيد الانتظار'],
                  ['active', 'نشطة'],
                  ['completed', 'مكتملة'],
                  ['rejected', 'مرفوضة'],
                ] as const).map(([key, label]) => (
                  <FilterChip key={key} active={bookingTab === key} onClick={() => setBookingTab(key)}>
                    {label}
                  </FilterChip>
                ))}
              </div>

              <div className="space-y-3">
                {filteredBookings.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                    لا توجد حجوزات
                  </div>
                )}
                {filteredBookings.map(booking => {
                  const amount = booking.financials?.totalAmount || priceMap[booking.package] || priceMap[booking.package?.toLowerCase()] || 0;
                  return (
                    <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{booking.name}</span>
                            <StatusBadge status={booking.status} />
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{booking.phone} · {booking.neighborhood}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{booking.carType} · {booking.package}</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{booking.date === 'today' ? 'اليوم' : booking.date === 'tomorrow' ? 'غداً' : booking.date} · {booking.slot}</p>
                          <p className="text-sm font-bold text-green-700 dark:text-green-400">{amount.toLocaleString('ar-IQ')} د.ع</p>
                          {booking.driverId && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">{drivers.find(d => d.id === booking.driverId)?.name || 'كابتن'}</p>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500">#{booking.id.slice(-8)} · {timeAgo(booking.createdAt)}</p>
                        </div>

                        {booking.status === 'pending' && (
                          <div className="min-w-[180px] space-y-2">
                            <DriverSelect
                              drivers={drivers}
                              value={selectedDrivers[booking.id] || drivers[0]?.id || ''}
                              onChange={id => setSelectedDrivers(prev => ({ ...prev, [booking.id]: id }))}
                            />
                            <button
                              onClick={() => performManagerAction(booking.id, 'approve')}
                              className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                            >
                              قبول
                            </button>
                            <button
                              onClick={() => performManagerAction(booking.id, 'reject')}
                              className="w-full rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              رفض
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {section === 'captains' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">إضافة كابتن</h2>
                <form onSubmit={createCaptain} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={newDriver.name} onChange={e => setNewDriver(prev => ({ ...prev, name: e.target.value }))} placeholder="الاسم" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                    <input value={newDriver.code} onChange={e => setNewDriver(prev => ({ ...prev, code: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="الكود" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white sm:w-28" />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={newDriver.phone} onChange={e => setNewDriver(prev => ({ ...prev, phone: e.target.value }))} placeholder="07XXXXXXXXX" dir="ltr" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                    <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">إضافة</button>
                  </div>
                </form>
              </div>

              <div className="space-y-2">
                {drivers.map(driver => (
                  <div key={driver.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{driver.name}</p>
                      <p className="text-xs text-slate-400">{driver.code}{driver.phone ? ` · ${driver.phone}` : ''}</p>
                    </div>
                    <button onClick={() => deleteCaptain(driver.id)} className="rounded-lg p-2 text-slate-300 transition-colors hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'finance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="إجمالي الإيرادات" value={String(finOverview?.totalRevenue?.toLocaleString('ar-IQ') || 0)} icon={<DollarSign className="h-4 w-4 text-green-500" />} />
                <StatCard label="حصة الشركة" value={String(finOverview?.companyRevenue?.toLocaleString('ar-IQ') || 0)} icon={<Wallet className="h-4 w-4 text-emerald-500" />} />
                <StatCard label="حصة الكباتن" value={String(finOverview?.captainPayouts?.toLocaleString('ar-IQ') || 0)} icon={<Car className="h-4 w-4 text-blue-500" />} />
                <StatCard label="مكتملة" value={String(finOverview?.completedCount || 0)} icon={<Check className="h-4 w-4 text-slate-500" />} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                  <h2 className="font-bold text-slate-900 dark:text-white">ملخص الكباتن</h2>
                </div>
                {finCaptains.map(captain => (
                  <div key={captain.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 px-5 py-3 text-sm last:border-0 dark:border-slate-700">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{captain.name}</p>
                      {captain.phone && <p className="text-xs text-slate-400" dir="ltr">{captain.phone}</p>}
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div><p className="text-slate-400">الرصيد</p><p dir="ltr" className="font-bold text-slate-700 dark:text-slate-300">{captain.balance.toLocaleString('ar-IQ')}</p></div>
                      <div><p className="text-slate-400">المكتسب</p><p dir="ltr" className="font-bold text-blue-600">{captain.totalEarned.toLocaleString('ar-IQ')}</p></div>
                      <div><p className="text-slate-400">المستلم</p><p dir="ltr" className="font-bold text-green-600">{(captain.totalCollected || 0).toLocaleString('ar-IQ')}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'settings' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Terminal size={18} /> إعدادات التطبيق</h2>
                <div className="space-y-3">
                  <input value={appConfig.appName} onChange={e => setAppConfig(prev => ({ ...prev, appName: e.target.value }))} placeholder="اسم التطبيق" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={appConfig.tagline} onChange={e => setAppConfig(prev => ({ ...prev, tagline: e.target.value }))} placeholder="الوصف" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={appConfig.supportPhone} onChange={e => setAppConfig(prev => ({ ...prev, supportPhone: e.target.value }))} placeholder="رقم الدعم" dir="ltr" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={appConfig.managerPhone} onChange={e => setAppConfig(prev => ({ ...prev, managerPhone: e.target.value }))} placeholder="رقم إشعارات الإدارة" dir="ltr" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={appConfig.wasenderToken} onChange={e => setAppConfig(prev => ({ ...prev, wasenderToken: e.target.value }))} placeholder="Wasender token" dir="ltr" type="password" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={appConfig.adminPassword} onChange={e => setAppConfig(prev => ({ ...prev, adminPassword: e.target.value }))} placeholder="كلمة مرور الإدارة" dir="ltr" type="password" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">الأسعار</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input value={financeConfig.basic} onChange={e => setFinanceConfig(prev => ({ ...prev, basic: Number(e.target.value) }))} type="number" placeholder="أساسي" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={financeConfig.standard} onChange={e => setFinanceConfig(prev => ({ ...prev, standard: Number(e.target.value) }))} type="number" placeholder="قياسي" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  <input value={financeConfig.premium} onChange={e => setFinanceConfig(prev => ({ ...prev, premium: Number(e.target.value) }))} type="number" placeholder="ممتاز" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
                <div className="mt-3">
                  <input value={financeConfig.captainSharePct} onChange={e => setFinanceConfig(prev => ({ ...prev, captainSharePct: Number(e.target.value) }))} type="number" placeholder="نسبة الكابتن" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={saveSettings} disabled={settingsLoading} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  <Save size={14} />
                  {settingsLoading ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
                </button>
                <button onClick={resetData} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600">
                  <Trash2 size={14} />
                  إعادة ضبط البيانات
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
