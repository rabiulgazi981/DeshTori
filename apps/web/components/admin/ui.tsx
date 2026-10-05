'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatBdt } from '@deshtori/shared';
import { api, errText } from '@/lib/api';

export const tk = (paisa: number | null | undefined) => formatBdt(paisa ?? 0);
export const dt = (s: string | Date | null | undefined) => (s ? new Date(s).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const d = (s: string | Date | null | undefined) => (s ? new Date(s).toLocaleDateString('bn-BD') : '—');

/** Load JSON from the API with loading/error state and a reload function. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setErr(null);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, err, loading, reload, setData };
}

/** Run an API action with a busy flag and a message line. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, okText = 'সংরক্ষিত হয়েছে'): Promise<T | undefined> => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: true, text: okText });
      return r;
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, msg, run, setMsg };
}

export function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p role="status" className={`rounded-lg px-3 py-2 text-sm font-semibold ${m.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>
      {m.text}
    </p>
  );
}

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col gap-3 p-4 ${className}`}>
      {title && <h2 className="flex items-center gap-2 text-lg font-bold"><span className="h-4 w-1.5 rounded bg-gold" />{title}</h2>}
      {children}
    </section>
  );
}

export function Table({ head, children, min = 640 }: { head: string[]; children: React.ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ivory-line">
      <table className="w-full border-collapse text-sm" style={{ minWidth: min }}>
        <thead className="bg-navy text-left text-white">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap p-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-ivory-line [&_td]:p-2.5 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ text = 'কিছু নেই' }: { text?: string }) {
  return <p className="py-6 text-center text-muted">{text}</p>;
}

const TONE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-[#FBE9E6] text-danger',
  PAYMENT_REVIEW: 'bg-gold-chip text-gold-ink',
  NEW: 'bg-[#E4ECFA] text-navy',
  PURCHASING: 'bg-[#E4ECFA] text-navy',
  NEEDS_DECISION: 'bg-[#FBE9E6] text-danger',
  AT_CN_WAREHOUSE: 'bg-gold-chip text-gold-ink',
  SHIPPED: 'bg-gold-chip text-gold-ink',
  ARRIVED_BD: 'bg-emerald-light text-emerald-dark',
  DELIVERED: 'bg-emerald-light text-emerald-dark',
  CANCELLED: 'bg-ivory-ph text-muted',
};
export function Pill({ s, label }: { s: string; label?: string }) {
  return <span className={`chip whitespace-nowrap ${TONE[s] ?? 'bg-ivory-ph text-navy'}`}>{label ?? s}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="label">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Taka input that stores paisa. */
export function TakaInput({ value, onChange, allowNegative = false }: { value: number; onChange: (paisa: number) => void; allowNegative?: boolean }) {
  return (
    <input
      className="input"
      inputMode="decimal"
      value={value === 0 ? '' : String(value / 100)}
      placeholder="৳"
      onChange={(e) => {
        const n = Number(e.target.value.replace(/[^\d.-]/g, ''));
        if (Number.isFinite(n)) onChange(Math.round((allowNegative ? n : Math.abs(n)) * 100));
      }}
    />
  );
}
