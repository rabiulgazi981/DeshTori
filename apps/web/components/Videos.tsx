'use client';
import { useState } from 'react';
import { videoEmbed, type Video } from '@/lib/content';

/** Thumbnails; clicking plays the video right here on our site (YouTube / Facebook embed). */
export function Videos({ items }: { items: Video[] }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const list = items.map((v) => ({ ...v, e: videoEmbed(v.url) })).filter((v) => v.e);
  if (!list.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((v, i) => (
        <figure key={i} className="overflow-hidden rounded-2xl bg-navy">
          <div className="relative aspect-video">
            {playing === i ? (
              <iframe src={v.e!.embed} title={v.title ?? 'ভিডিও'} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            ) : (
              <button onClick={() => setPlaying(i)} className="group absolute inset-0 flex items-center justify-center" aria-label={`${v.title ?? 'ভিডিও'} চালান`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(v.thumb || v.e!.thumb) && <img src={v.thumb || v.e!.thumb!} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" loading="lazy" />}
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gold text-2xl text-navy shadow-gold transition group-hover:scale-110">▶</span>
              </button>
            )}
          </div>
          {v.title && <figcaption className="p-3 font-semibold text-white">{v.title}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
