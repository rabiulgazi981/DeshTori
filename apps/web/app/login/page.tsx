'use client';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errText, ApiError } from '@/lib/api';

type Step = 'phone' | 'otp' | 'profile' | 'password' | 'reset' | 'staffOtp';

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/account';
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      const left = e instanceof ApiError ? (e.body as { message?: { triesLeft?: number } })?.message?.triesLeft : undefined;
      setErr(errText(e) + (left !== undefined ? ` (আর ${left} বার)` : ''));
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = (purpose: 'REGISTER' | 'RESET_PASSWORD') =>
    run(async () => {
      const r = await api<{ devCode?: string }>('/auth/otp', { method: 'POST', json: { phone, purpose } });
      setDevCode(r.devCode ?? null);
      setForgot(purpose === 'RESET_PASSWORD');
      setStep('otp');
    });

  const onPhone = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ exists: boolean }>('/auth/check-phone', { method: 'POST', json: { phone } });
      if (r.exists) setStep('password');
      else await sendOtp('REGISTER');
    });
  };

  const done = () => {
    router.push(next);
    router.refresh();
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ needOtp?: boolean; devCode?: string }>('/auth/login', { method: 'POST', json: { phone, password } });
      if (r.needOtp) {
        setDevCode(r.devCode ?? null);
        setStep('staffOtp');
      } else done();
    });
  };

  const onRegister = (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) return setErr('দুইটা পাসওয়ার্ড মেলেনি');
    run(async () => {
      await api('/auth/register', { method: 'POST', json: { phone, code, name, email: email || undefined, password } });
      done();
    });
  };

  const onReset = (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) return setErr('দুইটা পাসওয়ার্ড মেলেনি');
    run(async () => {
      await api('/auth/password/reset', { method: 'POST', json: { phone, code, password } });
      done();
    });
  };

  const onStaffOtp = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api('/auth/staff/verify', { method: 'POST', json: { phone, code } });
      router.push('/admin');
    });
  };

  const pwField = (label: string, value: string, set: (v: string) => void, auto: string) => (
    <label className="label">
      {label}
      <span className="flex overflow-hidden rounded-xl border-2 border-ivory-line bg-white">
        <input type={showPw ? 'text' : 'password'} value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} required minLength={8} className="min-w-0 flex-1 px-3.5 py-3 outline-none" />
        <button type="button" onClick={() => setShowPw(!showPw)} className="border-l border-ivory-line bg-ivory px-3.5 text-sm font-semibold">{showPw ? 'লুকান' : 'দেখান'}</button>
      </span>
    </label>
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <div className="card flex flex-wrap overflow-hidden">
        <section className="flex flex-[1_1_360px] flex-col gap-4 bg-navy p-6 text-[#C8D3EA] md:p-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-header.png" alt="DeshTori" className="w-full max-w-[280px]" />
          <h2 className="text-xl font-bold text-white md:text-2xl">চীনের বাজার থেকে আপনার দুয়ারে।</h2>
          <ul className="hidden flex-col gap-3 md:flex">
            {['1688 ও Taobao-র লাখো পণ্য', 'টাকায় লাইভ দাম', 'নিজস্ব চায়না টিম ও গুদাম', 'Air ৭–১৫ দিন · Sea ৪৫–৬৫ দিন'].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold font-bold text-navy">✓</span><b className="text-white">{t}</b></li>
            ))}
          </ul>
        </section>
        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 p-6 md:p-9">
          {err && <p role="alert" className="rounded-xl bg-[#FDECEA] px-3 py-2 font-semibold text-danger">{err}</p>}
          {devCode && <p className="rounded-xl bg-gold-chip px-3 py-2 text-sm text-gold-ink">ডেভেলপমেন্ট মোড – OTP: <b>{devCode}</b></p>}

          {step === 'phone' && (
            <form onSubmit={onPhone} className="flex flex-col gap-4">
              <h1 className="text-2xl font-bold">লগইন / রেজিস্ট্রেশন</h1>
              <p className="text-muted">মোবাইল নম্বর দিন। নতুন হলে একবার OTP দিয়ে যাচাই করে পাসওয়ার্ড সেট করবেন; পরের বার থেকে শুধু পাসওয়ার্ড।</p>
              <label className="label">মোবাইল নম্বর<input className="input text-lg tracking-wide" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
              <button disabled={busy} className="btn-gold min-h-[54px] text-lg">পরের ধাপ →</button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={onLogin} className="flex flex-col gap-4">
              <button type="button" onClick={() => setStep('phone')} className="self-start font-semibold">← নম্বর বদলান</button>
              <h1 className="text-2xl font-bold">আবার স্বাগতম 👋</h1>
              {pwField('পাসওয়ার্ড', password, setPassword, 'current-password')}
              <div className="flex justify-end"><button type="button" onClick={() => sendOtp('RESET_PASSWORD')} className="font-bold text-emerald">পাসওয়ার্ড ভুলে গেছেন?</button></div>
              <button disabled={busy} className="btn-gold min-h-[54px] text-lg">লগইন</button>
            </form>
          )}

          {(step === 'otp' || step === 'staffOtp') && (
            <form onSubmit={step === 'staffOtp' ? onStaffOtp : (e) => { e.preventDefault(); setStep(forgot ? 'reset' : 'profile'); }} className="flex flex-col gap-4">
              <h1 className="text-2xl font-bold">OTP কোড দিন</h1>
              <p className="text-muted">{phone} নম্বরে ৬ সংখ্যার কোড পাঠানো হয়েছে। ৫ মিনিট কাজ করবে।</p>
              <input className="input max-w-[260px] text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
              <button disabled={busy || code.length !== 6} className="btn-gold min-h-[54px] text-lg">যাচাই করুন</button>
              <span className="rounded-xl bg-ivory px-3 py-2 text-xs text-muted">🔒 আমাদের কোনো কর্মী কখনো OTP চাইবে না।</span>
            </form>
          )}

          {step === 'profile' && (
            <form onSubmit={onRegister} className="flex flex-col gap-4">
              <h1 className="text-2xl font-bold">আপনার পরিচয় দিন</h1>
              <label className="label">পূর্ণ নাম<input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
              <label className="label">ইমেইল (ঐচ্ছিক)<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
              {pwField('পাসওয়ার্ড সেট করুন', password, setPassword, 'new-password')}
              {pwField('পাসওয়ার্ড আবার লিখুন', password2, setPassword2, 'new-password')}
              <p className="text-xs text-muted">কমপক্ষে ৮ অক্ষর, অক্ষর ও সংখ্যা মিলিয়ে।</p>
              <button disabled={busy} className="btn-gold min-h-[54px] text-lg">অ্যাকাউন্ট খুলুন</button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={onReset} className="flex flex-col gap-4">
              <h1 className="text-2xl font-bold">নতুন পাসওয়ার্ড দিন</h1>
              {pwField('নতুন পাসওয়ার্ড', password, setPassword, 'new-password')}
              {pwField('আবার লিখুন', password2, setPassword2, 'new-password')}
              <button disabled={busy} className="btn-gold min-h-[54px] text-lg">পাসওয়ার্ড সেভ ও লগইন</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
