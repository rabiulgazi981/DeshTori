'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errText } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { toBanglaDigits } from '@deshtori/shared';
import { PENDING_IMAGE_EVENT, takePendingImage } from '@/lib/pendingImage';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_SIDE = 1600;
const MAX_UPLOAD = 4 * 1024 * 1024;

const ERR: Record<string, string> = {
  IMAGE_SEARCH_LIMIT: 'অল্প সময়ে অনেকবার খোঁজা হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।',
  IMAGE_SEARCH_FAILED: 'ছবি দিয়ে খোঁজা এই মুহূর্তে কাজ করছে না। একটু পরে চেষ্টা করুন, অথবা নাম লিখে খুঁজুন।',
  IMAGE_ONLY: 'শুধু JPG/PNG/WEBP ছবি দিন',
  IMAGE_TOO_LARGE: 'ছবি ৪ MB-এর কম হতে হবে',
};

const readDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });

/** Phone photos are often 5–12 MB: shrink big images to ≤1600px JPEG before sending. */
async function toUploadDataUrl(file: File, previewUrl: string): Promise<string> {
  if (!ACCEPT.split(',').includes(file.type)) throw new ApiError(400, 'IMAGE_ONLY', null);
  try {
    const img = new Image();
    img.src = previewUrl;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale < 1 || file.size > 1024 * 1024) {
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', 0.86);
        if (out.startsWith('data:image/jpeg')) return out;
      }
    }
  } catch {
    /* fall back to the original file */
  }
  if (file.size > MAX_UPLOAD) throw new ApiError(400, 'IMAGE_TOO_LARGE', null);
  return readDataUrl(file);
}

type Phase = 'idle' | 'searching' | 'done' | 'error';

export default function ImageSearch() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const openPicker = () => fileRef.current?.click();

  const pick = async (file?: File | null) => {
    if (!file) return;
    const id = ++run.current;
    const url = URL.createObjectURL(file);
    // show the photo and the loading state right away
    setPreview(url);
    setItems([]);
    setMsg(null);
    setPhase('searching');
    try {
      const dataUrl = await toUploadDataUrl(file, url);
      const r = await api<{ items: SearchItem[] }>('/products/search-image', { method: 'POST', json: { dataUrl } });
      if (id !== run.current) return;
      setItems(r.items);
      setPhase('done');
    } catch (e) {
      if (id !== run.current) return;
      setMsg(e instanceof ApiError ? ERR[e.code] ?? errText(e) : errText(e));
      setPhase('error');
    }
  };

  // a photo picked from the header camera button
  useEffect(() => {
    const take = () => { const f = takePendingImage(); if (f) void pick(f); };
    take();
    window.addEventListener(PENDING_IMAGE_EVENT, take);
    return () => window.removeEventListener(PENDING_IMAGE_EVENT, take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void pick(e.target.files?.[0]);
    e.target.value = ''; // picking the same file again still triggers a search
  };

  const busy = phase === 'searching';

  return (
    <div className="mx-auto flex max-w-[1920px] flex-col gap-5 px-3 py-5 md:px-6 2xl:px-10">
      <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onInput} />
      <input ref={cameraRef} type="file" accept={ACCEPT} capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onInput} />

      <header className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold-ink">Image search</span>
        <h1 className="text-2xl font-bold md:text-3xl">ছবি দিয়ে পণ্য খুঁজুন</h1>
        <p className="text-muted">পণ্যের একটা ছবি দিন — চীনের মার্কেট থেকে একই রকম পণ্য দাম সহ দেখিয়ে দেব।</p>
      </header>

      {!preview ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="ছবি বাছাই করুন"
          onClick={openPicker}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files[0]); }}
          className={`group relative flex cursor-pointer flex-col items-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-12 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40 md:py-16 ${
            drag ? 'scale-[1.01] border-emerald bg-emerald-light' : 'border-gold/70 bg-gradient-to-b from-[#FFFCF4] to-white hover:border-gold hover:shadow-card active:scale-[0.995]'
          }`}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-[#F9E39A] to-[#D9AE45] text-4xl shadow-gold transition group-hover:-translate-y-1" aria-hidden="true">📷</span>
          <span className="flex flex-col gap-1">
            <b className="text-lg md:text-xl">{drag ? 'এখানে ছেড়ে দিন' : 'ছবি বাছাই করতে এখানে চাপুন'}</b>
            <span className="text-sm text-muted">গ্যালারি থেকে বাছুন, অথবা ছবি টেনে এনে এখানে ছাড়ুন</span>
          </span>
          <span className="btn-gold pointer-events-none px-8">গ্যালারি থেকে ছবি দিন</span>
          <span className="text-xs text-muted">JPG / PNG / WEBP · বড় ছবি নিজে থেকেই ছোট করা হবে</span>
        </div>
      ) : (
        <section className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative mx-auto h-40 w-40 flex-none overflow-hidden rounded-2xl border border-ivory-line bg-ivory-ph sm:mx-0 sm:h-32 sm:w-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="আপনার ছবি" className="h-full w-full object-cover" />
            {busy && (
              <span className="absolute inset-0 flex items-center justify-center bg-navy/35">
                <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-center sm:text-left" aria-live="polite">
            {busy && <><b className="text-lg">মিল খোঁজা হচ্ছে…</b><span className="text-sm text-muted">ছবিটি পাঠানো হয়েছে, কয়েক সেকেন্ড লাগতে পারে।</span></>}
            {phase === 'done' && <><b className="text-lg">{items.length ? `${toBanglaDigits(items.length)}টি মিল পাওয়া গেছে` : 'মিল পাওয়া যায়নি'}</b><span className="text-sm text-muted">{items.length ? 'পণ্যে চাপ দিলে দাম, ভেরিয়েন্ট আর শিপিং খরচ দেখবেন।' : 'অন্য কোণ থেকে তোলা পরিষ্কার ছবি দিন, অথবা নাম লিখে খুঁজুন।'}</span></>}
            {phase === 'error' && <><b className="text-lg text-danger">খোঁজা যায়নি</b><span className="text-sm font-semibold text-danger">{msg}</span></>}
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:flex-col">
            <button onClick={openPicker} disabled={busy} className="btn-gold">অন্য ছবি দিন</button>
            <button onClick={() => cameraRef.current?.click()} disabled={busy} className="btn-outline md:hidden">📸 ক্যামেরা</button>
          </div>
        </section>
      )}

      {!preview && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button onClick={() => cameraRef.current?.click()} className="btn-outline md:hidden">📸 ক্যামেরা দিয়ে তুলুন</button>
          <Link href="/link" className="font-semibold text-emerald hover:underline">লিংক দিয়ে খুঁজুন →</Link>
        </div>
      )}

      {busy && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7" aria-hidden="true">
          {Array.from({ length: 10 }, (_, k) => (
            <div key={k} className="card flex animate-pulse flex-col overflow-hidden">
              <span className="aspect-square bg-ivory-ph" />
              <span className="flex flex-col gap-2 p-3"><span className="h-4 w-1/2 rounded bg-ivory-ph" /><span className="h-3 w-full rounded bg-ivory-soft" /><span className="h-3 w-3/4 rounded bg-ivory-soft" /></span>
            </div>
          ))}
        </div>
      )}

      {phase === 'done' && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7">{items.map((p) => <ProductCard key={p.market + p.id} p={p} />)}</div>
      )}
    </div>
  );
}
