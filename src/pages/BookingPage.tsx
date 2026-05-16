import React, { useState, useEffect } from 'react';
import { t, Lang } from '../translations';
import SearchableDropdown from '../components/SearchableDropdown';
import WashTechLogo from '../components/WashTechLogo';

type Step = 1 | 2 | 3;
type Status = 'idle' | 'submitting' | 'success' | 'error';

const LANG_KEY = 'wt_lang';

export default function BookingPage() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || 'ar');
  const tr = t[lang];
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState<Status>('idle');
  const [bookingId, setBookingId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [pkgData, setPkgData] = useState<Record<string, { name: string; name_ku: string; desc_ar: string; desc_ku: string; price: number }>>({});

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsDetected, setGpsDetected] = useState(false);

  const [form, setForm] = useState({
    name: '', phone: '', neighborhood: '',
    carType: '', package: '', date: 'today', slot: '',
  });

  useEffect(() => {
    fetch('/api/slots').then(r => r.json()).then(d => setSlots(d.slots || []));
    fetch('/api/neighborhoods').then(r => r.json()).then(d => setNeighborhoods(d.neighborhoods || []));
    fetch('/api/packages').then(r => r.json()).then(d => setPkgData(d.packages || {}));
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function localizeSlot(s: string): string {
    if (lang === 'ar') return s;
    return s.replace('صباحاً', 'بەیانی').replace('مساءاً', 'ئێوارە').replace('منتصف الليل', 'نیوەشەو');
  }

  async function detectLocation() {
    if (!navigator.geolocation) { setGpsError(lang === 'ar' ? 'GPS غير مدعوم' : 'GPS نەگنجاو'); return; }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ar`,
            { headers: { 'User-Agent': 'WashTech/2.0' } }
          );
          const data = await res.json();
          const detected = data.address?.suburb || data.address?.neighbourhood || data.address?.quarter || data.address?.city_district || '';
          const list = neighborhoods.length ? neighborhoods : tr.neighborhoods;
          const match = list.find(n => detected.includes(n) || n.includes(detected));
          if (match) {
            set('neighborhood', match);
            setGpsDetected(true);
          } else if (detected) {
            set('neighborhood', detected);
            setGpsDetected(true);
          } else {
            setGpsError(lang === 'ar' ? 'تعذّر تحديد المنطقة — اكتبها يدوياً' : 'ناوچەکە نەدۆزرایەوە — دەستی بنووسە');
          }
        } catch {
          setGpsError(lang === 'ar' ? 'خطأ في تحديد الموقع' : 'هەڵە لە دیاریکردنی شوێن');
        }
        setGpsLoading(false);
      },
      () => { setGpsError(lang === 'ar' ? 'رُفض الوصول للموقع' : 'مۆڵەتی شوێن ڕەتکرایەوە'); setGpsLoading(false); }
    );
  }

  const step1Valid = form.name.trim() && form.phone.trim().length >= 10;
  const step2Valid = form.neighborhood && form.carType && form.package;
  const step3Valid = form.slot;

  async function submit() {
    setStatus('submitting');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, language: lang }),
      });
      const data = await res.json();
      if (data.id) { setBookingId(data.id); setStatus('success'); }
      else { setErrorMsg(data.error || 'Error'); setStatus('error'); }
    } catch { setErrorMsg('Network error'); setStatus('error'); }
  }

  function switchLang(l: Lang) {
    setLang(l);
    localStorage.setItem(LANG_KEY, l);
    document.documentElement.dir = t[l].dir;
    document.documentElement.lang = l;
  }

  if (status === 'success') {
    const carLabel = (tr.carTypes as Record<string,string>)[form.carType] || form.carType;
    const pkgLabel = (tr.packages as Record<string,string>)[form.package] || form.package;
    const dateLabel = form.date === 'today' ? tr.today : tr.tomorrow;
    return (
      <div dir={tr.dir} className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{tr.success}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{tr.successMsg}</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{tr.name}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{form.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{tr.phone}</span>
              <span className="font-semibold text-slate-900 dark:text-white" dir="ltr">{form.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{tr.neighborhood}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{form.neighborhood}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{tr.carType}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{carLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{tr.package}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{pkgLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{tr.date}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{dateLabel} — {localizeSlot(form.slot)}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-green-800 dark:text-green-300">
              {lang === 'ar' ? 'ستصلك رسالة واتساب بتأكيد الحجز وتحديثاته. شكراً لاختيارك WashTech!' : 'پەیامی واتساپت دەگات بە تازەکارییەکان. سوپاس بۆ هەڵبژاردنت WashTech!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={tr.dir} className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <WashTechLogo size={36} />
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(['ar','ku'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${lang === l ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {l === 'ar' ? 'عربي' : 'کوردی'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-20">
        {/* Step indicator */}
        <div className="flex items-center gap-2 my-6">
          {([1,2,3] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${step >= s ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {step > s ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 transition-all ${step > s ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
            {step === 1 ? tr.personalInfo : step === 2 ? tr.serviceDetails : tr.schedule}
          </h2>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label={tr.name}>
                <input className={input} placeholder={tr.namePlaceholder} value={form.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label={tr.phone}>
                <input className={input} placeholder={tr.phonePlaceholder} value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" />
              </Field>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <Field label={tr.neighborhood}>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={gpsLoading}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-2 disabled:opacity-50 text-sm font-medium rounded-xl transition-colors ${gpsDetected ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}
                >
                  {gpsLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                  {gpsLoading
                    ? (lang === 'ar' ? 'جاري التحديد...' : 'دیاریکردن...')
                    : gpsDetected
                      ? (lang === 'ar' ? `✓ تم تحديد الموقع` : `✓ شوێن دیارکرا`)
                      : (lang === 'ar' ? 'تحديد موقعي تلقائياً' : 'شوێنم ئۆتۆماتیکی دیاریبکە')}
                </button>
                {gpsError && <p className="text-xs text-amber-600 mb-2">{gpsError}</p>}
                <input
                  className={input}
                  placeholder={lang === 'ar' ? 'اكتب اسم المنطقة...' : 'ناوی ناوچەکە بنووسە...'}
                  value={form.neighborhood}
                  onChange={e => { set('neighborhood', e.target.value); setGpsDetected(false); }}
                />
              </Field>
              <Field label={tr.carType}>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(tr.carTypes).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set('carType', k)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.carType === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={tr.package}>
                <div className="space-y-2">
                  {Object.entries(tr.packages).map(([k, v]) => {
                    const pkg = pkgData[k];
                    const displayName = lang === 'ku' ? (pkg?.name_ku || v) : (pkg?.name || v);
                    const desc = lang === 'ku' ? pkg?.desc_ku : pkg?.desc_ar;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set('package', k)}
                        className={`w-full p-3 rounded-xl border-2 text-sm font-medium text-start transition-all ${form.package === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>{displayName}</span>
                          {pkg?.price ? <span className="font-bold text-green-600 dark:text-green-400 text-xs">{pkg.price.toLocaleString('ar-IQ')} د.ع</span> : null}
                        </span>
                        {desc && <span className="block text-xs font-normal mt-0.5 opacity-70">{desc}</span>}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <Field label={tr.date}>
                <div className="grid grid-cols-2 gap-2">
                  {(['today','tomorrow'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('date', d)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.date === d ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                    >
                      {d === 'today' ? tr.today : tr.tomorrow}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={tr.timeSlot}>
                <select
                  value={form.slot}
                  onChange={e => set('slot', e.target.value)}
                  className={input + ' cursor-pointer'}
                >
                  <option value="">{lang === 'ar' ? '— اختر الوقت —' : '— کاتەکە هەڵبژێرە —'}</option>
                  {(slots.length ? slots : tr.slots).map(s => (
                    <option key={s} value={s}>{localizeSlot(s)}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                onClick={() => setStep(s => (s - 1) as Step)}
                className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {tr.back}
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => (s + 1) as Step)}
                disabled={step === 1 ? !step1Valid : !step2Valid}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
              >
                {tr.next}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!step3Valid || status === 'submitting'}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
              >
                {status === 'submitting' ? tr.submitting : tr.submit}
              </button>
            )}
          </div>
          {status === 'error' && <p className="mt-3 text-sm text-red-600 text-center">{errorMsg}</p>}
        </div>

      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const input = 'w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-700 dark:placeholder-slate-500';
