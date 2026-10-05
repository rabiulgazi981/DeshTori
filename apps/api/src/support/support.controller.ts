import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class TicketDto {
  @IsString() @MaxLength(120) subject: string;
  @IsString() @MaxLength(2000) text: string;
}
class ReplyDto {
  @IsString() @MaxLength(2000) text: string;
  @IsOptional() @IsIn(['OPEN', 'ANSWERED', 'CLOSED']) status?: string;
}
class ComplaintDto {
  @IsString() orderCode: string;
  @IsOptional() @IsString() itemId?: string;
  @IsIn(['DAMAGED', 'SHORT', 'WRONG_VARIANT', 'WRONG_ITEM', 'OTHER']) kind: string;
  @IsInt() @Min(1) qty: number;
  @IsIn(['REFUND', 'REPLACE', 'PARTIAL']) wants: string;
  @IsString() @MaxLength(1000) details: string;
  @IsOptional() @IsArray() @IsString({ each: true }) media?: string[];
}
class ResolveDto {
  @IsIn(['RESOLVED', 'REJECTED']) status: string;
  @IsString() @MaxLength(500) resolution: string;
  /** refund to the customer's wallet, in paisa */
  @IsOptional() @IsInt() @Min(0) refundPaisa?: number;
}

type Msg = { from: 'customer' | 'staff'; text: string; at: string; staffId?: string };

@Controller()
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private prisma: PrismaService, private audit: AuditService, private sms: SmsService) {}

  // ───── tickets ─────
  @Post('tickets') async open(@Req() r: AuthedRequest, @Body() d: TicketDto) {
    const n = await this.prisma.ticket.count();
    const messages: Msg[] = [{ from: 'customer', text: d.text, at: new Date().toISOString() }];
    return this.prisma.ticket.create({ data: { code: `TK-${1001 + n}`, userId: r.user.id, subject: d.subject, messages: messages as unknown as Prisma.InputJsonValue } });
  }
  @Get('tickets') mine(@Req() r: AuthedRequest) {
    return this.prisma.ticket.findMany({ where: { userId: r.user.id }, orderBy: { updatedAt: 'desc' } });
  }
  @Post('tickets/:code/reply') async reply(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: ReplyDto) {
    const t = await this.prisma.ticket.findUnique({ where: { code } });
    if (!t || t.userId !== r.user.id) throw new NotFoundException();
    if (t.status === 'CLOSED') throw new BadRequestException('TICKET_CLOSED');
    const messages = [...(t.messages as unknown as Msg[]), { from: 'customer', text: d.text, at: new Date().toISOString() }];
    return this.prisma.ticket.update({ where: { code }, data: { messages: messages as unknown as Prisma.InputJsonValue, status: 'OPEN' } });
  }

  @Get('admin/tickets') @UseGuards(RolesGuard) @Roles('BD_ORDER', 'BD_DELIVERY')
  list(@Query('status') status?: string) {
    return this.prisma.ticket.findMany({ where: status ? { status } : undefined, orderBy: { updatedAt: 'desc' }, take: 100, include: { user: { select: { name: true, phone: true, customerCode: true } } } });
  }
  @Post('admin/tickets/:code/reply') @UseGuards(RolesGuard) @Roles('BD_ORDER', 'BD_DELIVERY')
  async staffReply(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: ReplyDto) {
    const t = await this.prisma.ticket.findUnique({ where: { code }, include: { user: true } });
    if (!t) throw new NotFoundException();
    const messages = [...(t.messages as unknown as Msg[]), { from: 'staff', text: d.text, at: new Date().toISOString(), staffId: r.user.id }];
    const up = await this.prisma.ticket.update({ where: { code }, data: { messages: messages as unknown as Prisma.InputJsonValue, status: d.status ?? 'ANSWERED', assignee: r.user.id } });
    await this.sms.send(t.user.phone, `DeshTori: আপনার টিকেট ${t.code} এর উত্তর দেওয়া হয়েছে। দেখুন: deshtori.com/support`).catch(() => undefined);
    return up;
  }

  // ───── complaints ─────
  @Post('complaints') async complain(@Req() r: AuthedRequest, @Body() d: ComplaintDto) {
    const o = await this.prisma.order.findUnique({ where: { code: d.orderCode } });
    if (!o || o.userId !== r.user.id) throw new NotFoundException();
    if (!['ARRIVED_BD', 'DELIVERED'].includes(o.status)) throw new BadRequestException('NOT_DELIVERED_YET');
    const n = await this.prisma.complaint.count();
    const { orderCode, ...rest } = d;
    void orderCode;
    return this.prisma.complaint.create({ data: { ...rest, media: d.media ?? [], code: `CP-${1001 + n}`, userId: r.user.id, orderId: o.id } });
  }
  @Get('complaints') myComplaints(@Req() r: AuthedRequest) {
    return this.prisma.complaint.findMany({ where: { userId: r.user.id }, orderBy: { createdAt: 'desc' } });
  }

  @Get('admin/complaints') @UseGuards(RolesGuard) @Roles('BD_ORDER', 'BD_DELIVERY', 'ACCOUNTS')
  complaints(@Query('status') status?: string) {
    return this.prisma.complaint.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { name: true, phone: true, customerCode: true } } } });
  }

  @Patch('admin/complaints/:code') @UseGuards(RolesGuard) @Roles('BD_ORDER', 'ACCOUNTS')
  async resolve(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: ResolveDto) {
    const c = await this.prisma.complaint.findUnique({ where: { code }, include: { user: true } });
    if (!c) throw new NotFoundException();
    if (c.status !== 'REVIEW') throw new BadRequestException('ALREADY_RESOLVED');
    await this.prisma.$transaction(async (tx) => {
      await tx.complaint.update({ where: { code }, data: { status: d.status, resolution: d.resolution } });
      if (d.status === 'RESOLVED' && d.refundPaisa) {
        await tx.user.update({ where: { id: c.userId }, data: { walletPaisa: { increment: d.refundPaisa } } });
        await tx.walletTxn.create({ data: { userId: c.userId, type: 'REFUND', amount: d.refundPaisa, note: `অভিযোগ ${c.code}: ${d.resolution}`, orderId: c.orderId, createdBy: r.user.id } });
        await tx.ledgerEntry.create({ data: { kind: 'REFUND', category: 'COMPLAINT', amount: d.refundPaisa, orderId: c.orderId, note: c.code, createdBy: r.user.id } });
      }
    });
    await this.audit.log({ actorId: r.user.id, action: 'COMPLAINT_RESOLVE', entity: 'Complaint', entityId: c.id, after: d });
    await this.sms.send(c.user.phone, `DeshTori: অভিযোগ ${c.code} — ${d.resolution}${d.refundPaisa ? ` (৳${Math.round(d.refundPaisa / 100)} ওয়ালেটে ফেরত)` : ''}`).catch(() => undefined);
    return { ok: true };
  }
}
