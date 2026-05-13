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
const APP_URL        = process.env.APP_URL             || 'https://wash-tech-v2.vercel.app';

const DEFAULT_SLOTS = [
  '09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
  '07:00 PM','08:00 PM','09:00 PM','10:00 PM',
];
const DEFAULT_NEIGHBORHOODS = [
  'عنكاوة','عدن','آزادي','بحركة','ريزان','كويسنجق',
  'ولي','بناسلاوة','زرگوس','سامي عبدالرحمن','إسكان',
];
const DEFAULT_CAPTAINS = [{ id: 'd1', name: 'Ali', code: '1234', phone: '+9647809471576' }];

// ── Booking state machine ─────────────────────────────────────
export type BookingStatus =
  | 'pending' | 'approved' | 'accepted' | 'on_road' | 'completed' | 'closed' | 'rejected'
  | 'on_process'; // legacy alias

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:    ['approved', 'rejected'],
  approved:   ['accepted', 'rejected', 'on_process'],
  accepted:   ['on_road'],
  on_road:    ['completed'],
  completed:  ['closed'],
  on_process: ['on_road', 'completed'],
  rejected:   [],
  closed:     [],
};

// ── Package prices (IQD) ──────────────────────────────────────
const PACKAGE_PRICES: Record<string, number> = {
  basic: 15000, standard: 25000, premium: 35000,
  'أساسي': 15000, 'قياسي': 25000, 'ممتاز': 35000,
};
const CAPTAIN_SHARE_PCT = 0.70;

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
async function getCaptains() {
  const snap = await getDocs(collection(db, 'drivers'));
  if (snap.empty) {
    for (const d of DEFAULT_CAPTAINS) {
      await setDoc(doc(db, 'drivers', d.id), {
        name: d.name, code: d.code, phone: d.phone,
        wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
      });
    }
    return DEFAULT_CAPTAINS;
  }
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}
// Alias for backward-compat
const getDrivers = getCaptains;

// ── Short links ───────────────────────────────────────────────
function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
async function createShortLink(url: string, type: 'action' | 'track' = 'action'): Promise<string> {
  try {
    let code = genCode();
    try {
      const existing = await getDoc(doc(db, 'links', code));
      if (existing.exists()) code = genCode();
    } catch { code = genCode(); }
    // action links expire in 48h and are single-use; track links expire in 7 days and are multi-use
    const expiryMs  = type === 'track' ? 7 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiryMs).toISOString();
    await setDoc(doc(db, 'links', code), {
      url, type, createdAt: new Date().toISOString(), expiresAt,
      used: false, clicks: [],
    });
    return `${APP_URL}/go/${code}`;
  } catch (e) {
    console.error('[shortlink] fallback to long URL:', e);
    return url; // graceful fallback — long URL still works
  }
}

// ── Notification templates ────────────────────────────────────
export type EventKey =
  | 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected'
  | 'captain_on_road' | 'booking_completed';
export interface TemplateConfig { enabled: boolean; template: string; }
export type NotificationTemplates = Record<EventKey, TemplateConfig>;

const DEFAULT_TEMPLATES: NotificationTemplates = {
  new_booking:       { enabled: true, template: '📦 *حجز جديد* #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}\n\n──────────────\n✅ *قبول الحجز:*\n{{approveLink}}\n\n❌ *رفض الحجز:*\n{{rejectLink}}' },
  booking_approved:  { enabled: true, template: '✅ *مهمة جديدة*\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\n──────────────\n▶️ *اضغط لقبول المهمة:*\n{{acceptLink}}' },
  driver_accepted:   { enabled: true, template: '🚗 *الكابتن قبل مهمتك!*\n👨‍💼 الكابتن: {{driverName}}\n🕐 الوقت: {{slot}}\n\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼' },
  booking_rejected:  { enabled: true, template: '❌ عذراً {{name}}،\nلم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\n\nWashTech 🚗' },
  captain_on_road:   { enabled: true, template: '🚀 *الكابتن في الطريق إليك!*\n👨‍💼 {{driverName}}\n🕐 الوقت: {{slot}}\n\nاستعد لاستقباله. شكراً! 🧼' },
  booking_completed: { enabled: true, template: '✅ تم الانتهاء من خدمة غسيل سيارتك!\n💰 المبلغ: *{{amount}} د.ع*\nشكراً لاختيارك WashTech 🧼\nقيّم تجربتك: ⭐⭐⭐⭐⭐' },
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
async function getTemplates(): Promise<NotificationTemplates> {
  const saved = await getSetting<Partial<NotificationTemplates>>('notification_templates', {});
  return { ...DEFAULT_TEMPLATES, ...saved };
}

// ── Automation rules ──────────────────────────────────────────
export type RecipientType = 'manager' | 'captain' | 'customer' | 'custom';
export interface AutomationRule {
  id: string;
  enabled: boolean;
  trigger: EventKey;
  recipientType: RecipientType;
  customPhone?: string;
}

const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  { id: 'r_new_booking',       enabled: true, trigger: 'new_booking',       recipientType: 'manager'  },
  { id: 'r_booking_approved',  enabled: true, trigger: 'booking_approved',  recipientType: 'captain'  },
  { id: 'r_driver_accepted',   enabled: true, trigger: 'driver_accepted',   recipientType: 'customer' },
  { id: 'r_booking_rejected',  enabled: true, trigger: 'booking_rejected',  recipientType: 'customer' },
  { id: 'r_captain_on_road',   enabled: true, trigger: 'captain_on_road',   recipientType: 'customer' },
  { id: 'r_booking_completed', enabled: true, trigger: 'booking_completed', recipientType: 'customer' },
];

async function getAutomations(): Promise<AutomationRule[]> {
  const saved = await getSetting<AutomationRule[] | null>('automations', null);
  if (!saved) return DEFAULT_AUTOMATIONS;
  // Merge saved with defaults (keep default IDs updated, append custom rules)
  const savedMap = new Map(saved.map(r => [r.id, r]));
  const merged = DEFAULT_AUTOMATIONS.map(d => savedMap.get(d.id) ?? d);
  const custom = saved.filter(r => !DEFAULT_AUTOMATIONS.find(d => d.id === r.id));
  return [...merged, ...custom];
}
async function saveAutomations(rules: AutomationRule[]) {
  await setSetting('automations', rules);
}

function resolveRecipient(rule: AutomationRule, vars: Record<string, string>): string | null {
  switch (rule.recipientType) {
    case 'manager':  return MANAGER_PHONE;
    case 'captain':  return vars.driverPhone || null;
    case 'customer': return vars.phone || null;
    case 'custom':   return rule.customPhone || null;
    default:         return null;
  }
}

// ── Phone normalization ───────────────────────────────────────
function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '');
  if (/^07\d{9}$/.test(clean))      return '+964' + clean.slice(1);
  if (/^9647\d{9}$/.test(clean))    return '+' + clean;
  if (/^\+9647\d{9}$/.test(clean))  return clean;
  if (/^\+/.test(clean))            return clean;
  return '+' + clean;
}

// ── WhatsApp sender ───────────────────────────────────────────
async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!WASENDER_TOKEN) { console.warn('[WhatsApp] No WASENDER_API_TOKEN'); return; }
  try {
    const res = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WASENDER_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: normalizePhone(to), text }),
    });
    if (!res.ok) console.error('[WhatsApp]', res.status, await res.text());
  } catch (e) { console.error('[WhatsApp]', e); }
}

async function notify(event: EventKey, vars: Record<string, string>, fallbackTo: string): Promise<void> {
  if (N8N_WEBHOOK) {
    try {
      await fetch(N8N_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, ...vars }) });
    } catch (e) { console.error('[n8n]', e); }
    return;
  }
  const [templates, automations] = await Promise.all([getTemplates(), getAutomations()]);
  const cfg = templates[event];
  if (!cfg?.enabled) return;
  const text = applyTemplate(cfg.template, vars);
  const rules = automations.filter(r => r.trigger === event && r.enabled);
  if (!rules.length) {
    // Fallback: send to the provided phone if no rules match
    await sendWhatsApp(fallbackTo, text);
    return;
  }
  for (const rule of rules) {
    const to = resolveRecipient(rule, vars) || fallbackTo;
    await sendWhatsApp(to, text);
  }
}

// ── Captain wallet helpers ────────────────────────────────────
async function creditCaptainWallet(driverId: string, amount: number, bookingId: string, note: string) {
  if (!driverId || amount <= 0) return;
  const driverRef = doc(db, 'drivers', driverId);
  const snap = await getDoc(driverRef);
  if (!snap.exists()) return;
  const w = (snap.data() as any).wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 };
  await updateDoc(driverRef, {
    wallet: { balance: (w.balance || 0) + amount, totalEarned: (w.totalEarned || 0) + amount, totalWithdrawn: w.totalWithdrawn || 0 },
  });
  await addDoc(collection(db, 'drivers', driverId, 'transactions'), {
    type: 'earning', amount, bookingId, note, createdAt: new Date().toISOString(),
  });
}

// ── Express app ───────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok', version: '4.0-state-machine',
    wasenderToken: WASENDER_TOKEN ? `set (${WASENDER_TOKEN.slice(0,8)}...)` : 'NOT SET ⚠️',
    managerPhone: MANAGER_PHONE,
    mode: N8N_WEBHOOK ? 'n8n' : 'direct-whatsapp',
  });
});

// ── Short-link redirect ───────────────────────────────────────
app.get('/go/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const snap = await getDoc(doc(db, 'links', code));
    if (!snap.exists()) return res.status(404).send('رابط غير صالح');
    const link = snap.data() as any;
    if (new Date(link.expiresAt) < new Date()) return res.status(410).send('انتهت صلاحية الرابط');
    const isTrack = link.type === 'track';
    if (!isTrack && link.used) return res.status(410).send('تم استخدام هذا الرابط مسبقاً');
    const clickEntry = { at: new Date().toISOString(), ua: (req.headers['user-agent'] || '').slice(0, 200) };
    const updateData: any = { clicks: [...(link.clicks || []), clickEntry] };
    if (!isTrack) { updateData.used = true; updateData.usedAt = new Date().toISOString(); }
    await updateDoc(doc(db, 'links', code), updateData);
    res.redirect(link.url);
  } catch { res.status(500).send('Server error'); }
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

// ── Captains (drivers collection kept for Firestore compat) ───
app.get('/api/captains', async (_req, res) => {
  res.json({ captains: await getCaptains(), drivers: await getCaptains() });
});
app.get('/api/drivers', async (_req, res) => {
  res.json({ drivers: await getCaptains() });
});
app.post('/api/admin/create-captain', async (req, res) => {
  const { name, code, phone } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  const id = `d${Date.now()}`;
  const normalizedPhone = phone ? normalizePhone(phone) : '';
  await setDoc(doc(db, 'drivers', id), {
    name, code, phone: normalizedPhone,
    wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
  });
  res.json({ success: true, captain: { id, name, code, phone: normalizedPhone } });
});
// Alias
app.post('/api/admin/create-driver', async (req, res) => {
  const { name, code, phone } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  const id = `d${Date.now()}`;
  const normalizedPhone = phone ? normalizePhone(phone) : '';
  await setDoc(doc(db, 'drivers', id), {
    name, code, phone: normalizedPhone,
    wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
  });
  res.json({ success: true, driver: { id, name, code, phone: normalizedPhone } });
});
app.delete('/api/admin/captain/:id', async (req, res) => {
  await deleteDoc(doc(db, 'drivers', req.params.id));
  res.json({ success: true });
});
app.delete('/api/admin/driver/:id', async (req, res) => {
  await deleteDoc(doc(db, 'drivers', req.params.id));
  res.json({ success: true });
});

// ── Captain wallet ────────────────────────────────────────────
app.get('/api/captain/wallet', async (req, res) => {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'Missing driverId' });
  try {
    const snap = await getDoc(doc(db, 'drivers', driverId as string));
    if (!snap.exists()) return res.status(404).json({ error: 'Not found' });
    const txSnap = await getDocs(collection(db, 'drivers', driverId as string, 'transactions'));
    res.json({
      wallet: (snap.data() as any).wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
      transactions: txSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/captain/transaction', async (req, res) => {
  const { driverId, type, amount, note } = req.body;
  if (!driverId || !type || !amount) return res.status(400).json({ error: 'Missing fields' });
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const snap = await getDoc(driverRef);
    if (!snap.exists()) return res.status(404).json({ error: 'Not found' });
    const w = (snap.data() as any).wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 };
    const amt = Number(amount);
    const newWallet = { ...w };
    if (type === 'withdrawal') {
      if (w.balance < amt) return res.status(400).json({ error: 'Insufficient balance' });
      newWallet.balance -= amt;
      newWallet.totalWithdrawn = (w.totalWithdrawn || 0) + amt;
    } else if (type === 'adjustment') {
      newWallet.balance = (w.balance || 0) + amt;
    }
    await updateDoc(driverRef, { wallet: newWallet });
    await addDoc(collection(db, 'drivers', driverId, 'transactions'), {
      type, amount: amt, note: note || '', createdAt: new Date().toISOString(),
    });
    res.json({ success: true, wallet: newWallet });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Captain transaction history ───────────────────────────────
app.get('/api/captain/transactions', async (req, res) => {
  const { driverId, limit: lim } = req.query as any;
  if (!driverId) return res.status(400).json({ error: 'Missing driverId' });
  try {
    const txSnap = await getDocs(collection(db, 'drivers', driverId, 'transactions'));
    let txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (lim) txs = txs.slice(0, Number(lim));
    res.json({ transactions: txs });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Bookings ──────────────────────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = {
      ...req.body,
      phone: normalizePhone(req.body.phone || ''),
      status: 'pending',
      createdAt: new Date().toISOString(),
      statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: 'customer' }],
    };
    const docRef = await addDoc(collection(db, 'bookings'), booking);
    const id = docRef.id;
    try {
      const approveLink = await createShortLink(`${APP_URL}/action?id=${id}&act=approve`);
      const rejectLink  = await createShortLink(`${APP_URL}/action?id=${id}&act=reject`);
      await notify('new_booking', {
        id: id.slice(-5), name: booking.name || '', phone: booking.phone || '',
        neighborhood: booking.neighborhood || '', carType: booking.carType || '',
        package: booking.package || '', date: booking.date === 'today' ? 'اليوم' : 'غداً',
        slot: booking.slot || '', approveLink, rejectLink,
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
    const d = await getDoc(doc(db, 'bookings', req.params.id));
    if (!d.exists()) return res.status(404).json({ error: 'Not found' });
    res.json({ id: d.id, ...d.data() });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Track by phone ────────────────────────────────────────────
app.get('/api/track', async (req, res) => {
  const { phone } = req.query as { phone?: string };
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const normalizedQuery = normalizePhone(phone);
    const bookings = snap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(b => normalizePhone(b.phone || '') === normalizedQuery)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ bookings });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Manager accounts ──────────────────────────────────────────
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

// ── Manager login & actions ───────────────────────────────────
app.post('/api/manager/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (username?.trim()) {
      const managers = await getManagers();
      const manager = managers.find((m: any) => m.username === username.trim() && m.password === password);
      if (manager) return res.json({ success: true, manager: { id: manager.id, name: manager.name, username: manager.username } });
      if (managers.length > 0) return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (password === (process.env.MANAGER_PASSWORD || 'admin123')) return res.json({ success: true });
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (e) {
    res.status(500).json({ error: 'Server error, try again' });
  }
});

app.post('/api/manager/action', async (req, res) => {
  const { bookingId, action, driverId } = req.body;
  if (!bookingId || !action) return res.status(400).json({ error: 'Missing fields' });
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bsnap = await getDoc(bookingRef);
    if (!bsnap.exists()) return res.status(404).json({ error: 'Booking not found' });
    const booking = bsnap.data() as any;
    const now = new Date().toISOString();
    const history = [...(booking.statusHistory || [])];

    if (action === 'approve') {
      history.push({ status: 'approved', at: now, by: 'manager' });
      await updateDoc(bookingRef, { status: 'approved', driverId, updatedAt: now, statusHistory: history });
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'الكابتن', phone: '' };
      try {
        const acceptLink = await createShortLink(`${APP_URL}/action?id=${bookingId}&act=accept`);
        await notify('booking_approved', {
          name: booking?.name || '', phone: booking?.phone || '',
          neighborhood: booking?.neighborhood || '', slot: booking?.slot || '',
          driverName: driver.name, driverPhone: driver.phone || '', acceptLink,
        }, driver.phone || MANAGER_PHONE);
      } catch (e) { console.error('[notify booking_approved]', e); }
    } else if (action === 'reject') {
      history.push({ status: 'rejected', at: now, by: 'manager' });
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: now, statusHistory: history });
      try {
        await notify('booking_rejected', { name: booking?.name || '', phone: booking?.phone || '' }, booking?.phone || '');
      } catch (e) { console.error('[notify booking_rejected]', e); }
    }
    res.json({ success: true });
  } catch (e) {
    console.error('[manager/action]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Action endpoint (approve/reject/accept/on_road/complete via WhatsApp link) ──
app.get('/api/action', async (req, res) => {
  const { id } = req.query as { id?: string };
  if (!id) return res.status(400).json({ error: 'Missing id' });
  try {
    const bsnap = await getDoc(doc(db, 'bookings', id));
    if (!bsnap.exists()) return res.status(404).json({ error: 'Booking not found' });
    const drivers = await getDrivers();
    res.json({ booking: { id, ...bsnap.data() }, drivers });
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
    const now = new Date().toISOString();
    const history = [...(booking.statusHistory || [])];

    // State machine validation
    const statusMap: Record<string, string> = {
      approve: 'approved', reject: 'rejected', accept: 'accepted',
      on_road: 'on_road', complete: 'completed', close: 'closed',
    };
    const newStatus = statusMap[act] || act;
    const currentStatus = booking.status || 'pending';
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(409).json({ error: `لا يمكن الانتقال من ${currentStatus} إلى ${newStatus}` });
    }

    history.push({ status: newStatus, at: now, by: act });

    if (act === 'approve') {
      const driverId = selectedDriver || booking.driverId;
      if (!driverId) return res.status(400).json({ error: 'Driver required' });
      await updateDoc(bookingRef, { status: 'approved', driverId, updatedAt: now, statusHistory: history });
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'الكابتن', phone: '' };
      const acceptLink = await createShortLink(`${APP_URL}/action?id=${id}&act=accept`);
      await notify('booking_approved', {
        name: booking.name || '', phone: booking.phone || '',
        neighborhood: booking.neighborhood || '', slot: booking.slot || '',
        driverName: driver.name, driverPhone: driver.phone || '', acceptLink,
      }, driver.phone || MANAGER_PHONE);
      return res.json({ success: true, message: 'تم قبول الحجز وإشعار الكابتن' });

    } else if (act === 'reject') {
      await updateDoc(bookingRef, { status: 'rejected', updatedAt: now, statusHistory: history });
      await notify('booking_rejected', { name: booking.name || '', phone: booking.phone || '' }, booking.phone || '');
      return res.json({ success: true, message: 'تم رفض الحجز وإشعار العميل' });

    } else if (act === 'accept') {
      await updateDoc(bookingRef, { status: 'accepted', updatedAt: now, statusHistory: history });
      const driverDoc = booking.driverId ? await getDoc(doc(db, 'drivers', booking.driverId)) : null;
      const driver = driverDoc?.exists() ? (driverDoc.data() as any) : { name: 'الكابتن' };
      await notify('driver_accepted', {
        name: booking.name || '', phone: booking.phone || '',
        driverName: driver.name, slot: booking.slot || '',
      }, booking.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `✅ الكابتن ${driver.name} قبل مهمة #${id.slice(-6)}\nالعميل: ${booking.name}`);
      return res.json({ success: true, message: 'تم قبول المهمة وإشعار العميل والمدير' });

    } else if (act === 'on_road') {
      await updateDoc(bookingRef, { status: 'on_road', updatedAt: now, statusHistory: history });
      const driverDoc = booking.driverId ? await getDoc(doc(db, 'drivers', booking.driverId)) : null;
      const driver = driverDoc?.exists() ? (driverDoc.data() as any) : { name: 'الكابتن' };
      await notify('captain_on_road', {
        name: booking.name || '', phone: booking.phone || '',
        driverName: driver.name, slot: booking.slot || '',
      }, booking.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `🚀 الكابتن ${driver.name} في الطريق لـ${booking.name}`);
      return res.json({ success: true, message: 'تم إشعار العميل أن الكابتن في الطريق' });

    } else if (act === 'complete') {
      // Fetch dynamic finance config
      const finCfg = await getSetting<any>('finance_config', { captainSharePct: 0.70, packagePrices: PACKAGE_PRICES });
      const dynPrices: Record<string, number> = { ...PACKAGE_PRICES, ...(finCfg.packagePrices || {}) };
      const dynSharePct: number = finCfg.captainSharePct ?? CAPTAIN_SHARE_PCT;
      const pkgKey = (booking.package || '').toLowerCase();
      const totalAmount = dynPrices[pkgKey] || dynPrices[booking.package] || 0;
      const captainShare = Math.round(totalAmount * dynSharePct);
      const companyShare = totalAmount - captainShare;
      await updateDoc(bookingRef, {
        status: 'completed', updatedAt: now, statusHistory: history,
        financials: { totalAmount, captainShare, companyShare },
      });
      if (booking.driverId) await creditCaptainWallet(booking.driverId, captainShare, id, `حجز #${id.slice(-6)}`);
      await notify('booking_completed', {
        name: booking.name || '', phone: booking.phone || '',
        amount: totalAmount.toLocaleString('ar-IQ'),
      }, booking.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `✅ اكتمل حجز #${id.slice(-6)} — 💰 ${totalAmount.toLocaleString('ar-IQ')} د.ع`);
      return res.json({ success: true, message: 'تم إكمال المهمة وتحديث المحفظة' });

    } else {
      await updateDoc(bookingRef, { status: newStatus, updatedAt: now, statusHistory: history });
      return res.json({ success: true, message: `تم تحديث الحالة إلى ${newStatus}` });
    }
  } catch (e) {
    console.error('[action]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Captain login & tasks ─────────────────────────────────────
app.post('/api/captain/login', async (req, res) => {
  const { code } = req.body;
  const captains = await getCaptains();
  const captain = captains.find((d: any) => d.code === code);
  if (captain) res.json({ success: true, captain, driver: captain });
  else res.status(401).json({ error: 'كود غير صحيح' });
});
app.post('/api/driver/login', async (req, res) => {
  const { code } = req.body;
  const captains = await getCaptains();
  const captain = captains.find((d: any) => d.code === code);
  if (captain) res.json({ success: true, driver: captain, captain });
  else res.status(401).json({ error: 'Invalid code' });
});

app.get('/api/captain/tasks', async (req, res) => {
  const { captainId, driverId } = req.query as any;
  const id = captainId || driverId;
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const tasks = snap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(b => b.driverId === id && ['approved','accepted','on_road','on_process'].includes(b.status));
    res.json({ tasks });
  } catch { res.status(500).json({ error: 'Failed' }); }
});
app.get('/api/driver/tasks', async (req, res) => {
  const { driverId } = req.query;
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    const tasks = snap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter(b => b.driverId === driverId && ['approved','accepted','on_road','on_process'].includes(b.status));
    res.json({ tasks });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// Captain accepts task
app.post('/api/driver/accept-task', async (req, res) => {
  const { bookingId, driverId } = req.body;
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bsnap = await getDoc(bookingRef);
    if (!bsnap.exists()) return res.status(404).json({ error: 'Not found' });
    const booking = bsnap.data() as any;
    const now = new Date().toISOString();
    const history = [...(booking.statusHistory || []), { status: 'accepted', at: now, by: 'driver' }];
    await updateDoc(bookingRef, { status: 'accepted', updatedAt: now, statusHistory: history });
    if (driverId) {
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'الكابتن' };
      await notify('driver_accepted', {
        name: booking.name || '', phone: booking.phone || '',
        driverName: driver.name, slot: booking.slot || '',
      }, booking.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `✅ الكابتن ${driver.name} قبل مهمة #${bookingId.slice(-6)}`);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Captain on road — with ownership guard
app.post('/api/driver/on-road', async (req, res) => {
  const { bookingId, driverId } = req.body;
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bsnap = await getDoc(bookingRef);
    if (!bsnap.exists()) return res.status(404).json({ error: 'Not found' });
    const booking = bsnap.data() as any;
    if (driverId && booking.driverId && booking.driverId !== driverId) {
      return res.status(403).json({ error: 'غير مخوّل لتعديل هذه المهمة' });
    }
    const currentStatus = booking.status || 'pending';
    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes('on_road')) {
      return res.status(409).json({ error: `لا يمكن الانتقال من ${currentStatus} إلى on_road` });
    }
    const now = new Date().toISOString();
    const history = [...(booking.statusHistory || []), { status: 'on_road', at: now, by: 'captain' }];
    await updateDoc(bookingRef, { status: 'on_road', updatedAt: now, statusHistory: history });
    if (driverId) {
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const driver = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'الكابتن' };
      await notify('captain_on_road', {
        name: booking.name || '', phone: booking.phone || '',
        driverName: driver.name, slot: booking.slot || '',
      }, booking.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `🚀 الكابتن ${driver.name} في الطريق لـ${booking.name}`);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Captain complete task
app.post('/api/driver/complete-task', async (req, res) => {
  const { bookingId, driverId } = req.body;
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bsnap = await getDoc(bookingRef);
    if (!bsnap.exists()) return res.status(404).json({ error: 'Not found' });
    const booking = bsnap.data() as any;
    // Guard: only assigned captain
    if (driverId && booking.driverId && booking.driverId !== driverId) {
      return res.status(403).json({ error: 'غير مخوّل لتعديل هذه المهمة' });
    }
    const currentStatus = booking.status || 'pending';
    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes('completed')) {
      return res.status(409).json({ error: `لا يمكن الانتقال من ${currentStatus} إلى completed` });
    }
    const now = new Date().toISOString();
    // Fetch dynamic finance config
    const finCfg = await getSetting<any>('finance_config', { captainSharePct: 0.70, packagePrices: PACKAGE_PRICES });
    const dynPrices: Record<string, number> = { ...PACKAGE_PRICES, ...(finCfg.packagePrices || {}) };
    const dynSharePct: number = finCfg.captainSharePct ?? CAPTAIN_SHARE_PCT;
    const pkgKey = (booking.package || '').toLowerCase();
    const totalAmount = dynPrices[pkgKey] || dynPrices[booking.package] || 0;
    const captainShare = Math.round(totalAmount * dynSharePct);
    const companyShare = totalAmount - captainShare;
    const history = [...(booking.statusHistory || []), { status: 'completed', at: now, by: 'driver' }];
    await updateDoc(bookingRef, {
      status: 'completed', updatedAt: now, statusHistory: history,
      financials: { totalAmount, captainShare, companyShare },
    });
    if (driverId) await creditCaptainWallet(driverId, captainShare, bookingId, `حجز #${bookingId.slice(-6)}`);
    await notify('booking_completed', {
      name: booking.name || '', phone: booking.phone || '',
      amount: totalAmount.toLocaleString('ar-IQ'),
    }, booking.phone || '');
    await sendWhatsApp(MANAGER_PHONE, `✅ اكتمل حجز #${bookingId.slice(-6)} — 💰 ${totalAmount.toLocaleString('ar-IQ')} د.ع`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Legacy update-status — NOW with state machine guard
app.post('/api/driver/update-status', async (req, res) => {
  const { bookingId, status, driverId } = req.body;
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bsnap = await getDoc(bookingRef);
    if (!bsnap.exists()) return res.status(404).json({ error: 'Booking not found' });
    const booking = bsnap.data() as any;
    // State machine guard
    const currentStatus = booking.status || 'pending';
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({ error: `لا يمكن الانتقال من ${currentStatus} إلى ${status}` });
    }
    // Captain ownership check
    if (driverId && booking.driverId && booking.driverId !== driverId) {
      return res.status(403).json({ error: 'غير مخوّل لتعديل هذه المهمة' });
    }
    const now = new Date().toISOString();
    const history = [...(booking.statusHistory || []), { status, at: now, by: 'captain' }];
    await updateDoc(bookingRef, { status, updatedAt: now, statusHistory: history });
    if ((status === 'on_process' || status === 'accepted') && driverId) {
      const driverDoc = await getDoc(doc(db, 'drivers', driverId));
      const captain = driverDoc.exists() ? (driverDoc.data() as any) : { name: 'الكابتن' };
      await notify('driver_accepted', {
        name: booking?.name || '', phone: booking?.phone || '',
        driverName: captain.name, slot: booking?.slot || '',
      }, booking?.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `✅ الكابتن ${captain.name} قبل مهمة العميل *${booking?.name || ''}*`);
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Admin Reset ───────────────────────────────────────────────
app.post('/api/admin/reset', async (_req, res) => {
  try {
    const bookSnap = await getDocs(collection(db, 'bookings'));
    await Promise.all(bookSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
    const linkSnap = await getDocs(collection(db, 'links'));
    await Promise.all(linkSnap.docs.map(d => deleteDoc(doc(db, 'links', d.id))));
    const driverSnap = await getDocs(collection(db, 'drivers'));
    await Promise.all(driverSnap.docs.map(d => deleteDoc(doc(db, 'drivers', d.id))));
    for (const d of DEFAULT_CAPTAINS) {
      await setDoc(doc(db, 'drivers', d.id), {
        name: d.name, code: d.code, phone: d.phone,
        wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
      });
    }
    await setSetting('slots', DEFAULT_SLOTS);
    await setSetting('neighborhoods', DEFAULT_NEIGHBORHOODS);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Reset failed' }); }
});

// ── Dynamic settings endpoints ───────────────────────────────
// GET/POST /api/admin/settings/:key — generic key-value settings store
app.get('/api/admin/settings/:key', async (req, res) => {
  try {
    const snap = await getDoc(doc(db, 'settings', req.params.key));
    res.json(snap.exists() ? snap.data() : { value: null });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/settings/:key', async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  try {
    await setDoc(doc(db, 'settings', req.params.key), { value, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Manager financial overview ─────────────────────────────────
app.get('/api/manager/finance/overview', async (_req, res) => {
  try {
    const [bookSnap, captainSnap] = await Promise.all([
      getDocs(collection(db, 'bookings')),
      getDocs(collection(db, 'drivers')),
    ]);
    const bookings = bookSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const completed = bookings.filter(b => ['completed', 'closed'].includes(b.status) && b.financials);
    const totalRevenue   = completed.reduce((s, b) => s + (b.financials?.totalAmount  || 0), 0);
    const companyRevenue = completed.reduce((s, b) => s + (b.financials?.companyShare || 0), 0);
    const captainPayouts = completed.reduce((s, b) => s + (b.financials?.captainShare || 0), 0);
    const captains = captainSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const captainSummary = captains.map(c => ({
      id: c.id, name: c.name, phone: c.phone,
      balance: c.wallet?.balance || 0,
      totalEarned: c.wallet?.totalEarned || 0,
      totalWithdrawn: c.wallet?.totalWithdrawn || 0,
    }));
    res.json({ totalRevenue, companyRevenue, captainPayouts, completedCount: completed.length, captains: captainSummary });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/manager/finance/captains', async (_req, res) => {
  try {
    const snap = await getDocs(collection(db, 'drivers'));
    const captains = snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, name: data.name, phone: data.phone, wallet: data.wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 } };
    });
    res.json({ captains });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Automation rules CRUD ─────────────────────────────────────
app.get('/api/admin/automations', async (_req, res) => {
  res.json({ automations: await getAutomations() });
});

app.post('/api/admin/automations', async (req, res) => {
  const { automations } = req.body;
  if (!Array.isArray(automations)) return res.status(400).json({ error: 'automations must be array' });
  await saveAutomations(automations);
  res.json({ success: true });
});

app.post('/api/admin/automations/add', async (req, res) => {
  const { trigger, recipientType, customPhone } = req.body;
  if (!trigger || !recipientType) return res.status(400).json({ error: 'Missing fields' });
  const automations = await getAutomations();
  const newRule: AutomationRule = {
    id: `r_custom_${Date.now()}`,
    enabled: true, trigger, recipientType, customPhone: customPhone || undefined,
  };
  await saveAutomations([...automations, newRule]);
  res.json({ success: true, rule: newRule });
});

app.patch('/api/admin/automations/:id', async (req, res) => {
  const { id } = req.params;
  const automations = await getAutomations();
  const idx = automations.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Rule not found' });
  automations[idx] = { ...automations[idx], ...req.body, id };
  await saveAutomations(automations);
  res.json({ success: true, rule: automations[idx] });
});

app.delete('/api/admin/automations/:id', async (req, res) => {
  const { id } = req.params;
  const automations = await getAutomations();
  await saveAutomations(automations.filter(r => r.id !== id));
  res.json({ success: true });
});

// ── Notification templates ────────────────────────────────────
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
const EVENT_RECIPIENTS: Record<EventKey, (to: string) => string> = {
  new_booking:       _  => MANAGER_PHONE,
  booking_approved:  to => to,
  driver_accepted:   to => to,
  booking_rejected:  to => to,
  captain_on_road:   to => to,
  booking_completed: to => to,
};
const EVENT_AR_LABELS: Record<EventKey, string> = {
  new_booking:       'حجز جديد → المدير',
  booking_approved:  'موافقة → الكابتن',
  driver_accepted:   'قبول الكابتن → العميل',
  booking_rejected:  'رفض الحجز → العميل',
  captain_on_road:   'الكابتن في الطريق → العميل',
  booking_completed: 'اكتمال الخدمة → العميل',
};

async function getDummyVars(event: EventKey, to: string): Promise<Record<string, string>> {
  const base: Record<string, string> = { id: 'A8F3', name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوة', carType: 'سيدان', package: 'غسيل قياسي', date: 'اليوم', slot: '10:00 AM', driverName: 'علي محمد', driverPhone: to, amount: '25,000' };
  if (event === 'new_booking') {
    base.approveLink = await createShortLink(`${APP_URL}/action?id=TEST_APPROVE&act=approve`);
    base.rejectLink  = await createShortLink(`${APP_URL}/action?id=TEST_REJECT&act=reject`);
  }
  if (event === 'booking_approved') {
    base.acceptLink = await createShortLink(`${APP_URL}/action?id=TEST_ACCEPT&act=accept`);
  }
  return base;
}

app.post('/api/admin/test-notification', async (req, res) => {
  const { event, testPhone } = req.body as { event: EventKey; testPhone?: string };
  if (!event) return res.status(400).json({ error: 'Missing event' });
  const to = testPhone || MANAGER_PHONE;
  try {
    const vars = await getDummyVars(event, to);
    const templates = await getTemplates();
    const cfg = templates[event];
    if (!cfg?.enabled) return res.json({ success: false, error: 'هذا الإشعار معطّل' });
    const text = applyTemplate(cfg.template, vars);
    const recipient = EVENT_RECIPIENTS[event](to);
    await sendWhatsApp(recipient, text);
    res.json({ success: true, sentTo: recipient, preview: text });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/test-all-notifications', async (req, res) => {
  const { testPhone } = req.body as { testPhone?: string };
  const to = testPhone || MANAGER_PHONE;
  const events: EventKey[] = ['new_booking','booking_approved','driver_accepted','booking_rejected','captain_on_road','booking_completed'];
  const templates = await getTemplates();
  const results: { event: string; ok: boolean; label: string }[] = [];
  for (const event of events) {
    const cfg = templates[event];
    if (!cfg?.enabled) {
      results.push({ event, ok: false, label: `${EVENT_AR_LABELS[event]} — معطّل` });
      continue;
    }
    try {
      const vars = await getDummyVars(event, to);
      await sendWhatsApp(EVENT_RECIPIENTS[event](to), applyTemplate(cfg.template, vars));
      results.push({ event, ok: true, label: EVENT_AR_LABELS[event] });
    } catch (e) {
      results.push({ event, ok: false, label: `${EVENT_AR_LABELS[event]}: خطأ` });
    }
    await new Promise(r => setTimeout(r, 300));
  }
  const allOk = results.every(r => r.ok);
  res.json({ success: allOk, sentTo: to, results });
});

// ── Full cycle simulation (all 5 transitions) ────────────────
app.post('/api/admin/simulate-cycle', async (req, res) => {
  const { testPhone: rawPhone } = req.body;
  const customerPhone = rawPhone?.trim() ? normalizePhone(rawPhone.trim()) : MANAGER_PHONE;
  const steps: { label: string; ok: boolean }[] = [];
  let testId = '';
  try {
    const captains = await getCaptains();
    if (!captains.length) return res.status(400).json({ success: false, steps: [{ label: 'لا يوجد كباتن — أضف كابتناً أولاً', ok: false }] });
    const captain = captains[0];

    // Step 1 — Create booking (pending)
    const ref = await addDoc(collection(db, 'bookings'), {
      name: 'عميل تجريبي', phone: customerPhone, neighborhood: 'عنكاوة',
      carType: 'سيدان', package: 'قياسي', date: 'today', slot: '10:00 AM',
      status: 'pending', createdAt: new Date().toISOString(), isTest: true,
      statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: 'test' }],
    });
    testId = ref.id;
    steps.push({ label: '1/5 — تم إنشاء الحجز التجريبي (pending)', ok: true });

    // Step 2 — Manager approves → notify captain
    try {
      const approveLink = await createShortLink(`${APP_URL}/action?id=${testId}&act=approve`);
      const rejectLink  = await createShortLink(`${APP_URL}/action?id=${testId}&act=reject`);
      await notify('new_booking', { id: testId.slice(-5), name: 'عميل تجريبي', phone: customerPhone, neighborhood: 'عنكاوة', carType: 'سيدان', package: 'قياسي', date: 'اليوم', slot: '10:00 AM', approveLink, rejectLink }, MANAGER_PHONE);
      steps.push({ label: `2/5 — إشعار المدير (WhatsApp) → ${MANAGER_PHONE}`, ok: true });
    } catch (e) { steps.push({ label: `2/5 — فشل إشعار المدير: ${String(e).slice(0, 60)}`, ok: false }); }
    await updateDoc(doc(db, 'bookings', testId), { status: 'approved', driverId: captain.id, updatedAt: new Date().toISOString(), statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: 'test' }, { status: 'approved', at: new Date().toISOString(), by: 'sim' }] });

    // Step 3 — Captain accepts → notify customer
    try {
      const acceptLink = await createShortLink(`${APP_URL}/action?id=${testId}&act=accept`);
      await notify('booking_approved', { name: 'عميل تجريبي', phone: customerPhone, neighborhood: 'عنكاوة', slot: '10:00 AM', driverName: captain.name, driverPhone: captain.phone || '', acceptLink }, captain.phone || MANAGER_PHONE);
      steps.push({ label: `3/5 — إشعار الكابتن (approved → accepted) → ${captain.phone || MANAGER_PHONE}`, ok: true });
    } catch (e) { steps.push({ label: `3/5 — فشل إشعار الكابتن: ${String(e).slice(0, 60)}`, ok: false }); }
    await updateDoc(doc(db, 'bookings', testId), { status: 'accepted', updatedAt: new Date().toISOString() });
    try {
      await notify('driver_accepted', { name: 'عميل تجريبي', phone: customerPhone, driverName: captain.name, slot: '10:00 AM' }, customerPhone);
      steps.push({ label: `3/5 — إشعار العميل (الكابتن قبل) → ${customerPhone}`, ok: true });
    } catch (e) { steps.push({ label: `3/5 — فشل إشعار العميل: ${String(e).slice(0, 60)}`, ok: false }); }

    // Step 4 — Captain on road → notify customer
    await updateDoc(doc(db, 'bookings', testId), { status: 'on_road', updatedAt: new Date().toISOString() });
    try {
      await notify('captain_on_road', { name: 'عميل تجريبي', phone: customerPhone, driverName: captain.name, slot: '10:00 AM' }, customerPhone);
      steps.push({ label: `4/5 — الكابتن في الطريق (on_road) → إشعار العميل`, ok: true });
    } catch (e) { steps.push({ label: `4/5 — فشل إشعار الطريق: ${String(e).slice(0, 60)}`, ok: false }); }

    // Step 5 — Captain completes → financials + notify
    const totalAmount = 25000; // قياسي
    const captainShare = Math.round(totalAmount * CAPTAIN_SHARE_PCT);
    const companyShare = totalAmount - captainShare;
    await updateDoc(doc(db, 'bookings', testId), {
      status: 'completed', updatedAt: new Date().toISOString(),
      financials: { totalAmount, captainShare, companyShare },
    });
    try {
      await creditCaptainWallet(captain.id, captainShare, testId, 'حجز تجريبي');
      await notify('booking_completed', { name: 'عميل تجريبي', phone: customerPhone, amount: totalAmount.toLocaleString('ar-IQ') }, customerPhone);
      steps.push({ label: `5/5 — اكتمل الحجز (completed) — ${totalAmount.toLocaleString()} د.ع — محفظة الكابتن +${captainShare.toLocaleString()}`, ok: true });
    } catch (e) { steps.push({ label: `5/5 — فشل الإكمال: ${String(e).slice(0, 60)}`, ok: false }); }

    // Cleanup
    await deleteDoc(doc(db, 'bookings', testId));
    testId = '';
    steps.push({ label: 'تم حذف بيانات الاختبار التجريبي', ok: true });
    res.json({ success: steps.every(s => s.ok), steps });
  } catch (e) {
    if (testId) await deleteDoc(doc(db, 'bookings', testId)).catch(() => {});
    steps.push({ label: 'خطأ عام: ' + String(e), ok: false });
    res.json({ success: false, steps });
  }
});

// Named export for the dev server (server.ts imports this)
export { app };

// Default export: Vercel serverless handler
// Vercel calls this function directly with (req, res)
export default app;
