'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Post } from '@/lib/content';
import { BLOG_CATEGORIES, DEFAULT_POSTS } from '@/lib/blog';
import { ImageField } from '@/components/admin/media';
import { Field, Msg, PageHead, Panel, useAction } from '@/components/admin/ui';
import { PostBody } from '@/components/PostBody';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const today = () => new Date().toISOString().slice(0, 10);

/** Problems that block saving a post, in Bangla. */
function problems(p: Post, all: Post[], idx: number): string[] {
  const out: string[] = [];
  if (!p.title?.trim()) out.push('শিরোনাম দিন');
  if (!p.slug || !SLUG.test(p.slug)) out.push('URL শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও - দিয়ে লিখুন');
  else if (all.some((x, j) => j !== idx && x.slug === p.slug)) out.push('এই URL আগেই আরেকটি লেখায় আছে');
  return out;
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const act = useAction();

  useEffect(() => {
    api<Post[] | null>('/admin/content/blog').then((v) => setPosts(Array.isArray(v) ? v : [])).catch(() => setPosts([]));
  }, []);

  const persist = (next: Post[], ok = 'সেভ হয়েছে — ওয়েবসাইটে ১ মিনিটের মধ্যে দেখাবে') =>
    act.run(async () => {
      await api('/admin/content/blog', { method: 'PUT', json: { value: next } });
      setPosts(next);
    }, ok);

  const list = posts ?? [];
  const shown = useMemo(
    () => list.map((p, i) => ({ p, i })).filter(({ p }) => !q.trim() || `${p.title} ${p.slug} ${p.category} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => (b.p.date ?? '').localeCompare(a.p.date ?? '')),
    [list, q],
  );

  if (posts === null) return <p className="text-muted">লোড হচ্ছে…</p>;

  if (edit !== null) {
    const isNew = edit >= list.length;
    return (
      <Editor
        initial={isNew ? { date: today(), published: false, category: BLOG_CATEGORIES[0] } : list[edit]}
        validate={(p) => problems(p, list, edit)}
        busy={act.busy}
        msg={act.msg}
        onCancel={() => { act.setMsg(null); setEdit(null); }}
        onSave={async (p) => {
          const next = isNew ? [...list, p] : list.map((x, j) => (j === edit ? p : x));
          await persist(next);
          setEdit(isNew ? next.length - 1 : edit);
        }}
      />
    );
  }

  return (
    <>
      <PageHead title="ব্লগ">
        <button className="btn-gold" onClick={() => { act.setMsg(null); setEdit(list.length); }}>+ নতুন লেখা</button>
      </PageHead>
      <Msg m={act.msg} />
      {!list.length ? (
        <Panel>
          <p className="text-muted">এখনো কোনো লেখা সেভ করা হয়নি। এ অবস্থায় ওয়েবসাইটে {DEFAULT_POSTS.length.toLocaleString('bn-BD')}টি ডিফল্ট লেখা দেখাচ্ছে (1688 গাইড, শিপিং, দাম, স্পর্শকাতর পণ্য, ব্যবসার টিপস)।</p>
          <p className="text-sm text-muted">ডিফল্ট লেখাগুলো ইমপোর্ট করলে এখান থেকে এডিট বা মুছতে পারবেন। নতুন লেখা সেভ করলে ডিফল্ট লেখাগুলো আর দেখাবে না — তাই আগে ইমপোর্ট করে নেওয়াই ভালো।</p>
          <button className="btn-gold w-fit" disabled={act.busy} onClick={() => void persist(DEFAULT_POSTS.map((p) => ({ ...p, published: true })), 'ডিফল্ট লেখাগুলো ইমপোর্ট হয়েছে')}>ডিফল্ট লেখা ইমপোর্ট করুন</button>
        </Panel>
      ) : (
        <Panel>
          <input className="input" type="search" placeholder="শিরোনাম, ক্যাটাগরি বা ট্যাগ দিয়ে খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="লেখা খুঁজুন" />
          <ul className="flex flex-col divide-y divide-ivory-line">
            {shown.map(({ p, i }) => (
              <li key={p.slug ?? i} className="flex flex-wrap items-center gap-3 py-3">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-14 w-20 flex-none rounded-lg object-cover" />
                ) : (
                  <span className="h-14 w-20 flex-none rounded-lg bg-gradient-to-br from-[#1A3C8A] to-[#0A1F52]" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{p.title || '(শিরোনাম নেই)'}</b>
                  <span className="text-xs text-muted">{p.date} · {p.category || 'ক্যাটাগরি নেই'} · /blog/{p.slug}</span>
                </div>
                <span className={`chip ${p.published === false ? 'bg-ivory-ph text-muted' : 'bg-emerald-light text-emerald-dark'}`}>{p.published === false ? 'ড্রাফট' : 'প্রকাশিত'}</span>
                <div className="flex gap-1">
                  <button className="btn-outline h-9 min-h-0 px-3 text-sm" onClick={() => { act.setMsg(null); setEdit(i); }}>এডিট</button>
                  <button className="btn-outline h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => void persist(list.map((x, j) => (j === i ? { ...x, published: x.published === false } : x)), p.published === false ? 'প্রকাশিত হয়েছে' : 'ড্রাফটে সরানো হয়েছে')}>{p.published === false ? 'প্রকাশ করুন' : 'লুকান'}</button>
                  {p.published !== false && p.slug && <a className="btn-outline h-9 min-h-0 px-3 text-sm" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">দেখুন</a>}
                  <button className="btn-outline h-9 min-h-0 border-danger px-3 text-sm text-danger" disabled={act.busy} onClick={() => window.confirm(`"${p.title}" লেখাটি মুছবেন?`) && void persist(list.filter((_, j) => j !== i), 'মুছে ফেলা হয়েছে')}>মুছুন</button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-xs font-normal ${n > max ? 'text-danger' : 'text-muted'}`}>{n.toLocaleString('bn-BD')}/{max.toLocaleString('bn-BD')} অক্ষর</span>;
}

function Editor({ initial, validate, busy, msg, onCancel, onSave }: { initial: Post; validate: (p: Post) => string[]; busy: boolean; msg: { ok: boolean; text: string } | null; onCancel: () => void; onSave: (p: Post) => Promise<void> }) {
  const [p, setP] = useState<Post>(initial);
  const [tags, setTags] = useState((initial.tags ?? []).join(', '));
  const [preview, setPreview] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const set = (patch: Partial<Post>) => setP((old) => ({ ...old, ...patch }));

  const save = async (published?: boolean) => {
    const clean: Post = {
      ...p,
      title: p.title?.trim(),
      slug: p.slug?.trim(),
      category: p.category?.trim() || undefined,
      tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
      metaTitle: p.metaTitle?.trim() || undefined,
      metaDescription: p.metaDescription?.trim() || undefined,
      published: published ?? p.published !== false,
    };
    const e = validate(clean);
    setErrs(e);
    if (e.length) return;
    setP(clean);
    await onSave(clean);
  };

  return (
    <>
      <PageHead title={initial.slug ? 'লেখা এডিট' : 'নতুন লেখা'}>
        <button className="btn-outline" onClick={onCancel}>← সব লেখা</button>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Panel>
            <Field label="শিরোনাম *"><input className="input text-lg font-bold" value={p.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="URL (ইংরেজি, যেমন how-to-order)">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">/blog/</span>
                <input className="input min-w-0 flex-1" value={p.slug ?? ''} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} onBlur={(e) => set({ slug: slugify(e.target.value) })} />
              </div>
            </Field>
            <Field label="সংক্ষেপ (লিস্ট ও শেয়ারে দেখাবে)"><textarea className="input min-h-[80px]" value={p.excerpt ?? ''} onChange={(e) => set({ excerpt: e.target.value })} /></Field>
            <div className="flex items-center gap-2">
              <span className="label mr-auto">লেখা</span>
              <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${!preview ? 'bg-navy text-white' : 'bg-ivory'}`} onClick={() => setPreview(false)}>লিখুন</button>
              <button type="button" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${preview ? 'bg-navy text-white' : 'bg-ivory'}`} onClick={() => setPreview(true)}>প্রিভিউ</button>
            </div>
            {preview ? (
              <div className="min-h-[300px] rounded-xl border border-ivory-line bg-white p-4"><PostBody body={p.body} /></div>
            ) : (
              <>
                <textarea className="input min-h-[420px] font-mono text-sm leading-relaxed" value={p.body ?? ''} onChange={(e) => set({ body: e.target.value })} aria-label="লেখা" />
                <p className="text-xs text-muted">ফরম্যাট: নতুন লাইনে <code>## </code> দিলে বড় হেডিং, <code>### </code> ছোট হেডিং, <code>- </code> দিলে বুলেট, <code>1. </code> দিলে নম্বর তালিকা, <code>**লেখা**</code> বোল্ড। ফাঁকা লাইন দিয়ে প্যারাগ্রাফ আলাদা করুন।</p>
              </>
            )}
          </Panel>
          <Panel title="SEO">
            <Field label="Meta টাইটেল (খালি রাখলে শিরোনাম)"><input className="input" value={p.metaTitle ?? ''} onChange={(e) => set({ metaTitle: e.target.value })} /><Counter n={(p.metaTitle ?? '').length} max={60} /></Field>
            <Field label="Meta বিবরণ (খালি রাখলে সংক্ষেপ)"><textarea className="input min-h-[70px]" value={p.metaDescription ?? ''} onChange={(e) => set({ metaDescription: e.target.value })} /><Counter n={(p.metaDescription ?? '').length} max={160} /></Field>
            <div className="rounded-xl border border-ivory-line bg-white p-3 text-sm">
              <p className="text-xs text-muted">Google-এ যেমন দেখাতে পারে</p>
              <p className="truncate text-[#1a0dab]">{p.metaTitle || p.title || 'শিরোনাম'}</p>
              <p className="text-xs text-emerald-dark">deshtori.com › blog › {p.slug || '…'}</p>
              <p className="line-clamp-2 text-muted">{p.metaDescription || p.excerpt || 'বিবরণ'}</p>
            </div>
          </Panel>
        </div>
        <div className="flex flex-col gap-3">
          <Panel title="প্রকাশ">
            <p className="text-sm">অবস্থা: <b>{p.published === false ? 'ড্রাফট (ওয়েবসাইটে দেখাবে না)' : 'প্রকাশিত'}</b></p>
            {errs.length > 0 && <ul className="list-disc pl-5 text-sm text-danger">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
            <Msg m={msg} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-gold" disabled={busy} onClick={() => void save(true)}>{p.published === false ? 'প্রকাশ করুন' : 'আপডেট করুন'}</button>
              <button className="btn-outline" disabled={busy} onClick={() => void save(false)}>ড্রাফট হিসেবে রাখুন</button>
            </div>
          </Panel>
          <Panel title="বিস্তারিত">
            <Field label="তারিখ"><input className="input" type="date" value={p.date ?? ''} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="ক্যাটাগরি">
              <input className="input" list="blog-cats" value={p.category ?? ''} onChange={(e) => set({ category: e.target.value })} />
              <datalist id="blog-cats">{BLOG_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="ট্যাগ (কমা দিয়ে)"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="1688, শিপিং" /></Field>
            <ImageField label="কভার ছবি" value={p.image} onChange={(v) => set({ image: v || undefined })} hint="প্রস্তাবিত মাপ ১২০০×৬৩০ (শেয়ারেও এটি দেখাবে)" />
          </Panel>
        </div>
      </div>
    </>
  );
}
