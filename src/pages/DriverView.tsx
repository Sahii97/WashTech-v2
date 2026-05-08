import React, { useState, useEffect } from 'react';

type Task = {
  id: string; name: string; phone: string; neighborhood: string;
  carType: string; package: string; date: string; slot: string; status: string;
};
type Driver = { id: string; name: string; code: string };

export default function DriverView() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [code, setCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  async function login() {
    const res = await fetch('/api/driver/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.success) { setDriver(data.driver); loadTasks(data.driver.id); }
    else setLoginError('رمز غير صحيح');
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
      body: JSON.stringify({ bookingId: taskId, status }),
    });
    if (driver) loadTasks(driver.id);
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full">
          <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">بوابة السائق</h1>
          <p className="text-slate-500 text-sm mb-6">أدخل الرمز المكون من 4 أرقام</p>
          <input
            type="tel"
            maxLength={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl mb-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="• • • •"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          {loginError && <p className="text-red-500 text-sm mb-3 text-center">{loginError}</p>}
          <button onClick={login} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors">
            دخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">مرحباً، {driver.name}</h1>
          <p className="text-sm text-slate-500">{tasks.length} مهمة نشطة</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadTasks(driver.id)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <svg className={`w-5 h-5 text-slate-500 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button onClick={() => setDriver(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors text-sm">
            خروج
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {tasks.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            لا توجد مهام نشطة
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-slate-900">{task.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${task.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {task.status === 'approved' ? 'جديد' : 'جاري'}
              </span>
            </div>
            <div className="space-y-1 text-sm text-slate-600 mb-4">
              <p>📞 {task.phone}</p>
              <p>📍 {task.neighborhood}</p>
              <p>🚗 {task.carType} · {task.package}</p>
              <p>🕐 {task.date === 'today' ? 'اليوم' : 'غداً'} — {task.slot}</p>
            </div>
            {task.status === 'approved' && (
              <button
                onClick={() => updateStatus(task.id, 'on_process')}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                قبول المهمة — بدء التنفيذ
              </button>
            )}
            {task.status === 'on_process' && (
              <button
                onClick={() => updateStatus(task.id, 'completed')}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                ✓ تم الانتهاء
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
