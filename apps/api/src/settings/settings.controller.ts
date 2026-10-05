import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SettingsService } from './settings.service';
import { JwtAuthGuard, Roles, RolesGuard, AuthedRequest } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

class PricingDto {
  @IsNumber() @Min(1) @Max(100) cnyRate: number;
  @IsNumber() @Min(0) @Max(50) marginPct: number;
  @IsBoolean() useOriginalPrice: boolean;
}

class NoticeDto {
  @IsBoolean() on: boolean;
  @IsString() @MaxLength(400) textBn: string;
  @IsString() @MaxLength(400) textEn: string;
  @IsString() @MaxLength(30) hotline: string;
  @IsOptional() @IsString() @MaxLength(200) link?: string;
  @IsIn(['slow', 'normal', 'fast']) speed: 'slow' | 'normal' | 'fast';
}
class PlanDto {
  @IsIn([60, 80, 100]) percent: number;
  @IsNumber() @Min(0) @Max(20) discountPct: number;
}
class PlansDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PlanDto) plans: PlanDto[];
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

  @Put('admin/settings/notice')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  notice(@Body() dto: NoticeDto, @Req() req: AuthedRequest) {
    return this.settings.update('notice', { ...dto }, req.user.id);
  }

  @Put('admin/settings/advance-plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  plans(@Body() dto: PlansDto, @Req() req: AuthedRequest) {
    return this.settings.update('advancePlans', dto.plans.map((p) => ({ percent: p.percent, discountPct: p.discountPct })), req.user.id);
  }
}
