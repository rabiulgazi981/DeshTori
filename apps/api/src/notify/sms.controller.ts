import { Body, Controller, Get, HttpCode, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import { normalizeBdPhone } from '@deshtori/shared';
import { SmsService } from './sms.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';
import { AuditService } from '../prisma/audit.service';

class TestSmsDto {
  @IsString() @MaxLength(20) phone: string;
}

@Controller('admin/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class SmsController {
  constructor(private sms: SmsService, private audit: AuditService) {}

  @Get('status')
  status() {
    return this.sms.status();
  }

  /** Owner sends one test SMS to check the gateway (max 5 per 10 minutes). */
  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async test(@Body() d: TestSmsDto, @Req() r: AuthedRequest) {
    const phone = normalizeBdPhone(d.phone);
    if (!phone) throw new BadRequestException('INVALID_PHONE');
    try {
      await this.sms.send(phone, 'DeshTori: টেস্ট SMS ঠিকমতো পৌঁছেছে।');
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    await this.audit.log({ actorId: r.user.id, action: 'SMS_TEST', entity: 'Sms', after: { to: phone, provider: await this.sms.providerName() } });
    return { ok: true, provider: await this.sms.providerName() };
  }
}
