import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────
export interface FinanceConfig {
  captainSharePct: number;     // e.g. 0.70
  packagePrices: {
    basic: number;
    standard: number;
    premium: number;
  };
  currency: string;            // 'IQD'
}

export interface AppConfig {
  appName: string;
  tagline: string;
  supportPhone: string;
  managerPhone: string;
}

export interface SettingsState {
  finance: FinanceConfig;
  app: AppConfig;
  loaded: boolean;
}

interface SettingsContextValue extends SettingsState {
  reload: () => Promise<void>;
  saveFinance: (cfg: FinanceConfig) => Promise<void>;
  saveApp: (cfg: AppConfig) => Promise<void>;
}

// ── Defaults ──────────────────────────────────────────────────
const DEFAULT_FINANCE: FinanceConfig = {
  captainSharePct: 0.70,
  packagePrices: { basic: 15000, standard: 25000, premium: 35000 },
  currency: 'IQD',
};

const DEFAULT_APP: AppConfig = {
  appName: 'WashTech',
  tagline: 'خدمة غسيل سيارات احترافية',
  supportPhone: '+9647809471576',
  managerPhone: '+9647809471576',
};

// ── Context ───────────────────────────────────────────────────
const SettingsContext = createContext<SettingsContextValue>({
  finance: DEFAULT_FINANCE,
  app: DEFAULT_APP,
  loaded: false,
  reload: async () => {},
  saveFinance: async () => {},
  saveApp: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [finance, setFinance] = useState<FinanceConfig>(DEFAULT_FINANCE);
  const [app, setApp]         = useState<AppConfig>(DEFAULT_APP);
  const [loaded, setLoaded]   = useState(false);

  const reload = useCallback(async () => {
    try {
      const [fRes, aRes] = await Promise.all([
        fetch('/api/admin/settings/finance'),
        fetch('/api/admin/settings/app'),
      ]);
      if (fRes.ok) {
        const fd = await fRes.json();
        if (fd.value) setFinance({ ...DEFAULT_FINANCE, ...fd.value });
      }
      if (aRes.ok) {
        const ad = await aRes.json();
        if (ad.value) setApp({ ...DEFAULT_APP, ...ad.value });
      }
    } catch {
      // Use defaults if API fails
    }
    setLoaded(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const saveFinance = useCallback(async (cfg: FinanceConfig) => {
    await fetch('/api/admin/settings/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: cfg }),
    });
    setFinance(cfg);
  }, []);

  const saveApp = useCallback(async (cfg: AppConfig) => {
    await fetch('/api/admin/settings/app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: cfg }),
    });
    setApp(cfg);
  }, []);

  return (
    <SettingsContext.Provider value={{ finance, app, loaded, reload, saveFinance, saveApp }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
