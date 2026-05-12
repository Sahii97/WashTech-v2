import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Bell, Car, Users, MapPin, Settings, Play, Trash2, Plus, Check, RefreshCw, Moon, Sun, Send, Zap, TrendingUp } from 'lucide-react';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `منذ ${diff} ث`;
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}
const BUILD_COUNT = typeof __COMMIT_COUNT__ !== 'undefined' ? __COMMIT_COUNT__ : '0';
const BUILD_TIME  = typeof __BUILD_TIME__   !== 'undefined' ? __BUILD_TIME__   : new Date().toISOString();

type Driver   = { id: string; name: string; code: string; phone?: string };
type Manager  = { id: string; name: string; username: string };
type EventKey = 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected' | 'captain_on_road' | 'booking_completed';
type Section  = 'dashboard' | 'workflow' | 'drivers' | 'managers' | 'locations' | 'settings';

interface TemplateConfig { enabled: boolean; template: string; }
type Templates = Record<EventKey, TemplateConfig>;

// ── Sample values for preview rendering ──────────────────────
const PREVIEW_VARS: Record<string, string> = {
  id: 'A8F3', name: 'محمد أحمد', phone: '07901234567',
  neighborhood: 'عنكاوة', carType: 'سيدان', package: 'قياسي',
  date: 'اليوم', slot: '10:00 AM',
  approveLink: 'washt.ch/go/AB1C', rejectLink: 'washt.ch/go/XY9Z',
  acceptLink: 'washt.ch/go/QR4W', driverName: 'علي محمد',
  driverPhone: '07901234567', amount: '25,000',
};
function renderPreview(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => PREVIEW_VARS[k] ?? `[${k}]`);
}

// ── Defaults ──────────────────────────────────────────────────
const DEFAULT_TEMPLATES: Templates = {
  new_booking:       { enabled: true, template: '📦 *حجز جديد* #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}\n\n──────────────\n✅ *قبول:*\n{{approveLink}}\n\n❌ *رفض:*\n{{rejectLink}}' },
  booking_approved:  { enabled: true, template: '✅ *مهمة جديدة*\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\n──────────────\n▶️ *قبول المهمة:*\n{{acceptLink}}' },
  driver_accepted:   { enabled: true, template: '🚗 *الكابتن قبل مهمتك!*\n👨‍💼 الكابتن: {{driverName}}\n🕐 الوقت: {{slot}}\n\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼' },
  booking_rejected:  { enabled: true, template: '❌ عذراً {{name}}،\nلم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\n\nWashTech 🚗' },
  captain_on_road:   { enabled: true, template: '🚀 *الكابتن في الطريق إليك!*\n👨‍💼 {{driverName}}\n🕐 الوقت: {{slot}}\n\nاستعد لاستقباله. شكراً! 🧼' },
  booking_completed: { enabled: true, template: '✅ تم الانتهاء من خدمة غسيل سيارتك!\n💰 المبلغ: *{{amount}} د.ع*\nشكراً لاختيارك WashTech 🧼\nقيّم تجربتك: ⭐⭐⭐⭐⭐' },
};

const EVENT_META: {
  key: EventKey; label: string; recipient: string; icon: string;
  ifLabel: string; thenLabel: string; extra?: string; vars: string[];
}[] = [
  { key: 'new_booking',       icon: '📦', label: 'حجز جديد ← المدير',          recipient: 'يُرسل إلى: المدير',   ifLabel: 'وصل حجز جديد من عميل',      thenLabel: 'أرسل واتساب للمدير',  extra: 'يشمل رابط موافقة ورفض قصير', vars: ['id','name','phone','neighborhood','carType','package','date','slot','approveLink','rejectLink'] },
  { key: 'booking_approved',  icon: '✅', label: 'موافقة المدير ← الكابتن',     recipient: 'يُرسل إلى: الكابتن', ifLabel: 'وافق المدير على الحجز',      thenLabel: 'أرسل واتساب للكابتن', extra: 'يشمل رابط قبول المهمة',      vars: ['name','phone','neighborhood','slot','driverName','driverPhone','acceptLink'] },
  { key: 'driver_accepted',   icon: '🚗', label: 'قبول الكابتن ← العميل',       recipient: 'يُرسل إلى: العميل',  ifLabel: 'قبل الكابتن المهمة',         thenLabel: 'أرسل واتساب للعميل',  vars: ['name','phone','driverName','slot'] },
  { key: 'booking_rejected',  icon: '❌', label: 'رفض الحجز ← العميل',          recipient: 'يُرسل إلى: العميل',  ifLabel: 'رُفض الحجز',                 thenLabel: 'أرسل واتساب للعميل',  vars: ['name','phone'] },
  { key: 'captain_on_road',   icon: '🚀', label: 'الكابتن في الطريق ← العميل',  recipient: 'يُرسل إلى: العميل',  ifLabel: 'انطلق الكابتن للعميل',       thenLabel: 'أرسل واتساب للعميل',  vars: ['name','phone','driverName','slot'] },
  { key: 'booking_completed', icon: '💰', label: 'اكتمال الخدمة ← العميل',       recipient: 'يُرسل إلى: العميل',  ifLabel: 'اكتملت الخدمة',              thenLabel: 'أرسل واتساب للعميل',  extra: 'يشمل مبلغ الخدمة تلقائياً', vars: ['name','phone','amount'] },
];

const IC = {
  grid:    <LayoutGrid size={20} strokeWidth={1.5} />,
  bell:    <Bell       size={20} strokeWidth={1.5} />,
  car:     <Car        size={20} strokeWidth={1.5} />,
  users:   <Users      size={20} strokeWidth={1.5} />,
  pin:     <MapPin     size={20} strokeWidth={1.5} />,
  cog:     <Settings   size={20} strokeWidth={1.5} />,
  play:    <Play       size={16} strokeWidth={1.5} />,
  trash:   <Trash2     size={16} strokeWidth={1.5} />,
  plus:    <Plus       size={16} strokeWidth={2}   />,
  check:   <Check      size={16} strokeWidth={2.5} />,
  send:    <Send       size={16} strokeWidth={1.5} />,
  zap:     <Zap        size={20} strokeWidth={1.5} />,
  trend:   <TrendingUp size={20} strokeWidth={1.5} />,
};

const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'الرئيسية',  icon: IC.grid  },
  { key: 'workflow',  label: 'الرسائل',   icon: IC.bell  },
  { key: 'drivers',   label: 'الكباتن',   icon: IC.car   },
  { key: 'managers',  label: 'المدراء',   icon: IC.users },
  { key: 'locations', label: 'المناطق',   icon: IC.pin   },
  { key: 'settings',  label: 'الإعدادات', icon: IC.cog   },
];

const inp = 'w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition';
const btn = (color: string) => `px-4 py-2.5 ${color} text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40`;

// ── WhatsApp-style message editor with rendered preview ───────
function WaEditor({ value, onChange, rows, textareaRef }: {
  value: string; onChange: (v: string) => void;
  rows?: number; textareaRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const preview = renderPreview(value);
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600">
      <div className="bg-[#e7fdd8] dark:bg-[#1a3a2a] px-4 py-3 border-b border-slate-200 dark:border-slate-600">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5 font-medium uppercase tracking-wide">معاينة · بقيم تجريبية</p>
        <div className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap font-sans leading-relaxed break-words">
          {preview || <span className="text-slate-400 dark:text-slate-500 italic text-xs">اكتب الرسالة أدناه...</span>}
        </div>
      </div>
      <div className="bg-[#f0f2f5] dark:bg-slate-800 flex items-end gap-2 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows ?? 4}
          dir="auto"
          placeholder="اكتب نص الرسالة... استخدم {{المتغير}} لإدراج بيانات ديناميكية"
          className="flex-1 bg-white dark:bg-slate-700 border-0 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 font-mono"
        />
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5">
          <Send size={14} strokeWidth={2} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-10 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
    </label>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AdminDashboard() {
  const [section, setSection] = useState<Section>('dashboard');
  const [dark, setDark] = useState(() => localStorage.getItem('wt_dark') === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('wt_dark', dark ? '1' : '0');
  }, [dark]);

  const [drivers,       setDrivers]       = useState<Driver[]>([]);
  const [managers,      setManagers]      = useState<Manager[]>([]);
  const [bookings,      setBookings]      = useState<any[]>([]);
  const [slots,         setSlots]         = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  const [newDriver,   setNewDriver]   = useState({ name: '', code: '', phone: '' });
  const [newManager,  setNewManager]  = useState({ name: '', username: '', password: '' });
  const [newNeighbor, setNewNeighbor] = useState('');

  const [driverMsg,   setDm]  = useState('');
  const [managerMsg,  setMm]  = useState('');
  const [neighborMsg, setNm]  = useState('');
  const [resetting,   setRes] = useState(false);

  const [templates,     setTemplates]     = useState<Templates>(DEFAULT_TEMPLATES);
  const [saving,        setSaving]        = useState<Partial<Record<EventKey, boolean>>>({});
  const [saved,         setSaved]         = useState<Partial<Record<EventKey, boolean>>>({});
  const [testing,       setTesting]       = useState<Partial<Record<EventKey, boolean>>>({});
  const [testResult,    setTestResult]    = useState<Partial<Record<EventKey, string>>>({});
  const [testPhone,     setTestPhone]     = useState('');
  const [testingAll,    setTestingAll]    = useState(false);
  const [testAllResult, setTestAllResult] = useState('');
  const [testAllRows,   setTestAllRows]   = useState<{ event: string; ok: boolean; label: string }[]>([]);
  const textareaRefs = useRef<Partial<Record<EventKey, HTMLTextAreaElement | null>>>({});

  const [simulating, setSimulating] = useState(false);
  const [simSteps,   setSimSteps]   = useState<{ label: string; ok: boolean }[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [d, b, s, n, m, t] = await Promise.all([
      fetch('/api/drivers').then(r => r.json()),
      fetch('/api/bookings').then(r => r.json()),
      fetch('/api/slots').then(r => r.json()),
      fetch('/api/neighborhoods').then(r => r.json()),
      fetch('/api/admin/managers').then(r => r.json()),
      fetch('/api/admin/notification-templates').then(r => r.json()),
    ]);
    setDrivers(d.drivers || []);
    setBookings(b.bookings || []);
    setSlots(s.slots || []);
    setNeighborhoods(n.neighborhoods || []);
    setManagers(m.managers || []);
    if (t.templates) setTemplates({ ...DEFAULT_TEMPLATES, ...t.templates });
  }

  // ── Finance computed ─────────────────────────────────────────
  const completedBookings = bookings.filter(b => ['completed', 'closed'].includes(b.status) && b.financials);
  const totalRevenue   = completedBookings.reduce((s: number, b: any) => s + (b.financials?.totalAmount  || 0), 0);
  const companyRevenue = completedBookings.reduce((s: number, b: any) => s + (b.financials?.companyShare || 0), 0);
  const captainRevenue = completedBookings.reduce((s: number, b: any) => s + (b.financials?.captainShare || 0), 0);

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/create-driver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDriver),
    });
    if (res.ok) { setNewDriver({ name: '', code: '', phone: '' }); setDm('تمت الإضافة'); loadAll(); }
    else { const d = await res.json(); setDm(d.error || 'خطأ'); }
    setTimeout(() => setDm(''), 2500);
  }
  async function deleteDriver(id: string) { await fetch(`/api/admin/driver/${id}`, { method: 'DELETE' }); loadAll(); }

  async function createManager(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/create-manager', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newManager),
    });
    if (res.ok) { setNewManager({ name: '', username: '', password: '' }); setMm('تمت الإضافة'); loadAll(); }
    else { const d = await res.json(); setMm(d.error || 'خطأ'); }
    setTimeout(() => setMm(''), 2500);
  }
  async function deleteManager(id: string) { await fetch(`/api/admin/manager/${id}`, { method: 'DELETE' }); loadAll(); }

  async function addNeighborhood(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/neighborhoods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newNeighbor.trim() }),
    });
    if (res.ok) { setNewNeighbor(''); setNm('تمت الإضافة'); loadAll(); }
    else { const d = await res.json(); setNm(d.error || 'خطأ'); }
    setTimeout(() => setNm(''), 2500);
  }
  async function deleteNeighborhood(name: string) {
    await fetch(`/api/admin/neighborhoods/${encodeURIComponent(name)}`, { method: 'DELETE' }); loadAll();
  }

  async function reset() {
    if (!window.confirm('حذف جميع الحجوزات وإعادة ضبط البيانات؟')) return;
    setRes(true);
    await fetch('/api/admin/reset', { method: 'POST' });
    setRes(false);
    loadAll();
  }

  async function simulate() {
    setSimulating(true);
    setSimSteps([]);
    const res = await fetch('/api/admin/simulate-cycle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPhone: testPhone.trim() || undefined }),
    });
    const data = await res.json();
    setSimSteps(data.steps || []);
    setSimulating(false);
  }

  function insertVar(key: EventKey, v: string) {
    const el = textareaRefs.current[key];
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd   ?? el.value.length;
    const token = `{{${v}}}`;
    setTemplates(p => ({ ...p, [key]: { ...p[key], template: el.value.slice(0, s) + token + el.value.slice(e) } }));
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + token.length; el.focus(); }, 0);
  }

  async function saveTemplate(key: EventKey) {
    setSaving(p => ({ ...p, [key]: true }));
    await fetch('/api/admin/notification-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    }).catch(console.error);
    setSaving(p => ({ ...p, [key]: false }));
    setSaved(p => ({ ...p, [key]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000);
  }

  async function saveAllTemplates() {
    await fetch('/api/admin/notification-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    }).catch(console.error);
  }

  async function testEvent(key: EventKey) {
    setTesting(p => ({ ...p, [key]: true }));
    setTestResult(p => ({ ...p, [key]: '' }));
    const res = await fetch('/api/admin/test-notification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: key, testPhone: testPhone.trim() || undefined }),
    }).catch(() => null);
    const d = res ? await res.json() : { error: 'Network error' };
    setTestResult(p => ({ ...p, [key]: d.success ? `✓ أُرسل إلى ${d.sentTo}` : `✗ ${d.error}` }));
    setTesting(p => ({ ...p, [key]: false }));
    setTimeout(() => setTestResult(p => ({ ...p, [key]: '' })), 4000);
  }

  async function testAll() {
    setTestingAll(true);
    setTestAllResult('جاري الإرسال...');
    setTestAllRows([]);
    const res = await fetch('/api/admin/test-all-notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPhone: testPhone.trim() || undefined }),
    }).catch(() => null);
    const d = res ? await res.json() : { error: 'Network error' };
    if (d.results) setTestAllRows(d.results);
    setTestAllResult(d.success ? `✓ اكتمل الاختبار — ${d.sentTo}` : `✗ ${d.error || 'فشل'}`);
    setTestingAll(false);
    setTimeout(() => setTestAllResult(''), 10000);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car size={16} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white leading-none">واش تك — الإدارة</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              #{BUILD_COUNT} · {timeAgo(BUILD_TIME)} · {bookings.length} حجز · {drivers.length} كابتن
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDark(d => !d)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={loadAll}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500">
            <RefreshCw size={16} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-52 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 p-3 gap-1 sticky top-[61px] self-start h-[calc(100vh-61px)]">
          {NAV.map(item => (
            <button key={item.key} onClick={() => setSection(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                section === item.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </aside>

        {/* Mobile tab bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex z-10">
          {NAV.map(item => (
            <button key={item.key} onClick={() => setSection(item.key)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                section === item.key ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {item.icon}
              <span className="hidden xs:block text-[10px]">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 max-w-3xl">

          {/* ── Dashboard ──────────────────────────────────── */}
          {section === 'dashboard' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">الرئيسية</h2>

              {/* Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'الحجوزات', value: bookings.length,      color: 'text-blue-600'   },
                  { label: 'الكباتن',  value: drivers.length,       color: 'text-green-600'  },
                  { label: 'المواعيد', value: slots.length,          color: 'text-purple-600' },
                  { label: 'المناطق',  value: neighborhoods.length,  color: 'text-orange-500' },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Finance overview */}
              {totalRevenue > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-green-600" />
                    <h3 className="font-bold text-slate-900 dark:text-white">الإيرادات — {completedBookings.length} حجز مكتمل</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                      <p className="text-lg font-bold text-slate-900 dark:text-white" dir="ltr">{totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">إجمالي (د.ع)</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 rounded-xl p-3">
                      <p className="text-lg font-bold text-green-700 dark:text-green-400" dir="ltr">{companyRevenue.toLocaleString()}</p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">الشركة 30%</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-3">
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400" dir="ltr">{captainRevenue.toLocaleString()}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">الكباتن 70%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Cycle Simulation */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">اختبار دورة كاملة</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  حجز تجريبي → موافقة → كابتن → عميل — مع إرسال واتساب حقيقي بروابط قصيرة
                </p>
                <input type="tel" dir="ltr"
                  placeholder="07XXXXXXXXX (رقم العميل التجريبي)"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className={inp + ' mb-3'}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400 dark:text-slate-500">المدير يستقبل على رقمه · الكابتن على رقمه · العميل على الرقم أعلاه</p>
                  <button onClick={simulate} disabled={simulating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
                    {IC.play}
                    {simulating ? 'جاري...' : 'تشغيل'}
                  </button>
                </div>

                {simulating && simSteps.length === 0 && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-3 mt-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    جاري تنفيذ الدورة...
                  </div>
                )}
                {simSteps.length > 0 && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    {simSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                          {step.ok ? <Check size={13} strokeWidth={3} /> : <span className="text-xs font-bold">✕</span>}
                        </div>
                        <span className={step.ok ? 'text-slate-700 dark:text-slate-300' : 'text-red-600'}>{step.label}</span>
                      </div>
                    ))}
                    {simSteps.length > 0 && simSteps.every(s => s.ok) && (
                      <p className="text-xs text-green-600 font-medium mt-1">✓ سير العمل يعمل بشكل صحيح</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Workflow / Messages ─────────────────────────── */}
          {section === 'workflow' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">قوالب الرسائل</h2>

              {/* Test panel */}
              <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-4 space-y-3 border border-slate-700">
                <p className="text-white font-semibold text-sm">اختبار إرسال واتساب — {EVENT_META.length} رسائل</p>
                <input type="tel" dir="ltr"
                  placeholder="رقم الهاتف للاختبار (07XXXXXXXXX)"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full bg-white/10 text-white placeholder-white/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <button onClick={testAll} disabled={testingAll}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {IC.send}
                  {testingAll ? 'جاري الإرسال...' : `إرسال دورة كاملة — ${EVENT_META.length} رسائل`}
                </button>
                {testAllResult && (
                  <p className={`text-xs text-center font-mono ${testAllResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                    {testAllResult}
                  </p>
                )}
                {testAllRows.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {testAllRows.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span className={r.ok ? 'text-green-400' : 'text-red-400'}>{r.ok ? '✓' : '✗'}</span>
                        <span className={r.ok ? 'text-white/70' : 'text-red-400'}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 6 Event templates */}
              {EVENT_META.map(meta => {
                const cfg = templates[meta.key] || DEFAULT_TEMPLATES[meta.key];
                return (
                  <div key={meta.key} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta.icon}</span>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{meta.label}</p>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mr-7">{meta.recipient}</p>
                      </div>
                      <Toggle
                        checked={cfg.enabled}
                        onChange={v => setTemplates(p => ({ ...p, [meta.key]: { ...p[meta.key], enabled: v } }))}
                      />
                    </div>

                    {cfg.enabled && (
                      <>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {meta.vars.map(v => (
                            <button key={v} type="button" onClick={() => insertVar(meta.key, v)}
                              className="px-2 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-mono rounded-lg border border-blue-100 dark:border-blue-800 transition-colors">
                              {v}
                            </button>
                          ))}
                        </div>
                        <WaEditor
                          value={cfg.template}
                          onChange={v => setTemplates(p => ({ ...p, [meta.key]: { ...p[meta.key], template: v } }))}
                          rows={5}
                          textareaRef={el => { textareaRefs.current[meta.key] = el; }}
                        />
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => saveTemplate(meta.key)} disabled={!!saving[meta.key]}
                            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${saved[meta.key] ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}>
                            {saving[meta.key] ? '...' : saved[meta.key] ? '✓ تم الحفظ' : 'حفظ القالب'}
                          </button>
                          <button onClick={() => testEvent(meta.key)} disabled={!!testing[meta.key]}
                            className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-sm transition-colors">
                            {testing[meta.key] ? '...' : 'اختبار'}
                          </button>
                        </div>
                        {testResult[meta.key] && (
                          <p className={`text-xs mt-1.5 font-mono ${testResult[meta.key]!.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                            {testResult[meta.key]}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Captains ──────────────────────────────────── */}
          {section === 'drivers' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">الكباتن</h2>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">إضافة كابتن</p>
                <form onSubmit={createDriver} className="space-y-2">
                  <div className="flex gap-2">
                    <input placeholder="الاسم" required className={inp + ' flex-1'} value={newDriver.name}
                      onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))} />
                    <input placeholder="الكود" maxLength={4} required
                      className={inp + ' w-20 text-center font-mono'} value={newDriver.code}
                      onChange={e => setNewDriver(p => ({ ...p, code: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                  <div className="flex gap-2">
                    <input placeholder="واتساب 07XXXXXXXXX" type="tel" dir="ltr"
                      className={inp + ' flex-1'} value={newDriver.phone}
                      onChange={e => setNewDriver(p => ({ ...p, phone: e.target.value }))} />
                    <button type="submit" className={btn('bg-blue-600 hover:bg-blue-700')}>
                      <span className="flex items-center gap-1">{IC.plus} إضافة</span>
                    </button>
                  </div>
                </form>
                {driverMsg && <p className={`text-sm mt-2 ${driverMsg === 'تمت الإضافة' ? 'text-green-600' : 'text-red-500'}`}>{driverMsg}</p>}
              </div>
              <div className="space-y-2">
                {drivers.map(d => (
                  <div key={d.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{d.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        كود: {d.code}{d.phone ? ` · ${d.phone}` : ''}
                      </p>
                    </div>
                    <button onClick={() => deleteDriver(d.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      {IC.trash}
                    </button>
                  </div>
                ))}
                {drivers.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6">لا يوجد كباتن بعد</p>}
              </div>
            </div>
          )}

          {/* ── Managers ──────────────────────────────────── */}
          {section === 'managers' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">المدراء</h2>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">إضافة مدير</p>
                <form onSubmit={createManager} className="space-y-2">
                  <input placeholder="الاسم الكامل" required className={inp} value={newManager.name}
                    onChange={e => setNewManager(p => ({ ...p, name: e.target.value }))} />
                  <div className="flex gap-2">
                    <input placeholder="اسم المستخدم" required dir="ltr"
                      className={inp + ' flex-1'} value={newManager.username}
                      onChange={e => setNewManager(p => ({ ...p, username: e.target.value }))} />
                    <input placeholder="كلمة المرور" type="password" required
                      className={inp + ' flex-1'} value={newManager.password}
                      onChange={e => setNewManager(p => ({ ...p, password: e.target.value }))} />
                    <button type="submit" className={btn('bg-blue-600 hover:bg-blue-700')}>
                      <span className="flex items-center gap-1">{IC.plus} إضافة</span>
                    </button>
                  </div>
                </form>
                {managerMsg && <p className={`text-sm mt-2 ${managerMsg === 'تمت الإضافة' ? 'text-green-600' : 'text-red-500'}`}>{managerMsg}</p>}
              </div>
              <div className="space-y-2">
                {managers.map(m => (
                  <div key={m.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{m.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">@{m.username}</p>
                    </div>
                    <button onClick={() => deleteManager(m.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      {IC.trash}
                    </button>
                  </div>
                ))}
                {managers.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6">لا يوجد مدراء بعد</p>}
              </div>
            </div>
          )}

          {/* ── Locations ──────────────────────────────────── */}
          {section === 'locations' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">المناطق</h2>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <form onSubmit={addNeighborhood} className="flex gap-2 mb-4">
                  <input placeholder="اسم المنطقة" required className={inp + ' flex-1'} value={newNeighbor}
                    onChange={e => setNewNeighbor(e.target.value)} />
                  <button type="submit" className={btn('bg-blue-600 hover:bg-blue-700')}>
                    <span className="flex items-center gap-1">{IC.plus} إضافة</span>
                  </button>
                </form>
                {neighborMsg && <p className={`text-sm mb-3 ${neighborMsg === 'تمت الإضافة' ? 'text-green-600' : 'text-red-500'}`}>{neighborMsg}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {neighborhoods.map(n => (
                    <div key={n} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{n}</span>
                      <button onClick={() => deleteNeighborhood(n)} className="text-slate-300 hover:text-red-500 transition-colors mr-2 flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Settings ───────────────────────────────────── */}
          {section === 'settings' && (
            <div className="space-y-5">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">الإعدادات</h2>

              {/* ── Automation (If → Then) ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">الأتمتة — قواعد الإشعارات</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                  عدّل متى وكيف يتم إرسال الرسائل تلقائياً. التغييرات تُطبَّق فوراً بعد الحفظ.
                </p>

                {EVENT_META.map(meta => {
                  const cfg = templates[meta.key] || DEFAULT_TEMPLATES[meta.key];
                  return (
                    <div key={meta.key}
                      className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all ${cfg.enabled ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'} p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          {/* IF */}
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded-md uppercase tracking-wide">إذا</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{meta.icon} {meta.ifLabel}</span>
                          </div>
                          {/* Arrow */}
                          <div className="flex items-center gap-2 pr-2">
                            <div className="w-0.5 h-5 bg-slate-200 dark:bg-slate-600 mr-2" />
                            <svg className="w-3 h-3 text-slate-400 -mt-1" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M6 9L1.5 4h9z" />
                            </svg>
                          </div>
                          {/* THEN */}
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-md uppercase tracking-wide">إذن</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300">📱 {meta.thenLabel}</span>
                          </div>
                          {meta.extra && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 pr-2">← {meta.extra}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Toggle
                            checked={cfg.enabled}
                            onChange={async v => {
                              const next = { ...templates, [meta.key]: { ...cfg, enabled: v } };
                              setTemplates(next);
                              await fetch('/api/admin/notification-templates', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ templates: next }),
                              }).catch(() => {});
                            }}
                          />
                          <span className="text-[10px] text-slate-400">{cfg.enabled ? 'مفعّل' : 'معطّل'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={saveAllTemplates}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  حفظ جميع قواعد الأتمتة
                </button>
              </div>

              {/* System info */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">معلومات النظام</p>
                <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400 mb-4">
                  <p>الحجوزات: {bookings.length} · مكتملة: {completedBookings.length}</p>
                  <p>الكباتن: {drivers.length} · المدراء: {managers.length}</p>
                  <p>المناطق: {neighborhoods.length} · المواعيد: {slots.length}</p>
                  {totalRevenue > 0 && <p>إجمالي الإيرادات: {totalRevenue.toLocaleString()} د.ع</p>}
                </div>
                <a href="/api/health" target="_blank" className="inline-block text-xs text-blue-600 underline">
                  فحص حالة الخادم
                </a>
              </div>

              {/* Danger zone */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-800 p-5">
                <p className="font-semibold text-red-700 dark:text-red-400 mb-1 text-sm">منطقة الخطر</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">سيتم حذف جميع الحجوزات والروابط القصيرة وإعادة ضبط البيانات</p>
                <button onClick={reset} disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                  {IC.trash}
                  {resetting ? 'جاري الإعادة...' : 'إعادة ضبط جميع البيانات'}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
