import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { freightCharge, STATUS_LABEL_BN } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';
import { OrdersService } from '../orders/orders.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class ItemDto {
  @IsOptional() @IsInt() @Min(0) actualFen?: number;
  @IsOptional() @IsInt() @Min(0) purchasedQty?: number;
  @IsOptional() @IsInt() @Min(0) receivedQty?: number;
  @IsOptional() @IsIn(['OK', 'DAMAGED', 'SHORT', 'WRONG']) qcStatus?: string;
}
class QcDto {
  @IsUrl({ require_tld: false }) url: string;
}
class WeightDto {
  @IsNumber() @Min(0.01) weightKg: number;
  @IsIn(['A', 'B', 'C']) category: string;
}
class ShipmentDto {
  @IsIn(['AIR', 'SEA']) mode: 'AIR' | 'SEA';
  @IsIn(['GZ_AIR', 'HK_AIR', 'SEA']) route: string;
  @IsOptional() @IsString() @MaxLength(60) carrier?: string;
  @IsOptional() @IsString() @MaxLength(60) awb?: string;
  @IsOptional() @IsInt() @Min(0) costPaisa?: number;
  @IsArray() @IsString({ each: true }) orderCodes: string[];
  @IsArray() @IsString({ each: true }) shipRequestCodes: string[];
}
class BulkDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) codes: string[];
  @IsString() status: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
class ArriveDto {
  @IsIn(['ARRIVED_BD']) status: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsController {
  constructor(private prisma: PrismaService, private audit: AuditService, private sms: SmsService, private orders: OrdersService) {}

  /** Full order for staff (includes supplier price – staff only). */
  @Get('orders/:code') @Roles('BD_ORDER', 'CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY', 'ACCOUNTS')
  async order(@Param('code') code: string) {
    const o = await this.prisma.order.findUnique({
      where: { code },
      include: {
        user: { select: { id: true, name: true, phone: true, customerCode: true } },
        items: true, charges: true, payments: true, decisions: true, qcPhotos: true,
        events: { orderBy: { createdAt: 'asc' } },
        shipment: { select: { code: true, status: true } },
      },
    });
    if (!o) throw new NotFoundException();
    return { ...o, statusBn: STATUS_LABEL_BN[o.status], bill: this.orders.billFor(o) };
  }

  @Patch('orders/:code/items/:itemId') @Roles('CN_PURCHASE', 'CN_WAREHOUSE')
  async item(@Req() r: AuthedRequest, @Param('code') code: string, @Param('itemId') itemId: string, @Body() d: ItemDto) {
    const it = await this.prisma.orderItem.findFirst({ where: { id: itemId, order: { code } } });
    if (!it) throw new NotFoundException();
    const up = await this.prisma.orderItem.update({ where: { id: itemId }, data: d });
    await this.audit.log({ actorId: r.user.id, action: 'ORDER_ITEM_UPDATE', entity: 'OrderItem', entityId: itemId, before: it, after: d });
    return up;
  }

  @Post('orders/:code/qc-photos') @Roles('CN_WAREHOUSE')
  async qc(@Param('code') code: string, @Body() d: QcDto) {
    const o = await this.prisma.order.findUnique({ where: { code } });
    if (!o) throw new NotFoundException();
    return this.prisma.qcPhoto.create({ data: { orderId: o.id, url: d.url } });
  }

  /** Warehouse enters the final weight → freight charge is added automatically from the rate table. */
  @Post('orders/:code/weight') @Roles('CN_WAREHOUSE', 'SHIPMENT')
  async weight(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: WeightDto) {
    const o = await this.prisma.order.findUnique({ where: { code }, include: { charges: true } });
    if (!o) throw new NotFoundException();
    const cat = await this.prisma.freightCategory.findUnique({ where: { code: d.category } });
    if (!cat) throw new BadRequestException('UNKNOWN_CATEGORY');
    const perKg = o.shipMode === 'AIR' ? cat.airPaisa : cat.seaPaisa;
    const amount = freightCharge(d.weightKg, { category: cat.code, mode: o.shipMode, perKgPaisa: perKg, minKg: cat.minKg });
    await this.prisma.$transaction(async (tx) => {
      await tx.orderCharge.deleteMany({ where: { orderId: o.id, code: 'FREIGHT', createdBy: 'auto-weight' } });
      await tx.orderCharge.create({ data: { orderId: o.id, code: 'FREIGHT', label: `শিপিং চার্জ ${d.weightKg} কেজি × ৳${Math.round(perKg / 100)} (${cat.nameBn})`, amount, createdBy: 'auto-weight' } });
      await tx.order.update({ where: { id: o.id }, data: { finalWeightKg: d.weightKg } });
    });
    await this.audit.log({ actorId: r.user.id, action: 'ORDER_WEIGHT', entity: 'Order', entityId: o.id, after: { ...d, amount } });
    return { amount };
  }

  // ───── shipments (batch of orders + ship-for-me parcels on one flight/vessel) ─────
  @Get('shipments') @Roles('SHIPMENT', 'BD_DELIVERY', 'CN_WAREHOUSE')
  shipments() {
    return this.prisma.shipment.findMany({ orderBy: { sentAt: 'desc' }, take: 100, include: { _count: { select: { orders: true, shipRequests: true } } } });
  }

  @Post('shipments') @Roles('SHIPMENT')
  async createShipment(@Req() r: AuthedRequest, @Body() d: ShipmentDto) {
    if (!d.orderCodes.length && !d.shipRequestCodes.length) throw new BadRequestException('EMPTY_SHIPMENT');
    const orders = await this.prisma.order.findMany({ where: { code: { in: d.orderCodes } }, include: { user: true } });
    const bad = orders.filter((o) => o.status !== 'AT_CN_WAREHOUSE').map((o) => o.code);
    if (orders.length !== d.orderCodes.length || bad.length) throw new BadRequestException(`ORDERS_NOT_READY:${bad.join(',')}`);
    const srs = await this.prisma.shipRequest.findMany({ where: { code: { in: d.shipRequestCodes } }, include: { user: true } });
    if (srs.length !== d.shipRequestCodes.length || srs.some((s) => s.status !== 'RECEIVED')) throw new BadRequestException('SHIP_REQUESTS_NOT_READY');
    const n = await this.prisma.shipment.count();
    const sh = await this.prisma.$transaction(async (tx) => {
      const s = await tx.shipment.create({ data: { code: `SHIP-${String(n + 1).padStart(4, '0')}`, mode: d.mode, route: d.route, carrier: d.carrier, awb: d.awb, costPaisa: d.costPaisa, sentAt: new Date() } });
      for (const o of orders) {
        await tx.order.update({ where: { id: o.id }, data: { shipmentId: s.id, status: 'SHIPPED', events: { create: { fromStatus: o.status, toStatus: 'SHIPPED', note: s.code, actorId: r.user.id } } } });
      }
      await tx.shipRequest.updateMany({ where: { code: { in: d.shipRequestCodes } }, data: { shipmentId: s.id, status: 'SHIPPED' } });
      if (d.costPaisa) await tx.ledgerEntry.create({ data: { kind: 'EXPENSE', category: 'FREIGHT_CARRIER', amount: d.costPaisa, shipmentId: s.id, note: `${s.code} ${d.carrier ?? ''}`, createdBy: r.user.id } });
      return s;
    });
    await this.audit.log({ actorId: r.user.id, action: 'SHIPMENT_CREATE', entity: 'Shipment', entityId: sh.id, after: d });
    for (const p of [...orders.map((o) => ({ phone: o.user.phone, code: o.code })), ...srs.map((s) => ({ phone: s.user.phone, code: s.code }))]) {
      await this.sms.send(p.phone, `DeshTori: ${p.code} চীন থেকে বাংলাদেশের পথে রওনা হয়েছে (${sh.code})।`).catch(() => undefined);
    }
    return sh;
  }

  @Patch('shipments/:code') @Roles('SHIPMENT', 'BD_DELIVERY')
  async arrive(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: ArriveDto) {
    const sh = await this.prisma.shipment.findUnique({ where: { code }, include: { orders: { include: { user: true } }, shipRequests: { include: { user: true } } } });
    if (!sh) throw new NotFoundException();
    if (sh.status === 'ARRIVED_BD') throw new BadRequestException('ALREADY_ARRIVED');
    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: sh.id }, data: { status: d.status, arrivedAt: new Date() } });
      for (const o of sh.orders.filter((x) => x.status === 'SHIPPED')) {
        await tx.order.update({ where: { id: o.id }, data: { status: 'ARRIVED_BD', events: { create: { fromStatus: 'SHIPPED', toStatus: 'ARRIVED_BD', note: sh.code, actorId: r.user.id } } } });
      }
      await tx.shipRequest.updateMany({ where: { shipmentId: sh.id, status: 'SHIPPED' }, data: { status: 'ARRIVED_BD' } });
    });
    await this.audit.log({ actorId: r.user.id, action: 'SHIPMENT_ARRIVED', entity: 'Shipment', entityId: sh.id });
    for (const p of [...sh.orders.map((o) => ({ phone: o.user.phone, code: o.code })), ...sh.shipRequests.map((s) => ({ phone: s.user.phone, code: s.code }))]) {
      await this.sms.send(p.phone, `DeshTori: ${p.code} বাংলাদেশে পৌঁছেছে। বাকি টাকা পরিশোধ করে ডেলিভারি নিন: deshtori.com/account`).catch(() => undefined);
    }
    return { ok: true };
  }

  /** Bulk view for the purchase team: everything in NEW/PURCHASING with supplier links. */
  @Get('purchase-queue') @Roles('CN_PURCHASE')
  purchaseQueue() {
    return this.prisma.order.findMany({ where: { status: { in: ['NEW', 'PURCHASING', 'NEEDS_DECISION'] } }, orderBy: { createdAt: 'asc' }, include: { items: true, decisions: { where: { answer: 'PENDING' } } } });
  }

  @Post('orders/bulk-status') @Roles('BD_ORDER', 'CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY')
  async bulk(@Req() r: AuthedRequest, @Body() d: BulkDto) {
    const done: string[] = [];
    const failed: { code: string; error: string }[] = [];
    for (const code of d.codes) {
      try {
        await this.orders.changeStatus(code, d.status as never, r.user, d.note, true);
        done.push(code);
      } catch (e) {
        failed.push({ code, error: (e as Error).message });
      }
    }
    return { done, failed };
  }
}

