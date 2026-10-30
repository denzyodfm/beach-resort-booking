export type FooterSettings = {
  poweredByLabel: string;
  companyInitial: string;
  companyName: string;
  teamLabel: string;
  updatedAt: string;
};

export const defaultFooterSettings: FooterSettings = {
  poweredByLabel: "Powered by",
  companyInitial: "V",
  companyName: "VALDEMEER RESOURCES, INC",
  teamLabel: "IT TEAM - KAMARU",
  updatedAt: new Date(0).toISOString(),
};

/** Settings row id. The footer is a single global lockup, so the table holds one row. */
export const FOOTER_SETTINGS_ID = "footer";

export function normalizeFooterSettings(row: Record<string, unknown> | null | undefined): FooterSettings {
  const source = row || {};

  const read = (camel: string, snake: string, fallback: string) => {
    const value = source[camel] ?? source[snake];
    const text = typeof value === "string" ? value.trim() : "";
    return text || fallback;
  };

  return {
    poweredByLabel: read("poweredByLabel", "powered_by_label", defaultFooterSettings.poweredByLabel),
    companyInitial: read("companyInitial", "company_initial", defaultFooterSettings.companyInitial).slice(0, 2),
    companyName: read("companyName", "company_name", defaultFooterSettings.companyName),
    teamLabel: read("teamLabel", "team_label", defaultFooterSettings.teamLabel),
    updatedAt: String(source.updatedAt || source.updated_at || new Date().toISOString()),
  };
}

export function toFooterSettingsRow(settings: FooterSettings) {
  return {
    id: FOOTER_SETTINGS_ID,
    powered_by_label: settings.poweredByLabel,
    company_initial: settings.companyInitial,
    company_name: settings.companyName,
    team_label: settings.teamLabel,
  };
}
