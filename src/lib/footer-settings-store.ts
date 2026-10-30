import { defaultFooterSettings, normalizeFooterSettings, type FooterSettings } from "@/lib/footer-settings";

const globalStore = globalThis as typeof globalThis & {
  __bolihonFooterSettings?: FooterSettings;
};

export function getServerFooterSettings(): FooterSettings {
  if (!globalStore.__bolihonFooterSettings) {
    globalStore.__bolihonFooterSettings = { ...defaultFooterSettings };
  }

  return globalStore.__bolihonFooterSettings;
}

export function saveServerFooterSettings(settings: Record<string, unknown>): FooterSettings {
  const merged = normalizeFooterSettings({ ...getServerFooterSettings(), ...settings });
  globalStore.__bolihonFooterSettings = merged;
  return merged;
}
