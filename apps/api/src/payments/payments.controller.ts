import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
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
class WalletPayDto {
  @IsString() orderCode: string;
  @IsInt() @Min(100) amount: number;
}
class VerifyDto {
  @IsBoolean() ok: boolean;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService, private prisma: PrismaService, private orders: OrdersService) {}

  @Post('payments/manual') manual(@Req() r: AuthedRequest, @Body() d: ManualDto) {
    return this.payments.submitManual(r.user.id, d);
  }

  @Post('payments/wallet') async wallet(@Req() r: AuthedRequest, @Body() d: WalletPayDto) {
    const o = await this.prisma.order.findUnique({ where: { code: d.orderCode }, include: { charges: true } });
    if (!o || o.userId !== r.user.id) throw new NotFoundException();
    const due = this.orders.billFor(o).due;
    if (d.amount > due) throw new BadRequestException('MORE_THAN_DUE');
    return this.payments.recordConfirmed({ orderId: o.id, userId: r.user.id, method: 'WALLET', amount: d.amount });
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
