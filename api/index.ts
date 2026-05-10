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
const APP_URL        = process.env.APP_URL             || 'https://washtech-v2.vercel.app';

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
async function getManagers() {
  const snap = await getDocs(collection(db, 'managers'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
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

// ── Notification templates ────────────────────────────────────
export type EventKey = 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected';
export interface TemplateConfig { enabled: boolean; template: string; }
export type NotificationTemplates = Record<EventKey, TemplateConfig>;

const DEFAULT_TEMPLATES: NotificationTemplates = {
  new_booking:      { enabled: true, template: '📦 *حجز جديد* #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}\n\n──────────────\n✅ *قبول الحجز:*\n{{approveLink}}\n\n❌ *رفض الحجز:*\n{{rejectLink}}' },
  booking_approved: { enabled: true, template: '✅ *مهمة جديدة*\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\n──────────────\n▶️ *اضغط لقبول المهمة:*\n{{acceptLink}}' },
  driver_accepted:  { enabled: true, template: '🚗 *سائقك في الطريق إليك!*\n👨‍💼 السائق: {{driverName}}\n🕐 الوقت: {{slot}}\n\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼' },
  booking_rejected: { enabled: true, template: '❌ عذراً {{name}}،\nلم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\n\nWashTech 🚗' },
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

async function getTemplates(): Promise<NotificationTemplates> {
  return getSetting<NotificationTemplates>('notification_templates', DEFAULT_TEMPLATES);
}

// ── Notifications ─────────────────────────────────────────────
async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!WASENDER_TOKEN) { console.warn('[WhatsApp] No WASENDER_API_TOKEN'); return; }
  try {
    const res = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
    });
    if (!res.ok) console.error('[WhatsApp]', res.status, await res.text());
  } catch (e) { console.error('[WhatsApp]', e); }
}

async function notify(event: EventKey, vars: Record<string, string>, to: string): Promise<void> {
  if (N8N_WEBHOOK) {
    try {
      await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...vars }),
      });
    } catch (e) { console.error('[n8n]', e); }
    return;
  }
  const templates = await getTemplates();
  const cfg = templates[event];
  if (!cfg?.enabled) return;
  await sendWhatsApp(to, applyTemplate(cfg.template, vars));
}

// ── Express app ───────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '3.0',
    wasenderToken: WASENDER_TOKEN ? `set (${WASENDER_TOKEN.slice(0,8)}...)` : 'NOT SET ⚠️',
    managerPhone: MANAGER_PHONE,
    n8nWebhook: N8N_WEBHOOK || 'not set (using WasenderAPI directly)',
    mode: N8N_WEBHOOK ? 'n8n' : 'direct-whatsapp',
  });
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
    // Await before res.json — Vercel kills the function after responding
    try {
      await notify('new_booking', {
        id: id.slice(-5), name: booking.name || '', phone: booking.phone || '',
        neighborhood: booking.neighborhood || '', carType: booking.carType || '',
        package: booking.package || '',
        date: booking.date === 'today' ? 'اليوم' : 'غداً',
        slot: booking.slot || '',
        approveLink: `${APP_URL}/action?id=${id}&act=approve`,
        rejectLink:  `${APP_URL}/action?id=${id}&act=reject`,
      }, MANAGER_PHONE);
    } catch (e) { console.error('[notify new_booking]', e); }
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

// ── Manager accounts (Firestore) ──────────────────────────────
app.get('/api/admin/managers', async (_req, res) => {
  const managers = await getManagers();
  res.json({ managers: managers.map(m => ({ id: m.id, name: m.name, username: m.username })) });
});

app.post('/api/admin/create-manager', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'All fields required' });
  const id = `mgr${Date.now()}`;
  await setDoc(doc(db, 'managers', id), { name, username, password });
  res.json({ success: true, manager: { id, name, username } });
});

app.delete('/api/admin/manager/:id', async (req, res) => {
  await deleteDoc(doc(db, 'managers', req.params.id));
  res.json({ success: true });
});

// ── Manager ───────────────────────────────────────────────────
app.post('/api/manager/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (username?.trim()) {
      const managers = await getManagers();
      const manager = managers.find((m: any) => m.username === username.trim() && m.password === password);
      if (manager) return res.json({ success: true, manager: { id: manager.id, name: manager.name, username: manager.username } });
      // If managers exist in Firestore but none matched → wrong credentials
      if (managers.length > 0) return res.status(401).json({ error: 'Invalid credentials' });
      // No managers created yet → fall through to legacy
    }
    // Legacy password fallback (default: admin123)
    if (password === (process.env.MANAGER_PASSWORD || 'admin123')) return res.json({ success: true });
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (e) {
    console.error('[manager/login]', e);
    res.status(500).json({ error: 'Server error, try again' });
  }
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
      try {
        await notify('booking_approved', {
          name: booking?.name || '', phone: booking?.phone || '',
          neighborhood: booking?.neighborhood || '', slot: booking?.slot || '',
          driverName: driver.name, driverPhone: driver.phone || '',
          acceptLink: `${APP_URL}/action?id=${bookingId}&act=accept`,
        }, driver.phone || MANAGER_PHONE);
      } catch (e) { console.error('[notify booking_approved]', e); }

    } else if (action === 'reject') {
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: new Date().toISOString() });
      try {
        await notify('booking_rejected', {
          name: booking?.name || '', phone: booking?.phone || '',
        }, booking?.phone || '');
      } catch (e) { console.error('[notify booking_rejected]', e); }
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

    // When driver accepts → notify customer (awaited before responding)
    if (status === 'on_process' && driverId) {
      const snap = await getDocs(collection(db, 'bookings'));
      const booking = snap.docs.find(d => d.id === bookingId)?.data() as any;
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'السائق' };
      try {
        await notify('driver_accepted', {
          name: booking?.name || '', phone: booking?.phone || '',
          driverName: driver.name, slot: booking?.slot || '',
        }, booking?.phone || '');
      } catch (e) { console.error('[notify driver_accepted]', e); }
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

// ── Notification templates API ────────────────────────────────
app.get('/api/admin/notification-templates', async (_req, res) => {
  res.json({ templates: await getTemplates() });
});

app.post('/api/admin/notification-templates', async (req, res) => {
  const { templates } = req.body;
  if (!templates) return res.status(400).json({ error: 'Missing templates' });
  await setSetting('notification_templates', templates);
  res.json({ success: true });
});

// ── Test notifications ────────────────────────────────────────
const DUMMY_VARS: Record<EventKey, (to: string) => Record<string, string>> = {
  new_booking:      to => ({ id: 'TEST1', name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوة', carType: 'سيدان', package: 'غسيل كامل', date: 'اليوم', slot: '10:00 AM', approveLink: `${APP_URL}/action?id=TEST1&act=approve`, rejectLink: `${APP_URL}/action?id=TEST1&act=reject` }),
  booking_approved: to => ({ name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوة', slot: '10:00 AM', driverName: 'علي', driverPhone: to, acceptLink: `${APP_URL}/action?id=TEST1&act=accept` }),
  driver_accepted:  to => ({ name: 'محمد أحمد', phone: to, driverName: 'علي', slot: '10:00 AM' }),
  booking_rejected: to => ({ name: 'محمد أحمد', phone: to }),
};

const EVENT_RECIPIENTS: Record<EventKey, (to: string) => string> = {
  new_booking:      _ => MANAGER_PHONE,
  booking_approved: to => to,
  driver_accepted:  to => to,
  booking_rejected: to => to,
};

app.post('/api/admin/test-notification', async (req, res) => {
  const { event, testPhone } = req.body as { event: EventKey; testPhone?: string };
  if (!event) return res.status(400).json({ error: 'Missing event' });
  const to = testPhone || MANAGER_PHONE;
  try {
    const vars = DUMMY_VARS[event](to);
    const templates = await getTemplates();
    const preview = templates[event]?.enabled ? applyTemplate(templates[event].template, vars) : '(disabled)';
    await notify(event, vars, EVENT_RECIPIENTS[event](to));
    res.json({ success: true, sentTo: EVENT_RECIPIENTS[event](to), preview });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/test-all-notifications', async (req, res) => {
  const { testPhone } = req.body as { testPhone?: string };
  const to = testPhone || MANAGER_PHONE;
  const events: EventKey[] = ['new_booking', 'booking_approved', 'driver_accepted', 'booking_rejected'];
  const results: string[] = [];
  for (const event of events) {
    try {
      await notify(event, DUMMY_VARS[event](to), EVENT_RECIPIENTS[event](to));
      results.push(`✓ ${event}`);
    } catch (e) {
      results.push(`✗ ${event}: ${e}`);
    }
    await new Promise(r => setTimeout(r, 600));
  }
  res.json({ success: true, sentTo: to, results });
});

// ── Action endpoint (approve/reject/accept via WhatsApp link) ─
app.get('/api/action', async (req, res) => {
  const { id } = req.query as { id?: string };
  if (!id) return res.status(400).json({ error: 'Missing id' });
  try {
    const bsnap = await getDoc(doc(db, 'bookings', id));
    if (!bsnap.exists()) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: { id, ...bsnap.data() } });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/action', async (req, res) => {
  const { id, act, driverId: selectedDriver } = req.body;
  if (!id || !act) return res.status(400).json({ error: 'Missing fields' });
  try {
    const bookingRef = doc(db, 'bookings', id);
    const bsnap = await getDoc(bookingRef);
    if (!bsnap.exists()) return res.status(404).json({ error: 'Booking not found' });
    const booking = bsnap.data() as any;

    if (act === 'approve') {
      const driverId = selectedDriver || booking.driverId;
      if (!driverId) return res.status(400).json({ error: 'Driver required' });
      await updateDoc(bookingRef, { status: 'approved', driverId, updatedAt: new Date().toISOString() });
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'السائق', phone: '' };
      await notify('booking_approved', {
        name: booking.name || '', phone: booking.phone || '',
        neighborhood: booking.neighborhood || '', slot: booking.slot || '',
        driverName: driver.name, driverPhone: driver.phone || '',
        acceptLink: `${APP_URL}/action?id=${id}&act=accept`,
      }, driver.phone || MANAGER_PHONE);
      res.json({ success: true, message: 'تم قبول الحجز وإشعار السائق' });

    } else if (act === 'reject') {
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: new Date().toISOString() });
      await notify('booking_rejected', {
        name: booking.name || '', phone: booking.phone || '',
      }, booking.phone || '');
      res.json({ success: true, message: 'تم رفض الحجز وإشعار العميل' });

    } else if (act === 'accept') {
      const driverId = booking.driverId;
      await updateDoc(bookingRef, { status: 'on_process', updatedAt: new Date().toISOString() });
      const driverDoc = driverId ? await getDoc(doc(db, 'drivers', driverId)) : null;
      const driver = driverDoc?.exists() ? (driverDoc.data() as any) : { name: 'السائق' };
      await notify('driver_accepted', {
        name: booking.name || '', phone: booking.phone || '',
        driverName: driver.name, slot: booking.slot || '',
      }, booking.phone || '');
      res.json({ success: true, message: 'تم قبول المهمة وإشعار العميل' });

    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (e) {
    console.error('[action]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Track by phone ────────────────────────────────────────────
app.get('/api/track', async (req, res) => {
  const { phone } = req.query as { phone?: string };
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const clean = (p: string) => p.replace(/\s+/g, '');
    const bookings = snap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(b => clean(b.phone || '') === clean(phone))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ bookings });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default app;
