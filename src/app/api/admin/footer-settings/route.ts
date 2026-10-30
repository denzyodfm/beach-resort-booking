import { revalidatePath } from "next/cache";

import { requireResortManager } from "@/lib/admin-auth";
import { errorMessage, execute, hasDatabaseEnv, isMissingTableError, queryOne, toInsertClause } from "@/lib/db";
import {
  defaultFooterSettings,
  FOOTER_SETTINGS_ID,
  normalizeFooterSettings,
  toFooterSettingsRow,
} from "@/lib/footer-settings";
import { getServerFooterSettings, saveServerFooterSettings } from "@/lib/footer-settings-store";

export async function GET() {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  if (!hasDatabaseEnv()) return Response.json(getServerFooterSettings());

  try {
    const data = await queryOne("select * from site_footer_settings where id = ?", [FOOTER_SETTINGS_ID]);
    return Response.json(data ? normalizeFooterSettings(data) : defaultFooterSettings);
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireResortManager();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as Record<string, unknown>;
  const settings = normalizeFooterSettings(body);

  if (!settings.companyName.trim()) {
    return Response.json({ message: "Company name is required." }, { status: 400 });
  }

  if (!hasDatabaseEnv()) {
    const saved = saveServerFooterSettings(settings);
    revalidateFooter();
    return Response.json(saved);
  }

  try {
    const insert = toInsertClause(toFooterSettingsRow(settings));
    await execute(
      `insert into site_footer_settings (${insert.columns}) values (${insert.placeholders})
       on duplicate key update powered_by_label = values(powered_by_label), company_initial = values(company_initial),
         company_name = values(company_name), team_label = values(team_label)`,
      insert.params,
    );
    const data = await queryOne("select * from site_footer_settings where id = ?", [FOOTER_SETTINGS_ID]);

    revalidateFooter();
    return Response.json(normalizeFooterSettings(data));
  } catch (error) {
    return Response.json({ message: getSetupMessage(error) }, { status: 500 });
  }
}

/**
 * The footer lives in the root layout, so prerendered pages bake it in at build
 * time. Invalidating the root layout lets every page pick up the new credit on
 * its next visit.
 */
function revalidateFooter() {
  revalidatePath("/", "layout");
}

function getSetupMessage(error: unknown) {
  if (isMissingTableError(error)) {
    return "Footer settings table is not ready. Run mysql/schema.sql to create site_footer_settings.";
  }

  return errorMessage(error);
}
