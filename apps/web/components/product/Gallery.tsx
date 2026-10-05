'use client';
import { useState } from 'react';

export function Gallery({ images }: { images: string[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-ivory-ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {images[i] && <img src={images[i]} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {images.slice(0, 5).map((src, k) => (
          <button key={src} onClick={() => setI(k)} aria-label={`ছবি ${k + 1}`} className={`aspect-square overflow-hidden rounded-lg border-2 ${k === i ? 'border-gold' : 'border-ivory-line'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
