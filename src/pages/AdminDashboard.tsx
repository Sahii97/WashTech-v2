import React, { useState, useEffect, useRef } from 'react';

// ── Build info ────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `منذ ${diff} ث`;
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}
const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0';
const BUILD_TIME    = typeof __BUILD_TIME__    !== 'undefined' ? __BUILD_TIME__    : new Date().toISOString();

// ── Types ─────────────────────────────────────────────────────
type Driver   = { id: string; name: string; code: string; phone?: string };
type Manager  = { id: string; name: string; username: string };
type EventKey = 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected';
type Section  = 'dashboard' | 'workflow' | 'drivers' | 'managers' | 'locations' | 'settings';
interface TemplateConfig { enabled: boolean; template: string; }
type Templates = Record<EventKey, TemplateConfig>;

const DEFAULT_TEMPLATES: Templates = {
  new_booking:      { enabled: true, template: '📦 *حجز جديد* #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}\n\n──────────────\n✅ *قبول الحجز:*\n{{approveLink}}\n\n❌ *رفض الحجز:*\n{{rejectLink}}' },
  booking_approved: { enabled: true, template: '✅ *مهمة جديدة*\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\n──────────────\n▶️ *اضغط لقبول المهمة:*\n{{acceptLink}}' },
  driver_accepted:  { enabled: true, template: '🚗 *سائقك في الطريق إليك!*\n👨‍💼 السائق: {{driverName}}\n🕐 الوقت: {{slot}}\n\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼' },
  booking_rejected: { enabled: true, template: '❌ عذراً {{name}}،\nلم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\n\nWashTech 🚗' },
};

const EVENT_META: { key: EventKey; label: string; recipient: string; vars: string[] }[] = [
  { key: 'new_booking',      label: 'حجز جديد ← المدير',         recipient: 'يُرسل إلى: المدير',   vars: ['id','name','phone','neighborhood','carType','package','date','slot','approveLink','rejectLink'] },
  { key: 'booking_approved', label: 'تمت الموافقة ← السائق',     recipient: 'يُرسل إلى: السائق',   vars: ['name','phone','neighborhood','slot','driverName','driverPhone','acceptLink'] },
  { key: 'driver_accepted',  label: 'السائق في الطريق ← العميل', recipient: 'يُرسل إلى: العميل',   vars: ['name','phone','driverName','slot'] },
  { key: 'booking_rejected', label: 'تم الرفض ← العميل',         recipient: 'يُرسل إلى: العميل',   vars: ['name','phone'] },
];

// ── Icons ─────────────────────────────────────────────────────
const IC = {
  grid: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  bell: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  car:  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l.5.5M13 16l.5.5M13 16H9m5-10h2l3 4v6h-2M4 11h9"/></svg>,
  users:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
  pin:  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  cog:  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  play: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z"/></svg>,
  trash:<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
  check:<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
};

const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard',  label: 'الرئيسية',    icon: IC.grid  },
  { key: 'workflow',   label: 'سير العمل',   icon: IC.bell  },
  { key: 'drivers',    label: 'السائقون',    icon: IC.car   },
  { key: 'managers',   label: 'المدراء',     icon: IC.users },
  { key: 'locations',  label: 'المناطق',     icon: IC.pin   },
  { key: 'settings',   label: 'الإعدادات',   icon: IC.cog   },
];

// ── Shared ────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white transition';
const btn = (color: string) => `px-4 py-2.5 ${color} text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40`;

// ── Main component ────────────────────────────────────────────
export default function AdminDashboard() {
  const [section, setSection] = useState<Section>('dashboard');

  // Data
  const [drivers,       setDrivers]       = useState<Driver[]>([]);
  const [managers,      setManagers]      = useState<Manager[]>([]);
  const [bookingCount,  setBookingCount]  = useState(0);
  const [slots,         setSlots]         = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  // Forms
  const [newDriver,   setNewDriver]   = useState({ name: '', code: '', phone: '' });
  const [newManager,  setNewManager]  = useState({ name: '', username: '', password: '' });
  const [newNeighbor, setNewNeighbor] = useState('');

  // Status messages
  const [driverMsg,   setDm]  = useState('');
  const [managerMsg,  setMm]  = useState('');
  const [neighborMsg, setNm]  = useState('');
  const [resetting,   setRes] = useState(false);

  // Templates
  const [templates,     setTemplates]     = useState<Templates>(DEFAULT_TEMPLATES);
  const [saving,        setSaving]        = useState<Partial<Record<EventKey, boolean>>>({});
  const [saved,         setSaved]         = useState<Partial<Record<EventKey, boolean>>>({});
  const [testing,       setTesting]       = useState<Partial<Record<EventKey, boolean>>>({});
  const [testResult,    setTestResult]    = useState<Partial<Record<EventKey, string>>>({});
  const [testPhone,     setTestPhone]     = useState('');
  const [testingAll,    setTestingAll]    = useState(false);
  const [testAllResult, setTestAllResult] = useState('');
  const textareaRefs = useRef<Partial<Record<EventKey, HTMLTextAreaElement | null>>>({});

  // Simulate cycle
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
    setBookingCount((b.bookings || []).length);
    setSlots(s.slots || []);
    setNeighborhoods(n.neighborhoods || []);
    setManagers(m.managers || []);
    if (t.templates) setTemplates(t.templates);
  }

  // ── Driver CRUD ──────────────────────────────────────────
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
  async function deleteDriver(id: string) {
    await fetch(`/api/admin/driver/${id}`, { method: 'DELETE' });
    loadAll();
  }

  // ── Manager CRUD ─────────────────────────────────────────
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
  async function deleteManager(id: string) {
    await fetch(`/api/admin/manager/${id}`, { method: 'DELETE' });
    loadAll();
  }

  // ── Neighborhood CRUD ────────────────────────────────────
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
    await fetch(`/api/admin/neighborhoods/${encodeURIComponent(name)}`, { method: 'DELETE' });
    loadAll();
  }

  // ── Reset ────────────────────────────────────────────────
  async function reset() {
    if (!window.confirm('حذف جميع الحجوزات وإعادة ضبط البيانات؟')) return;
    setRes(true);
    await fetch('/api/admin/reset', { method: 'POST' });
    setRes(false);
    loadAll();
  }

  // ── Simulate cycle ───────────────────────────────────────
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

  // ── Templates ────────────────────────────────────────────
  function insertVar(key: EventKey, v: string) {
    const el = textareaRefs.current[key];
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd   ?? el.value.length;
    const token = `{{${v}}}`;
    setTemplates(p => ({ ...p, [key]: { ...p[key], template: el.value.slice(0,s) + token + el.value.slice(e) } }));
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
    const res = await fetch('/api/admin/test-all-notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPhone: testPhone.trim() || undefined }),
    }).catch(() => null);
    const d = res ? await res.json() : { error: 'Network error' };
    setTestAllResult(d.success ? `✓ تم الإرسال إلى ${d.sentTo}` : `✗ ${d.error}`);
    setTestingAll(false);
    setTimeout(() => setTestAllResult(''), 6000);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">واش تك — الإدارة</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              v{BUILD_VERSION} · {timeAgo(BUILD_TIME)} · {bookingCount} حجز · {drivers.length} سائق
            </p>
          </div>
        </div>
        <button onClick={loadAll} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8 8 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8 8 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </header>

      {/* Sidebar + Content layout */}
      <div className="flex flex-1">

        {/* Sidebar (desktop) / Tab bar (mobile) */}
        <aside className="hidden lg:flex flex-col w-52 bg-white border-l border-slate-200 p-3 gap-1 sticky top-[61px] self-start h-[calc(100vh-61px)]">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                section === item.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </aside>

        {/* Mobile tab bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-10">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                section === item.key ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <span className={section === item.key ? 'text-slate-900' : 'text-slate-400'}>{item.icon}</span>
              <span className="hidden xs:block">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 max-w-3xl">

          {/* ── Dashboard ──────────────────────────────────── */}
          {section === 'dashboard' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-lg">الرئيسية</h2>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'الحجوزات',   value: bookingCount,       color: 'text-blue-600'  },
                  { label: 'السائقون',   value: drivers.length,     color: 'text-green-600' },
                  { label: 'المواعيد',   value: slots.length,       color: 'text-purple-600'},
                  { label: 'المناطق',    value: neighborhoods.length,color: 'text-orange-500'},
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Full Cycle Simulation */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900">اختبار دورة كاملة</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    حجز تجريبي → موافقة → سائق → عميل — مع إرسال واتساب حقيقي
                  </p>
                </div>
                <input
                  type="tel" dir="ltr"
                  placeholder="07XXXXXXXX (رقم العميل التجريبي)"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">المدير يستقبل على رقمه · السائق على رقمه · العميل على الرقم أعلاه</p>
                  <button
                    onClick={simulate}
                    disabled={simulating}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0 mr-3"
                  >
                    {IC.play}
                    {simulating ? 'جاري...' : 'تشغيل'}
                  </button>
                </div>

                {simulating && simSteps.length === 0 && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    جاري تنفيذ الدورة...
                  </div>
                )}

                {simSteps.length > 0 && (
                  <div className="space-y-2">
                    {simSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${step.ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                          {step.ok ? IC.check : '✕'}
                        </div>
                        <span className={step.ok ? 'text-slate-700' : 'text-red-600'}>{step.label}</span>
                      </div>
                    ))}
                    {simSteps.every(s => s.ok) && (
                      <p className="text-xs text-green-600 font-medium mt-2 pt-2 border-t border-slate-100">
                        سير العمل يعمل بشكل صحيح
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Workflow ────────────────────────────────────── */}
          {section === 'workflow' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-lg">سير العمل والإشعارات</h2>

              {/* Test panel */}
              <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
                <p className="text-white font-semibold text-sm">اختبار إرسال واتساب</p>
                <input
                  type="tel" dir="ltr"
                  placeholder="رقم الهاتف للاختبار (07XXXXXXXX)"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full bg-white/10 text-white placeholder-white/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <button
                  onClick={testAll}
                  disabled={testingAll}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  {testingAll ? 'جاري الإرسال...' : 'إرسال دورة كاملة — 4 رسائل'}
                </button>
                {testAllResult && (
                  <p className={`text-xs text-center font-mono ${testAllResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                    {testAllResult}
                  </p>
                )}
              </div>

              {/* Event templates */}
              {EVENT_META.map(meta => {
                const cfg = templates[meta.key];
                return (
                  <div key={meta.key} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{meta.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{meta.recipient}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox" className="sr-only peer"
                          checked={cfg.enabled}
                          onChange={e => setTemplates(p => ({ ...p, [meta.key]: { ...p[meta.key], enabled: e.target.checked } }))}
                        />
                        <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
                      </label>
                    </div>

                    {cfg.enabled && (
                      <>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {meta.vars.map(v => (
                            <button key={v} type="button" onClick={() => insertVar(meta.key, v)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-mono rounded-lg border border-blue-100 transition-colors">
                              {`{{${v}}}`}
                            </button>
                          ))}
                        </div>
                        <textarea
                          ref={el => { textareaRefs.current[meta.key] = el; }}
                          value={cfg.template}
                          onChange={e => setTemplates(p => ({ ...p, [meta.key]: { ...p[meta.key], template: e.target.value } }))}
                          rows={5} dir="auto"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none font-mono transition"
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => saveTemplate(meta.key)} disabled={!!saving[meta.key]}
                            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${saved[meta.key] ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}>
                            {saving[meta.key] ? '...' : saved[meta.key] ? 'تم الحفظ' : 'حفظ'}
                          </button>
                          <button onClick={() => testEvent(meta.key)} disabled={!!testing[meta.key]}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-sm transition-colors">
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

          {/* ── Drivers ─────────────────────────────────────── */}
          {section === 'drivers' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-lg">السائقون</h2>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">إضافة سائق</p>
                <form onSubmit={createDriver} className="space-y-2">
                  <div className="flex gap-2">
                    <input placeholder="الاسم" required className={inp + ' flex-1'} value={newDriver.name}
                      onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))} />
                    <input placeholder="الكود" maxLength={4} required
                      className={inp + ' w-20 text-center font-mono'} value={newDriver.code}
                      onChange={e => setNewDriver(p => ({ ...p, code: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                  <div className="flex gap-2">
                    <input placeholder="واتساب 07XXXXXXXX" type="tel" dir="ltr"
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
                  <div key={d.id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{d.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        كود: {d.code}{d.phone ? ` · ${d.phone}` : ''}
                      </p>
                    </div>
                    <button onClick={() => deleteDriver(d.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      {IC.trash}
                    </button>
                  </div>
                ))}
                {drivers.length === 0 && <p className="text-slate-400 text-sm text-center py-6">لا يوجد سائقون بعد</p>}
              </div>
            </div>
          )}

          {/* ── Managers ────────────────────────────────────── */}
          {section === 'managers' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-lg">المدراء</h2>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">إضافة مدير</p>
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
                  <div key={m.id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{m.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">@{m.username}</p>
                    </div>
                    <button onClick={() => deleteManager(m.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      {IC.trash}
                    </button>
                  </div>
                ))}
                {managers.length === 0 && <p className="text-slate-400 text-sm text-center py-6">لا يوجد مدراء بعد</p>}
              </div>
            </div>
          )}

          {/* ── Locations ───────────────────────────────────── */}
          {section === 'locations' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-lg">المناطق</h2>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
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
                    <div key={n} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                      <span className="text-sm text-slate-700 truncate">{n}</span>
                      <button onClick={() => deleteNeighborhood(n)} className="text-slate-300 hover:text-red-500 transition-colors mr-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Settings ────────────────────────────────────── */}
          {section === 'settings' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-lg">الإعدادات</h2>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-1">معلومات النظام</p>
                <div className="space-y-1 text-sm text-slate-500 mb-4">
                  <p>الحجوزات: {bookingCount}</p>
                  <p>السائقون: {drivers.length}</p>
                  <p>المدراء: {managers.length}</p>
                  <p>المناطق: {neighborhoods.length}</p>
                  <p>المواعيد: {slots.length}</p>
                </div>
                <a href="/api/health" target="_blank"
                  className="inline-block text-xs text-blue-600 underline mb-4">
                  فحص حالة الخادم
                </a>
              </div>
              <div className="bg-white rounded-2xl border border-red-200 p-5">
                <p className="font-semibold text-red-700 mb-1 text-sm">منطقة الخطر</p>
                <p className="text-xs text-slate-500 mb-4">سيتم حذف جميع الحجوزات وإعادة ضبط البيانات</p>
                <button
                  onClick={reset}
                  disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
                >
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
