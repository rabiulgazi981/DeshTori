import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlphaSms } from './alpha-sms';

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

/** Development provider: prints to console. */
class ConsoleSms implements SmsProvider {
  private log = new Logger('SMS(dev)');
  async send(to: string, message: string) {
    this.log.log(`→ ${to}: ${message}`);
  }
}

/**
 * Generic HTTP GET gateway used by most Bangladeshi SMS providers.
 * SMS_HTTP_URL example: https://api.example.com/send?api_key={key}&to={to}&msg={msg}&sender={sender}
 */
class HttpSms implements SmsProvider {
  constructor(private url: string, private key: string, private sender: string) {}
  async send(to: string, message: string) {
    const u = this.url
      .replace('{key}', encodeURIComponent(this.key))
      .replace('{to}', encodeURIComponent(to.replace('+', '')))
      .replace('{msg}', encodeURIComponent(message))
      .replace('{sender}', encodeURIComponent(this.sender));
    const res = await fetch(u);
    if (!res.ok) throw new Error(`SMS gateway HTTP ${res.status}`);
  }
}

@Injectable()
export class SmsService {
  private provider: SmsProvider;
  private alpha?: AlphaSms;
  readonly providerName: string;
  private log = new Logger('SMS');

  constructor(private prisma: PrismaService) {
    const p = process.env.SMS_PROVIDER ?? 'console';
    if (p === 'alpha' && process.env.SMS_API_KEY) {
      // Sender ID only once Alpha has approved it; otherwise their default number is used.
      this.alpha = new AlphaSms(process.env.SMS_API_KEY, process.env.SMS_SENDER_ID || undefined);
      this.provider = this.alpha;
      this.providerName = 'alpha';
    } else if (p === 'http' && process.env.SMS_HTTP_URL) {
      this.provider = new HttpSms(process.env.SMS_HTTP_URL, process.env.SMS_API_KEY ?? '', process.env.SMS_SENDER_ID ?? 'DeshTori');
      this.providerName = 'http';
    } else {
      if (p !== 'console') this.log.warn(`SMS_PROVIDER=${p} but its settings are missing — SMS will only be printed to the console`);
      this.provider = new ConsoleSms();
      this.providerName = 'console';
    }
    if (this.providerName === 'console' && process.env.NODE_ENV === 'production') {
      this.log.error('No SMS gateway configured in production: OTP codes cannot reach customers');
    }
  }

  /** For the admin panel: which gateway is active and (Alpha only) the balance. Never returns the key. */
  async status(): Promise<{ provider: string; live: boolean; balance?: number; error?: string }> {
    const live = this.providerName !== 'console';
    if (!this.alpha) return { provider: this.providerName, live };
    try {
      return { provider: this.providerName, live, balance: await this.alpha.balance() };
    } catch (e) {
      return { provider: this.providerName, live, error: (e as Error).message };
    }
  }

  async send(to: string, message: string) {
    try {
      await this.provider.send(to, message);
    } catch (e) {
      this.log.error(`failed to send SMS to ${to}: ${(e as Error).message}`);
      throw e;
    }
  }

  /**
   * Send using the admin-editable template (Settings → SMS). Falls back to the built-in text.
   * key: orderPlaced | status | payment | arrived. A template switched off sends nothing.
   */
  async sendTemplate(to: string, key: 'orderPlaced' | 'status' | 'payment' | 'arrived', vars: Record<string, string>, fallback: string) {
    let text = fallback;
    try {
      const row = await this.prisma.setting.findUnique({ where: { key: 'content.smsTemplates' } });
      const t = (row?.value ?? {}) as Record<string, unknown>;
      if (t[`${key}On`] === false) return;
      if (typeof t[key] === 'string' && (t[key] as string).trim()) text = t[key] as string;
    } catch {
      /* use fallback */
    }
    text = text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
    await this.send(to, text).catch(() => undefined);
  }
}
