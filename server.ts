import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Firebase ────────────────────────────────────────────────
const firebaseApp = initializeApp({
  apiKey:            process.env.FIREBASE_API_KEY            || 'AIzaSyDRxH5dqU0RanerfWCTYuI2WR5Cv43K2sU',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || 'gen-lang-client-0754111363.firebaseapp.com',
  projectId:         process.env.FIREBASE_PROJECT_ID         || 'gen-lang-client-0754111363',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || 'gen-lang-client-0754111363.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID|| '271263579220',
  appId:             process.env.FIREBASE_APP_ID             || '1:271263579220:web:8aae94d14a4d96f38d01c1',
});
const db = getFirestore(firebaseApp, process.env.FIREBASE_DATABASE_ID || 'ai-studio-ae98497f-378e-4913-8fbf-662dadf0b548');

// ── WhatsApp ─────────────────────────────────────────────────
const WASENDER_TOKEN = process.env.WASENDER_API_TOKEN || '';
const MANAGER_PHONE  = process.env.MANAGER_PHONE      || '+9647809471576';

async function sendWhatsApp(to: string, text: string): Promise<boolean> {
  if (!WASENDER_TOKEN) { console.warn('[WA] No WASENDER_API_TOKEN set'); return false; }
  try {
    const res = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
    });
    if (!res.ok) console.warn(`[WA] Failed to ${to}: HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error('[WA] Error:', e);
    return false;
  }
}

// ── In-memory state ──────────────────────────────────────────
let availableSlots: string[] = [
  '09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
  '07:00 PM','08:00 PM','09:00 PM','10:00 PM',
];
let availableDrivers: { id: string; name: string; code: string }[] = [
  { id: 'd1', name: 'Ali', code: '1234' },
];
let availableNeighborhoods: string[] = [
  'عنكاوة','عدن','آزادي','بحركة','ريزان','كويسنجق','ولي','بناسلاوة','زرگوس','سامي عبدالرحمن','إسكان',
];

// ── API ───────────────────────────────────────────────────────

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0', wasender: !!WASENDER_TOKEN });
});

// Slots
app.get('/api/slots', (_req, res) => res.json({ slots: availableSlots }));
app.post('/api/slots', (req, res) => {
  const { slots } = req.body;
  if (Array.isArray(slots)) { availableSlots = slots; res.json({ success: true }); }
  else res.status(400).json({ error: 'slots must be array' });
});

// Drivers
app.get('/api/drivers', (_req, res) => res.json({ drivers: availableDrivers }));

// Neighborhoods
app.get('/api/neighborhoods', (_req, res) => res.json({ neighborhoods: availableNeighborhoods }));
app.post('/api/admin/neighborhoods', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (availableNeighborhoods.includes(name.trim())) return res.status(400).json({ error: 'Already exists' });
  availableNeighborhoods.push(name.trim());
  res.json({ success: true, neighborhoods: availableNeighborhoods });
});
app.delete('/api/admin/neighborhoods/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  availableNeighborhoods = availableNeighborhoods.filter(n => n !== name);
  res.json({ success: true });
});

// ── Bookings ──────────────────────────────────────────────────

// Create booking
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = {
      ...req.body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'bookings'), booking);
    const id = docRef.id;

    // Notify manager via WhatsApp
    const msg =
      `📦 حجز جديد #${id.slice(-5)}\n` +
      `👤 ${booking.name}\n` +
      `📞 ${booking.phone}\n` +
      `📍 ${booking.neighborhood}\n` +
      `🚗 ${booking.carType} — ${booking.package}\n` +
      `🕐 ${booking.date === 'today' ? 'اليوم' : 'غداً'} ${booking.slot}`;
    sendWhatsApp(MANAGER_PHONE, msg).catch(console.error);

    res.json({ success: true, id });
  } catch (e) {
    console.error('[booking] create error:', e);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get all bookings
app.get('/api/bookings', async (_req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ bookings });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get single booking status
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const d = snap.docs.find(d => d.id === req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json({ id: d.id, ...d.data() });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Manager ───────────────────────────────────────────────────

app.post('/api/manager/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.MANAGER_PASSWORD || 'admin123')) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.post('/api/manager/action', async (req, res) => {
  const { bookingId, action, driverId } = req.body;
  if (!bookingId || !action) return res.status(400).json({ error: 'Missing fields' });

  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const snap = await getDocs(collection(db, 'bookings'));
    const bookingDoc = snap.docs.find(d => d.id === bookingId);
    const booking = bookingDoc?.data() as any;

    if (action === 'approve') {
      await updateDoc(bookingRef, { status: 'approved', driverId, updatedAt: new Date().toISOString() });

      // Notify driver
      const driver = availableDrivers.find(d => d.id === driverId);
      if (driver) {
        sendWhatsApp(MANAGER_PHONE,
          `✅ تم تعيينك على حجز جديد\n👤 ${booking?.name}\n📍 ${booking?.neighborhood}\n🕐 ${booking?.slot}`
        ).catch(console.error);
      }

      // Notify customer
      if (booking?.phone) {
        sendWhatsApp(booking.phone,
          `✅ تم تأكيد حجزك في WashTech!\n🕐 ${booking?.slot}\nسيتواصل معك السائق قريباً.`
        ).catch(console.error);
      }
    } else if (action === 'reject') {
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: new Date().toISOString() });

      if (booking?.phone) {
        sendWhatsApp(booking.phone,
          `❌ عذراً، لم يتم قبول حجزك في هذا الوقت. يرجى المحاولة مرة أخرى.`
        ).catch(console.error);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[manager/action] error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Driver ────────────────────────────────────────────────────

app.post('/api/driver/login', (req, res) => {
  const { code } = req.body;
  const driver = availableDrivers.find(d => d.code === code);
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
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/driver/update-status', async (req, res) => {
  const { bookingId, status } = req.body;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { status, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Admin ─────────────────────────────────────────────────────

app.post('/api/admin/create-driver', (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  const driver = { id: `d${Date.now()}`, name, code };
  availableDrivers.push(driver);
  res.json({ success: true, driver });
});

app.delete('/api/admin/driver/:id', (req, res) => {
  availableDrivers = availableDrivers.filter(d => d.id !== req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/reset', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
    availableDrivers = [{ id: 'd1', name: 'Ali', code: '1234' }];
    availableNeighborhoods = [
      'عنكاوة','عدن','آزادي','بحركة','ريزان','كويسنجق','ولي','بناسلاوة','زرگوس','سامي عبدالرحمن','إسكان',
    ];
    availableSlots = [
      '09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM',
      '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
      '07:00 PM','08:00 PM','09:00 PM','10:00 PM',
    ];
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ── Vite / Static ─────────────────────────────────────────────
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(PORT, () => console.log(`WashTech v2 running on http://localhost:${PORT}`));
}

start();
