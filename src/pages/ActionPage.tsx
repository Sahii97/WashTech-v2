import React, { useState, useEffect } from 'react';

type Act = 'approve' | 'reject' | 'accept';

const STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
  on_process: 'في الطريق',
  completed: 'مكتمل',
};

export default function ActionPage() {
  const params = new URLSearchParams(window.location.search);
  const id  = params.get('id')  || '';
  const act = (params.get('act') || '') as Act;

  const [booking,  setBooking]  = useState<any>(null);
  const [drivers,  setDrivers]  = useState<any[]>([]);
  const [driverId, setDriverId] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [done,     setDone]     = useState(false);
  const [result,   setResult]   = useState('');
  const [error,    setError]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) { setError('رابط غير صالح'); setLoading(false); return; }
    Promise.all([
      fetch(`/api/action?id=${id}`).then(r => r.json()),
      act === 'approve' ? fetch('/api/drivers').then(r => r.json()) : Promise.resolve({ drivers: [] }),
    ]).then(([bData, dData]) => {
      if (bData.error) { setError(bData.error); setLoading(false); return; }
      setBooking(bData.booking);
      const driversList = dData.drivers || [];
      setDrivers(driversList);
      if (driversList.length) setDriverId(driversList[0].id);
      setLoading(false);
    }).catch(() => { setError('فشل تحميل البيانات'); setLoading(false); });
  }, [id, act]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, act, driverId }),
      });
      const data = await res.json();
      if (data.success) { setDone(true); setResult(data.message); }
      else setError(data.error || 'حدث خطأ');
    } catch { setError('خطأ في الاتصال'); }
    setSubmitting(false);
  }

  const actionConfig = {
    approve: { title: 'قبول الحجز', btn: 'قبول وإرسال للسائق', color: 'bg-green-600 hover:bg-green-700' },
    reject:  { title: 'رفض الحجز',  btn: 'رفض وإشعار العميل',  color: 'bg-red-500 hover:bg-red-600'   },
    accept:  { title: 'قبول المهمة', btn: 'قبول المهمة وإشعار العميل', color: 'bg-blue-600 hover:bg-blue-700' },
  };
  const cfg = actionConfig[act];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center">
            <span className="text-xl">🚗</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">WashTech</h1>
            <p className="text-sm text-slate-500">{loading ? 'جاري التحميل...' : cfg?.title || 'إجراء'}</p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8 text-slate-400">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">جاري التحميل...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        {done && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-900 font-bold text-lg">{result}</p>
            <p className="text-slate-500 text-sm mt-2">تم الإرسال عبر واتساب</p>
          </div>
        )}

        {!loading && !error && !done && booking && (
          <>
            {/* Booking summary */}
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">العميل</span>
                <span className="font-semibold text-slate-900">{booking.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">الهاتف</span>
                <span className="font-mono text-slate-900" dir="ltr">{booking.phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">المنطقة</span>
                <span className="font-semibold text-slate-900">{booking.neighborhood}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">السيارة</span>
                <span className="font-semibold text-slate-900">{booking.carType} — {booking.package}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">الموعد</span>
                <span className="font-semibold text-slate-900">{booking.date === 'today' ? 'اليوم' : 'غداً'} {booking.slot}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="text-slate-500">الحالة</span>
                <span className="font-semibold text-slate-700">{STATUS_AR[booking.status] || booking.status}</span>
              </div>
            </div>

            {/* Driver picker (approve only) */}
            {act === 'approve' && drivers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">اختر السائق</label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.phone || 'لا يوجد هاتف'}</option>
                  ))}
                </select>
              </div>
            )}

            {act === 'approve' && drivers.length === 0 && (
              <p className="text-amber-600 text-sm mb-4 bg-amber-50 rounded-xl p-3">
                لا يوجد سائقون متاحون. أضف سائقاً من لوحة الإدارة أولاً.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {(act !== 'approve' || drivers.length > 0) && (
                <button
                  onClick={submit}
                  disabled={submitting || (act === 'approve' && !driverId)}
                  className={`w-full py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 ${cfg?.color}`}
                >
                  {submitting ? 'جاري المعالجة...' : cfg?.btn}
                </button>
              )}
              {act === 'reject' && (
                <button
                  onClick={() => window.history.back()}
                  className="w-full py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
