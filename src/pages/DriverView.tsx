import React, { useState, useEffect } from 'react';

type Task = {
  id: string; name: string; phone: string; neighborhood: string;
  carType: string; package: string; date: string; slot: string; status: string;
};
type Driver = { id: string; name: string; code: string; phone?: string };

export default function DriverView() {
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [driver,     setDriver]     = useState<Driver | null>(null);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [driversLoading, setDriversLoading] = useState(true);

  useEffect(() => {
    fetch('/api/drivers')
      .then(r => r.json())
      .then(d => { setAllDrivers(d.drivers || []); setDriversLoading(false); })
      .catch(() => setDriversLoading(false));
  }, []);

  async function selectDriver(d: Driver) {
    setDriver(d);
    loadTasks(d.id);
  }

  async function loadTasks(driverId: string) {
    setLoading(true);
    const res = await fetch(`/api/driver/tasks?driverId=${driverId}`);
    const data = await res.json();
    setTasks(data.tasks || []);
    setLoading(false);
  }

  async function updateStatus(taskId: string, status: string) {
    await fetch('/api/driver/update-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, status, driverId: driver?.id }),
    });
    if (driver) loadTasks(driver.id);
  }

  // ── Driver picker ─────────────────────────────────────────
  if (!driver) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-xl">🚗</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">بوابة السائق</h1>
              <p className="text-slate-500 text-sm">اختر اسمك للمتابعة</p>
            </div>
          </div>

          {driversLoading && (
            <div className="text-center py-8">
              <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {!driversLoading && allDrivers.length === 0 && (
            <p className="text-slate-400 text-center py-6 text-sm">لا يوجد سائقون مضافون بعد</p>
          )}

          <div className="space-y-2">
            {allDrivers.map(d => (
              <button
                key={d.id}
                onClick={() => selectDriver(d)}
                className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 border border-slate-200 rounded-xl transition-all text-right"
              >
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-700 font-bold text-lg">{d.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  {d.phone && <p className="text-xs text-slate-400 font-mono" dir="ltr">{d.phone}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Tasks view ────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">مرحباً، {driver.name}</h1>
          <p className="text-sm text-slate-500">{tasks.length} مهمة نشطة</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadTasks(driver.id)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="تحديث"
          >
            <svg className={`w-5 h-5 text-slate-500 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => { setDriver(null); setTasks([]); }}
            className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          >
            تغيير
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {loading && (
          <div className="text-center py-12">
            <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        {!loading && tasks.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            <div className="text-4xl mb-3">📭</div>
            <p>لا توجد مهام نشطة</p>
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-slate-900">{task.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                task.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {task.status === 'approved' ? 'جديد' : 'جاري'}
              </span>
            </div>
            <div className="space-y-1 text-sm text-slate-600 mb-4">
              <p>📞 <span dir="ltr">{task.phone}</span></p>
              <p>📍 {task.neighborhood}</p>
              <p>🚗 {task.carType} · {task.package}</p>
              <p>🕐 {task.date === 'today' ? 'اليوم' : 'غداً'} — {task.slot}</p>
            </div>
            {task.status === 'approved' && (
              <button
                onClick={() => updateStatus(task.id, 'on_process')}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                ▶️ قبول المهمة — بدء التنفيذ
              </button>
            )}
            {task.status === 'on_process' && (
              <button
                onClick={() => updateStatus(task.id, 'completed')}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                ✅ تم الانتهاء
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
