export const API_URL = typeof window === 'undefined'
  ? process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
  : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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
  WALLET_LOW: 'ওয়ালেটে যথেষ্ট টাকা নেই',
  MORE_THAN_DUE: 'বাকির চেয়ে বেশি টাকা দেওয়া যাবে না',
  GATEWAY_NOT_CONFIGURED: 'এই পেমেন্ট পদ্ধতি এখনো চালু হয়নি',
  TRXID_ALREADY_USED: 'এই TrxID আগে ব্যবহার হয়েছে',
  ALREADY_ANSWERED: 'আগেই উত্তর দেওয়া হয়েছে',
  NOT_DELIVERED_YET: 'পণ্য হাতে পাওয়ার পর অভিযোগ করা যাবে',
  IMAGE_ONLY: 'শুধু JPG/PNG/WEBP ছবি দিন',
  IMAGE_TOO_LARGE: 'ছবি ৪ MB-এর কম হতে হবে',
  TICKET_CLOSED: 'টিকেটটি বন্ধ হয়ে গেছে',
  STAFF_ONLY: 'শুধু স্টাফদের জন্য',
  ROLE_REQUIRED: 'আপনার এই কাজের অনুমতি নেই',
  PHONE_ALREADY_USED: 'এই নম্বর আগেই ব্যবহার হয়েছে',
  ORDERS_OF_DIFFERENT_CUSTOMERS: 'একই গ্রাহকের অর্ডার বাছাই করুন',
  EMPTY_SHIPMENT: 'অন্তত একটি অর্ডার বা পার্সেল বাছাই করুন',
  SHIP_REQUESTS_NOT_READY: 'পার্সেল এখনো গুদামে পৌঁছায়নি',
  CANNOT_DEMOTE_SELF: 'নিজের OWNER রোল সরানো যাবে না',
  WALLET_NEGATIVE: 'ব্যালেন্স মাইনাস হয়ে যাবে',
};
export const errText = (e: unknown) => (e instanceof ApiError ? ERR_BN[e.code] ?? e.code : 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন');

/** Read a picked image file as a data URL and upload it. Returns the public URL. */
export async function uploadImage(file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024) throw new ApiError(400, 'IMAGE_TOO_LARGE', null);
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
  const r = await api<{ url: string }>('/uploads', { method: 'POST', json: { dataUrl } });
  return r.url;
}
