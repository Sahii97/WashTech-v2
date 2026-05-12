import React, { useState, useEffect } from 'react';
import { Car as IcCar, Check as IcCheck, X as IcX, Play as IcPlay, Navigation as IcNav, Flag as IcFlag, AlertTriangle as IcWarning, ChevronDown } from 'lucide-react';

type Act = 'approve' | 'reject' | 'accept' | 'on_road' | 'complete';

const STATUS_AR: Record<string, string> = {
  pending:    'قيد الانتظار',
  approved:   'مقبول',
  accepted:   'تم القبول',
  rejected:   'مرفوض',
  on_process: 'في الطريق',
  on_road:    'في الطريق',
  completed:  'مكتمل',
  closed:     'مغلق',
};

export default function ActionPage() {
  const params = new URLSearchParams(window.location.search);
  const id  = params.get('id')  || '';
  const act = (params.get('act') || '') as Act;

  const [booking,    setBooking]    = useState<any>(null);
  const [drivers,    setDrivers]    = useState<any[]>([]);
  const [driverId,   setDriverId]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [done,       setDone]       = useState(false);
  const [result,     setResult]     = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) { setError('رابط غير صالح'); setLoading(false); return; }
    Promise.all([
      fetch(`/api/action?id=${id}`).then(r => r.json()),
      act === 'approve' ? fetch('/api/drivers').then(r => r.json()) : Promise.resolve({ drivers: [] }),
    ]).then(([bData, dData]) => {
      if (bData.error) { setError(bData.error); setLoading(false); return; }
      setBooking(bData.booking);
      const list = dData.drivers || [];
      setDrivers(list);
      if (list.length) setDriverId(list[0].id);
      setLoading(false);
    }).catch(() => { setError('فشل تحميل بيانات الحجز'); setLoading(false); });
  }, [id]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, act, driverId }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(data.error || 'لا يمكن تنفيذ هذا الإجراء على الحالة الحالية');
      } else if (data.success) {
        setDone(true); setResult(data.message);
      } else {
        setError(data.error || 'حدث خطأ');
      }
    } catch { setError('خطأ في الاتصال'); }
    setSubmitting(false);
  }

  const cfg: Record<Act, { title: string; btn: string; color: string; Icon: React.FC<{ className?: string }> }> = {
    approve:  { title: 'قبول الحجز',       btn: 'قبول وإرسال للكابتن',       color: 'bg-green-600 hover:bg-green-700', Icon: IcCheck },
    reject:   { title: 'رفض الحجز',        btn: 'رفض وإشعار العميل',         color: 'bg-red-500  hover:bg-red-600',   Icon: IcX },
    accept:   { title: 'قبول المهمة',      btn: 'قبول المهمة وإشعار العميل', color: 'bg-blue-600 hover:bg-blue-700',  Icon: IcPlay },
    on_road:  { title: 'الكابتن في الطريق', btn: 'تأكيد الانطلاق',            color: 'bg-indigo-600 hover:bg-indigo-700', Icon: IcNav },
    complete: { title: 'إتمام الخدمة',     btn: 'تأكيد الإتمام',             color: 'bg-teal-600 hover:bg-teal-700',  Icon: IcFlag },
  };
  const c = cfg[act];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center">
            <IcCar className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">WashTech</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{c?.title || 'إجراء'}</p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-500">جاري التحميل...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <IcWarning className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-sm text-brand-600 underline">
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-900 dark:text-white font-bold text-lg">{result}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">تم الإرسال عبر واتساب ✓</p>
          </div>
        )}

        {/* Booking & action */}
        {!loading && !error && !done && booking && (
          <>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-5 space-y-2.5 text-sm">
              {([
                ['العميل',  booking.name],
                ['الهاتف',  booking.phone],
                ['المنطقة', booking.neighborhood],
                ['السيارة', `${booking.carType} — ${booking.package}`],
                ['الموعد',  `${booking.date === 'today' ? 'اليوم' : 'غداً'} ${booking.slot}`],
                ['الحالة',  STATUS_AR[booking.status] || booking.status],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200" dir={label === 'الهاتف' ? 'ltr' : 'rtl'}>{val}</span>
                </div>
              ))}
            </div>

            {act === 'approve' && drivers.length > 0 && (
              <DriverDropdown drivers={drivers} value={driverId} onChange={setDriverId} />
            )}

            {act === 'approve' && drivers.length === 0 && (
              <p className="text-amber-600 text-sm mb-4 bg-amber-50 dark:bg-amber-950 rounded-xl p-3">
                ⚠️ لا يوجد كباتن. أضف كابتناً من لوحة الإدارة أولاً.
              </p>
            )}

            {(act !== 'approve' || drivers.length > 0) && (
              <button
                onClick={submit}
                disabled={submitting || (act === 'approve' && !driverId)}
                className={`w-full py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${c?.color}`}
              >
                {!submitting && c?.Icon && <c.Icon className="w-5 h-5" />}
                {submitting ? 'جاري المعالجة...' : c?.btn}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DriverDropdown({ drivers, value, onChange }: { drivers: any[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = drivers.find((d: any) => d.id === value);
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">اختر الكابتن</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all text-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-brand-700 dark:text-brand-300 font-bold text-sm">
                {selected?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">{selected?.name || 'اختر كابتن'}</p>
              {selected?.phone && <p className="text-xs text-slate-400 dark:text-slate-500 font-mono" dir="ltr">{selected.phone}</p>}
            </div>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-xl overflow-hidden">
            {drivers.map((d: any) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { onChange(d.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-right ${value === d.id ? 'bg-brand-50 dark:bg-brand-950' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${value === d.id ? 'bg-brand-200 dark:bg-brand-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  <span className={`font-bold text-sm ${value === d.id ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {d.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${value === d.id ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-white'}`}>{d.name}</p>
                  {d.phone && <p className="text-xs text-slate-400 dark:text-slate-500 font-mono" dir="ltr">{d.phone}</p>}
                </div>
                {value === d.id && <IcCheck size={14} className="text-brand-600 dark:text-brand-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
