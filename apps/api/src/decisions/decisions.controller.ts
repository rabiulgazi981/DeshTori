import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class DecisionDto {
  @IsOptional() @IsString() itemId?: string;
  @IsString() @MaxLength(300) issue: string;
  @IsString() @MaxLength(300) proposal: string;
  @IsInt() diffPaisa: number;
}
class AnswerDto {
  @IsIn(['YES', 'NO']) answer: 'YES' | 'NO';
}

const siteUrl = () => process.env.PUBLIC_SITE_URL ?? 'https://deshtori.com';

/**
 * "Supplier problem" decisions: the purchase team asks the customer yes/no
 * (price changed, colour out of stock…). The customer answers from a link
 * in SMS/WhatsApp – no login needed, the random token is the key.
 */
@Controller()
export class DecisionsController {
  constructor(private prisma: PrismaService, private audit: AuditService, private sms: SmsService) {}

  @Post('admin/orders/:code/decisions') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('CN_PURCHASE', 'BD_ORDER')
  async ask(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: DecisionDto) {
    const o = await this.prisma.order.findUnique({ where: { code }, include: { user: true } });
    if (!o) throw new NotFoundException();
    const token = randomBytes(18).toString('base64url');
    const dec = await this.prisma.decision.create({ data: { orderId: o.id, ...d, token, createdBy: r.user.id } });
    if (o.status === 'PURCHASING') {
      await this.prisma.order.update({ where: { id: o.id }, data: { status: 'NEEDS_DECISION', events: { create: { fromStatus: o.status, toStatus: 'NEEDS_DECISION', note: d.issue, actorId: r.user.id } } } });
    }
    await this.audit.log({ actorId: r.user.id, action: 'DECISION_ASK', entity: 'Order', entityId: o.id, after: d });
    await this.sms.send(o.user.phone, `DeshTori: অর্ডার ${o.code} — ${d.issue}। প্রস্তাব: ${d.proposal}। হ্যাঁ/না জানান: ${siteUrl()}/d/${token}`).catch(() => undefined);
    return dec;
  }

  @Post('admin/decisions/:id/remind') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('CN_PURCHASE', 'BD_ORDER')
  async remind(@Param('id') id: string) {
    const dec = await this.prisma.decision.findUnique({ where: { id }, include: { order: { include: { user: true } } } });
    if (!dec || dec.answer !== 'PENDING') throw new NotFoundException();
    await this.prisma.decision.update({ where: { id }, data: { reminders: { increment: 1 } } });
    await this.sms.send(dec.order.user.phone, `DeshTori: অর্ডার ${dec.order.code} এর জন্য আপনার সিদ্ধান্ত দরকার: ${siteUrl()}/d/${dec.token}`).catch(() => undefined);
    return { ok: true };
  }

  /** Public – the yes/no page. Shows only what the customer needs. */
  @Get('decisions/:token') async view(@Param('token') token: string) {
    const d = await this.prisma.decision.findUnique({ where: { token }, include: { order: { select: { code: true, items: { select: { id: true, title: true, image: true, skuLabel: true, qty: true } } } } } });
    if (!d) throw new NotFoundException();
    const item = d.itemId ? d.order.items.find((i) => i.id === d.itemId) : undefined;
    return { orderCode: d.order.code, issue: d.issue, proposal: d.proposal, diffPaisa: d.diffPaisa, answer: d.answer, item };
  }

  @Post('decisions/:token') async answer(@Param('token') token: string, @Body() b: AnswerDto) {
    const d = await this.prisma.decision.findUnique({ where: { token }, include: { order: true } });
    if (!d) throw new NotFoundException();
    if (d.answer !== 'PENDING') throw new BadRequestException('ALREADY_ANSWERED');
    await this.prisma.$transaction(async (tx) => {
      await tx.decision.update({ where: { id: d.id }, data: { answer: b.answer, answeredVia: 'link', answeredAt: new Date() } });
      const stillOpen = await tx.decision.count({ where: { orderId: d.orderId, answer: 'PENDING' } });
      if (b.answer === 'YES' && d.diffPaisa) {
        await tx.orderCharge.create({ data: { orderId: d.orderId, code: 'ADJUSTMENT', label: `সিদ্ধান্ত: ${d.proposal}`, amount: d.diffPaisa } });
      }
      if (!stillOpen && d.order.status === 'NEEDS_DECISION') {
        await tx.order.update({ where: { id: d.orderId }, data: { status: 'PURCHASING', events: { create: { fromStatus: 'NEEDS_DECISION', toStatus: 'PURCHASING', note: `গ্রাহক উত্তর দিয়েছেন: ${b.answer === 'YES' ? 'হ্যাঁ' : 'না'}` } } } });
      }
    });
    return { ok: true, answer: b.answer };
  }
}
