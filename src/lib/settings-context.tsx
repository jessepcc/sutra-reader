// Bridges the IndexedDB-backed settings into React, plus applies CSS variables.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSettings, patchSettings } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "./types";

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<Ctx | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror settings to <html data-paper="…"> and CSS custom properties so the
  // theme switches instantly without re-rendering anything else.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.paper = settings.paperMode;
    el.style.setProperty("--font-scale", String(settings.fontScale));
    el.style.setProperty("--line-height", String(settings.lineHeight));
  }, [settings.paperMode, settings.fontScale, settings.lineHeight]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = await patchSettings(patch);
    setSettings(next);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
