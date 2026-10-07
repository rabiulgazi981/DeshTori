import { AlphaSms } from './alpha-sms';
import { IntegrationsService } from '../integrations/integrations.service';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  private log = new Logger('SMS');
  constructor(private prisma: PrismaService, private integrations: IntegrationsService) {}
  private async provider(): Promise<SmsProvider> {
    const c = await this.integrations.resolve('sms');
    if (c.provider === 'alpha') return new AlphaSms(c.apiKey ?? '', c.senderId);
    if (c.provider === 'http' && process.env.SMS_HTTP_URL) return new HttpSms(process.env.SMS_HTTP_URL, c.apiKey ?? '', c.senderId ?? 'DeshTori');
    if (process.env.NODE_ENV === 'production') throw new Error('LIVE_SMS_PROVIDER_REQUIRED');
    return new ConsoleSms();
  }

  async send(to: string, message: string) {
    try {
      await (await this.provider()).send(to, message);
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
