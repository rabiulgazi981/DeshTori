import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { encrypt, decrypt } from './crypto';

export const DEFINITIONS = {
  products: { provider: 'PRODUCT_PROVIDER', apiKey: 'RAPIDAPI_KEY', cacheMinutes: 'PRODUCT_CACHE_MINUTES' },
  sms: { provider: 'SMS_PROVIDER', apiKey: 'SMS_API_KEY', senderId: 'SMS_SENDER_ID' },
  bkash: { environment: 'BKASH_BASE_URL', appKey: 'BKASH_APP_KEY', appSecret: 'BKASH_APP_SECRET', username: 'BKASH_USERNAME', password: 'BKASH_PASSWORD' },
  sslcommerz: { environment: 'SSLCZ_BASE_URL', storeId: 'SSLCZ_STORE_ID', storePassword: 'SSLCZ_STORE_PASSWORD' },
} as const;
export type IntegrationKind = keyof typeof DEFINITIONS;
export const SECRET_FIELDS = new Set(['apiKey', 'appKey', 'appSecret', 'username', 'password', 'storeId', 'storePassword']);
const defaults: Record<IntegrationKind, Record<string, string>> = {
  products: { provider: 'mock', cacheMinutes: '60' }, sms: { provider: 'console', senderId: '' },
  bkash: { environment: 'sandbox' }, sslcommerz: { environment: 'sandbox' },
};
@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  private key() { return process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.JWT_SECRET || ''; }
  async resolve(kind: IntegrationKind): Promise<Record<string, string>> {
    const fields = DEFINITIONS[kind];
    const out = { ...defaults[kind] };
    for (const [field, env] of Object.entries(fields)) if (process.env[env]) out[field] = process.env[env]!;
    if (kind === 'bkash') out.environment = out.environment.includes('sandbox') || out.environment === 'sandbox' ? 'sandbox' : 'live';
    if (kind === 'sslcommerz') out.environment = out.environment.includes('sandbox') || out.environment === 'sandbox' ? 'sandbox' : 'live';
    const row = await this.prisma.setting.findUnique({ where: { key: `private.integration.${kind}` } });
    if (row) Object.assign(out, decrypt(row.value as string, this.key()));
    return out;
  }
  async publicStatus(kind: IntegrationKind) {
    const config = await this.resolve(kind);
    return { values: Object.fromEntries(Object.entries(config).filter(([field]) => !SECRET_FIELDS.has(field))), configured: Object.fromEntries(Object.keys(DEFINITIONS[kind]).filter(field => SECRET_FIELDS.has(field)).map(field => [field, !!config[field]])), writable: this.key().length >= 32 };
  }
  async save(kind: IntegrationKind, values: Record<string, unknown>, clearSecrets: string[], actorId: string) {
    const allowed = Object.keys(DEFINITIONS[kind]);
    if (Object.keys(values).some(k => !allowed.includes(k)) || clearSecrets.some(k => !allowed.includes(k) || !SECRET_FIELDS.has(k))) throw new BadRequestException('INVALID_INTEGRATION_FIELD');
    const row = await this.prisma.setting.findUnique({ where: { key: `private.integration.${kind}` } });
    const stored = row ? decrypt(row.value as string, this.key()) : {};
    for (const [field, value] of Object.entries(values)) {
      if (typeof value !== 'string' || value.length > 2000) throw new BadRequestException('INVALID_INTEGRATION_VALUE');
      // Empty password input keeps an existing credential. Explicit clear overrides env fallback.
      if (SECRET_FIELDS.has(field) && !value.trim()) continue;
      stored[field] = value.trim();
    }
    for (const field of clearSecrets) stored[field] = '';
    const combined = { ...(await this.resolve(kind)), ...stored };
    if (kind === 'products' && (!['mock', 'alibaba-1688', 'taobao-datahub'].includes(combined.provider) || !/^\d+$/.test(combined.cacheMinutes) || Number(combined.cacheMinutes) < 1 || Number(combined.cacheMinutes) > 10080)) throw new BadRequestException('INVALID_PRODUCT_CONFIG');
    if (kind === 'sms' && !['console', 'alpha', 'http'].includes(combined.provider)) throw new BadRequestException('INVALID_SMS_PROVIDER');
    if ((kind === 'bkash' || kind === 'sslcommerz') && !['sandbox', 'live'].includes(combined.environment)) throw new BadRequestException('INVALID_GATEWAY_ENVIRONMENT');
    if (this.key().length < 32) throw new BadRequestException('INTEGRATIONS_ENCRYPTION_KEY_REQUIRED');
    const encrypted = encrypt(stored, this.key());
    await this.prisma.setting.upsert({ where: { key: `private.integration.${kind}` }, create: { key: `private.integration.${kind}`, value: encrypted, updatedBy: actorId }, update: { value: encrypted, updatedBy: actorId } });
    if (kind === 'products') await this.prisma.product.updateMany({ data: { fetchedAt: new Date(0) } });
    await this.audit.log({ actorId, action: 'INTEGRATION_SAVE', entity: 'Setting', entityId: kind, after: { changedFields: Object.keys(values), clearedFields: clearSecrets } });
    return this.publicStatus(kind);
  }
}
