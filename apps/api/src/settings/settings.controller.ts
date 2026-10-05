import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, Max, Min } from 'class-validator';
import { SettingsService } from './settings.service';
import { JwtAuthGuard, Roles, RolesGuard, AuthedRequest } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

class PricingDto {
  @IsNumber() @Min(1) @Max(100) cnyRate: number;
  @IsNumber() @Min(0) @Max(50) marginPct: number;
  @IsBoolean() useOriginalPrice: boolean;
}

@Controller()
export class SettingsController {
  constructor(private settings: SettingsService, private prisma: PrismaService) {}

  /** Public: what the website needs (no secrets!). */
  @Get('settings/public')
  async publicSettings() {
    const s = await this.settings.get();
    const freight = await this.prisma.freightCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    return { advancePlans: s.advancePlans, notice: s.notice, freight };
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ACCOUNTS')
  all() {
    return this.settings.get();
  }

  @Put('admin/settings/pricing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  async pricing(@Body() dto: PricingDto, @Req() req: AuthedRequest) {
    await this.settings.update('pricing', { cnyRate: dto.cnyRate, marginPct: dto.marginPct }, req.user.id);
    return this.settings.update('useOriginalPrice', dto.useOriginalPrice, req.user.id);
  }
}
