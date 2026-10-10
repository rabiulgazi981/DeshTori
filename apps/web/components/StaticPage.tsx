import { getContent, type Pages } from '@/lib/content';

/** Normalises known address typos in owner-edited text ("60 Feet Road" → "60 Fit Road"). */
const fixText = (s: string) => s.replace(/\bFeet Road\b/g, 'Fit Road');

const LIST_ITEM = /^\s*(?:[-•*]|[0-9০-৯]+[.)।])\s+/;
const ORDERED = /^\s*[0-9০-৯]+[.)।]\s+/;

/**
 * Renders plain owner-edited text as readable prose: blank lines split paragraphs,
 * "১. …" / "- …" lines become lists, a short line ending in ":" (or a lone short line
 * followed by more text) becomes a sub-heading.
 */
export function Prose({ text, className = '' }: { text: string; className?: string }) {
  const blocks = fixText(text).replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`flex flex-col gap-4 text-[17px] leading-[1.85] md:text-[18px] ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const [first, ...rest] = lines;
        const isHeading = !LIST_ITEM.test(first) && first.length <= 60 && (/[:：]$/.test(first) || (rest.length > 0 && !/[।.!?]$/.test(first)));
        if (isHeading) {
          return (
            <section key={i} className="flex flex-col gap-3">
              <h2 className="mt-2 flex items-center gap-2.5 text-xl font-bold md:text-[22px]">
                <span aria-hidden="true" className="h-5 w-1.5 rounded bg-gold" />
                {first.replace(/[:：]$/, '')}
              </h2>
              {rest.length > 0 && <Lines lines={rest} />}
            </section>
          );
        }
        return <Lines key={i} lines={lines} />;
      })}
    </div>
  );
}

/** A paragraph, or a list when every line is a list item. */
function Lines({ lines }: { lines: string[] }) {
  if (!lines.every((l) => LIST_ITEM.test(l))) return <p className="whitespace-pre-line">{lines.join('\n')}</p>;
  const ordered = lines.every((l) => ORDERED.test(l));
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className="flex flex-col gap-2.5">
      {lines.map((l, j) => (
        <li key={j} className="flex gap-3 rounded-xl bg-ivory/60 px-4 py-2.5 dark:bg-white/5">
          <span aria-hidden="true" className="min-w-[1.5rem] font-bold text-gold-ink dark:text-gold-light">{ordered ? l.match(LIST_ITEM)?.[0].trim() : '◆'}</span>
          <span>{l.replace(LIST_ITEM, '')}</span>
        </li>
      ))}
    </Tag>
  );
}

/** Shared shell for info pages: comfortable reading width, title band and spacing. */
export function PageShell({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[880px] px-4 py-6 md:px-6 md:py-10">
      <article className="card overflow-hidden">
        <header className="border-b border-ivory-line bg-ivory px-5 dark:border-white/10 dark:bg-white/5 py-6 md:px-10 md:py-8">
          <h1 className="text-[26px] font-bold leading-tight md:text-[32px]">{title}</h1>
          {lead && <p className="mt-2 text-[16px] text-muted md:text-[17px] dark:text-[#C8D3EA]">{lead}</p>}
          <span aria-hidden="true" className="mt-4 block h-1 w-16 rounded bg-gold" />
        </header>
        <div className="mx-auto max-w-[68ch] px-5 py-6 md:px-10 md:py-9">{children}</div>
      </article>
    </div>
  );
}

/** Text page whose body the owner can edit from Admin → Website content → Pages. */
export async function StaticPage({ title, field, fallback, lead, children }: { title: string; field: keyof Pages; fallback: string; lead?: string; children?: React.ReactNode }) {
  const pages = await getContent<Pages>('pages');
  const body = pages?.[field]?.trim() || fallback;
  return (
    <>
      <PageShell title={title} lead={lead}>
        <Prose text={body} />
      </PageShell>
      {children}
    </>
  );
}
