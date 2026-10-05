'use client';
import { useEffect, useState } from 'react';
import { formatBdt } from '@deshtori/shared';
import { api, errText, uploadImage } from '@/lib/api';

interface Methods { BKASH_GATEWAY: boolean; SSLCOMMERZ: boolean; MANUAL: boolean; MOCK: boolean }
interface Contact { bkash?: string; nagad?: string; bank?: string }

/**
 * Pay one order: online gateway (bKash / card / Nagad via SSLCommerz), wallet, or manual Send Money + TrxID.
 * Gateway keys never reach the browser – we only ask the API for a redirect URL.
 */
export function PayBox({ orderCode, amount, wallet = 0, onDone }: { orderCode: string; amount: number; wallet?: number; onDone?: () => void }) {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [contact, setContact] = useState<Contact>({});
  const [tab, setTab] = useState<'online' | 'wallet' | 'manual'>('online');
  const [manual, setManual] = useState({ method: 'MANUAL_BKASH', trxId: '', fromNumber: '', screenshot: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<Methods>('/gateway/methods').then((m) => {
      setMethods(m);
      if (!m.BKASH_GATEWAY && !m.SSLCOMMERZ && !m.MOCK) setTab(wallet >= 100 ? 'wallet' : 'manual');
    }).catch(() => setTab('manual'));
    api<{ value: Contact | null }>('/content/contact').then((r) => setContact(r.value ?? {})).catch(() => undefined);
  }, [wallet]);

  const online = methods && (methods.BKASH_GATEWAY || methods.SSLCOMMERZ || methods.MOCK);
  const go = async (method: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ redirectUrl: string }>('/gateway/init', { method: 'POST', json: { orderCode, method, amount } });
      window.location.href = r.redirectUrl;
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
      setBusy(false);
    }
  };
  const payWallet = async () => {
    setBusy(true);
    try {
      await api('/payments/wallet', { method: 'POST', json: { orderCode, amount: Math.min(wallet, amount) } });
      setMsg({ ok: true, text: 'ওয়ালেট থেকে পরিশোধ হয়েছে' });
      onDone?.();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  const submitManual = async () => {
    setBusy(true);
    try {
      await api('/payments/manual', { method: 'POST', json: { orderCode, method: manual.method, amount, trxId: manual.trxId.trim(), fromNumber: manual.fromNumber || undefined, screenshot: manual.screenshot || undefined } });
      setMsg({ ok: true, text: 'পেমেন্ট জমা হয়েছে। যাচাই হলে SMS পাবেন।' });
      onDone?.();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  const number = manual.method === 'MANUAL_NAGAD' ? contact.nagad : contact.bkash;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ivory-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{orderCode}</b>
        <span>পরিশোধ করুন: <b className="text-xl">{formatBdt(amount)}</b></span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ivory p-1" role="tablist">
        {([['online', 'অনলাইন'], ['wallet', `ওয়ালেট (${formatBdt(wallet)})`], ['manual', 'Send Money']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} disabled={(k === 'online' && !online) || (k === 'wallet' && wallet < 100) || (k === 'manual' && methods?.MANUAL === false)} onClick={() => setTab(k)} className={`min-h-[40px] rounded-lg text-sm font-semibold disabled:opacity-40 ${tab === k ? 'bg-white shadow' : ''}`}>{l}</button>
        ))}
      </div>
      {tab === 'online' && online && (
        <div className="flex flex-wrap gap-2">
          {methods?.BKASH_GATEWAY && <button className="btn-gold" disabled={busy} onClick={() => go('BKASH_GATEWAY')}>bKash দিয়ে পে করুন</button>}
          {methods?.SSLCOMMERZ && <button className="btn-navy" disabled={busy} onClick={() => go('SSLCOMMERZ')}>কার্ড / Nagad / ব্যাংক</button>}
          {methods?.MOCK && <button className="btn-outline" disabled={busy} onClick={() => go('MOCK')}>টেস্ট পেমেন্ট (ডেভেলপমেন্ট)</button>}
        </div>
      )}
      {tab === 'wallet' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">ওয়ালেট থেকে {formatBdt(Math.min(wallet, amount))} কাটা হবে{wallet < amount ? `, বাকি ${formatBdt(amount - wallet)} অন্যভাবে দিতে হবে` : ''}।</p>
          <button className="btn-gold w-fit" disabled={busy} onClick={payWallet}>ওয়ালেট থেকে দিন</button>
        </div>
      )}
      {tab === 'manual' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {[['MANUAL_BKASH', 'bKash'], ['MANUAL_NAGAD', 'Nagad'], ['MANUAL_BANK', 'ব্যাংক']].map(([k, l]) => (
              <button key={k} className={`chip min-h-[36px] border px-3 text-sm ${manual.method === k ? 'border-navy bg-navy text-white' : 'border-ivory-line'}`} onClick={() => setManual({ ...manual, method: k })}>{l}</button>
            ))}
          </div>
          <p className="rounded-xl border border-dashed border-gold bg-[#FFFCF4] p-3 text-sm">
            {manual.method === 'MANUAL_BANK'
              ? <span className="whitespace-pre-line">{contact.bank || 'ব্যাংক তথ্যের জন্য হটলাইনে কল করুন: 01938-27 38 78'}</span>
              : <>নিচের নম্বরে <b>{formatBdt(amount)}</b> Send Money করে TrxID দিন: <b className="text-lg">{number || '01938-27 38 78'}</b></>}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="label">TrxID / রেফারেন্স<input className="input" value={manual.trxId} onChange={(e) => setManual({ ...manual, trxId: e.target.value })} /></label>
            <label className="label">যে নম্বর/অ্যাকাউন্ট থেকে<input className="input" value={manual.fromNumber} onChange={(e) => setManual({ ...manual, fromNumber: e.target.value })} /></label>
          </div>
          <label className="label">স্ক্রিনশট (ঐচ্ছিক)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setManual({ ...manual, screenshot: await uploadImage(f) }); } catch (er) { setMsg({ ok: false, text: errText(er) }); } }} />
          </label>
          <button className="btn-gold w-fit" disabled={busy || manual.trxId.trim().length < 4} onClick={submitManual}>পেমেন্ট জমা দিন</button>
        </div>
      )}
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
    </div>
  );
}
