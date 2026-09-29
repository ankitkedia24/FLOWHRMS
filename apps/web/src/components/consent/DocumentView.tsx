import type { ConsentDocument } from "@/lib/consent/documents";
import { cn } from "@/lib/cn";

/**
 * Renders a notice or policy exactly as written — the same structure that
 * is hashed and published, so what a person reads is what the consent
 * record points at. No client code: usable on public pages, the consent
 * screen and inside the sign-up form alike.
 */
export function DocumentView({
  doc,
  headingLevel = 2,
  compact = false,
  className,
}: {
  doc: ConsentDocument;
  /** 1 on a page of its own; 2 or 3 when embedded. */
  headingLevel?: 1 | 2 | 3;
  compact?: boolean;
  className?: string;
}) {
  const Title = `h${headingLevel}` as "h1" | "h2" | "h3";
  const Section = `h${Math.min(headingLevel + 1, 4)}` as "h2" | "h3" | "h4";

  return (
    <article className={cn("flex flex-col gap-4 text-text-primary", className)}>
      <header>
        <Title
          className={cn(
            "font-heading text-text-primary",
            headingLevel === 1 ? "text-h1" : compact ? "text-h3" : "text-h2",
          )}
        >
          {doc.title}
        </Title>
        <p className="mt-2 text-body text-text-secondary">{doc.summary}</p>
        <p className="mt-1 text-caption text-text-tertiary">
          Version {doc.version}
        </p>
      </header>

      {doc.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <Section className="font-heading text-body-lg font-semibold text-text-primary">
            {section.heading}
          </Section>
          {section.paragraphs?.map((p) => (
            <p key={p} className="text-body text-text-secondary">
              {p}
            </p>
          ))}
          {section.items && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-text-secondary">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.rows && (
            <div className="overflow-x-auto rounded-md border border-border-default">
              <table className="w-full min-w-[480px] text-left text-secondary">
                <thead className="bg-surface-sunken text-text-secondary">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Personal data
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Why it is used
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map(([what, why]) => (
                    <tr key={what} className="border-t border-border-subtle">
                      <td className="px-3 py-2 align-top text-text-primary">{what}</td>
                      <td className="px-3 py-2 align-top text-text-secondary">{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </article>
  );
}
