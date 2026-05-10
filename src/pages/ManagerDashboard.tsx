import React, { useState, useEffect } from 'react';
import { IcCheck, IcX, IcRefresh } from '../icons';

type Booking = {
  id: string; name: string; phone: string; neighborhood: string;
  carType: string; package: string; date: string; slot: string;
  status: string; driverId?: string; createdAt: string;
};
type Driver = { id: string; name: string; code: string };
type Tab = 'pending' | 'approved' | 'rejected';

export default function ManagerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [bRes, dRes] = await Promise.all([fetch('/api/bookings'), fetch('/api/drivers')]);
    const bData = await bRes.json();
    const dData = await dRes.json();
    setBookings(bData.bookings || []);
    setDrivers(dData.drivers || []);
    setLoading(false);
  }

  async function action(bookingId: string, act: 'approve' | 'reject') {
    const driverId = selectedDrivers[bookingId] || drivers[0]?.id;
    await fetch('/api/manager/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, action: act, driverId }),
    });
    load();
  }

  const filtered = bookings.filter(b =>
    tab === 'pending' ? b.status === 'pending' :
    tab === 'approved' ? ['approved','on_process','completed'].includes(b.status) :
    b.status === 'rejected'
  );

  const counts = {
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => ['approved','on_process','completed'].includes(b.status)).length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">لوحة المدير</h1>
          <p className="text-sm text-slate-500">{bookings.length} حجز إجمالي</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="تحديث">
          <IcRefresh className={`w-5 h-5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 max-w-4xl mx-auto">
        {(['pending','approved','rejected'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`bg-white rounded-xl border p-4 text-center transition-all ${tab === t ? 'border-brand-500 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <div className={`text-2xl font-bold ${t === 'pending' ? 'text-amber-600' : t === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
              {counts[t]}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {t === 'pending' ? 'قيد الانتظار' : t === 'approved' ? 'مقبول' : 'مرفوض'}
            </div>
          </button>
        ))}
      </div>

      {/* Bookings list */}
      <div className="max-w-4xl mx-auto px-4 pb-10 space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            لا توجد حجوزات
          </div>
        )}
        {filtered.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900">{b.name}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-slate-500">{b.phone} · {b.neighborhood}</p>
                <p className="text-sm text-slate-500">{b.carType} · {b.package}</p>
                <p className="text-sm font-medium text-slate-700 mt-1">
                  {b.date === 'today' ? 'اليوم' : 'غداً'} — {b.slot}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono">#{b.id.slice(-8)}</p>
              </div>

              {b.status === 'pending' && (
                <div className="flex flex-col gap-2 min-w-[160px]">
                  <select
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={selectedDrivers[b.id] || drivers[0]?.id || ''}
                    onChange={e => setSelectedDrivers(p => ({ ...p, [b.id]: e.target.value }))}
                  >
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button
                    onClick={() => action(b.id, 'approve')}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <IcCheck className="w-4 h-4" /> قبول
                  </button>
                  <button
                    onClick={() => action(b.id, 'reject')}
                    className="w-full py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <IcX className="w-4 h-4" /> رفض
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    on_process: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-600',
  };
  const labels: Record<string, string> = {
    pending: 'انتظار', approved: 'مقبول', rejected: 'مرفوض',
    on_process: 'جاري', completed: 'مكتمل',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls[status] || 'bg-slate-100 text-slate-600'}`}>
      {labels[status] || status}
    </span>
  );
}
