'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Banner, BannerPlacement } from '@/lib/content';
import { ImageField } from '@/components/admin/media';
import { Field, Msg, PageHead, Panel, useAction } from '@/components/admin/ui';

const PLACEMENT: Record<BannerPlacement, { label: string; hint: string }> = {
  hero: { label: 'হিরো স্লাইডার', hint: 'হোমপেজের বড় নীল বক্সে, ট্যাগলাইনের পেছনে স্লাইড হবে। প্রস্তাবিত মাপ ১৬০০×৬০০।' },
  wide: { label: 'চওড়া প্রোমো স্ট্রিপ', hint: 'হিরোর নিচে, ক্যাটাগরির উপরে পুরো চওড়া ব্যানার। প্রস্তাবিত মাপ ১৬০০×৪০০।' },
};

export default function Banners() {
  const [list, setList] = useState<Banner[] | null>(null);
  const [filter, setFilter] = useState<'all' | BannerPlacement>('all');
  const act = useAction();

  useEffect(() => {
    api<Banner[] | null>('/admin/content/banners')
      .then((v) => setList((Array.isArray(v) ? v : []).map((b, i) => ({ ...b, placement: b.placement ?? 'hero', active: b.active !== false, order: b.order ?? i })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))))
      .catch(() => setList([]));
  }, []);

  const rows = list ?? [];
  const set = (i: number, patch: Partial<Banner>) => setList(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const n = [...rows];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setList(n);
  };
  const save = () => {
    const missing = rows.findIndex((b) => !b.image);
    if (missing >= 0) {
      act.setMsg({ ok: false, text: `ব্যানার ${(missing + 1).toLocaleString('bn-BD')}-এ ছবি দিন` });
      return;
    }
    const value = rows.map((b, i) => ({ ...b, order: i, showButton: !!b.showButton && !!b.buttonText }));
    void act.run(() => api('/admin/content/banners', { method: 'PUT', json: { value } }), 'সেভ হয়েছে — ওয়েবসাইটে ১ মিনিটের মধ্যে দেখাবে');
  };

  return (
    <>
      <PageHead title="হোম ব্যানার">
        <button className="btn-outline" onClick={() => setList([...rows, { placement: filter === 'wide' ? 'wide' : 'hero', width: 'full', active: true, showButton: false }])}>+ নতুন ব্যানার</button>
        <button className="btn-gold" disabled={act.busy || list === null} onClick={save}>সেভ করুন</button>
      </PageHead>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {(['all', 'hero', 'wide'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === k ? 'bg-navy text-white' : 'bg-white'}`}>
            {k === 'all' ? 'সব' : PLACEMENT[k].label} ({rows.filter((b) => k === 'all' || (b.placement ?? 'hero') === k).length.toLocaleString('bn-BD')})
          </button>
        ))}
      </div>
      <Msg m={act.msg} />
      {list === null ? (
        <p className="text-muted">লোড হচ্ছে…</p>
      ) : !rows.length ? (
        <Panel><p className="py-6 text-center text-muted">কোনো ব্যানার নেই। “+ নতুন ব্যানার” চাপুন।</p></Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((b, i) => {
            const pl = b.placement ?? 'hero';
            if (filter !== 'all' && pl !== filter) return null;
            return (
              <Panel key={i} className={b.active === false ? 'opacity-70' : ''}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="mr-auto">ব্যানার {(i + 1).toLocaleString('bn-BD')} · <span className="text-sm font-semibold text-muted">{PLACEMENT[pl].label}</span></b>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="h-5 w-5" checked={b.active !== false} onChange={(e) => set(i, { active: e.target.checked })} />
                    চালু
                  </label>
                  <button className="btn-outline h-9 min-h-0 px-3 text-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="উপরে">↑</button>
                  <button className="btn-outline h-9 min-h-0 px-3 text-sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="নিচে">↓</button>
                  <button className="btn-outline h-9 min-h-0 border-danger px-3 text-sm text-danger" onClick={() => window.confirm('ব্যানারটি মুছবেন?') && setList(rows.filter((_, j) => j !== i))}>মুছুন</button>
                </div>
                <Preview b={b} />
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="md:col-span-2"><ImageField label="ছবি *" value={b.image} onChange={(v) => set(i, { image: v })} hint={PLACEMENT[pl].hint} /></div>
                  <Field label="শিরোনাম"><input className="input" value={b.title ?? ''} onChange={(e) => set(i, { title: e.target.value })} /></Field>
                  <Field label="সাব-টাইটেল"><input className="input" value={b.subtitle ?? ''} onChange={(e) => set(i, { subtitle: e.target.value })} /></Field>
                  <Field label="লিংক (যেমন /search?q=bag বা https://…)"><input className="input" value={b.link ?? ''} onChange={(e) => set(i, { link: e.target.value })} /></Field>
                  <Field label="বাটনের লেখা"><input className="input" value={b.buttonText ?? ''} placeholder="যেমন: এখনই দেখুন" onChange={(e) => set(i, { buttonText: e.target.value })} /></Field>
                  <Field label="কোথায় দেখাবে">
                    <select className="input" value={pl} onChange={(e) => set(i, { placement: e.target.value as BannerPlacement })}>
                      <option value="hero">{PLACEMENT.hero.label}</option>
                      <option value="wide">{PLACEMENT.wide.label}</option>
                    </select>
                  </Field>
                  <Field label="চওড়া">
                    <select className="input" value={b.width ?? 'full'} onChange={(e) => set(i, { width: e.target.value as 'full' | 'contained' })}>
                      <option value="full">পুরো চওড়া</option>
                      <option value="contained">মাঝখানে সীমিত</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="h-5 w-5" checked={!!b.showButton} disabled={!b.buttonText} onChange={(e) => set(i, { showButton: e.target.checked })} />
                    বাটন দেখান {!b.buttonText && <span className="font-normal text-muted">(আগে বাটনের লেখা দিন)</span>}
                  </label>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      {!!rows.length && <button className="btn-gold mt-3" disabled={act.busy} onClick={save}>সেভ করুন</button>}
    </>
  );
}

/** Rough preview of how the banner reads (the homepage decides the final layout). */
function Preview({ b }: { b: Banner }) {
  if (!b.image) return null;
  const wide = (b.placement ?? 'hero') === 'wide';
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-navy ${b.width === 'contained' ? 'mx-auto w-full max-w-xl' : 'w-full'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.image} alt="" className={`block w-full object-cover ${wide ? 'aspect-[4/1]' : 'aspect-[8/3]'}`} />
      {(b.title || b.subtitle || (b.showButton && b.buttonText)) && (
        <div className="absolute inset-0 flex flex-col justify-center gap-1 bg-gradient-to-r from-black/60 to-transparent p-4 text-white">
          {b.title && <b className="text-lg md:text-2xl">{b.title}</b>}
          {b.subtitle && <span className="text-sm">{b.subtitle}</span>}
          {b.showButton && b.buttonText && <span className="btn-gold mt-1 h-9 min-h-0 w-fit px-3 text-sm">{b.buttonText}</span>}
        </div>
      )}
    </div>
  );
}
