import "server-only";

import { hasDatabaseEnv, queryOne } from "@/lib/db";
import {
  defaultFooterSettings,
  FOOTER_SETTINGS_ID,
  normalizeFooterSettings,
  type FooterSettings,
} from "@/lib/footer-settings";
import { getServerFooterSettings } from "@/lib/footer-settings-store";

export async function getFooterSettings(): Promise<FooterSettings> {
  if (!hasDatabaseEnv()) {
    return getServerFooterSettings();
  }

  try {
    const data = await queryOne("select * from site_footer_settings where id = ?", [FOOTER_SETTINGS_ID]);

    // The footer renders on every page, so a missing table or row must never
    // break the layout. Fall back to the shipped defaults instead.
    return data ? normalizeFooterSettings(data) : defaultFooterSettings;
  } catch {
    return defaultFooterSettings;
  }
}
