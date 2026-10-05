import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class ManualDto {
  @IsString() orderCode: string;
  @IsIn(['MANUAL_BKASH', 'MANUAL_NAGAD', 'MANUAL_BANK']) method: PaymentMethod;
  @IsInt() @Min(100) amount: number;
  @IsString() @MaxLength(40) trxId: string;
  @IsOptional() @IsString() @MaxLength(20) fromNumber?: string;
  @IsOptional() @IsString() screenshot?: string;
}
class VerifyDto {
  @IsBoolean() ok: boolean;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('payments/manual') manual(@Req() r: AuthedRequest, @Body() d: ManualDto) {
    return this.payments.submitManual(r.user.id, d);
  }

  @Get('admin/payments/pending') @UseGuards(RolesGuard) @Roles('ACCOUNTS')
  pending() {
    return this.payments.pending();
  }

  @Post('admin/payments/:id/verify') @UseGuards(RolesGuard) @Roles('ACCOUNTS')
  verify(@Req() r: AuthedRequest, @Param('id') id: string, @Body() d: VerifyDto) {
    return this.payments.verify(id, d.ok, r.user.id);
  }
}
