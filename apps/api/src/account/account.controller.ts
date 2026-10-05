import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { normalizeBdPhone } from '@deshtori/shared';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';

class AddressDto {
  @IsString() @MaxLength(30) label: string;
  @IsString() @MaxLength(80) name: string;
  @IsString() @MaxLength(20) phone: string;
  @IsString() @MaxLength(40) district: string;
  @IsString() @MaxLength(60) area: string;
  @IsString() @MaxLength(250) line: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class WithdrawDto {
  @IsIn(['BKASH', 'NAGAD', 'BANK']) method: string;
  @IsString() @MaxLength(80) account: string;
  @IsInt() @Min(10000) amount: number; // min ৳100
}
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsObject() notifyPrefs?: Record<string, unknown>;
}

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private prisma: PrismaService) {}

  @Get('addresses') list(@Req() r: AuthedRequest) {
    return this.prisma.address.findMany({ where: { userId: r.user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }

  @Post('addresses') async add(@Req() r: AuthedRequest, @Body() d: AddressDto) {
    const phone = normalizeBdPhone(d.phone);
    if (!phone) throw new BadRequestException('INVALID_PHONE');
    if (d.isDefault) await this.prisma.address.updateMany({ where: { userId: r.user.id }, data: { isDefault: false } });
    const count = await this.prisma.address.count({ where: { userId: r.user.id } });
    return this.prisma.address.create({ data: { ...d, phone, userId: r.user.id, isDefault: d.isDefault ?? count === 0 } });
  }

  @Delete('addresses/:id') remove(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.prisma.address.deleteMany({ where: { id, userId: r.user.id } });
  }

  @Get('wallet') async wallet(@Req() r: AuthedRequest) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: r.user.id }, select: { walletPaisa: true } });
    const txns = await this.prisma.walletTxn.findMany({ where: { userId: r.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { balancePaisa: u.walletPaisa, txns };
  }

  /** Money is held from the wallet now; Accounts sends it and marks SENT (or REJECTED → returned). */
  @Post('withdrawals') async withdraw(@Req() r: AuthedRequest, @Body() d: WithdrawDto) {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.updateMany({ where: { id: r.user.id, walletPaisa: { gte: d.amount } }, data: { walletPaisa: { decrement: d.amount } } });
      if (u.count !== 1) throw new BadRequestException('WALLET_LOW');
      await tx.walletTxn.create({ data: { userId: r.user.id, type: 'WITHDRAWAL', amount: -d.amount, note: `উত্তোলন অনুরোধ (${d.method})` } });
      return tx.withdrawal.create({ data: { userId: r.user.id, ...d } });
    });
  }
  @Get('withdrawals') withdrawals(@Req() r: AuthedRequest) {
    return this.prisma.withdrawal.findMany({ where: { userId: r.user.id }, orderBy: { createdAt: 'desc' } });
  }

  @Post('profile') async profile(@Req() r: AuthedRequest, @Body() d: ProfileDto) {
    const u = await this.prisma.user.update({ where: { id: r.user.id }, data: { name: d.name, email: d.email, notifyPrefs: d.notifyPrefs as Prisma.InputJsonValue | undefined } });
    return { name: u.name, email: u.email, notifyPrefs: u.notifyPrefs };
  }
}
