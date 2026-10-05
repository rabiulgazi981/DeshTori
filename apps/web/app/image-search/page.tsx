'use client';
import { useState } from 'react';
import { api, ApiError, errText, uploadImage } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export default function ImageSearch() {
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setItems(null);
    setMsg(null);
    setBusy(true);
    try {
      const imageUrl = await uploadImage(file);
      const r = await api<{ items: SearchItem[] }>('/products/search-image', { method: 'POST', json: { imageUrl } });
      setItems(r.items);
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 401 ? 'ছবি দিয়ে খুঁজতে আগে লগইন করুন' : errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-3 py-5 md:px-6">
      <h1 className="text-2xl font-bold">ছবি দিয়ে পণ্য খুঁজুন</h1>
      <label className="card flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed border-gold p-8 text-center"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="আপনার ছবি" className="max-h-56 rounded-xl" /> : <span className="text-5xl" aria-hidden="true">📷</span>}
        <b>{busy ? 'খোঁজা হচ্ছে…' : 'ছবি বাছাই করুন বা এখানে টেনে আনুন'}</b>
        <span className="text-sm text-muted">JPG/PNG/WEBP, ৪ MB পর্যন্ত। মোবাইলে সরাসরি ক্যামেরা দিয়েও তোলা যাবে।</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {msg && <p className="rounded-lg bg-[#FBE9E6] px-3 py-2 font-semibold text-danger">{msg}</p>}
      {items && (items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{items.map((p) => <ProductCard key={p.market + p.id} p={p} />)}</div> : <p className="text-muted">মিল পাওয়া যায়নি। অন্য ছবি দিন বা নাম লিখে খুঁজুন।</p>)}
    </div>
  );
}
