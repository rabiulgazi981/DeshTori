import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';

/** Pasted 1688/Taobao link → our product page. */
export default async function LinkPage({ searchParams }: { searchParams: { url?: string } }) {
  const url = searchParams.url ?? '';
  let target: string | null = null;
  try {
    const r = await fetch(`${API_URL}/products/resolve-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), cache: 'no-store' });
    if (r.ok) {
      const { market, sourceId } = await r.json();
      target = `/p/${market}/${sourceId}`;
    }
  } catch {
    /* fallthrough */
  }
  if (target) redirect(target);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card flex flex-col gap-3 p-6">
        <h1 className="text-xl font-bold">লিংকটা চিনতে পারিনি</h1>
        <p className="text-muted">1688 (detail.1688.com/offer/…) বা Taobao/Tmall (item.taobao.com/item.htm?id=…) পণ্যের লিংক দিন। অন্য সাইটের পণ্য হলে কোটেশন চাইতে পারেন।</p>
        <a href="/quote" className="btn-gold self-start">কোটেশন চান</a>
      </div>
    </div>
  );
}
