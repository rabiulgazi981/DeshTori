import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

export const SHIP_STATUSES = ['AWAITING_ARRIVAL', 'RECEIVED', 'SHIPPED', 'ARRIVED_BD', 'DELIVERED', 'CANCELLED'] as const;
export const SHIP_STATUS_BN: Record<string, string> = {
  AWAITING_ARRIVAL: 'গুদামে আসার অপেক্ষায়',
  RECEIVED: 'চীনের গুদামে পৌঁছেছে',
  SHIPPED: 'বাংলাদেশের পথে',
  ARRIVED_BD: 'বাংলাদেশে পৌঁছেছে',
  DELIVERED: 'ডেলিভারি সম্পন্ন',
  CANCELLED: 'বাতিল',
};

class ShipDto {
  @IsIn(['GZ_AIR', 'HK_AIR', 'SEA']) warehouse: string;
  @IsString() @MaxLength(60) trackingNo: string;
  @IsInt() @Min(1) cartons: number;
  @IsInt() @Min(1) totalPieces: number;
  @IsString() @MaxLength(500) description: string;
  @IsIn(['A', 'B', 'C']) category: string;
  @IsIn(['NONE', 'PAYMENT', 'SPECIAL_PACKING', 'INSPECTION']) extraService: string;
}
class ReceiveDto {
  @IsIn(SHIP_STATUSES as unknown as string[]) status: string;
  @IsOptional() @IsInt() @Min(0) receivedCartons?: number;
  @IsOptional() @IsInt() @Min(0) receivedPieces?: number;
  @IsOptional() @IsNumber() @Min(0) weightKg?: number;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ShipController {
  constructor(private prisma: PrismaService, private audit: AuditService, private sms: SmsService) {}

  @Post('ship-requests') async create(@Req() r: AuthedRequest, @Body() d: ShipDto) {
    const n = await this.prisma.shipRequest.count();
    const sr = await this.prisma.shipRequest.create({ data: { ...d, code: `SHP-${10001 + n}`, userId: r.user.id } });
    const u = await this.prisma.user.findUnique({ where: { id: r.user.id }, select: { customerCode: true } });
    return { ...sr, shippingMark: u?.customerCode ?? '', statusBn: SHIP_STATUS_BN[sr.status] };
  }

  @Get('ship-requests') async mine(@Req() r: AuthedRequest) {
    const list = await this.prisma.shipRequest.findMany({ where: { userId: r.user.id }, orderBy: { createdAt: 'desc' } });
    return list.map((s) => ({ ...s, statusBn: SHIP_STATUS_BN[s.status] }));
  }

  @Get('admin/ship-requests') @UseGuards(RolesGuard) @Roles('CN_WAREHOUSE', 'SHIPMENT', 'BD_ORDER', 'BD_DELIVERY')
  list(@Query('status') status?: string) {
    return this.prisma.shipRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, phone: true, customerCode: true } } },
    });
  }

  @Patch('admin/ship-requests/:code') @UseGuards(RolesGuard) @Roles('CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY')
  async update(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: ReceiveDto) {
    const sr = await this.prisma.shipRequest.findUnique({ where: { code }, include: { user: true } });
    if (!sr) throw new NotFoundException();
    const up = await this.prisma.shipRequest.update({ where: { code }, data: d });
    await this.audit.log({ actorId: r.user.id, action: 'SHIP_REQUEST_UPDATE', entity: 'ShipRequest', entityId: sr.id, before: { status: sr.status }, after: d });
    if (d.status !== sr.status) {
      const short = d.status === 'RECEIVED' && d.receivedCartons !== undefined && d.receivedCartons < sr.cartons ? ` (কার্টন ${d.receivedCartons}/${sr.cartons} পাওয়া গেছে)` : '';
      await this.sms.send(sr.user.phone, `DeshTori: আপনার শিপমেন্ট ${sr.code} এখন "${SHIP_STATUS_BN[d.status]}"${short}।`).catch(() => undefined);
    }
    return up;
  }
}
