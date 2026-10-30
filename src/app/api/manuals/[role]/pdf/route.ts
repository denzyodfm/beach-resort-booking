import { readFile } from "node:fs/promises";
import path from "node:path";

import { canOpenManual } from "@/lib/manual-access";
import { manuals, type ManualRole } from "@/lib/manuals";

/** PDFs are built by scripts/build-manual-pdfs.mjs and kept outside public/ so this route can check access. */
export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!(role in manuals)) return Response.json({ message: "Manual not found." }, { status: 404 });

  const manualRole = role as ManualRole;
  if (!(await canOpenManual(manualRole))) {
    return Response.json({ message: "Sign in with the right account to download this manual." }, { status: 403 });
  }

  const fileName = `bolihon-${manualRole}-manual.pdf`;

  try {
    const pdf = await readFile(path.join(process.cwd(), "manual-pdfs", fileName));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "The PDF has not been generated yet. Run scripts/build-manual-pdfs.mjs." },
      { status: 404 },
    );
  }
}
