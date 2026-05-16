import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Bell, Car, Users, MapPin, Play, Trash2, Plus, Check, RefreshCw, Moon, Sun, Send, TrendingUp, Pencil, X, ChevronDown, Terminal, Wallet, DollarSign, ArrowDownLeft, ArrowUpRight, Save, Package, CheckCheck, XCircle, Navigation, Star, Smartphone, Zap } from 'lucide-react';
import MessageCard from '../components/MessageCard';
import WashTechLogo from '../components/WashTechLogo';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `منذ ${diff} ث`;
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}
const BUILD_COUNT = typeof __COMMIT_COUNT__ !== 'undefined' ? __COMMIT_COUNT__ : '0';
const BUILD_TIME  = typeof __BUILD_TIME__   !== 'undefined' ? __BUILD_TIME__   : new Date().toISOString();

type Driver       = { id: string; name: string; code: string; phone?: string };
type Manager      = { id: string; name: string; username: string };
type EventKey     = 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected' | 'captain_on_road' | 'booking_completed';
type RecipientType = 'manager' | 'captain' | 'customer' | 'custom';
type Section      = 'workflow' | 'drivers' | 'managers' | 'settings';
type FinanceCaptain = { id: string; name: string; phone?: string; balance: number; totalEarned: number; totalWithdrawn: number };

interface TemplateConfig { enabled: boolean; template: string; }
type Templates = Record<EventKey, TemplateConfig>;

interface AutomationRule {
  id: string;
  enabled: boolean;
  trigger: EventKey;
  recipientType: RecipientType;
  customPhone?: string;
  template?: string;
}

// ── Sample values for message preview ────────────────────────
const PREVIEW_VARS: Record<string, string> = {
  id: 'A8F3', name: 'محمد أحمد', phone: '07901234567',
  neighborhood: 'عنكاوة', carType: 'سيدان', package: 'قياسي',
  date: 'اليوم', slot: '10:00 AM',
  approveLink: 'washt.ch/go/AB1C', rejectLink: 'washt.ch/go/XY9Z',
  acceptLink: 'washt.ch/go/QR4W', driverName: 'علي محمد',
  driverPhone: '07901234567',
};
function renderPreview(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => PREVIEW_VARS[k] ?? `[${k}]`);
}

const DEFAULT_TEMPLATES: Templates = {
  new_booking:       { enabled: true, template: '📦 *حجز جديد* #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}\n\n──────────────\n✅ *قبول:*\n{{approveLink}}\n\n❌ *رفض:*\n{{rejectLink}}' },
  booking_approved:  { enabled: true, template: '✅ *مهمة جديدة*\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\n──────────────\n▶️ *قبول المهمة:*\n{{acceptLink}}' },
  driver_accepted:   { enabled: true, template: '🚗 *الكابتن قبل مهمتك!*\n👨‍💼 الكابتن: {{driverName}}\n🕐 الوقت: {{slot}}\n\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼' },
  booking_rejected:  { enabled: true, template: '❌ عذراً {{name}}،\nلم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\n\nWashTech 🚗' },
  captain_on_road:   { enabled: true, template: '🚀 *الكابتن في الطريق إليك!*\n👨‍💼 {{driverName}}\n🕐 الوقت: {{slot}}\n\nاستعد لاستقباله. شكراً! 🧼' },
  booking_completed: { enabled: true, template: '✅ تم الانتهاء من خدمة غسيل سيارتك!\nشكراً لاختيارك WashTech 🧼\nقيّم تجربتك: ⭐⭐⭐⭐⭐' },
};

const EVENT_META: { key: EventKey; icon: React.ReactNode; label: string; ifLabel: string; vars: string[]; recipient: string }[] = [
  { key: 'new_booking',       icon: <Package size={18} strokeWidth={1.5} />,   label: 'حجز جديد',          ifLabel: 'وصل حجز جديد',             recipient: 'يُرسل إلى: المدير',   vars: ['id','name','phone','neighborhood','carType','package','date','slot','approveLink','rejectLink'] },
  { key: 'booking_approved',  icon: <CheckCheck size={18} strokeWidth={1.5} />, label: 'موافقة المدير',    ifLabel: 'وافق المدير على الحجز',    recipient: 'يُرسل إلى: الكابتن', vars: ['name','phone','neighborhood','slot','driverName','driverPhone','acceptLink'] },
  { key: 'driver_accepted',   icon: <Car size={18} strokeWidth={1.5} />,        label: 'قبول الكابتن',    ifLabel: 'قبل الكابتن المهمة',        recipient: 'يُرسل إلى: العميل',  vars: ['name','phone','driverName','slot'] },
  { key: 'booking_rejected',  icon: <XCircle size={18} strokeWidth={1.5} />,    label: 'رفض الحجز',       ifLabel: 'رُفض الحجز',               recipient: 'يُرسل إلى: العميل',  vars: ['name','phone'] },
  { key: 'captain_on_road',   icon: <Navigation size={18} strokeWidth={1.5} />, label: 'الكابتن في الطريق', ifLabel: 'انطلق الكابتن للعميل',   recipient: 'يُرسل إلى: العميل',  vars: ['name','phone','driverName','slot'] },
  { key: 'booking_completed', icon: <Star size={18} strokeWidth={1.5} />,       label: 'اكتمال الخدمة',   ifLabel: 'اكتملت الخدمة',            recipient: 'يُرسل إلى: العميل',  vars: ['name','phone'] },
];

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  manager:  'المدير',
  captain:  'الكابتن',
  customer: 'العميل',
  custom:   'رقم مخصص',
};

const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'workflow',  label: 'الرسائل',         icon: <Bell        size={20} strokeWidth={1.5} /> },
  { key: 'drivers',   label: 'الكباتن',         icon: <Car         size={20} strokeWidth={1.5} /> },
  { key: 'managers',  label: 'المدراء',         icon: <Users       size={20} strokeWidth={1.5} /> },
  { key: 'settings',  label: 'اعدادات المطور', icon: <Terminal    size={20} strokeWidth={1.5} /> },
];

const inp = 'w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition';

// ── Toggle — uses button+inline-style to avoid RTL/peer issues ─
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      dir="ltr"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)', marginTop: '1px' }}
        className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out"
      />
    </button>
  );
}

// ── WhatsApp-style editor with rendered MessageCard preview ────────
function WaEditor({ value, onChange, rows, textareaRef }: {
  value: string; onChange: (v: string) => void;
  rows?: number; textareaRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const now = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600">
      {/* WhatsApp-style preview */}
      <div className="bg-[#e5ddd5] dark:bg-[#0c1317] px-3 py-3">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">معاينة الرسالة</p>
        <MessageCard
          from="WashTech"
          body={renderPreview(value) || 'اكتب الرسالة أدناه...'}
          time={now}
          compact={false}
        />
      </div>
      {/* Editor */}
      <div className="bg-[#f0f2f5] dark:bg-slate-800 flex items-end gap-2 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows ?? 4}
          dir="auto"
          placeholder="نص الرسالة... استخدم {{المتغير}} لبيانات ديناميكية"
          className="flex-1 bg-white dark:bg-slate-700 border-0 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30 font-mono"
        />
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5">
          <Send size={14} strokeWidth={2} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ── Automation rule add/edit form ─────────────────────────────
function RuleForm({
  initial, onSave, onCancel, hideIf, fixedTrigger, vars,
}: {
  initial?: Partial<AutomationRule>;
  onSave: (data: Partial<AutomationRule>) => Promise<void>;
  onCancel: () => void;
  hideIf?: boolean;
  fixedTrigger?: EventKey;
  vars?: string[];
}) {
  const [trigger, setTrigger]     = useState<EventKey>(fixedTrigger || (initial?.trigger as EventKey) || 'new_booking');
  const [recipient, setRecipient] = useState<RecipientType>(initial?.recipientType || 'manager');
  const [phone, setPhone]         = useState(initial?.customPhone || '');
  const [template, setTemplate]   = useState(initial?.template ?? '');
  // When no vars prop given, derive from current trigger (for standalone form with trigger selector)
  const effectiveVars = vars ?? EVENT_META.find(m => m.key === trigger)?.vars ?? [];
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  const templateRef = React.useRef<HTMLTextAreaElement>(null);

  function insertVar(v: string) {
    const el = templateRef.current;
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    const token = `{{${v}}}`;
    setTemplate(prev => prev.slice(0, s) + token + prev.slice(e));
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + token.length; el.focus(); }, 0);
  }

  async function handleSave() {
    setErr('');
    setSaving(true);
    try {
      await onSave({
        trigger,
        recipientType: recipient,
        customPhone: recipient === 'custom' ? phone : undefined,
        template: template.trim() || undefined,
      });
    } catch (e: any) {
      setErr(e?.message || 'فشل الحفظ');
    }
    setSaving(false);
  }

  const now = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 p-3 space-y-2.5">
      {!hideIf && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">إذا: (الحدث)</label>
          <div className="relative">
            <select value={trigger} onChange={e => setTrigger(e.target.value as EventKey)} className={inp + ' appearance-none pr-8'}>
              {EVENT_META.map(m => <option key={m.key} value={m.key}>{m.ifLabel}</option>)}
            </select>
            <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">أرسل واتساب إلى</label>
        <div className="relative">
          <select value={recipient} onChange={e => setRecipient(e.target.value as RecipientType)} className={inp + ' appearance-none pr-8'}>
            {(Object.entries(RECIPIENT_LABELS) as [RecipientType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>
      {recipient === 'custom' && (
        <input type="tel" dir="ltr" placeholder="07XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} className={inp} />
      )}

      {/* Per-rule message template */}
      <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            نص الرسالة <span className="font-normal text-slate-400">(اتركها فارغة للرسالة الافتراضية)</span>
          </label>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {effectiveVars.map(v => (
              <button key={v} type="button" onClick={() => insertVar(v)}
                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-mono rounded border border-blue-100 dark:border-blue-800 transition-colors">
                {v}
              </button>
            ))}
          </div>
          {template && (
            <div className="mb-1.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
              <div className="bg-[#e5ddd5] dark:bg-[#0c1317] px-2 py-2">
                <MessageCard from="WashTech" body={renderPreview(template)} time={now} compact={false} />
              </div>
            </div>
          )}
          <div className="bg-[#f0f2f5] dark:bg-slate-800 flex items-end gap-2 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-600">
            <textarea
              ref={templateRef}
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={3}
              dir="auto"
              placeholder="نص الرسالة لهذا المستلم..."
              className="flex-1 bg-white dark:bg-slate-700 border-0 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            />
            <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5">
              <Send size={12} strokeWidth={2} className="text-white" />
            </div>
          </div>
        </div>

      {err && <p className="text-xs text-red-500 font-mono">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving || (recipient === 'custom' && !phone.trim())}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5">
          <Check size={13} strokeWidth={3} />
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors">
          إلغاء
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AdminDashboard() {
  const [section, setSection] = useState<Section>('workflow');
  const [dark, setDark] = useState(() => localStorage.getItem('wt_dark') === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('wt_dark', dark ? '1' : '0');
  }, [dark]);

  const [drivers,        setDrivers]        = useState<Driver[]>([]);
  const [managers,       setManagers]       = useState<Manager[]>([]);
  const [bookings,       setBookings]       = useState<any[]>([]);
  const [slots,          setSlots]          = useState<string[]>([]);
  const [neighborhoods,  setNeighborhoods]  = useState<string[]>([]);
  const [automations,    setAutomations]    = useState<AutomationRule[]>([]);
  const [templates,      setTemplates]      = useState<Templates>(DEFAULT_TEMPLATES);

  // Finance section state (section='finance' is not in nav but code references these)
  const [finLoading,  setFinLoading]  = useState(false);
  const [finOverview, setFinOverview] = useState<{ totalRevenue: number; companyRevenue: number; captainPayouts: number; completedCount: number } | null>(null);
  const [finCaptains, setFinCaptains] = useState<(FinanceCaptain & { totalCollected?: number })[]>([]);
  const [adjForm, setAdjForm] = useState<{ captainId: string; type: 'receipt' | 'withdrawal' | 'adjustment'; amount: string; note: string }>({ captainId: '', type: 'receipt', amount: '', note: '' });
  const [adjLoading, setAdjLoading]  = useState(false);
  const [adjMsg,     setAdjMsg]      = useState('');



  // Dynamic settings state
  const [finConfig,      setFinConfig]      = useState({ captainSharePct: 70, basic: 15000, standard: 25000, premium: 35000, basicName: 'أساسي', standardName: 'قياسي', premiumName: 'ممتاز', basicDesc: '', standardDesc: '', premiumDesc: '' });
  const [appConfig,      setAppConfig]      = useState({ appName: 'WashTech', tagline: 'خدمة غسيل سيارات احترافية', supportPhone: '', managerPhone: '', automationEnabled: true });
  const [settingsSaved,  setSettingsSaved]  = useState('');
  const [settingsLoading,setSettingsLoading]= useState(false);

  const [newDriver,   setNewDriver]   = useState({ name: '', code: '', phone: '' });
  const [newManager,  setNewManager]  = useState({ name: '', username: '', password: '' });
  const [newNeighbor, setNewNeighbor] = useState('');

  const [driverMsg,   setDm]  = useState('');
  const [managerMsg,  setMm]  = useState('');
  const [neighborMsg, setNm]  = useState('');
  const [resetting,   setRes] = useState(false);

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

  // Automation CRUD state
  const [editingRuleId,    setEditingRuleId]    = useState<string | null>(null);
  const [addingRuleForEvent, setAddingRuleForEvent] = useState<EventKey | null>(null);
  const [addingStandaloneRule, setAddingStandaloneRule] = useState(false);
  const [showPreview,      setShowPreview]      = useState<Partial<Record<EventKey, boolean>>>({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [d, b, s, n, m, t, a] = await Promise.all([
      fetch('/api/drivers').then(r => r.json()),
      fetch('/api/bookings').then(r => r.json()),
      fetch('/api/slots').then(r => r.json()),
      fetch('/api/neighborhoods').then(r => r.json()),
      fetch('/api/admin/managers').then(r => r.json()),
      fetch('/api/admin/notification-templates').then(r => r.json()),
      fetch('/api/admin/automations').then(r => r.json()),
    ]);
    setDrivers(d.drivers || []);
    setBookings(b.bookings || []);
    setSlots(s.slots || []);
    setNeighborhoods(n.neighborhoods || []);
    setManagers(m.managers || []);
    if (t.templates) setTemplates({ ...DEFAULT_TEMPLATES, ...t.templates });
    if (a.automations) setAutomations(a.automations);
  }

  async function loadSettingsConfig() {
    try {
      const [fc, ac] = await Promise.all([
        fetch('/api/admin/settings/finance_config').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/settings/app_config').then(r => r.json()).catch(() => ({})),
      ]);
      if (fc?.value) {
        const v = fc.value;
        setFinConfig({
          captainSharePct: Math.round((v.captainSharePct || 0.70) * 100),
          basic: v.packagePrices?.basic || 15000, standard: v.packagePrices?.standard || 25000, premium: v.packagePrices?.premium || 35000,
          basicName: v.packageNames?.basic || 'أساسي', standardName: v.packageNames?.standard || 'قياسي', premiumName: v.packageNames?.premium || 'ممتاز',
          basicDesc: v.packageDescriptions?.basic || '', standardDesc: v.packageDescriptions?.standard || '', premiumDesc: v.packageDescriptions?.premium || '',
        });
      }
      if (ac?.value) setAppConfig(prev => ({ ...prev, ...ac.value }));
    } catch {}
  }

  useEffect(() => { if (section === 'settings' || section === 'workflow') loadSettingsConfig(); }, [section]);

  useEffect(() => { loadAll(); }, []);

  const completedBookings = bookings.filter((b: any) => b.status === 'completed');
  const totalRevenue = 0; // requires finance data; populated by loadFinance

  async function loadFinance() {
    setFinLoading(true);
    try {
      const res = await fetch('/api/admin/finance-overview').catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        setFinOverview(d.overview || null);
        setFinCaptains(d.captains || []);
      }
    } catch {}
    setFinLoading(false);
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjForm.captainId || !adjForm.amount) return;
    setAdjLoading(true); setAdjMsg('');
    const res = await fetch('/api/captain/transaction', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: adjForm.captainId, type: adjForm.type, amount: Number(adjForm.amount), note: adjForm.note }),
    });
    const d = await res.json();
    setAdjMsg(d.success ? '✓ تم تحديث المحفظة' : (d.error || 'خطأ'));
    setAdjForm(p => ({ ...p, amount: '', note: '' }));
    setAdjLoading(false);
    loadFinance();
    setTimeout(() => setAdjMsg(''), 3000);
  }

  async function saveFinanceConfig() {
    setSettingsLoading(true);
    const value = {
      captainSharePct: finConfig.captainSharePct / 100,
      packagePrices: { basic: finConfig.basic, standard: finConfig.standard, premium: finConfig.premium },
      packageNames: { basic: finConfig.basicName, standard: finConfig.standardName, premium: finConfig.premiumName },
      packageDescriptions: { basic: finConfig.basicDesc, standard: finConfig.standardDesc, premium: finConfig.premiumDesc },
    };
    await fetch('/api/admin/settings/finance_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });
    setSettingsSaved('finance'); setSettingsLoading(false);
    setTimeout(() => setSettingsSaved(''), 2500);
  }

  async function saveAppConfig() {
    setSettingsLoading(true);
    await fetch('/api/admin/settings/app_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: appConfig }) });
    setSettingsSaved('app'); setSettingsLoading(false);
    setTimeout(() => setSettingsSaved(''), 2500);
  }



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
    setSimulating(true); setSimSteps([]);
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
    setTestingAll(true); setTestAllResult('جاري الإرسال...'); setTestAllRows([]);
    const res = await fetch('/api/admin/test-all-notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPhone: testPhone.trim() || undefined }),
    }).catch(() => null);
    const d = res ? await res.json() : { error: 'Network error' };
    if (d.results) setTestAllRows(d.results);
    setTestAllResult(d.success ? `✓ اكتمل — ${d.sentTo}` : `✗ ${d.error || 'فشل'}`);
    setTestingAll(false);
    setTimeout(() => setTestAllResult(''), 12000);
  }

  // ── Automation helpers ────────────────────────────────────────
  async function patchRule(id: string, patch: Partial<AutomationRule>) {
    const next = automations.map(r => r.id === id ? { ...r, ...patch } : r);
    setAutomations(next);
    await fetch(`/api/admin/automations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(console.error);
  }

  async function deleteRule(id: string) {
    if (!window.confirm('حذف هذه القاعدة؟')) return;
    setAutomations(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/admin/automations/${id}`, { method: 'DELETE' }).catch(console.error);
  }

  async function addRule(data: Partial<AutomationRule>) {
    const res = await fetch('/api/admin/automations/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!res.ok || !d.rule) throw new Error(d.error || 'فشل الحفظ');
    // Optimistic update — close form immediately, refresh in background
    setAutomations(prev => [...prev, d.rule]);
    setAddingRuleForEvent(null);
    setAddingStandaloneRule(false);
    fetch('/api/admin/automations').then(r => r.json()).then(fresh => {
      if (fresh.automations) setAutomations(fresh.automations);
    }).catch(() => {});
  }

  async function saveEditRule(id: string, data: Partial<AutomationRule>) {
    // Remove undefined values — Firestore rejects them
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    const res = await fetch(`/api/admin/automations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'فشل التعديل');
    // Optimistic update — close form immediately, refresh in background
    setAutomations(prev => prev.map(r => r.id === id ? { ...r, ...data, id } : r));
    setEditingRuleId(null);
    fetch('/api/admin/automations').then(r => r.json()).then(fresh => {
      if (fresh.automations) setAutomations(fresh.automations);
    }).catch(() => {});
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <WashTechLogo size={32} />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            #{BUILD_COUNT} · {timeAgo(BUILD_TIME)} · {bookings.length} حجز · {drivers.length} كابتن
          </p>
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
                section === item.key ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
            </button>
          ))}
        </nav>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 max-w-3xl">


          {/* ── Workflow: Messages + Automation ─────────── */}
          {section === 'workflow' && (
            <div className="space-y-4">
              {/* Header + global toggle */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">الرسائل والأتمتة</h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setAddingStandaloneRule(true); setAddingRuleForEvent(null); setEditingRuleId(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    قاعدة جديدة
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">إشعارات</span>
                    <Toggle
                      checked={appConfig.automationEnabled !== false}
                      onChange={v => {
                        const newCfg = { ...appConfig, automationEnabled: v };
                        setAppConfig(newCfg);
                        fetch('/api/admin/settings/app_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: newCfg }) });
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Standalone add rule form */}
              {addingStandaloneRule && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-300 dark:border-blue-700 p-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">إضافة قاعدة أتمتة جديدة</p>
                  <RuleForm
                    onSave={addRule}
                    onCancel={() => setAddingStandaloneRule(false)}
                  />
                </div>
              )}

              {EVENT_META.map(meta => {
                const cfg = templates[meta.key] || DEFAULT_TEMPLATES[meta.key];
                const eventRules = automations.filter(r => r.trigger === meta.key);
                const isPreviewOpen = showPreview[meta.key] || false;
                const isAddingForThis = addingRuleForEvent === meta.key;
                const now = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={meta.key} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    {/* Event header */}
                    <div className="flex items-start justify-between mb-4 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">{meta.icon}</span>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{meta.label}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{meta.ifLabel}</p>
                        </div>
                      </div>
                      <Toggle checked={cfg.enabled} onChange={v => setTemplates(p => ({ ...p, [meta.key]: { ...p[meta.key], enabled: v } }))} />
                    </div>

                    {cfg.enabled && (
                      <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                          <Zap size={11} className="text-green-500" />
                          إذن: أرسل إلى
                        </p>
                        <div className="space-y-1.5">
                          {eventRules.map(rule =>
                            editingRuleId === rule.id ? (
                              <RuleForm
                                key={rule.id}
                                initial={rule}
                                hideIf
                                vars={meta.vars}
                                onSave={data => saveEditRule(rule.id, data)}
                                onCancel={() => setEditingRuleId(null)}
                              />
                            ) : (
                              <div key={rule.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-opacity ${rule.enabled ? '' : 'opacity-50'}`} style={{ background: 'rgba(0,0,0,0.03)' }}>
                                <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {RECIPIENT_LABELS[rule.recipientType]}
                                  {rule.customPhone && <span className="font-mono text-xs text-slate-400 mr-2" dir="ltr">{rule.customPhone}</span>}
                                  {rule.template
                                    ? <span className="mr-1.5 text-[10px] text-blue-500 font-semibold bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded-md">رسالة مخصصة</span>
                                    : <span className="mr-1.5 text-[10px] text-amber-500 font-medium bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md">بدون رسالة</span>
                                  }
                                </span>
                                <Toggle checked={rule.enabled} onChange={v => patchRule(rule.id, { enabled: v })} />
                                <button type="button" onClick={() => { setEditingRuleId(rule.id); setAddingRuleForEvent(null); }} className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg transition-colors" title="تعديل"><Pencil size={12} /></button>
                                <button type="button" onClick={() => deleteRule(rule.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="حذف"><Trash2 size={12} /></button>
                              </div>
                            )
                          )}
                          {eventRules.length === 0 && !isAddingForThis && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 py-0.5">لم تُضف أي مستلم — أضف واحداً أدناه</p>
                          )}
                          {isAddingForThis && (
                            <RuleForm
                              hideIf
                              fixedTrigger={meta.key}
                              vars={meta.vars}
                              onSave={async data => { await addRule({ ...data, trigger: meta.key }); }}
                              onCancel={() => setAddingRuleForEvent(null)}
                            />
                          )}
                        </div>
                        {!isAddingForThis && (
                          <button
                            type="button"
                            onClick={() => { setAddingRuleForEvent(meta.key); setEditingRuleId(null); }}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
                          >
                            <Plus size={12} /> إضافة مستلم
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Captains ──────────────────────────────── */}
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
                    <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                      <span className="flex items-center gap-1"><Plus size={16} strokeWidth={2} /> إضافة</span>
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
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">كود: {d.code}{d.phone ? ` · ${d.phone}` : ''}</p>
                    </div>
                    <button onClick={() => deleteDriver(d.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                {drivers.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6">لا يوجد كباتن بعد</p>}
              </div>
            </div>
          )}

          {/* ── Managers ──────────────────────────────── */}
          {section === 'managers' && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">المدراء</h2>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">إضافة مدير</p>
                <form onSubmit={createManager} className="space-y-2">
                  <input placeholder="الاسم الكامل" required className={inp} value={newManager.name}
                    onChange={e => setNewManager(p => ({ ...p, name: e.target.value }))} />
                  <div className="flex gap-2">
                    <input placeholder="اسم المستخدم" required dir="ltr" className={inp + ' flex-1'} value={newManager.username}
                      onChange={e => setNewManager(p => ({ ...p, username: e.target.value }))} />
                    <input placeholder="كلمة المرور" type="password" required className={inp + ' flex-1'} value={newManager.password}
                      onChange={e => setNewManager(p => ({ ...p, password: e.target.value }))} />
                    <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                      <span className="flex items-center gap-1"><Plus size={16} strokeWidth={2} /> إضافة</span>
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
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                {managers.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6">لا يوجد مدراء بعد</p>}
              </div>
            </div>
          )}


          {/* ── Finance ────────────────────────────────── */}
          {section === 'finance' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2"><Wallet size={20} className="text-green-600" /> المالية</h2>
                <button onClick={loadFinance} disabled={finLoading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                  <RefreshCw size={16} className={finLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Loading state */}
              {finLoading && !finOverview && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">جاري تحميل البيانات المالية...</p>
                </div>
              )}

              {/* Overview cards */}
              {finOverview && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'إجمالي الإيرادات', val: finOverview.totalRevenue,   cls: 'text-slate-900 dark:text-white', icon: <DollarSign size={16} className="text-green-500" /> },
                    { label: 'حصة الشركة',        val: finOverview.companyRevenue, cls: 'text-green-700 dark:text-green-400', icon: <ArrowUpRight size={16} className="text-green-500" /> },
                    { label: 'حصة الكباتن',       val: finOverview.captainPayouts, cls: 'text-blue-700 dark:text-blue-400',  icon: <ArrowDownLeft size={16} className="text-blue-500" /> },
                    { label: 'مكتملة',            val: finOverview.completedCount, cls: 'text-slate-700 dark:text-slate-300', icon: <Check size={16} className="text-slate-400" />, noFormat: true },
                  ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center gap-1.5 mb-1">{s.icon}<p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p></div>
                      <p className={`text-lg font-bold ${s.cls}`} dir="ltr">{(s as any).noFormat ? s.val : s.val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-captain wallet table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">محافظ الكباتن</h3>
                </div>
                {finCaptains.length === 0 && <p className="text-center text-slate-400 text-sm py-8">لا يوجد كباتن بعد</p>}
                {finCaptains.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0 flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{c.name}</p>
                      {c.phone && <p className="text-xs text-slate-400 font-mono" dir="ltr">{c.phone}</p>}
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <div><p className="text-slate-400">مطلوب منه</p><p className={`font-bold ${c.balance < 0 ? 'text-red-500' : 'text-green-600'}`} dir="ltr">{Math.abs(c.balance).toLocaleString()}</p></div>
                      <div><p className="text-slate-400">مكتسب</p><p className="font-bold text-blue-600" dir="ltr">{c.totalEarned.toLocaleString()}</p></div>
                      <div><p className="text-slate-400">مستلم كاش</p><p className="font-bold text-slate-600 dark:text-slate-300" dir="ltr">{(c.totalCollected || 0).toLocaleString()}</p></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Manual wallet adjustment */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4">تسوية مالية يدوية</h3>
                <form onSubmit={submitAdjustment} className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="relative">
                        <select value={adjForm.captainId} onChange={e => setAdjForm(p => ({ ...p, captainId: e.target.value }))} className={inp + ' appearance-none'}>
                          <option value="" disabled>اختر الكابتن...</option>
                          {finCaptains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {(() => {
                        const sel = finCaptains.find(c => c.id === adjForm.captainId);
                        if (!sel) return null;
                        return (
                          <p className="text-xs mt-1.5 px-1 font-medium">
                            {sel.balance < 0 ? <span className="text-red-500">المطلوب استلامه للتسوية: {Math.abs(sel.balance).toLocaleString()} د.ع</span> : <span className="text-green-600">رصيده الحالي: {sel.balance.toLocaleString()} د.ع</span>}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="relative h-fit">
                      <select value={adjForm.type} onChange={e => setAdjForm(p => ({ ...p, type: e.target.value as any }))} className={inp + ' appearance-none pr-8 w-auto'}>
                        <option value="receipt">استلام نقدي من الكابتن</option>
                        <option value="withdrawal">سحب رصيد (دفع للكابتن)</option>
                        <option value="adjustment">تسوية مالية (تصفير رصيد)</option>
                      </select>
                      <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="المبلغ (د.ع)" required min="1" value={adjForm.amount} onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))} className={inp + ' flex-1'} dir="ltr" />
                    <input placeholder="ملاحظة (اختياري)" value={adjForm.note} onChange={e => setAdjForm(p => ({ ...p, note: e.target.value }))} className={inp + ' flex-1'} />
                  </div>
                  <button type="submit" disabled={adjLoading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
                    {adjLoading ? 'جاري...' : 'تطبيق التسوية'}
                  </button>
                  {adjMsg && <p className={`text-sm text-center font-medium ${adjMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{adjMsg}</p>}
                </form>
              </div>
            </div>
          )}

          {/* ── Settings ───────────────────────────────── */}
          {section === 'settings' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Terminal size={20} className="text-slate-500 dark:text-slate-400" />
                <h2 className="font-bold text-slate-900 dark:text-white text-lg">اعدادات المطور</h2>
              </div>

              {/* ── Global automation toggle ── */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap size={20} className={appConfig.automationEnabled !== false ? 'text-green-500' : 'text-slate-400'} strokeWidth={1.5} />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">إشعارات واتساب</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{appConfig.automationEnabled !== false ? 'مفعّلة — الرسائل تُرسل تلقائياً' : 'معطّلة — لن تُرسل أي رسائل'}</p>
                  </div>
                </div>
                <Toggle
                  checked={appConfig.automationEnabled !== false}
                  onChange={v => {
                    const newCfg = { ...appConfig, automationEnabled: v };
                    setAppConfig(newCfg);
                    fetch('/api/admin/settings/app_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: newCfg }) });
                  }}
                />
              </div>

              {/* App config */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Terminal size={16} className="text-slate-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">إعدادات التطبيق</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">اسم التطبيق</label>
                    <input value={appConfig.appName} onChange={e => setAppConfig(p => ({ ...p, appName: e.target.value }))} className={inp} placeholder="WashTech" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">الوصف / الشعار</label>
                    <input value={appConfig.tagline} onChange={e => setAppConfig(p => ({ ...p, tagline: e.target.value }))} className={inp} placeholder="خدمة غسيل سيارات..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">رقم واتساب المدير (يستقبل إشعارات الحجوزات)</label>
                    <div className="flex items-center gap-2">
                      <Smartphone size={16} className="text-slate-400 flex-shrink-0" />
                      <input value={appConfig.managerPhone || ''} onChange={e => setAppConfig(p => ({ ...p, managerPhone: e.target.value }))} className={inp} placeholder="+9647XXXXXXXXX" dir="ltr" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">رقم الدعم (واتساب)</label>
                    <input value={appConfig.supportPhone} onChange={e => setAppConfig(p => ({ ...p, supportPhone: e.target.value }))} className={inp} placeholder="+9647XXXXXXXXX" dir="ltr" />
                  </div>
                  <button onClick={saveAppConfig} disabled={settingsLoading} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${settingsSaved === 'app' ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}>
                    <Save size={14} />{settingsSaved === 'app' ? '✓ تم الحفظ' : 'حفظ إعدادات التطبيق'}
                  </button>
                </div>
              </div>

              {/* Packages editor */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Package size={16} className="text-slate-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">إعدادات الباقات</h3>
                </div>
                <div className="space-y-4">
                  {(['basic', 'standard', 'premium'] as const).map(pkg => {
                    const nameKey = `${pkg}Name` as keyof typeof finConfig;
                    const descKey = `${pkg}Desc` as keyof typeof finConfig;
                    const labels = { basic: 'الباقة الأساسية', standard: 'الباقة القياسية', premium: 'الباقة المميزة' };
                    return (
                      <div key={pkg} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{labels[pkg]}</p>
                        <div className="flex gap-2">
                          <input
                            value={String(finConfig[nameKey] || '')}
                            onChange={e => setFinConfig(p => ({ ...p, [nameKey]: e.target.value }))}
                            className={inp + ' flex-1'}
                            placeholder="اسم الباقة"
                          />
                          <input
                            type="number"
                            value={finConfig[pkg]}
                            onChange={e => setFinConfig(p => ({ ...p, [pkg]: Number(e.target.value) }))}
                            className={inp + ' w-32 font-mono'}
                            dir="ltr"
                            placeholder="السعر"
                          />
                        </div>
                        <input
                          value={String(finConfig[descKey] || '')}
                          onChange={e => setFinConfig(p => ({ ...p, [descKey]: e.target.value }))}
                          className={inp}
                          placeholder="وصف الباقة (اختياري)"
                        />
                      </div>
                    );
                  })}
                  <button onClick={saveFinanceConfig} disabled={settingsLoading} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${settingsSaved === 'finance' ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}>
                    <Save size={14} />{settingsSaved === 'finance' ? '✓ تم الحفظ' : 'حفظ إعدادات الباقات'}
                  </button>
                </div>
              </div>

              {/* System info */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">معلومات النظام</p>
                <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400 mb-4">
                  <p>الحجوزات: {bookings.length} · مكتملة: {completedBookings.length}</p>
                  <p>الكباتن: {drivers.length} · المدراء: {managers.length}</p>
                  <p>المناطق: {neighborhoods.length} · المواعيد: {slots.length}</p>
                  <p>قواعد الأتمتة: {automations.length}</p>
                  {totalRevenue > 0 && <p>الإيرادات: {totalRevenue.toLocaleString()} د.ع</p>}
                </div>
                <a href="/api/health" target="_blank" className="inline-block text-xs text-blue-600 underline">فحص حالة الخادم</a>
              </div>

              {/* Danger zone */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-800 p-5">
                <p className="font-semibold text-red-700 dark:text-red-400 mb-1 text-sm">منطقة الخطر</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">حذف جميع الحجوزات والروابط القصيرة وإعادة ضبط البيانات</p>
                <button onClick={reset} disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                  <Trash2 size={16} strokeWidth={1.5} />
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
