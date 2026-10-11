import { Fragment, type ReactNode } from 'react';

/** **bold** → <strong>. Everything else stays text (no HTML is ever injected). */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

type Block = { kind: 'h2'; text: string } | { kind: 'h3'; text: string } | { kind: 'p'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'ol'; items: string[] };

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join('\n') });
    para = [];
  };
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-•*]\s+(.*)$/);
    const ol = line.match(/^\s*(?:\d+|[০-৯]+)[.)]\s+(.*)$/);
    if (!line.trim()) {
      flush();
    } else if (h) {
      flush();
      blocks.push({ kind: h[1].length === 2 ? 'h2' : 'h3', text: h[2] });
    } else if (ul || ol) {
      flush();
      const kind = ul ? 'ul' : 'ol';
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push((ul ?? ol)![1]);
      else blocks.push({ kind, items: [(ul ?? ol)![1]] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/**
 * Renders a blog body written as plain text with a few light conventions:
 * "## " / "### " headings, "- " bullets, "1. " numbered lists, **bold**. Old plain-text posts render as paragraphs.
 */
export function PostBody({ body = '' }: { body?: string }) {
  return (
    <div className="flex flex-col gap-4 text-[17px] leading-relaxed">
      {parseBody(body).map((b, i) => {
        if (b.kind === 'h2') return <h2 key={i} className="mt-3 text-xl font-bold md:text-2xl">{inline(b.text)}</h2>;
        if (b.kind === 'h3') return <h3 key={i} className="mt-2 text-lg font-bold">{inline(b.text)}</h3>;
        if (b.kind === 'ul') return <ul key={i} className="flex list-disc flex-col gap-1.5 pl-6">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
        if (b.kind === 'ol') return <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-6">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
        return <p key={i} className="whitespace-pre-line">{inline(b.text)}</p>;
      })}
    </div>
  );
}
