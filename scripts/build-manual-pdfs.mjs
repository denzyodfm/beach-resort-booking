// Builds the downloadable manual PDFs from the in-app manuals.
//
//   node scripts/build-manual-pdfs.mjs <admin email> <admin password> [base url]
//
// Needs the app running (npm run dev) and Microsoft Edge or Google Chrome
// installed. The staff and admin manuals are behind sign-in, so the script
// signs in with an admin account. Re-run it after editing src/lib/manuals.ts.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const [email, password, baseUrl = "http://localhost:3000"] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/build-manual-pdfs.mjs <admin email> <admin password> [base url]");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "manual-pdfs");
await mkdir(outDir, { recursive: true });

const browser = await launchInstalledBrowser();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(120_000);

const login = await page.request.post(`${baseUrl}/api/auth/login`, { data: { identifier: email, password } });
if (!login.ok()) {
  console.error(`Sign-in failed: ${(await login.json()).message}`);
  await browser.close();
  process.exit(1);
}

for (const role of ["guest", "staff", "admin"]) {
  const response = await page.goto(`${baseUrl}/manuals/print/${role}`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`${role} manual page returned ${response?.status()}`);

  // Keep only the manual: drop the site header, footer and chat bubble, and
  // load every screenshot (they are lazy-loaded on screen).
  await page.evaluate(async () => {
    const manual = document.querySelector("[data-manual-print]");
    if (manual) document.body.replaceChildren(manual);
    const images = [...document.images];
    images.forEach((image) => (image.loading = "eager"));
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  });

  const file = path.join(outDir, `bolihon-${role}-manual.pdf`);
  await page.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "18mm", left: "12mm", right: "12mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#64748b;text-align:center;">BOLIHON Beach Resort · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  });
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
}

await browser.close();

async function launchInstalledBrowser() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("Install Microsoft Edge or Google Chrome to build the PDFs.");
}
