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
const DEFAULT_DRIVERS = [{ id: 'd1', name: 'Ali', code: '1234' }];

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
    // seed defaults on first run
    for (const d of DEFAULT_DRIVERS) {
      await setDoc(doc(db, 'drivers', d.id), { name: d.name, code: d.code });
    }
    return DEFAULT_DRIVERS;
  }
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

// ── WhatsApp ──────────────────────────────────────────────────
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

// ── n8n webhook ───────────────────────────────────────────────
async function triggerN8n(event: string, data: any) {
  if (!N8N_WEBHOOK) return;
  try {
    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...data }),
    });
  } catch (e) { console.error('[n8n]', e); }
}

// ── Express app ───────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.1', wasender: !!WASENDER_TOKEN, n8n: !!N8N_WEBHOOK });
});

// ── Slots ─────────────────────────────────────────────────────
app.get('/api/slots', async (_req, res) => {
  const slots = await getSetting('slots', DEFAULT_SLOTS);
  res.json({ slots });
});
app.post('/api/slots', async (req, res) => {
  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be array' });
  await setSetting('slots', slots);
  res.json({ success: true });
});

// ── Neighborhoods ─────────────────────────────────────────────
app.get('/api/neighborhoods', async (_req, res) => {
  const neighborhoods = await getSetting('neighborhoods', DEFAULT_NEIGHBORHOODS);
  res.json({ neighborhoods });
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
  const drivers = await getDrivers();
  res.json({ drivers });
});
app.post('/api/admin/create-driver', async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  const id = `d${Date.now()}`;
  await setDoc(doc(db, 'drivers', id), { name, code });
  res.json({ success: true, driver: { id, name, code } });
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

    const msg =
      `📦 حجز جديد #${id.slice(-5)}\n` +
      `👤 ${booking.name}\n📞 ${booking.phone}\n📍 ${booking.neighborhood}\n` +
      `🚗 ${booking.carType} — ${booking.package}\n` +
      `🕐 ${booking.date === 'today' ? 'اليوم' : 'غداً'} ${booking.slot}`;

    sendWhatsApp(MANAGER_PHONE, msg).catch(console.error);
    triggerN8n('new_booking', { id, ...booking }).catch(console.error);

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

      // Get driver name
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driverName = driverDoc.exists() ? (driverDoc.data() as any).name : 'السائق';

      sendWhatsApp(MANAGER_PHONE,
        `✅ تم تعيين ${driverName} على حجز جديد\n👤 ${booking?.name}\n📍 ${booking?.neighborhood}\n🕐 ${booking?.slot}`
      ).catch(console.error);

      if (booking?.phone) {
        sendWhatsApp(booking.phone,
          `✅ تم تأكيد حجزك في WashTech!\n🚗 السائق: ${driverName}\n🕐 ${booking?.slot}\nسيتواصل معك السائق قريباً.`
        ).catch(console.error);
      }

      triggerN8n('booking_approved', { bookingId, driverId, driverName, ...booking }).catch(console.error);

    } else if (action === 'reject') {
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: new Date().toISOString() });
      if (booking?.phone) {
        sendWhatsApp(booking.phone,
          `❌ عذراً، لم يتم قبول حجزك في هذا الوقت. يرجى المحاولة مرة أخرى.`
        ).catch(console.error);
      }
      triggerN8n('booking_rejected', { bookingId, ...booking }).catch(console.error);
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
  const { bookingId, status } = req.body;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { status, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Admin Reset ───────────────────────────────────────────────
app.post('/api/admin/reset', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
    const driverSnap = await getDocs(collection(db, 'drivers'));
    await Promise.all(driverSnap.docs.map(d => deleteDoc(doc(db, 'drivers', d.id))));
    for (const d of DEFAULT_DRIVERS) {
      await setDoc(doc(db, 'drivers', d.id), { name: d.name, code: d.code });
    }
    await setSetting('slots', DEFAULT_SLOTS);
    await setSetting('neighborhoods', DEFAULT_NEIGHBORHOODS);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

export default app;
