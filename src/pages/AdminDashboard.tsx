import React, { useState, useEffect, useRef } from 'react';

type Driver = { id: string; name: string; code: string; phone?: string };
type EventKey = 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected';
interface TemplateConfig { enabled: boolean; template: string; }
type Templates = Record<EventKey, TemplateConfig>;

const DEFAULT_TEMPLATES: Templates = {
  new_booking:      { enabled: true, template: '📦 حجز جديد #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}' },
  booking_approved: { enabled: true, template: '✅ لديك حجز جديد\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\nافتح تطبيق السائق واضغط قبول المهمة' },
  driver_accepted:  { enabled: true, template: '🚗 سائقك في الطريق إليك!\n👨‍💼 السائق: {{driverName}}\n🕐 الوقت: {{slot}}\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼' },
  booking_rejected: { enabled: true, template: '❌ عذراً، لم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\nWashTech 🚗' },
};

const EVENT_META: {
  key: EventKey; label: string; recipient: string; vars: string[];
}[] = [
  { key: 'new_booking',      label: '📦 New Booking → Manager',       recipient: 'Sent to: Manager',  vars: ['id','name','phone','neighborhood','carType','package','date','slot','approveLink','rejectLink'] },
  { key: 'booking_approved', label: '✅ Booking Approved → Driver',    recipient: 'Sent to: Driver',   vars: ['name','phone','neighborhood','slot','driverName','driverPhone','acceptLink'] },
  { key: 'driver_accepted',  label: '🚗 Driver On The Way → Customer', recipient: 'Sent to: Customer', vars: ['name','phone','driverName','slot'] },
  { key: 'booking_rejected', label: '❌ Booking Rejected → Customer',  recipient: 'Sent to: Customer', vars: ['name','phone'] },
];

type Manager = { id: string; name: string; username: string };

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newDriver, setNewDriver] = useState({ name: '', code: '', phone: '' });
  const [bookingCount, setBookingCount] = useState(0);
  const [status, setStatus] = useState('');
  const [resetting, setResetting] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [neighborhoodStatus, setNeighborhoodStatus] = useState('');
  const [managers, setManagers] = useState<Manager[]>([]);
  const [newManager, setNewManager] = useState({ name: '', username: '', password: '' });
  const [managerStatus, setManagerStatus] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [d, b, s, n, m] = await Promise.all([
      fetch('/api/drivers').then(r => r.json()),
      fetch('/api/bookings').then(r => r.json()),
      fetch('/api/slots').then(r => r.json()),
      fetch('/api/neighborhoods').then(r => r.json()),
      fetch('/api/admin/managers').then(r => r.json()),
    ]);
    setDrivers(d.drivers || []);
    setBookingCount((b.bookings || []).length);
    setSlots(s.slots || []);
    setNeighborhoods(n.neighborhoods || []);
    setManagers(m.managers || []);
  }

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!newDriver.name || !newDriver.code) return;
    const res = await fetch('/api/admin/create-driver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDriver),
    });
    if (res.ok) { setNewDriver({ name: '', code: '', phone: '' }); setStatus('Driver created ✓'); load(); }
    setTimeout(() => setStatus(''), 2000);
  }

  async function deleteDriver(id: string) {
    await fetch(`/api/admin/driver/${id}`, { method: 'DELETE' });
    load();
  }

  async function createManager(e: React.FormEvent) {
    e.preventDefault();
    if (!newManager.name || !newManager.username || !newManager.password) return;
    const res = await fetch('/api/admin/create-manager', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newManager),
    });
    if (res.ok) { setNewManager({ name: '', username: '', password: '' }); setManagerStatus('Manager created ✓'); load(); }
    else { const d = await res.json(); setManagerStatus(d.error || 'Error'); }
    setTimeout(() => setManagerStatus(''), 3000);
  }

  async function deleteManager(id: string) {
    await fetch(`/api/admin/manager/${id}`, { method: 'DELETE' });
    load();
  }

  async function addNeighborhood(e: React.FormEvent) {
    e.preventDefault();
    if (!newNeighborhood.trim()) return;
    const res = await fetch('/api/admin/neighborhoods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newNeighborhood.trim() }),
    });
    if (res.ok) { setNewNeighborhood(''); setNeighborhoodStatus('Added ✓'); load(); }
    else { const d = await res.json(); setNeighborhoodStatus(d.error || 'Error'); }
    setTimeout(() => setNeighborhoodStatus(''), 2000);
  }

  async function deleteNeighborhood(name: string) {
    await fetch(`/api/admin/neighborhoods/${encodeURIComponent(name)}`, { method: 'DELETE' });
    load();
  }

  async function reset() {
    if (!window.confirm('Delete ALL bookings and reset data?')) return;
    setResetting(true);
    await fetch('/api/admin/reset', { method: 'POST' });
    setResetting(false);
    load();
    window.location.reload();
  }

  // ── Notification templates ──────────────────────────────────
  const [templates, setTemplates] = useState<Templates>(DEFAULT_TEMPLATES);
  const [templateSaving, setTemplateSaving] = useState<Partial<Record<EventKey, boolean>>>({});
  const [templateSaved,  setTemplateSaved]  = useState<Partial<Record<EventKey, boolean>>>({});
  const textareaRefs = useRef<Partial<Record<EventKey, HTMLTextAreaElement | null>>>({});

  const [testPhone,    setTestPhone]    = useState('');
  const [testing,      setTesting]      = useState<Partial<Record<EventKey, boolean>>>({});
  const [testResult,   setTestResult]   = useState<Partial<Record<EventKey, string>>>({});
  const [testingAll,   setTestingAll]   = useState(false);
  const [testAllResult,setTestAllResult]= useState('');

  useEffect(() => {
    fetch('/api/admin/notification-templates')
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .catch(console.error);
  }, []);

  function insertVar(key: EventKey, varName: string) {
    const el = textareaRefs.current[key];
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const token = `{{${varName}}}`;
    const next  = el.value.slice(0, start) + token + el.value.slice(end);
    setTemplates(prev => ({ ...prev, [key]: { ...prev[key], template: next } }));
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + token.length; el.focus(); }, 0);
  }

  async function saveTemplate(key: EventKey) {
    setTemplateSaving(prev => ({ ...prev, [key]: true }));
    await fetch('/api/admin/notification-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    }).catch(console.error);
    setTemplateSaving(prev => ({ ...prev, [key]: false }));
    setTemplateSaved(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setTemplateSaved(prev => ({ ...prev, [key]: false })), 2000);
  }

  async function testEvent(key: EventKey) {
    setTesting(prev => ({ ...prev, [key]: true }));
    setTestResult(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: key, testPhone: testPhone.trim() || undefined }),
      });
      const d = await res.json();
      setTestResult(prev => ({ ...prev, [key]: d.success ? `✓ Sent to ${d.sentTo}` : `✗ ${d.error}` }));
    } catch { setTestResult(prev => ({ ...prev, [key]: '✗ Network error' })); }
    setTesting(prev => ({ ...prev, [key]: false }));
    setTimeout(() => setTestResult(prev => ({ ...prev, [key]: '' })), 4000);
  }

  async function testAll() {
    setTestingAll(true);
    setTestAllResult('Sending 4 messages...');
    try {
      const res = await fetch('/api/admin/test-all-notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPhone: testPhone.trim() || undefined }),
      });
      const d = await res.json();
      setTestAllResult(d.success ? `✓ All sent to ${d.sentTo}` : `✗ ${d.error}`);
    } catch { setTestAllResult('✗ Network error'); }
    setTestingAll(false);
    setTimeout(() => setTestAllResult(''), 5000);
  }
  // ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500">System management</p>
      </header>

      <div className="max-w-4xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">System Status</h2>
          <div className="space-y-3">
            <Stat label="Total Bookings" value={bookingCount} />
            <Stat label="Active Drivers" value={drivers.length} />
            <Stat label="Available Slots" value={slots.length} />
            <Stat label="Neighborhoods" value={neighborhoods.length} />
            <Stat label="WhatsApp" value="WasenderAPI" />
          </div>
          <button
            onClick={reset}
            disabled={resetting}
            className="mt-6 w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {resetting ? 'Resetting...' : 'Reset All Data'}
          </button>
        </div>

        {/* Driver management */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Driver Management</h2>
          <form onSubmit={createDriver} className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input
                placeholder="Name"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newDriver.name}
                onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))}
                required
              />
              <input
                placeholder="Code"
                maxLength={4}
                className="w-20 px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newDriver.code}
                onChange={e => setNewDriver(p => ({ ...p, code: e.target.value.replace(/\D/g, '') }))}
                required
              />
            </div>
            <div className="flex gap-2">
              <input
                placeholder="WhatsApp +9647xxxxxxxxx"
                type="tel"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newDriver.phone}
                onChange={e => setNewDriver(p => ({ ...p, phone: e.target.value }))}
              />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">
                Add
              </button>
            </div>
          </form>
          {status && <p className="text-green-600 text-sm mb-3">{status}</p>}
          <div className="space-y-2">
            {drivers.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-400 font-mono">Code: {d.code}{d.phone ? ` · ${d.phone}` : ''}</p>
                </div>
                <button onClick={() => deleteDriver(d.id)} className="text-red-400 hover:text-red-600 text-sm transition-colors">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Manager accounts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Manager Accounts</h2>
          <form onSubmit={createManager} className="space-y-2 mb-4">
            <input
              placeholder="Full Name"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newManager.name}
              onChange={e => setNewManager(p => ({ ...p, name: e.target.value }))}
              required
            />
            <div className="flex gap-2">
              <input
                placeholder="Username"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newManager.username}
                onChange={e => setNewManager(p => ({ ...p, username: e.target.value }))}
                required
              />
              <input
                placeholder="Password"
                type="password"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newManager.password}
                onChange={e => setNewManager(p => ({ ...p, password: e.target.value }))}
                required
              />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">
                Add
              </button>
            </div>
          </form>
          {managerStatus && (
            <p className={`text-sm mb-3 ${managerStatus.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {managerStatus}
            </p>
          )}
          <div className="space-y-2">
            {managers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3">No managers yet</p>
            )}
            {managers.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                  <p className="text-xs text-slate-400 font-mono">@{m.username}</p>
                </div>
                <button onClick={() => deleteManager(m.id)} className="text-red-400 hover:text-red-600 text-sm transition-colors">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Neighborhood management */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
          <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Location Management — المناطق</h2>
          <form onSubmit={addNeighborhood} className="flex gap-2 mb-4">
            <input
              placeholder="اسم المنطقة / Add neighborhood"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newNeighborhood}
              onChange={e => setNewNeighborhood(e.target.value)}
              required
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">
              Add
            </button>
          </form>
          {neighborhoodStatus && (
            <p className={`text-sm mb-3 ${neighborhoodStatus.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {neighborhoodStatus}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {neighborhoods.map(n => (
              <div key={n} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                <span className="text-sm text-slate-700 truncate">{n}</span>
                <button onClick={() => deleteNeighborhood(n)} className="text-red-400 hover:text-red-600 text-xs ml-2 flex-shrink-0 transition-colors">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Notification workflow editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#1c1c1e] rounded-2xl p-5 space-y-3">
            <p className="text-white font-bold text-sm tracking-wide">🧪 Test WhatsApp Notifications</p>
            <input
              type="tel"
              dir="ltr"
              placeholder="Test phone number (default: manager phone)"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-white/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <button
              type="button"
              onClick={testAll}
              disabled={testingAll}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all"
            >
              {testingAll ? 'Sending...' : '⚡ Test Full Cycle — all 4 events in sequence'}
            </button>
            {testAllResult && (
              <p className={`text-xs font-mono text-center ${testAllResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {testAllResult}
              </p>
            )}
          </div>

          {EVENT_META.map(meta => {
            const cfg = templates[meta.key];
            return (
              <div key={meta.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{meta.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{meta.recipient}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={e => setTemplates(prev => ({ ...prev, [meta.key]: { ...prev[meta.key], enabled: e.target.checked } }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
                  </label>
                </div>

                {cfg.enabled && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {meta.vars.map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVar(meta.key, v)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-mono rounded-lg border border-blue-100 transition-colors"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>

                    <textarea
                      ref={el => { textareaRefs.current[meta.key] = el; }}
                      value={cfg.template}
                      onChange={e => setTemplates(prev => ({ ...prev, [meta.key]: { ...prev[meta.key], template: e.target.value } }))}
                      rows={5}
                      dir="auto"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-mono"
                      placeholder="Write your WhatsApp message here..."
                    />

                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => saveTemplate(meta.key)}
                        disabled={!!templateSaving[meta.key]}
                        className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                          templateSaved[meta.key]
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        } disabled:opacity-50`}
                      >
                        {templateSaving[meta.key] ? '...' : templateSaved[meta.key] ? '✓ Saved' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => testEvent(meta.key)}
                        disabled={!!testing[meta.key]}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
                      >
                        {testing[meta.key] ? '...' : '🧪'}
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

      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 text-sm">{value}</span>
    </div>
  );
}
