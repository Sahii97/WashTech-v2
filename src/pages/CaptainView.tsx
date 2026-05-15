import React, { useState, useEffect } from 'react';
import { Car as IcCar, Phone as IcPhone, MapPin as IcMapPin, Clock as IcClock, Check as IcCheck, Play as IcPlay, RefreshCw as IcRefresh, Navigation as IcNav, Wallet as IcWallet, History as IcHistory } from 'lucide-react';

type Task = {
  id: string; name: string; phone: string; neighborhood: string;
  carType: string; package: string; date: string; slot: string; status: string;
};
type Captain = { id: string; name: string; code: string; phone?: string };

export default function CaptainView() {
  const [allCaptains, setAllCaptains] = useState<Captain[]>([]);
  const [captain,     setCaptain]     = useState<Captain | null>(null);
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [recentDone,  setRecentDone]  = useState<Task[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [captainsLoading, setCaptainsLoading] = useState(true);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [tab,         setTab]         = useState<'active' | 'done'>('active');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/drivers')
      .then(r => r.json())
      .then(d => {
        const list: Captain[] = d.drivers || [];
        setAllCaptains(list);
        setCaptainsLoading(false);
        if (list.length === 1) selectCaptain(list[0]);
      })
      .catch(() => setCaptainsLoading(false));
  }, []);

  async function selectCaptain(c: Captain) {
    setCaptain(c);
    loadTasks(c.id);
  }

  async function loadTasks(captainId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/driver/tasks?driverId=${captainId}`);
      const data = await res.json();
      const all: Task[] = data.tasks || [];
      setTasks(all.filter(t => ['approved','accepted','on_road','on_process'].includes(t.status)));
      setRecentDone(all.filter(t => t.status === 'completed').slice(0, 5));
    } catch {}
    setLoading(false);
  }



  async function acceptTask(taskId: string) {
    setActionError(null);
    const res = await fetch('/api/driver/accept-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, driverId: captain?.id }),
    });
    if (!res.ok) { const d = await res.json(); setActionError(d.error || 'خطأ'); return; }
    if (captain) { loadTasks(captain.id); }
  }

  async function onRoad(taskId: string) {
    setActionError(null);
    const res = await fetch('/api/driver/on-road', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, driverId: captain?.id }),
    });
    if (!res.ok) { const d = await res.json(); setActionError(d.error || 'خطأ'); return; }
    if (captain) loadTasks(captain.id);
  }

  async function completeTask(taskId: string) {
    setConfirmId(null);
    setActionError(null);
    const res = await fetch('/api/driver/complete-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, driverId: captain?.id }),
    });
    if (!res.ok) { const d = await res.json(); setActionError(d.error || 'خطأ'); return; }
    if (captain) { loadTasks(captain.id); }
  }

  // ── Captain picker ───────────────────────────────────────────
  if (!captain) {
    return (
      <div dir="rtl" className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <IcCar className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">بوابة الكابتن</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">اختر اسمك للمتابعة</p>
            </div>
          </div>

          {captainsLoading && (
            <div className="text-center py-8">
              <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
          {!captainsLoading && allCaptains.length === 0 && (
            <p className="text-slate-400 dark:text-slate-500 text-center py-6 text-sm">لا يوجد كباتن مضافون بعد</p>
          )}
          <div className="space-y-2">
            {allCaptains.map(c => (
              <button
                key={c.id}
                onClick={() => selectCaptain(c)}
                className="w-full flex items-center gap-4 px-4 py-4 bg-slate-50 dark:bg-slate-700 hover:bg-brand-50 hover:border-brand-300 border border-slate-200 dark:border-slate-600 rounded-xl transition-all text-right"
              >
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-700 font-bold text-lg">{c.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                  {c.phone && <p className="text-xs text-slate-400 dark:text-slate-500 font-mono" dir="ltr">{c.phone}</p>}
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
    <div dir="rtl" className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">مرحباً، {captain.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{tasks.length} مهمة نشطة</p>
        </div>
        <div className="flex items-center gap-2">

          <button
            onClick={() => loadTasks(captain.id)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="تحديث"
          >
            <IcRefresh className={`w-5 h-5 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setCaptain(null); setTasks([]); setRecentDone([]); }}
            className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            تغيير
          </button>
        </div>
      </header>

      {/* Tabs: active / done / wallet */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex px-4 gap-1">
        {([['active','المهام النشطة'],['done','المكتملة']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === k ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            {k === 'done' && <IcHistory className="w-4 h-4" />}
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Action error banner */}
        {actionError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-red-700 dark:text-red-400 text-sm">{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 mr-2"><IcCheck className="w-4 h-4" /></button>
          </div>
        )}
        {loading && (
          <div className="text-center py-12">
            <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Active tasks */}
        {tab === 'active' && !loading && tasks.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 dark:text-slate-500">
            <IcCar className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p>لا توجد مهام نشطة</p>
          </div>
        )}
        {tab === 'active' && tasks.map(task => (
          <div key={task.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-slate-900 dark:text-white">{task.name}</span>
              <StatusBadge status={task.status} />
            </div>
            <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <p className="flex items-center gap-2"><IcPhone className="w-4 h-4 text-slate-400 flex-shrink-0" /><span dir="ltr">{task.phone}</span></p>
              <p className="flex items-center gap-2"><IcMapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />{task.neighborhood}</p>
              <p className="flex items-center gap-2"><IcCar className="w-4 h-4 text-slate-400 flex-shrink-0" />{task.carType} · {task.package}</p>
              <p className="flex items-center gap-2"><IcClock className="w-4 h-4 text-slate-400 flex-shrink-0" />{task.date === 'today' ? 'اليوم' : 'غداً'} — {task.slot}</p>
            </div>

            {task.status === 'approved' && (
              <button onClick={() => acceptTask(task.id)}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <IcPlay className="w-4 h-4" /> قبول المهمة
              </button>
            )}
            {(task.status === 'accepted' || task.status === 'on_process') && (
              <button onClick={() => onRoad(task.id)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <IcNav className="w-4 h-4" /> أنا في الطريق
              </button>
            )}
            {task.status === 'on_road' && (
              <button onClick={() => { setConfirmId(task.id); }}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <IcCheck className="w-4 h-4" /> تم الانتهاء
              </button>
            )}
          </div>
        ))}

        {/* Recently completed */}
        {tab === 'done' && recentDone.length === 0 && !loading && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 dark:text-slate-500">
            <IcHistory className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p>لا توجد مهام مكتملة بعد</p>
          </div>
        )}
        {tab === 'done' && recentDone.map(task => (
          <div key={task.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-900 dark:text-white">{task.name}</span>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{task.neighborhood} · {task.slot}</p>
          </div>
        ))}

      </div>

      {/* Confirm overlay */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-2">تأكيد إتمام الخدمة</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">هل أنت متأكد من إتمام هذه المهمة؟</p>
            <div className="flex gap-3">
              <button onClick={() => completeTask(confirmId)}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors">
                تأكيد الإتمام
              </button>
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved:   { label: 'جديد',        cls: 'bg-green-100 text-green-700' },
    accepted:   { label: 'مقبول',       cls: 'bg-brand-100 text-brand-700' },
    on_process: { label: 'في الطريق',   cls: 'bg-blue-100 text-blue-700' },
    on_road:    { label: 'في الطريق',   cls: 'bg-blue-100 text-blue-700' },
    completed:  { label: 'مكتمل',       cls: 'bg-teal-100 text-teal-700' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}
