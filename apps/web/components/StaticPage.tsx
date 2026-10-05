import { getContent, type Pages } from '@/lib/content';

/** Text page whose body the owner can edit from Admin → Website content → Pages. */
export async function StaticPage({ title, field, fallback }: { title: string; field: keyof Pages; fallback: string }) {
  const pages = await getContent<Pages>('pages');
  const body = pages?.[field]?.trim() || fallback;
  return (
    <div className="mx-auto max-w-[860px] px-3 py-6 md:px-6">
      <article className="card p-5 md:p-8">
        <h1 className="mb-4 text-2xl font-bold">{title}</h1>
        <div className="whitespace-pre-line leading-relaxed">{body}</div>
      </article>
    </div>
  );
}
