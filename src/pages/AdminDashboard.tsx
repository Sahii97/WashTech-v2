import React, { useState, useEffect } from 'react';

type Driver = { id: string; name: string; code: string };

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newDriver, setNewDriver] = useState({ name: '', code: '' });
  const [bookingCount, setBookingCount] = useState(0);
  const [status, setStatus] = useState('');
  const [resetting, setResetting] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [d, b, s] = await Promise.all([
      fetch('/api/drivers').then(r => r.json()),
      fetch('/api/bookings').then(r => r.json()),
      fetch('/api/slots').then(r => r.json()),
    ]);
    setDrivers(d.drivers || []);
    setBookingCount((b.bookings || []).length);
    setSlots(s.slots || []);
  }

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!newDriver.name || !newDriver.code) return;
    const res = await fetch('/api/admin/create-driver', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDriver),
    });
    if (res.ok) { setNewDriver({ name: '', code: '' }); setStatus('Driver created ✓'); load(); }
    setTimeout(() => setStatus(''), 2000);
  }

  async function deleteDriver(id: string) {
    await fetch(`/api/admin/driver/${id}`, { method: 'DELETE' });
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
            <Stat label="WhatsApp (WasenderAPI)" value="Connected" />
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
          <form onSubmit={createDriver} className="flex gap-2 mb-4">
            <input
              placeholder="Name"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={newDriver.name}
              onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              placeholder="Code"
              maxLength={4}
              className="w-20 px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={newDriver.code}
              onChange={e => setNewDriver(p => ({ ...p, code: e.target.value.replace(/\D/g, '') }))}
              required
            />
            <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors">
              Add
            </button>
          </form>
          {status && <p className="text-green-600 text-sm mb-3">{status}</p>}
          <div className="space-y-2">
            {drivers.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{d.name}</p>
                  <p className="text-xs text-slate-400 font-mono">Code: {d.code}</p>
                </div>
                <button
                  onClick={() => deleteDriver(d.id)}
                  className="text-red-400 hover:text-red-600 text-sm transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
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
