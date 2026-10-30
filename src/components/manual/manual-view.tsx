import { FileText } from "lucide-react";
import type { Manual } from "@/lib/manuals";

/** Renders one manual: a contents list, then each section. No hooks, so it works on server and client pages. */
export function ManualView({ manual, showHeader = true }: { manual: Manual; showHeader?: boolean }) {
  return (
    <article className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label={`${manual.title} contents`} className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-[180px]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Contents</p>
        <ol className="mt-3 grid gap-2 text-sm">
          {manual.sections.map((section, index) => (
            <li key={section.id}>
              <a href={`#${manual.role}-${section.id}`} className="text-slate-600 hover:text-bolihon-green">
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-5">
        {showHeader ? (
          <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950">{manual.title}</h2>
            <p className="mt-2 leading-7 text-slate-600">{manual.summary}</p>
          </header>
        ) : null}

        {manual.sections.map((section, index) => (
          <section
            key={section.id}
            id={`${manual.role}-${section.id}`}
            className="scroll-mt-[200px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-xl font-bold text-slate-950">
              {index + 1}. {section.title}
            </h3>
            {section.intro ? <p className="mt-3 leading-7 text-slate-700">{formatInline(section.intro)}</p> : null}

            {section.steps?.length ? (
              <ol className="mt-3 grid list-decimal gap-2 pl-6 leading-7 text-slate-700">
                {section.steps.map((step) => (
                  <li key={step}>{formatInline(step)}</li>
                ))}
              </ol>
            ) : null}

            {section.bullets?.length ? (
              <ul className="mt-3 grid list-disc gap-2 pl-6 leading-7 text-slate-700">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{formatInline(bullet)}</li>
                ))}
              </ul>
            ) : null}

            {section.table ? (
              <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      {section.table.headers.map((header) => (
                        <th key={header} className="px-3 py-2 font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map(([first, second]) => (
                      <tr key={first} className="break-inside-avoid border-t border-slate-200 align-top">
                        <td className="px-3 py-2 font-semibold text-slate-900">{first}</td>
                        <td className="px-3 py-2 text-slate-700">{second}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {section.links?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {section.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-bolihon-green px-4 py-2 text-sm font-semibold text-bolihon-green transition hover:bg-emerald-50"
                  >
                    <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}

            {section.note ? (
              <p className="mt-3 rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{formatInline(section.note)}</p>
            ) : null}

            {section.images?.length ? (
              <div className="mt-4 grid gap-4">
                {section.images.map((image) => (
                  <figure key={image.src} className="break-inside-avoid">
                    <a href={image.src} target="_blank" rel="noreferrer">
                      <img
                        src={image.src}
                        alt={image.alt}
                        loading="lazy"
                        className="w-full rounded-md border border-slate-200 shadow-sm"
                      />
                    </a>
                    <figcaption className="mt-1 text-xs text-slate-500">{image.alt}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

/** Turns **bold** markers into <strong>. */
function formatInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-slate-950">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
