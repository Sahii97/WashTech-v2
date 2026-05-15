import React, { useState, useEffect } from 'react';
import { t, Lang } from '../translations';
import SearchableDropdown from '../components/SearchableDropdown';

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
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

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
            setGpsError(lang === 'ar' ? `لم يُطابق: ${detected} — اكتب المنطقة يدوياً` : `نەگنجا: ${detected} — دەستی بنووسە`);
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
    return (
      <div dir={tr.dir} className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{tr.success}</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{tr.successMsg}</p>

          <button
            onClick={() => { setStatus('idle'); setStep(1); setForm({ name:'',phone:'',neighborhood:'',carType:'',package:'',date:'today',slot:'' }); }}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors"
          >
            {tr.newBooking}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir={tr.dir} className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{tr.appName}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tr.tagline}</p>
          </div>
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
                {gpsDetected ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 border-2 border-green-400 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="text-sm font-semibold text-green-800 dark:text-green-300">{form.neighborhood}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setGpsDetected(false); setGpsError(''); set('neighborhood', ''); }}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 underline"
                    >
                      {lang === 'ar' ? 'تغيير' : 'گۆڕین'}
                    </button>
                  </div>
                ) : (
                  <>
                    {!gpsError && (
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={gpsLoading}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors"
                      >
                        {gpsLoading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                        {gpsLoading
                          ? (lang === 'ar' ? 'جاري التحديد...' : 'دیاریکردن...')
                          : (lang === 'ar' ? 'تحديد موقعي تلقائياً' : 'شوێنم ئۆتۆماتیکی دیاریبکە')}
                      </button>
                    )}
                    {gpsError && (
                      <div className="mb-2">
                        <p className="text-xs text-amber-600 mb-2">{gpsError}</p>
                        <input
                          className={input}
                          placeholder={lang === 'ar' ? 'اكتب اسم المنطقة...' : 'ناوی ناوچەکە بنووسە...'}
                          value={form.neighborhood}
                          onChange={e => set('neighborhood', e.target.value)}
                        />
                      </div>
                    )}
                  </>
                )}
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
                  {Object.entries(tr.packages).map(([k, v]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set('package', k)}
                        className={`w-full p-3 rounded-xl border-2 text-sm font-medium text-start transition-all ${form.package === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                      >
                        {v}
                      </button>
                  ))}
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
                <div className="grid grid-cols-3 gap-2">
                  {(slots.length ? slots : tr.slots).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('slot', s)}
                      className={`p-2 rounded-xl border-2 text-xs font-medium transition-all ${form.slot === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
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
