import React, { useState, useEffect } from 'react';

type Act = 'approve' | 'reject' | 'accept';

const STATUS_AR: Record<string, string> = {
  pending:    'قيد الانتظار',
  approved:   'مقبول',
  rejected:   'مرفوض',
  on_process: 'في الطريق',
  completed:  'مكتمل',
};

export default function ActionPage() {
  const params = new URLSearchParams(window.location.search);
  const id  = params.get('id')  || '';
  const act = (params.get('act') || '') as Act;

  // ── Auth gate ─────────────────────────────────────────────
  const [authed,    setAuthed]    = useState(false);
  const [authName,  setAuthName]  = useState('');
  const [authUser,  setAuthUser]  = useState('');
  const [authPass,  setAuthPass]  = useState('');
  const [authError, setAuthError] = useState('');
  const [authing,   setAuthing]   = useState(false);

  async function authenticate() {
    if (!authPass.trim()) return;
    setAuthing(true);
    setAuthError('');
    try {
      if (act === 'accept') {
        const res = await fetch('/api/driver/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: authPass.trim() }),
        });
        const data = await res.json();
        if (res.ok) { setAuthName(data.driver?.name || 'السائق'); setAuthed(true); }
        else setAuthError('كود السائق غير صحيح');
      } else {
        const res = await fetch('/api/manager/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authUser.trim(), password: authPass }),
        });
        const data = await res.json();
        if (res.ok) { setAuthName(data.manager?.name || 'المدير'); setAuthed(true); }
        else setAuthError(data.error || 'بيانات الدخول غير صحيحة');
      }
    } catch { setAuthError('خطأ في الاتصال، حاول مرة أخرى'); }
    setAuthing(false);
  }

  // ── Booking & action ──────────────────────────────────────
  const [booking,    setBooking]    = useState<any>(null);
  const [drivers,    setDrivers]    = useState<any[]>([]);
  const [driverId,   setDriverId]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [result,     setResult]     = useState('');
  const [fetchError, setFetchError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authed || !id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/action?id=${id}`).then(r => r.json()),
      act === 'approve' ? fetch('/api/drivers').then(r => r.json()) : Promise.resolve({ drivers: [] }),
    ]).then(([bData, dData]) => {
      if (bData.error) { setFetchError(bData.error); setLoading(false); return; }
      setBooking(bData.booking);
      const list = dData.drivers || [];
      setDrivers(list);
      if (list.length) setDriverId(list[0].id);
      setLoading(false);
    }).catch(() => { setFetchError('فشل تحميل بيانات الحجز'); setLoading(false); });
  }, [authed, id]);

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
      else setFetchError(data.error || 'حدث خطأ');
    } catch { setFetchError('خطأ في الاتصال'); }
    setSubmitting(false);
  }

  const actionConfig: Record<string, { title: string; btn: string; color: string }> = {
    approve: { title: 'قبول الحجز',   btn: 'قبول وإرسال للسائق',       color: 'bg-green-600 hover:bg-green-700' },
    reject:  { title: 'رفض الحجز',    btn: 'رفض وإشعار العميل',         color: 'bg-red-500  hover:bg-red-600'   },
    accept:  { title: 'قبول المهمة',  btn: 'قبول المهمة وإشعار العميل', color: 'bg-blue-600 hover:bg-blue-700'  },
  };
  const cfg = actionConfig[act];

  const card = 'bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-md w-full';
  const inp  = 'w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  // ── Auth screen ───────────────────────────────────────────
  if (!authed) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className={card}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-xl">🚗</div>
            <div>
              <p className="font-bold text-slate-900">WashTech</p>
              <p className="text-sm text-slate-500">
                {act === 'accept' ? 'تسجيل دخول السائق' : 'تسجيل دخول المدير'}
              </p>
            </div>
          </div>

          {!id && (
            <div className="text-center py-6 text-red-500">
              <div className="text-3xl mb-2">⚠️</div>
              <p>رابط غير صالح</p>
            </div>
          )}

          {id && (
            <>
              <p className="text-sm text-slate-600 mb-4">
                {act === 'accept'
                  ? 'أدخل كود السائق للمتابعة وقبول المهمة'
                  : 'أدخل بيانات حساب المدير للمتابعة'}
              </p>

              <div className="space-y-3">
                {act !== 'accept' && (
                  <input
                    className={inp}
                    placeholder="اسم المستخدم"
                    value={authUser}
                    onChange={e => setAuthUser(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && authenticate()}
                    dir="ltr"
                    autoComplete="username"
                  />
                )}
                <input
                  className={inp}
                  type={act === 'accept' ? 'text' : 'password'}
                  placeholder={act === 'accept' ? 'كود السائق (4 أرقام)' : 'كلمة المرور'}
                  value={authPass}
                  onChange={e => setAuthPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && authenticate()}
                  dir="ltr"
                  autoComplete={act === 'accept' ? 'off' : 'current-password'}
                  inputMode={act === 'accept' ? 'numeric' : undefined}
                />
              </div>

              {authError && (
                <p className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{authError}</p>
              )}

              <button
                onClick={authenticate}
                disabled={authing || !authPass.trim()}
                className="mt-4 w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
              >
                {authing ? 'جاري التحقق...' : 'دخول'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Action screen ─────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className={card}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-xl">🚗</div>
          <div>
            <p className="font-bold text-slate-900">WashTech — {cfg?.title}</p>
            <p className="text-sm text-slate-500">{authName}</p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">جاري التحميل...</p>
          </div>
        )}

        {fetchError && !loading && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-600 font-medium">{fetchError}</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-sm text-brand-600 underline">
              إعادة المحاولة
            </button>
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
            <p className="text-slate-500 text-sm mt-2">تم الإرسال عبر واتساب ✓</p>
          </div>
        )}

        {!loading && !fetchError && !done && booking && (
          <>
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2.5 text-sm">
              {[
                ['العميل',  booking.name],
                ['الهاتف',  <span dir="ltr" className="font-mono">{booking.phone}</span>],
                ['المنطقة', booking.neighborhood],
                ['السيارة', `${booking.carType} — ${booking.package}`],
                ['الموعد',  `${booking.date === 'today' ? 'اليوم' : 'غداً'} ${booking.slot}`],
                ['الحالة',  STATUS_AR[booking.status] || booking.status],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between items-center">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{val}</span>
                </div>
              ))}
            </div>

            {act === 'approve' && drivers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">اختر السائق</label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}{d.phone ? ` — ${d.phone}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {act === 'approve' && drivers.length === 0 && (
              <p className="text-amber-600 text-sm mb-4 bg-amber-50 rounded-xl p-3">
                ⚠️ لا يوجد سائقون متاحون. أضف سائقاً من لوحة الإدارة أولاً.
              </p>
            )}

            <div className="space-y-2">
              {(act !== 'approve' || drivers.length > 0) && (
                <button
                  onClick={submit}
                  disabled={submitting || (act === 'approve' && !driverId)}
                  className={`w-full py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 ${cfg?.color}`}
                >
                  {submitting ? 'جاري المعالجة...' : cfg?.btn}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
