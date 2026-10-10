/**
 * Alpha SMS (sms.net.bd / sms.bd) — Bangladeshi SMS gateway.
 * Docs: https://sms.bd/api  ·  POST https://api.sms.net.bd/sendsms  (api_key, msg, to, [sender_id])
 * Success: {"error":0,"msg":"Request successfully submitted","data":{"request_id":…}}
 * The key goes in the POST body (never in a URL, so it doesn't end up in proxy logs).
 */
export const ALPHA_ERRORS: Record<number, string> = {
  400: 'অনুরোধে ভুল প্যারামিটার',
  401: 'অনুমতি নেই',
  403: 'অনুমতি নেই / API key ভুল',
  404: 'পাওয়া যায়নি',
  405: 'অনুমতি নেই',
  409: 'সার্ভারের সমস্যা',
  410: 'অ্যাকাউন্টের মেয়াদ শেষ',
  411: 'রিসেলার অ্যাকাউন্টের মেয়াদ শেষ',
  412: 'শিডিউলের সময় ভুল',
  413: 'Sender ID অনুমোদিত নয়',
  414: 'মেসেজ খালি',
  415: 'মেসেজ অনেক বড়',
  416: 'কোনো সঠিক নম্বর নেই',
  417: 'ব্যালেন্স শেষ — রিচার্জ করুন',
  420: 'মেসেজের লেখা আটকে দেওয়া হয়েছে',
};

export class AlphaSmsError extends Error {
  constructor(public code: number, msg: string) {
    super(`Alpha SMS error ${code}: ${ALPHA_ERRORS[code] ?? msg}`);
  }
}

/** +8801XXXXXXXXX / 01XXXXXXXXX → 8801XXXXXXXXX */
export const alphaNumber = (to: string) => {
  const d = to.replace(/\D/g, '');
  return d.startsWith('880') ? d : d.startsWith('0') ? `88${d}` : d;
};

export const alphaBody = (key: string, to: string, msg: string, senderId?: string) => {
  const b = new URLSearchParams({ api_key: key, msg, to: alphaNumber(to) });
  if (senderId) b.set('sender_id', senderId);
  return b;
};

export const parseAlpha = (status: number, text: string): { requestId?: string | number } => {
  let j: { error?: number; msg?: string; data?: { request_id?: string | number } } | null = null;
  try {
    j = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!j) throw new AlphaSmsError(status, `HTTP ${status}`);
  if (j.error !== 0) throw new AlphaSmsError(Number(j.error ?? status), String(j.msg ?? ''));
  return { requestId: j.data?.request_id };
};

export class AlphaSms {
  constructor(private key: string, private senderId?: string, private base = 'https://api.sms.net.bd') {
    if (!key) throw new Error('SMS_API_KEY is not set');
  }

  async send(to: string, message: string): Promise<void> {
    const res = await fetch(`${this.base}/sendsms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: alphaBody(this.key, to, message, this.senderId),
      signal: AbortSignal.timeout(15000),
    });
    parseAlpha(res.status, await res.text());
  }

  /** Remaining balance in taka. */
  async balance(): Promise<number> {
    const res = await fetch(`${this.base}/user/balance/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: this.key }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    parseAlpha(res.status, text);
    const j = JSON.parse(text) as { data?: { balance?: string }; balance?: string };
    return parseFloat(j.data?.balance ?? j.balance ?? '0');
  }
}
