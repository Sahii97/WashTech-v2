import React, { useEffect, useState } from 'react';
import {
  Car as IcCar,
  Check as IcCheck,
  Clock as IcClock,
  History as IcHistory,
  MapPin as IcMapPin,
  Navigation as IcNav,
  Phone as IcPhone,
  Play as IcPlay,
  RefreshCw as IcRefresh,
  Wallet as IcWallet,
} from 'lucide-react';
import WashTechLogo from '../components/WashTechLogo';

type Task = {
  id: string;
  name: string;
  phone: string;
  neighborhood: string;
  carType: string;
  package: string;
  date: string;
  slot: string;
  status: string;
  financials?: { totalAmount: number; captainShare: number; companyShare: number };
};

type Captain = { id: string; name: string; code: string; phone?: string };
type Wallet = { balance: number; totalEarned: number; totalWithdrawn: number; totalCollected?: number; totalPaidToCompany?: number };
type Transaction = {
  id: string;
  type: string;
  amount?: number;
  totalAmount?: number;
  captainShare?: number;
  companyShare?: number;
  bookingId?: string;
  note?: string;
  createdAt: string;
};

const DEFAULT_PRICES: Record<string, number> = {
  basic: 15000,
  standard: 25000,
  premium: 35000,
  'أساسي': 15000,
  'قياسي': 25000,
  'ممتاز': 35000,
};

function CaptainLogin({ onLogin }: { onLogin: (c: Captain) => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/captain/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) {
      localStorage.setItem('wt_cpt', JSON.stringify(d.captain));
      onLogin(d.captain);
    } else {
      setErr(d.error || 'الكود غير صحيح');
    }
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 max-w-sm w-full">
        <div className="mb-6"><WashTechLogo size={32} /></div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-1">بوابة الكابتن</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">أدخل كودك الرباعي للدخول</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            maxLength={4}
            dir="ltr"
            inputMode="numeric"
            className="w-full px-3 py-4 border border-slate-200 dark:border-slate-600 rounded-xl text-3xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white dark:bg-slate-700 dark:text-white"
          />
          {err && <p className="text-xs text-red-500 text-center">{err}</p>}
          <button type="submit" disabled={loading || code.length < 4} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-colors">
            {loading ? '...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `منذ ${diff} ث`;
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: 'جديد', cls: 'bg-green-100 text-green-700' },
    accepted: { label: 'مقبول', cls: 'bg-blue-100 text-blue-700' },
    on_process: { label: 'جاري', cls: 'bg-blue-100 text-blue-700' },
    on_road: { label: 'في الطريق', cls: 'bg-indigo-100 text-indigo-700' },
    completed: { label: 'مكتمل', cls: 'bg-teal-100 text-teal-700' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function FinanceCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</p>
      <p className={`font-bold text-base ${danger ? 'text-red-500' : 'text-green-700 dark:text-green-400'}`}>{value}</p>
    </div>
  );
}

function txLabel(tx: Transaction) {
  if (tx.type === 'earning') return 'تحصيل من العميل';
  if (tx.type === 'receipt') return 'دفع للشركة';
  if (tx.type === 'withdrawal') return 'سحب للكابتن';
  if (tx.type === 'adjustment') return 'تسوية مالية';
  return tx.type;
}

function txAmount(tx: Transaction) {
  if (tx.type === 'earning') return `+ ${((tx.totalAmount ?? 0)).toLocaleString('ar-IQ')} د.ع`;
  if (tx.type === 'receipt') return `- ${(tx.amount ?? 0).toLocaleString('ar-IQ')} د.ع`;
  return `+ ${(tx.amount ?? 0).toLocaleString('ar-IQ')} د.ع`;
}

function txClass(tx: Transaction) {
  if (tx.type === 'earning') return 'text-green-600';
  if (tx.type === 'receipt') return 'text-red-500';
  if (tx.type === 'withdrawal') return 'text-blue-600';
  return 'text-slate-700 dark:text-slate-300';
}

export default function CaptainView() {
  const [captain, setCaptain] = useState<Captain | null>(() => {
    try { return JSON.parse(localStorage.getItem('wt_cpt') || 'null'); } catch { return null; }
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentDone, setRecentDone] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'done' | 'finance'>('active');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pkgPrices, setPkgPrices] = useState<Record<string, number>>(DEFAULT_PRICES);
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, totalEarned: 0, totalWithdrawn: 0, totalCollected: 0, totalPaidToCompany: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [actualAmount, setActualAmount] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return;
    fetch(`/api/auth/captain?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          localStorage.setItem('wt_cpt', JSON.stringify(d.captain));
          setCaptain(d.captain);
          loadCaptainData(d.captain.id);
          window.history.replaceState({}, '', '/captain');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (captain) loadCaptainData(captain.id);
    fetch('/api/admin/settings/finance_config')
      .then(r => r.json())
      .then(d => {
        if (d?.value?.packagePrices) setPkgPrices({ ...DEFAULT_PRICES, ...d.value.packagePrices });
      })
      .catch(() => {});
  }, []);

  function getPrice(pkg: string): number {
    return pkgPrices[pkg] || pkgPrices[pkg?.toLowerCase()] || 0;
  }

  function fmtPrice(n: number): string {
    return n > 0 ? n.toLocaleString('ar-IQ') + ' د.ع' : '—';
  }

  async function loadCaptainData(captainId: string) {
    setLoading(true);
    try {
      const [taskRes, walletRes, txRes] = await Promise.all([
        fetch(`/api/driver/tasks?driverId=${captainId}`),
        fetch(`/api/captain/wallet?driverId=${captainId}`),
        fetch(`/api/captain/transactions?driverId=${captainId}`),
      ]);
      const taskData = await taskRes.json();
      const walletData = await walletRes.json();
      const txData = await txRes.json();
      setTasks(taskData.tasks || []);
      setRecentDone(taskData.completed || []);
      setWallet(walletData.wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0, totalCollected: 0, totalPaidToCompany: 0 });
      setTransactions(txData.transactions || []);
    } catch {}
    setLoading(false);
  }

  async function acceptTask(taskId: string) {
    setActionError(null);
    const res = await fetch('/api/driver/accept-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, driverId: captain?.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error || 'خطأ');
      return;
    }
    if (captain) loadCaptainData(captain.id);
  }

  async function onRoad(taskId: string) {
    setActionError(null);
    const res = await fetch('/api/driver/on-road', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, driverId: captain?.id }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error || 'خطأ');
      return;
    }
    if (captain) loadCaptainData(captain.id);
  }

  async function completeTask(taskId: string) {
    setActionError(null);
    const amount = Number(actualAmount);
    if (!amount || amount <= 0) {
      setActionError('أدخل المبلغ المستلم من العميل');
      return;
    }
    const res = await fetch('/api/driver/complete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: taskId, driverId: captain?.id, actualAmount: amount }),
    });
    if (!res.ok) {
      const d = await res.json();
      setActionError(d.error || 'خطأ');
      return;
    }
    setConfirmId(null);
    setActualAmount('');
    if (captain) {
      await loadCaptainData(captain.id);
      setTab('finance');
    }
  }

  if (!captain) return <CaptainLogin onLogin={c => { setCaptain(c); loadCaptainData(c.id); }} />;

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex flex-col gap-0.5">
          <WashTechLogo size={28} />
          <p className="text-sm text-slate-500 dark:text-slate-400">مرحباً، {captain.name} · {tasks.length} مهمة نشطة</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadCaptainData(captain.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" title="تحديث">
            <IcRefresh className={`w-5 h-5 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { localStorage.removeItem('wt_cpt'); setCaptain(null); setTasks([]); setRecentDone([]); setTransactions([]); }} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors">
            خروج
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex px-4 gap-1">
        {([['active', 'المهام النشطة'], ['done', 'المكتملة'], ['finance', 'المالية']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === k ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}
          >
            {k === 'done' && <IcHistory className="w-4 h-4" />}
            {k === 'finance' && <IcWallet className="w-4 h-4" />}
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
              <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-100 dark:border-slate-700">
                <IcWallet className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="font-bold text-green-700 dark:text-green-400">{fmtPrice(getPrice(task.package))}</span>
              </div>
            </div>

            {task.status === 'approved' && (
              <button onClick={() => acceptTask(task.id)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <IcPlay className="w-4 h-4" /> قبول المهمة
              </button>
            )}
            {(task.status === 'accepted' || task.status === 'on_process') && (
              <button onClick={() => onRoad(task.id)} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <IcNav className="w-4 h-4" /> أنا في الطريق
              </button>
            )}
            {task.status === 'on_road' && (
              <button onClick={() => { setConfirmId(task.id); setActualAmount(String(task.financials?.totalAmount || getPrice(task.package) || '')); }} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                <IcCheck className="w-4 h-4" /> تم الانتهاء ✓
              </button>
            )}
          </div>
        ))}

        {tab === 'done' && recentDone.length === 0 && !loading && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 dark:text-slate-500">
            <IcHistory className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p>لا توجد مهام مكتملة بعد</p>
          </div>
        )}

        {tab === 'done' && recentDone.map(task => {
          const total = task.financials?.totalAmount ?? getPrice(task.package);
          const captainShare = task.financials?.captainShare ?? 0;
          const companyShare = task.financials?.companyShare ?? 0;
          return (
            <div key={task.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-900 dark:text-white">{task.name}</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <p className="flex items-center gap-2"><IcPhone className="w-4 h-4 text-slate-400 flex-shrink-0" /><span dir="ltr">{task.phone}</span></p>
                <p className="flex items-center gap-2"><IcMapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />{task.neighborhood}</p>
                <p className="flex items-center gap-2"><IcCar className="w-4 h-4 text-slate-400 flex-shrink-0" />{task.carType} · {task.package}</p>
                <p className="flex items-center gap-2"><IcClock className="w-4 h-4 text-slate-400 flex-shrink-0" />{task.date === 'today' ? 'اليوم' : 'غداً'} — {task.slot}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-400">المبلغ المستلم</span><span className="font-bold text-green-700 dark:text-green-400">{fmtPrice(total)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-slate-400">حصتك</span><span className="font-bold text-blue-600">{fmtPrice(captainShare)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-slate-400">المطلوب للشركة</span><span className="font-bold text-red-500">{fmtPrice(companyShare)}</span></div>
              </div>
            </div>
          );
        })}

        {tab === 'finance' && !loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FinanceCard label="المبلغ المستلم" value={fmtPrice(wallet.totalCollected || 0)} />
              <FinanceCard label="حصتك" value={fmtPrice(wallet.totalEarned || 0)} />
              <FinanceCard label="المطلوب للشركة" value={fmtPrice(Math.abs(Math.min(wallet.balance || 0, 0)))} danger={(wallet.balance || 0) < 0} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">سجل الخصم والإضافة</h2>
              </div>
              {transactions.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">لا توجد حركات مالية بعد</div>
              )}
              {transactions.map(tx => (
                <div key={tx.id} className="px-5 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{txLabel(tx)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{tx.note || (tx.bookingId ? `#${tx.bookingId.slice(-6)}` : '')} · {timeAgo(tx.createdAt)}</p>
                  </div>
                  <div className={`font-bold text-sm ${txClass(tx)}`} dir="ltr">{txAmount(tx)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-2">تأكيد إتمام الخدمة</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">أدخل المبلغ المستلم من العميل ثم أكد الإتمام.</p>
            <input
              type="number"
              min="0"
              value={actualAmount}
              onChange={e => setActualAmount(e.target.value)}
              placeholder="المبلغ المستلم من العميل"
              className="w-full mb-5 px-3 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white dark:bg-slate-700 dark:text-white"
              dir="ltr"
            />
            <div className="flex gap-3">
              <button onClick={() => completeTask(confirmId)} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors">
                تأكيد الإتمام
              </button>
              <button onClick={() => { setConfirmId(null); setActualAmount(''); }} className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
