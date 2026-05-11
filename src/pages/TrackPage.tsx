import React, { useState } from 'react';
import { Search as IcSearch } from 'lucide-react';

const STATUS_AR: Record<string, { label: string; color: string }> = {
  pending:    { label: 'قيد الانتظار',  color: 'bg-amber-100 text-amber-700' },
  approved:   { label: 'مقبول',         color: 'bg-green-100 text-green-700' },
  rejected:   { label: 'مرفوض',         color: 'bg-red-100 text-red-700' },
  on_process: { label: 'السائق في الطريق', color: 'bg-blue-100 text-blue-700' },
  completed:  { label: 'مكتمل',         color: 'bg-slate-100 text-slate-700' },
};

export default function TrackPage() {
  const [phone,    setPhone]    = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [error,    setError]    = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    setSearched(false);
    try {
      const res = await fetch(`/api/track?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setBookings([]); }
      else { setBookings(data.bookings || []); }
      setSearched(true);
    } catch { setError('خطأ في الاتصال'); }
    setLoading(false);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-lg font-bold text-slate-900">تتبع طلبك</h1>
            <p className="text-sm text-slate-500">أدخل رقم هاتفك للبحث عن حجوزاتك</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-20">
        <form onSubmit={search} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">رقم الهاتف</label>
          <div className="flex gap-2">
            <input
              type="tel"
              dir="ltr"
              placeholder="07XXXXXXXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {loading ? '...' : 'بحث'}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        {searched && !error && bookings.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <IcSearch className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-medium">لم يتم العثور على حجوزات</p>
            <p className="text-sm mt-1">تأكد من رقم الهاتف المستخدم عند الحجز</p>
          </div>
        )}

        {bookings.length > 0 && (
          <div className="space-y-3">
            {bookings.map(b => {
              const st = STATUS_AR[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-700' };
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">#{b.id.slice(-8)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">المنطقة</span>
                      <span className="font-medium text-slate-800">{b.neighborhood}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">السيارة</span>
                      <span className="font-medium text-slate-800">{b.carType} — {b.package}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الموعد</span>
                      <span className="font-medium text-slate-800">{b.date === 'today' ? 'اليوم' : 'غداً'} {b.slot}</span>
                    </div>
                  </div>
                  {b.status === 'on_process' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-blue-600">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">السائق في طريقه إليك</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
