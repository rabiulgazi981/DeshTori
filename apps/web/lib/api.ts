export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: unknown) {
    super(code);
  }
}

/** Fetch helper. Session cookie (httpOnly) is sent automatically. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: rest.cache ?? 'no-store',
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.message;
    const code = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : msg?.message ?? `HTTP_${res.status}`;
    throw new ApiError(res.status, code, body);
  }
  return body as T;
}

/** Bangla messages for API error codes. */
export const ERR_BN: Record<string, string> = {
  INVALID_PHONE: 'মোবাইল নম্বর সঠিক নয়',
  OTP_WRONG: 'কোড মেলেনি',
  OTP_EXPIRED: 'কোডের মেয়াদ শেষ, আবার পাঠান',
  OTP_WAIT_60S: '১ মিনিট পর আবার চেষ্টা করুন',
  OTP_DAILY_LIMIT: 'আজকের OTP সীমা শেষ। হটলাইনে যোগাযোগ করুন',
  WRONG_CREDENTIALS: 'নম্বর বা পাসওয়ার্ড ভুল',
  ACCOUNT_LOCKED: 'অনেকবার ভুল হয়েছে, ১৫ মিনিট পর চেষ্টা করুন',
  WEAK_PASSWORD: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষর, অক্ষর ও সংখ্যা মিলিয়ে দিন',
  LOGIN_REQUIRED: 'আগে লগইন করুন',
  CART_EMPTY: 'কার্ট খালি',
  ADDRESS_REQUIRED: 'ডেলিভারির ঠিকানা দিন',
  COUPON_INVALID: 'কুপনটি সঠিক নয়',
  MIN_ORDER_NOT_MET: 'কুপনের জন্য ন্যূনতম অর্ডার পূরণ হয়নি',
  OUT_OF_STOCK: 'স্টকে নেই',
};
export const errText = (e: unknown) => (e instanceof ApiError ? ERR_BN[e.code] ?? e.code : 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন');
