import React, { useState, useEffect, useRef } from 'react';
import { Check as IcCheck, X as IcX, RefreshCw as IcRefresh, ChevronDown, DollarSign as IcDollar, User as IcUser, Wallet as IcWallet, TrendingUp, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

type Booking = {
  id: string; name: string; phone: string; neighborhood: string;
  carType: string; package: string; date: string; slot: string;
  status: string; driverId?: string; createdAt: string;
  captainShare?: number; companyShare?: number; price?: number;
};
type Driver = { id: string; name: string; code: string };
type FinanceCaptain = { id: string; name: string; phone?: string; balance: number; totalEarned: number; totalWithdrawn: number };
type Tab = 'pending' | 'active' | 'completed' | 'rejected' | 'finance';

const STATUS_LABELS: Record<string, string> = {
  pending: 'انتظار', approved: 'مقبول', accepted: 'مقبول من الكابتن',
  on_process: 'جاري', on_road: 'في الطريق', completed: 'مكتمل',
  closed: 'مغلق', rejected: 'مرفوض',
};

const ACTIVE_STATUSES = ['approved', 'accepted', 'on_process', 'on_road'];

export default function ManagerDashboard() {
  const [bookings,        setBookings]        = useState<Booking[]>([]);
  const [drivers,         setDrivers]         = useState<Driver[]>([]);
  const [tab,             setTab]             = useState<Tab>('pending');
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(false);

  // Finance
  const [finCaptains,  setFinCaptains]  = useState<FinanceCaptain[]>([]);
  const [finOverview,  setFinOverview]  = useState<{ totalRevenue: number; companyRevenue: number; captainPayouts: number; completedCount: number } | null>(null);
  const [finLoading,   setFinLoading]   = useState(false);
  const [adjForm,      setAdjForm]      = useState<{ captainId: string; type: 'adjustment' | 'withdrawal'; amount: string; note: string }>({ captainId: '', type: 'adjustment', amount: '', note: '' });
  const [adjMsg,       setAdjMsg]       = useState('');
  const [adjLoading,   setAdjLoading]   = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    loadFinance();
    intervalRef.current = setInterval(() => load(), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (tab === 'finance') loadFinance();
  }, [tab]);

  async function load() {
    setLoading(true);
    const [bRes, dRes] = await Promise.all([fetch('/api/bookings'), fetch('/api/drivers')]);
    const bData = await bRes.json();
    const dData = await dRes.json();
    setBookings(bData.bookings || []);
    setDrivers(dData.drivers || []);
    setLoading(false);
  }

  async function loadFinance() {
    setFinLoading(true);
    try {
      const [ov, ca] = await Promise.all([
        fetch('/api/manager/finance/overview').then(r => r.json()),
        fetch('/api/manager/finance/captains').then(r => r.json()),
      ]);
      setFinOverview(ov);
      setFinCaptains(ca.captains || []);
      if (ca.captains?.length && !adjForm.captainId) {
        setAdjForm(p => ({ ...p, captainId: ca.captains[0].id }));
      }
    } catch {}
    setFinLoading(false);
  }

  async function action(bookingId: string, act: 'approve' | 'reject') {
    const driverId = selectedDrivers[bookingId] || drivers[0]?.id;
    await fetch('/api/manager/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, action: act, driverId }),
    });
    load();
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjForm.captainId || !adjForm.amount) return;
    setAdjLoading(true); setAdjMsg('');
    const res = await fetch('/api/captain/transaction', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: adjForm.captainId, type: adjForm.type, amount: Number(adjForm.amount), note: adjForm.note }),
    });
    const d = await res.json();
    setAdjMsg(d.success ? '✓ تم تحديث المحفظة' : (d.error || 'خطأ'));
    setAdjForm(p => ({ ...p, amount: '', note: '' }));
    setAdjLoading(false);
    loadFinance();
    setTimeout(() => setAdjMsg(''), 3000);
  }

  const bookingTabs = (['pending', 'active', 'completed', 'rejected'] as const);

  const filtered = bookings.filter(b =>
    tab === 'pending'    ? b.status === 'pending' :
    tab === 'active'     ? ACTIVE_STATUSES.includes(b.status) :
    tab === 'completed'  ? ['completed', 'closed'].includes(b.status) :
    tab === 'rejected'   ? b.status === 'rejected' : false
  );

  const counts = {
    pending:   bookings.filter(b => b.status === 'pending').length,
    active:    bookings.filter(b => ACTIVE_STATUSES.includes(b.status)).length,
    completed: bookings.filter(b => ['completed', 'closed'].includes(b.status)).length,
    rejected:  bookings.filter(b => b.status === 'rejected').length,
  };

  const completedB = bookings.filter(b => ['completed', 'closed'].includes(b.status));
  const totalRevenue   = completedB.reduce((s: number, b: any) => s + (b.financials?.totalAmount  || b.price || 0), 0);
  const companyRevenue = completedB.reduce((s: number, b: any) => s + (b.financials?.companyShare || b.companyShare || 0), 0);

  const BOOKING_TABS: { key: typeof bookingTabs[number]; label: string; color: string }[] = [
    { key: 'pending',   label: 'قيد الانتظار',  color: 'text-amber-600' },
    { key: 'active',    label: 'نشط',            color: 'text-blue-600' },
    { key: 'completed', label: 'مكتمل',          color: 'text-green-600' },
    { key: 'rejected',  label: 'مرفوض',          color: 'text-red-600' },
  ];

  const inp = 'w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white dark:bg-slate-700 dark:text-white transition';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">لوحة المدير</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{bookings.length} حجز إجمالي</p>
        </div>
        <button onClick={() => { load(); loadFinance(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" title="تحديث">
          <IcRefresh className={`w-5 h-5 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Revenue summary bar */}
      {totalRevenue > 0 && tab !== 'finance' && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 flex-wrap">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <IcDollar className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex gap-6 flex-wrap text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">إجمالي الإيرادات</p>
                <p className="font-bold text-slate-900 dark:text-white" dir="ltr">{totalRevenue.toLocaleString()} IQD</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">حصة الشركة (30%)</p>
                <p className="font-bold text-green-600" dir="ltr">{companyRevenue.toLocaleString()} IQD</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">حصة الكباتن (70%)</p>
                <p className="font-bold text-blue-600" dir="ltr">{(totalRevenue - companyRevenue).toLocaleString()} IQD</p>
              </div>
            </div>
            <button onClick={() => setTab('finance')} className="mr-auto text-xs text-blue-600 hover:underline font-medium">
              عرض التفاصيل المالية ←
            </button>
          </div>
        </div>
      )}

      {/* Main nav tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        {/* Finance tab button — shown separately */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          {BOOKING_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border px-4 py-2.5 text-center transition-all ${tab === t.key ? 'border-brand-500 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
            >
              <div className={`text-xl font-bold ${t.color}`}>{counts[t.key]}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.label}</div>
            </button>
          ))}
          {/* Finance tab */}
          <button
            onClick={() => setTab('finance')}
            className={`flex-shrink-0 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border px-4 py-2.5 text-center transition-all ${tab === 'finance' ? 'border-green-500 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
          >
            <IcWallet className={`w-5 h-5 ${tab === 'finance' ? 'text-green-600' : 'text-slate-400'}`} />
            <div>
              <div className={`text-xl font-bold ${tab === 'finance' ? 'text-green-600' : 'text-slate-500'}`}>{finCaptains.length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">المالية</div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Finance Tab ─────────────────────────────────────────── */}
      {tab === 'finance' && (
        <div className="max-w-4xl mx-auto px-4 pb-10 space-y-4">
          {/* Loading */}
          {finLoading && !finOverview && (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">جاري تحميل البيانات المالية...</p>
            </div>
          )}

          {/* Overview cards */}
          {finOverview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي الإيرادات', val: finOverview.totalRevenue,   cls: 'text-slate-900 dark:text-white',       icon: <TrendingUp     className="w-4 h-4 text-green-500" /> },
                { label: 'حصة الشركة',        val: finOverview.companyRevenue, cls: 'text-green-700 dark:text-green-400',   icon: <ArrowUpRight   className="w-4 h-4 text-green-500" /> },
                { label: 'حصة الكباتن',       val: finOverview.captainPayouts, cls: 'text-blue-700 dark:text-blue-400',    icon: <ArrowDownLeft  className="w-4 h-4 text-blue-500"  /> },
                { label: 'حجوزات مكتملة',     val: finOverview.completedCount, cls: 'text-slate-700 dark:text-slate-300',  icon: <IcCheck        className="w-4 h-4 text-slate-400"  />, noFormat: true },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-1.5 mb-1">{s.icon}<p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p></div>
                  <p className={`text-lg font-bold ${s.cls}`} dir="ltr">{(s as any).noFormat ? s.val : s.val.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-captain wallets */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <IcWallet className="w-4 h-4 text-green-600" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">محافظ الكباتن</h3>
            </div>
            {finCaptains.length === 0 && !finLoading && (
              <p className="text-center text-slate-400 text-sm py-8">لا يوجد كباتن بعد</p>
            )}
            {finCaptains.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 dark:border-slate-700 last:border-0 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">{c.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{c.name}</p>
                    {c.phone && <p className="text-xs text-slate-400 font-mono" dir="ltr">{c.phone}</p>}
                  </div>
                </div>
                <div className="flex gap-5 text-xs">
                  <div className="text-center">
                    <p className="text-slate-400 mb-0.5">الرصيد</p>
                    <p className="font-bold text-green-600" dir="ltr">{c.balance.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 mb-0.5">مكتسب</p>
                    <p className="font-bold text-blue-600" dir="ltr">{c.totalEarned.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 mb-0.5">مسحوب</p>
                    <p className="font-bold text-red-500" dir="ltr">{c.totalWithdrawn.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Manual adjustment */}
          {finCaptains.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4 flex items-center gap-2">
                <IcDollar className="w-4 h-4 text-blue-500" />
                تسوية مالية يدوية
              </h3>
              <form onSubmit={submitAdjustment} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={adjForm.captainId} onChange={e => setAdjForm(p => ({ ...p, captainId: e.target.value }))} className={inp + ' appearance-none'}>
                      {finCaptains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value as any }))} className={inp + ' appearance-none w-auto'}>
                      <option value="adjustment">إضافة رصيد</option>
                      <option value="withdrawal">سحب رصيد</option>
                    </select>
                    <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="number" placeholder="المبلغ (د.ع)" required min="1" value={adjForm.amount}
                    onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} className={inp + ' flex-1'} dir="ltr" />
                  <input placeholder="ملاحظة (اختياري)" value={adjForm.note}
                    onChange={e => setAdjForm(p => ({ ...p, note: e.target.value }))} className={inp + ' flex-1'} />
                </div>
                <button type="submit" disabled={adjLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
                  {adjLoading ? 'جاري...' : 'تطبيق التسوية'}
                </button>
                {adjMsg && <p className={`text-sm text-center font-medium ${adjMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{adjMsg}</p>}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Bookings Tab ─────────────────────────────────────────── */}
      {tab !== 'finance' && (
        <div className="max-w-4xl mx-auto px-4 pb-10 space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 dark:text-slate-500">
              لا توجد حجوزات
            </div>
          )}
          {filtered.map(b => (
            <div key={b.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white">{b.name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{b.phone} · {b.neighborhood}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{b.carType} · {b.package}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">
                    {b.date === 'today' ? 'اليوم' : 'غداً'} — {b.slot}
                  </p>
                  {b.driverId && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                      <IcUser className="w-3 h-3" />
                      {drivers.find(d => d.id === b.driverId)?.name || 'كابتن'}
                    </p>
                  )}
                  {(() => { const amt = (b as any).financials?.totalAmount || b.price || 0; return amt > 0 ? (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono">
                      {amt.toLocaleString()} IQD · كابتن {((b as any).financials?.captainShare || b.captainShare || 0).toLocaleString()} · شركة {((b as any).financials?.companyShare || b.companyShare || 0).toLocaleString()}
                    </p>
                  ) : null; })()}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">#{b.id.slice(-8)}</p>
                </div>

                {b.status === 'pending' && (
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <DriverSelect
                      drivers={drivers}
                      value={selectedDrivers[b.id] || drivers[0]?.id || ''}
                      onChange={id => setSelectedDrivers(p => ({ ...p, [b.id]: id }))}
                    />
                    <button
                      onClick={() => action(b.id, 'approve')}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <IcCheck className="w-4 h-4" /> قبول
                    </button>
                    <button
                      onClick={() => action(b.id, 'reject')}
                      className="w-full py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <IcX className="w-4 h-4" /> رفض
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending:    'bg-amber-100 text-amber-700',
    approved:   'bg-green-100 text-green-700',
    accepted:   'bg-brand-100 text-brand-700',
    rejected:   'bg-red-100 text-red-700',
    on_process: 'bg-blue-100 text-blue-700',
    on_road:    'bg-indigo-100 text-indigo-700',
    completed:  'bg-slate-100 text-slate-600',
    closed:     'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls[status] || 'bg-slate-100 text-slate-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function DriverSelect({ drivers, value, onChange }: {
  drivers: Driver[], value: string, onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false);
  const selected = drivers.find(d => d.id === value);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white hover:border-blue-400 transition-colors">
        <span>{selected?.name || 'اختر كابتن'}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
          {drivers.map(d => (
            <button key={d.id} type="button"
              onClick={() => { onChange(d.id); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-right text-sm hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ${value === d.id ? 'text-blue-600 font-semibold' : 'text-slate-900 dark:text-white'}`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
