import type { Metadata } from 'next';
import { formatBdt } from '@deshtori/shared';
import { API_URL } from '@/lib/api';
import { getContent, type Pages } from '@/lib/content';
import { Prose } from '@/components/StaticPage';
import type { PublicSettings } from '@/lib/types';

export const metadata: Metadata = { title: 'শিপিং রেট — DeshTori', description: 'চীন থেকে বাংলাদেশ Air ও Sea শিপিং রেট, ক্যাটাগরি অনুযায়ী প্রতি কেজি।' };

export default async function Rates() {
  const [s, pages] = await Promise.all([
    fetch(`${API_URL}/settings/public`, { next: { revalidate: 60 } }).then((r) => (r.ok ? (r.json() as Promise<PublicSettings>) : null)).catch(() => null),
    getContent<Pages>('pages'),
  ]);
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-3 py-5 md:px-6">
      <h1 className="text-[26px] font-bold md:text-[32px]">শিপিং রেট (প্রতি কেজি)</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['✈️ গুয়াংজু Air', '৭–১৫ দিন'], ['✈️ হংকং Air', '১৫–২৫ দিন'], ['🚢 Sea', '৪৫–৬৫ দিন']].map(([a, b]) => <div key={a} className="card p-4"><b className="text-lg">{a}</b><p className="text-base text-muted">{b}</p></div>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-ivory-line bg-white">
        <table className="w-full min-w-[560px] border-collapse text-[15px] md:text-base">
          <thead className="bg-navy text-left text-white"><tr><th className="p-3">ক্যাটাগরি</th><th className="p-3">পণ্য</th><th className="p-3">Air</th><th className="p-3">Sea</th></tr></thead>
          <tbody>
            {(s?.freight ?? []).map((f) => (
              <tr key={f.code} className="border-t border-ivory-line align-top"><td className="p-3 font-bold">{f.nameBn}</td><td className="p-3">{f.itemsBn}</td><td className="p-3 font-bold text-emerald">{formatBdt(f.airPaisa)}</td><td className="p-3 font-bold text-emerald">{formatBdt(f.seaPaisa)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-xl bg-gold-chip px-4 py-3 text-[15px] leading-relaxed text-gold-ink md:text-base">চূড়ান্ত চার্জ বাংলাদেশে আসার পর প্রকৃত ওজন মেপে হিসাব হয়। চীনের লোকাল কুরিয়ার ও প্যাকেজিং খরচ আলাদা।</p>
      <section id="banned" className="card scroll-mt-24 p-5 md:p-8">
        <h2 className="mb-3 flex items-center gap-2.5 text-xl font-bold md:text-[22px]"><span aria-hidden="true" className="h-5 w-1.5 rounded bg-gold" />নিষিদ্ধ পণ্য</h2>
        <Prose className="max-w-[68ch]" text={pages?.banned || 'অস্ত্র ও তার অংশ, মাদক, দাহ্য ও বিস্ফোরক পদার্থ, নগদ টাকা, পর্নোগ্রাফি, জীবন্ত প্রাণী, বাংলাদেশে আমদানি-নিষিদ্ধ যেকোনো পণ্য। সন্দেহ থাকলে অর্ডারের আগে হটলাইনে জিজ্ঞেস করুন: 01938-27 38 78।'} />
      </section>
    </div>
  );
}
