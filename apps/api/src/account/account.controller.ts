import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
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
}
