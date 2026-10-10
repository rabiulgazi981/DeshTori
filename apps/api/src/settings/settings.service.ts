import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdvancePlan, DEFAULT_ADVANCE_PLANS, PricingSettings } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../prisma/redis.service';
import { AuditService } from '../prisma/audit.service';

export interface SiteSettings {
  pricing: PricingSettings;
  /** show the supplier's original price (true) or promo price (false) */
  useOriginalPrice: boolean;
  advancePlans: AdvancePlan[];
  notice: { on: boolean; textBn: string; textEn: string; hotline: string; link?: string; speed: 'slow' | 'normal' | 'fast' };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  pricing: { cnyRate: 19.9, marginPct: 0 },
  useOriginalPrice: true,
  advancePlans: DEFAULT_ADVANCE_PLANS,
  notice: {
    on: true,
    textBn: 'বাংলাদেশে এই প্রথম DeshTori Door To Door Service দিচ্ছে সবচেয়ে সাশ্রয় ও স্বল্প মূল্যে Quickly China থেকে Bangladesh এ শিপমেন্ট।',
    textEn: 'First time in Bangladesh — DeshTori Door To Door Service: the most affordable shipping from China to Bangladesh.',
    hotline: '01938-27 38 78',
    speed: 'normal',
  },
};

const CACHE_KEY = 'settings:site';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private cache: CacheService, private audit: AuditService) {}

  async get(): Promise<SiteSettings> {
    const hit = await this.cache.get<SiteSettings>(CACHE_KEY);
    if (hit) return hit;
    const rows = await this.prisma.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
    const merged: SiteSettings = { ...DEFAULT_SETTINGS };
    for (const r of rows) (merged as unknown as Record<string, unknown>)[r.key] = r.value;
    await this.cache.set(CACHE_KEY, merged, 300);
    return merged;
  }

  async update<K extends keyof SiteSettings>(key: K, value: SiteSettings[K], actorId: string) {
    const before = (await this.get())[key];
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as unknown as Prisma.InputJsonValue, updatedBy: actorId },
      update: { value: value as unknown as Prisma.InputJsonValue, updatedBy: actorId },
    });
    await this.cache.del(CACHE_KEY);
    await this.audit.log({ actorId, action: 'SETTING_UPDATE', entity: 'Setting', entityId: key, before, after: value });
    return this.get();
  }
}
