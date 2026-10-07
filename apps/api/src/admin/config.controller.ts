import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsHexColor, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';
import { DEFINITIONS, IntegrationKind, IntegrationsService } from '../integrations/integrations.service';
import { ProductsService } from '../products/products.service';
import { AlphaSms } from '../notify/alpha-sms';

class IntegrationDto {
  @IsObject() values: Record<string, unknown>;
  @IsOptional() @IsArray() @IsString({ each: true }) clearSecrets?: string[];
}
class AppearanceDto {
  @IsHexColor() primary: string;
  @IsHexColor() accent: string;
  @IsHexColor() secondary: string;
  @IsHexColor() background: string;
  @IsIn(['light', 'dark', 'system']) defaultTheme: string;
  @IsString() @MaxLength(2000) headerLogo: string;
  @IsString() @MaxLength(2000) footerLogo: string;
  @IsBoolean() showImageSearch: boolean;
  @IsBoolean() showShipping: boolean;
  @IsBoolean() showMobileNav: boolean;
}
export const DEFAULT_APPEARANCE = { primary: '#0E2A6B', accent: '#D4A93A', secondary: '#0F6B4F', background: '#F6F2E8', defaultTheme: 'light', headerLogo: '/brand/logo-header.png', footerLogo: '/brand/logo-footer.png', showImageSearch: true, showShipping: true, showMobileNav: true };
@Controller()
export class ConfigController {
  constructor(private integrations: IntegrationsService, private products: ProductsService, private prisma: PrismaService, private audit: AuditService) {}
  private kind(raw: string): IntegrationKind {
    if (!Object.prototype.hasOwnProperty.call(DEFINITIONS, raw)) throw new BadRequestException('UNKNOWN_INTEGRATION');
    return raw as IntegrationKind;
  }
  @Get('admin/integrations') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER')
  async list() {
    return Object.fromEntries(await Promise.all(Object.keys(DEFINITIONS).map(async k => [k, await this.integrations.publicStatus(this.kind(k))])));
  }
  @Put('admin/integrations/:kind') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER')
  save(@Req() r: AuthedRequest, @Param('kind') kind: string, @Body() d: IntegrationDto) {
    return this.integrations.save(this.kind(kind), d.values, d.clearSecrets ?? [], r.user.id);
  }
  @Post('admin/integrations/:kind/test') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER')
  async test(@Req() r: AuthedRequest, @Param('kind') raw: string) {
    const kind = this.kind(raw);
    // Product test uses one provider request; SMS test reads balance, never sends an SMS.
    try {
      let result: Record<string, unknown>;
      if (kind === 'products') {
        const data = await this.products.search('phone case', { page: 1 });
        const c = await this.integrations.resolve(kind);
        result = { ok: c.provider !== 'mock' && data.items.length > 0, message: c.provider === 'mock' ? 'Mock provider: live connection পরীক্ষা হয়নি।' : `সার্চে ${data.items.length}টি পণ্য পাওয়া গেছে।` };
      } else if (kind === 'sms') {
        const c = await this.integrations.resolve(kind);
        if (c.provider !== 'alpha') return { ok: false, message: 'Balance test শুধু Alpha SMS-এর জন্য।' };
        result = { ok: true, message: `Alpha SMS balance: ৳${await new AlphaSms(c.apiKey ?? '', c.senderId).balance()}` };
      } else throw new BadRequestException('TEST_NOT_SUPPORTED');
      await this.audit.log({ actorId: r.user.id, action: 'INTEGRATION_TEST', entity: 'Setting', entityId: kind, after: { ok: result.ok } });
      return result;
    } catch { return { ok: false, message: 'সংযোগ যাচাই ব্যর্থ। API key, provider subscription ও server network পরীক্ষা করুন।' }; }
  }
  @Get('appearance') async appearance() {
    const row = await this.prisma.setting.findUnique({ where: { key: 'appearance' } });
    return { ...DEFAULT_APPEARANCE, ...(row?.value as object ?? {}) };
  }
  @Put('admin/appearance') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER')
  async saveAppearance(@Req() r: AuthedRequest, @Body() d: AppearanceDto) {
    for (const url of [d.headerLogo, d.footerLogo]) {
      if (url.startsWith('/') && !url.startsWith('//') && !/[\\<>"\s]/.test(url)) continue;
      try { const u = new URL(url); if (u.protocol === 'https:' && !u.username && !u.password) continue; } catch {}
      throw new BadRequestException('INVALID_LOGO_URL');
    }
    await this.prisma.setting.upsert({ where: { key: 'appearance' }, create: { key: 'appearance', value: { ...d }, updatedBy: r.user.id }, update: { value: { ...d }, updatedBy: r.user.id } });
    await this.audit.log({ actorId: r.user.id, action: 'APPEARANCE_SAVE', entity: 'Setting', entityId: 'appearance', after: d });
    return this.appearance();
  }
}
