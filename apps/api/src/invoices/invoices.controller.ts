import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';
import { Prisma } from '@prisma/client';
import { BillLine, STATUS_LABEL_BN } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { OrdersService } from '../orders/orders.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class InvoiceDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) orderCodes: string[];
  @IsIn(['DELIVERY', 'ADVANCE', 'CUSTOM']) kind: string;
}

type InvLine = BillLine & { orderCode: string };

/**
 * Invoices are snapshots: once made they never change, so the customer's copy
 * always matches what was printed. Signature caption is fixed: "অনুমোদনকারী, DeshTori".
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private prisma: PrismaService, private audit: AuditService, private orders: OrdersService) {}

  @Post('admin/invoices') @UseGuards(RolesGuard) @Roles('ACCOUNTS', 'BD_DELIVERY', 'BD_ORDER')
  async create(@Req() r: AuthedRequest, @Body() d: InvoiceDto) {
    const list = await this.prisma.order.findMany({ where: { code: { in: d.orderCodes } }, include: { charges: true } });
    if (list.length !== d.orderCodes.length) throw new NotFoundException('ORDER_NOT_FOUND');
    const userIds = new Set(list.map((o) => o.userId));
    if (userIds.size !== 1) throw new BadRequestException('ORDERS_OF_DIFFERENT_CUSTOMERS');
    const lines: InvLine[] = [];
    let total = 0;
    let paid = 0;
    for (const o of list) {
      const b = this.orders.billFor(o);
      for (const l of b.lines) lines.push({ ...l, orderCode: o.code });
      total += b.total;
      paid += b.paid;
    }
    const n = await this.prisma.invoice.count();
    const inv = await this.prisma.invoice.create({
      data: {
        code: `INV-${2001 + n}`,
        userId: list[0].userId,
        kind: d.kind,
        lines: lines as unknown as Prisma.InputJsonValue,
        totalPaisa: total,
        paidPaisa: paid,
        status: total - paid <= 0 ? 'PAID' : 'DUE',
        createdBy: r.user.id,
        orders: { create: list.map((o) => ({ orderId: o.id })) },
      },
    });
    await this.audit.log({ actorId: r.user.id, action: 'INVOICE_CREATE', entity: 'Invoice', entityId: inv.id, after: { orders: d.orderCodes, total } });
    return inv;
  }

  @Get('admin/invoices') @UseGuards(RolesGuard) @Roles('ACCOUNTS', 'BD_DELIVERY', 'BD_ORDER')
  list() {
    return this.prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @Get('invoices') mine(@Req() r: AuthedRequest) {
    return this.prisma.invoice.findMany({ where: { userId: r.user.id, status: { not: 'VOID' } }, orderBy: { createdAt: 'desc' } });
  }

  /** Customer (own) or staff can open an invoice for printing. */
  @Get('invoices/:code') async one(@Req() r: AuthedRequest, @Param('code') code: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { code }, include: { orders: { include: { order: { select: { code: true, status: true, shipMode: true, advancePct: true, addressSnapshot: true, deliveryMethod: true, items: { select: { title: true, skuLabel: true, qty: true, unitPaisa: true, image: true } } } } } } } });
    if (!inv || (r.user.kind !== 'STAFF' && inv.userId !== r.user.id)) throw new NotFoundException();
    const user = await this.prisma.user.findUnique({ where: { id: inv.userId }, select: { name: true, phone: true, customerCode: true } });
    return {
      code: inv.code,
      kind: inv.kind,
      status: inv.status,
      createdAt: inv.createdAt,
      totalPaisa: inv.totalPaisa,
      paidPaisa: inv.paidPaisa,
      duePaisa: inv.totalPaisa - inv.paidPaisa,
      lines: inv.lines,
      customer: user,
      orders: inv.orders.map(({ order }) => ({ ...order, statusBn: STATUS_LABEL_BN[order.status] })),
      signatureCaption: 'অনুমোদনকারী, DeshTori',
    };
  }
}
