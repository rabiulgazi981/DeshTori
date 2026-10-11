'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, errText, uploadToLibrary, type MediaItem } from '@/lib/api';
import { Field } from '@/components/admin/ui';

type Scope = 'LIBRARY' | 'UPLOAD' | 'ALL';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Paged media list with search. */
function useMedia(q: string, scope: Scope) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(
    async (cursor?: string | null) => {
      const p = new URLSearchParams({ scope });
      if (q.trim()) p.set('q', q.trim());
      if (cursor) p.set('cursor', cursor);
      try {
        const r = await api<{ items: MediaItem[]; next: string | null }>(`/admin/media?${p}`);
        setItems((old) => (cursor ? [...(old ?? []), ...r.items] : r.items));
        setNext(r.next);
        setErr('');
      } catch (e) {
        setErr(errText(e));
        setItems((old) => old ?? []);
      }
    },
    [q, scope],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  return { items, setItems, next, err, reload: () => load(), more: () => load(next) };
}

/**
 * Grid of media-library images with search and (multi) upload.
 * With `onPick` a click chooses the image (picker); without it, each tile offers copy-URL and delete.
 */
export function MediaBrowser({ onPick, allowScopes = false }: { onPick?: (m: MediaItem) => void; allowScopes?: boolean }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('LIBRARY');
  const { items, setItems, next, err, more } = useMedia(q, scope);
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setMsg(null);
    const done: MediaItem[] = [];
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress(`${(i + 1).toLocaleString('bn-BD')}/${list.length.toLocaleString('bn-BD')} আপলোড হচ্ছে…`);
      try {
        done.push(await uploadToLibrary(list[i]));
      } catch (e) {
        failed.push(`${list[i].name}: ${errText(e)}`);
      }
    }
    setProgress('');
    if (done.length) setItems((old) => [...done.reverse(), ...(old ?? [])]);
    setMsg(failed.length ? { ok: false, text: `আপলোড হয়নি — ${failed.join(' · ')}` } : { ok: true, text: `${done.length.toLocaleString('bn-BD')}টি ছবি আপলোড হয়েছে` });
    if (onPick && done.length === 1 && !failed.length) onPick(done[0]);
  };

  const copy = async (m: MediaItem) => {
    try {
      await navigator.clipboard.writeText(m.url);
      setMsg({ ok: true, text: 'লিংক কপি হয়েছে' });
    } catch {
      window.prompt('লিংক কপি করুন', m.url);
    }
  };

  const remove = async (m: MediaItem) => {
    if (!window.confirm(`"${m.name}" ছবিটি স্থায়ীভাবে মুছে ফেলবেন?\nযেসব ব্যানার/ব্লগে এটি ব্যবহার হয়েছে সেখানে ছবি আর দেখাবে না।`)) return;
    try {
      await api(`/admin/media/${m.id}`, { method: 'DELETE' });
      setItems((old) => (old ?? []).filter((x) => x.id !== m.id));
      setMsg({ ok: true, text: 'মুছে ফেলা হয়েছে' });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl ${drag ? 'outline-dashed outline-2 outline-gold' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void upload(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input className="input min-w-0 flex-1" type="search" placeholder="নাম দিয়ে খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ছবি খুঁজুন" />
        {allowScopes && (
          <select className="input w-auto" value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="কোন ছবি">
            <option value="LIBRARY">সাইটের ছবি</option>
            <option value="UPLOAD">গ্রাহক/অর্ডারের আপলোড</option>
            <option value="ALL">সব</option>
          </select>
        )}
        <button type="button" className="btn-gold" disabled={!!progress} onClick={() => fileRef.current?.click()}>
          {progress || '+ ছবি আপলোড'}
        </button>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
      </div>
      <p className="text-xs text-muted">JPG / PNG / WEBP, প্রতিটি ৪ MB-এর কম। একসাথে একাধিক ছবি বাছাই বা এখানে টেনে এনে ছাড়তে পারেন। ছবি ডাটাবেসে থাকে — সার্ভার রিস্টার্টেও হারাবে না।</p>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}
      {items === null ? (
        <p className="py-6 text-center text-muted">লোড হচ্ছে…</p>
      ) : !items.length ? (
        <p className="py-6 text-center text-muted">{q ? 'এই নামে কোনো ছবি নেই' : 'এখনো কোনো ছবি নেই — উপরের বাটনে আপলোড করুন'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <li key={m.id} className="flex flex-col overflow-hidden rounded-xl border border-ivory-line bg-white">
              <button type="button" className="block bg-ivory-ph" onClick={() => (onPick ? onPick(m) : window.open(m.url, '_blank'))} title={onPick ? 'এই ছবি বাছাই করুন' : 'বড় করে দেখুন'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.name} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
              <div className="flex flex-col gap-1 p-2">
                <span className="truncate text-xs font-semibold" title={m.name}>{m.name}</span>
                <span className="text-[11px] text-muted">{m.width && m.height ? `${m.width}×${m.height} · ` : ''}{kb(m.size)}</span>
                {onPick ? (
                  <button type="button" className="btn-gold h-8 min-h-0 px-2 text-xs" onClick={() => onPick(m)}>বাছাই করুন</button>
                ) : (
                  <div className="flex gap-1">
                    <button type="button" className="btn-outline h-8 min-h-0 flex-1 px-2 text-xs" onClick={() => void copy(m)}>লিংক কপি</button>
                    <button type="button" className="btn-outline h-8 min-h-0 border-danger px-2 text-xs text-danger" onClick={() => void remove(m)} aria-label={`${m.name} মুছুন`}>মুছুন</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {next && <button type="button" className="btn-outline w-fit self-center" onClick={() => void more()}>আরও দেখুন</button>}
    </div>
  );
}

/** Modal that lets staff choose (or upload) an image from the media library. */
export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  // portal: keeps the modal out of the surrounding <label>, whose native click behaviour would steal focus
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="মিডিয়া লাইব্রেরি" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-3 overflow-y-auto rounded-t-2xl bg-ivory p-4 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">মিডিয়া লাইব্রেরি থেকে ছবি বাছুন</h2>
          <button type="button" className="btn-outline h-9 min-h-0 px-3" onClick={onClose} aria-label="বন্ধ">✕</button>
        </div>
        <MediaBrowser onPick={(m) => { onPick(m.url); onClose(); }} />
      </div>
    </div>,
    document.body,
  );
}

/** Image form field: preview + URL input + "choose from library" button. Drop-in for admin forms. */
export function ImageField({ label, value, onChange, hint }: { label: string; value?: string; onChange: (url: string) => void; hint?: string }) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" onError={() => setMissing(value)} onLoad={() => setMissing(null)} className="h-14 w-14 flex-none rounded-lg border border-ivory-line object-cover" />
        ) : (
          <span className="h-14 w-14 flex-none rounded-lg bg-ivory-ph" aria-hidden="true" />
        )}
        <input className="input min-w-0 flex-1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="লাইব্রেরি থেকে বাছুন বা লিংক দিন" />
        <button type="button" className="btn-outline h-11 min-h-0 whitespace-nowrap px-3 text-sm" onClick={() => setOpen(true)}>🖼 বাছুন</button>
        {value && <button type="button" className="btn-outline h-11 min-h-0 px-3 text-sm" onClick={() => onChange('')} aria-label="ছবি সরান">✕</button>}
      </div>
      {value && missing === value && <span className="text-xs font-semibold text-danger">⚠ এই ছবিটা আর সার্ভারে নেই, তাই সাইটে দেখাবে না। “🖼 বাছুন” চেপে আবার আপলোড করুন।</span>}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      <MediaPicker open={open} onClose={close} onPick={onChange} />
    </Field>
  );
}
