import 'dotenv/config';
import express from 'express';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, addDoc, getDocs,
  doc, updateDoc, deleteDoc, setDoc, getDoc,
} from 'firebase/firestore';

// ── Firebase ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY            || 'AIzaSyDRxH5dqU0RanerfWCTYuI2WR5Cv43K2sU',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || 'gen-lang-client-0754111363.firebaseapp.com',
  projectId:         process.env.FIREBASE_PROJECT_ID         || 'gen-lang-client-0754111363',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || 'gen-lang-client-0754111363.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID|| '271263579220',
  appId:             process.env.FIREBASE_APP_ID             || '1:271263579220:web:8aae94d14a4d96f38d01c1',
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fbApp, process.env.FIREBASE_DATABASE_ID || 'ai-studio-ae98497f-378e-4913-8fbf-662dadf0b548');

// ── Config ────────────────────────────────────────────────────
const WASENDER_TOKEN = process.env.WASENDER_API_TOKEN || '';
const MANAGER_PHONE  = process.env.MANAGER_PHONE      || '+9647809471576';
const N8N_WEBHOOK    = process.env.N8N_WEBHOOK_URL    || '';

const DEFAULT_SLOTS = [
  '09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
  '07:00 PM','08:00 PM','09:00 PM','10:00 PM',
];
const DEFAULT_NEIGHBORHOODS = [
  'عنكاوة','عدن','آزادي','بحركة','ريزان','كويسنجق',
  'ولي','بناسلاوة','زرگوس','سامي عبدالرحمن','إسكان',
];
const DEFAULT_DRIVERS = [{ id: 'd1', name: 'Ali', code: '1234', phone: '+9647809471576' }];

// ── Firestore helpers ─────────────────────────────────────────
async function getSetting<T>(key: string, def: T): Promise<T> {
  try {
    const d = await getDoc(doc(db, 'settings', key));
    return d.exists() ? (d.data() as any).value : def;
  } catch { return def; }
}
async function setSetting(key: string, value: any) {
  await setDoc(doc(db, 'settings', key), { value });
}
async function getDrivers() {
  const snap = await getDocs(collection(db, 'drivers'));
  if (snap.empty) {
    for (const d of DEFAULT_DRIVERS) {
      await setDoc(doc(db, 'drivers', d.id), { name: d.name, code: d.code, phone: d.phone });
    }
    return DEFAULT_DRIVERS;
  }
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

// ── Notifications ─────────────────────────────────────────────
async function sendWhatsApp(to: string, text: string): Promise<boolean> {
  if (!WASENDER_TOKEN) return false;
  try {
    const res = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
    });
    return res.ok;
  } catch { return false; }
}

async function notify(event: string, data: any) {
  if (N8N_WEBHOOK) {
    // n8n handles all WhatsApp — send event and stop
    try {
      await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...data }),
      });
    } catch (e) { console.error('[n8n]', e); }
  } else {
    // Fallback: direct WhatsApp (no n8n configured)
    if (event === 'new_booking') {
      const d = data;
      const msg = `📦 حجز جديد #${d.id?.slice(-5)}\n👤 ${d.name}\n📞 ${d.phone}\n📍 ${d.neighborhood}\n🚗 ${d.carType} — ${d.package}\n🕐 ${d.date === 'today' ? 'اليوم' : 'غداً'} ${d.slot}`;
      sendWhatsApp(MANAGER_PHONE, msg).catch(console.error);
    }
    if (event === 'booking_approved') {
      const d = data;
      sendWhatsApp(d.driverPhone || MANAGER_PHONE, `✅ لديك حجز جديد\n👤 ${d.name}\n📍 ${d.neighborhood}\n🕐 ${d.slot}`).catch(console.error);
      if (d.phone) sendWhatsApp(d.phone, `✅ تم تأكيد حجزك!\n🚗 السائق: ${d.driverName}\n🕐 ${d.slot}`).catch(console.error);
    }
    if (event === 'driver_accepted') {
      const d = data;
      if (d.phone) sendWhatsApp(d.phone, `🚗 سائقك في الطريق!\n👨‍💼 ${d.driverName}\n🕐 ${d.slot}`).catch(console.error);
    }
    if (event === 'booking_rejected') {
      const d = data;
      if (d.phone) sendWhatsApp(d.phone, `❌ عذراً، لم نتمكن من قبول حجزك. يرجى المحاولة مرة أخرى.`).catch(console.error);
    }
  }
}

// ── Express app ───────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.1', n8n: !!N8N_WEBHOOK, wasender: !!WASENDER_TOKEN });
});

// ── Slots ─────────────────────────────────────────────────────
app.get('/api/slots', async (_req, res) => {
  res.json({ slots: await getSetting('slots', DEFAULT_SLOTS) });
});
app.post('/api/slots', async (req, res) => {
  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be array' });
  await setSetting('slots', slots);
  res.json({ success: true });
});

// ── Neighborhoods ─────────────────────────────────────────────
app.get('/api/neighborhoods', async (_req, res) => {
  res.json({ neighborhoods: await getSetting('neighborhoods', DEFAULT_NEIGHBORHOODS) });
});
app.post('/api/admin/neighborhoods', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const list = await getSetting<string[]>('neighborhoods', DEFAULT_NEIGHBORHOODS);
  if (list.includes(name.trim())) return res.status(400).json({ error: 'Already exists' });
  list.push(name.trim());
  await setSetting('neighborhoods', list);
  res.json({ success: true, neighborhoods: list });
});
app.delete('/api/admin/neighborhoods/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const list = await getSetting<string[]>('neighborhoods', DEFAULT_NEIGHBORHOODS);
  await setSetting('neighborhoods', list.filter(n => n !== name));
  res.json({ success: true });
});

// ── Drivers ───────────────────────────────────────────────────
app.get('/api/drivers', async (_req, res) => {
  res.json({ drivers: await getDrivers() });
});
app.post('/api/admin/create-driver', async (req, res) => {
  const { name, code, phone } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  const id = `d${Date.now()}`;
  await setDoc(doc(db, 'drivers', id), { name, code, phone: phone || '' });
  res.json({ success: true, driver: { id, name, code, phone: phone || '' } });
});
app.delete('/api/admin/driver/:id', async (req, res) => {
  await deleteDoc(doc(db, 'drivers', req.params.id));
  res.json({ success: true });
});

// ── Bookings ──────────────────────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = { ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(db, 'bookings'), booking);
    const id = docRef.id;
    notify('new_booking', { id, ...booking }).catch(console.error);
    res.json({ success: true, id });
  } catch (e) {
    console.error('[booking]', e);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.get('/api/bookings', async (_req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    res.json({ bookings: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const d = snap.docs.find(d => d.id === req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json({ id: d.id, ...d.data() });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Manager ───────────────────────────────────────────────────
app.post('/api/manager/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.MANAGER_PASSWORD || 'admin123')) res.json({ success: true });
  else res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/manager/action', async (req, res) => {
  const { bookingId, action, driverId } = req.body;
  if (!bookingId || !action) return res.status(400).json({ error: 'Missing fields' });
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const snap = await getDocs(collection(db, 'bookings'));
    const booking = snap.docs.find(d => d.id === bookingId)?.data() as any;

    if (action === 'approve') {
      await updateDoc(bookingRef, { status: 'approved', driverId, updatedAt: new Date().toISOString() });
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'السائق', phone: '' };
      notify('booking_approved', {
        bookingId, driverId,
        driverName: driver.name, driverPhone: driver.phone,
        ...booking,
      }).catch(console.error);

    } else if (action === 'reject') {
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: new Date().toISOString() });
      notify('booking_rejected', { bookingId, ...booking }).catch(console.error);
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[manager/action]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Driver ────────────────────────────────────────────────────
app.post('/api/driver/login', async (req, res) => {
  const { code } = req.body;
  const drivers = await getDrivers();
  const driver = drivers.find((d: any) => d.code === code);
  if (driver) res.json({ success: true, driver });
  else res.status(401).json({ error: 'Invalid code' });
});

app.get('/api/driver/tasks', async (req, res) => {
  const { driverId } = req.query;
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const tasks = snap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(b => b.driverId === driverId && ['approved','on_process'].includes(b.status));
    res.json({ tasks });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/driver/update-status', async (req, res) => {
  const { bookingId, status, driverId } = req.body;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { status, updatedAt: new Date().toISOString() });

    // When driver accepts → notify customer
    if (status === 'on_process' && driverId) {
      const snap = await getDocs(collection(db, 'bookings'));
      const booking = snap.docs.find(d => d.id === bookingId)?.data() as any;
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'السائق' };
      notify('driver_accepted', {
        bookingId,
        driverName: driver.name,
        phone: booking?.phone,
        slot: booking?.slot,
        language: booking?.language,
      }).catch(console.error);
    }

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Admin Reset ───────────────────────────────────────────────
app.post('/api/admin/reset', async (req, res) => {
  try {
    const bookSnap = await getDocs(collection(db, 'bookings'));
    await Promise.all(bookSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
    const driverSnap = await getDocs(collection(db, 'drivers'));
    await Promise.all(driverSnap.docs.map(d => deleteDoc(doc(db, 'drivers', d.id))));
    for (const d of DEFAULT_DRIVERS) {
      await setDoc(doc(db, 'drivers', d.id), { name: d.name, code: d.code, phone: d.phone });
    }
    await setSetting('slots', DEFAULT_SLOTS);
    await setSetting('neighborhoods', DEFAULT_NEIGHBORHOODS);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Reset failed' }); }
});

export default app;
