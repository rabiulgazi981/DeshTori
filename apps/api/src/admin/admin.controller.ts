import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Prisma, StaffRole } from '@prisma/client';
import { normalizeBdPhone, ROLES } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class WalletAdjustDto {
  @IsInt() amount: number; // paisa, +credit / -debit
  @IsString() @MaxLength(200) note: string;
}
class CustomerPatchDto {
  @IsOptional() @IsBoolean() isBlocked?: boolean;
  @IsOptional() @IsString() @MaxLength(500) internalNote?: string;
}
class CouponDto {
  @IsString() @MinLength(3) @MaxLength(30) code: string;
  @IsIn(['PERCENT', 'FLAT', 'FREIGHT_PERCENT', 'FREE_BD_DELIVERY']) type: string;
  @IsInt() @Min(0) value: number;
  @IsOptional() @IsInt() minOrder?: number;
  @IsOptional() @IsInt() maxDiscount?: number;
  @IsOptional() @IsInt() usageLimit?: number;
  @IsOptional() @IsInt() perUser?: number;
  @IsOptional() @IsBoolean() firstOrderOnly?: boolean;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class KeywordDto {
  @IsString() @MinLength(2) @MaxLength(60) keyword: string;
}
class FreightDto {
  @IsString() @MaxLength(60) nameBn: string;
  @IsString() @MaxLength(500) itemsBn: string;
  @IsInt() @Min(0) airPaisa: number;
  @IsInt() @Min(0) seaPaisa: number;
  @IsNumber() @Min(0) minKg: number;
  @IsBoolean() active: boolean;
}
class StaffDto {
  @IsString() phone: string;
  @IsString() @MaxLength(80) name: string;
  @IsArray() @ArrayMinSize(1) @IsIn(ROLES as unknown as string[], { each: true }) roles: string[];
  @IsString() @MinLength(8) password: string;
}
class StaffPatchDto {
  @IsOptional() @IsArray() @IsIn(ROLES as unknown as string[], { each: true }) roles?: string[];
  @IsOptional() @IsBoolean() isBlocked?: boolean;
}
class LedgerDto {
  @IsIn(['INCOME', 'EXPENSE', 'SUPPLIER', 'REFUND', 'TRANSFER']) kind: string;
  @IsString() @MaxLength(60) category: string;
  @IsInt() @Min(1) amount: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsString() orderCode?: string;
  /** set to correct a previous entry (entries are never edited or deleted) */
  @IsOptional() @IsString() correctsId?: string;
}
class WithdrawalDto {
  @IsIn(['SENT', 'REJECTED']) status: string;
  @IsOptional() @IsString() @MaxLength(40) trxId?: string;
}

/** Keys of free-form site content editable from the admin panel. */
export const CONTENT_KEYS = ['videos', 'banners', 'services', 'popup', 'seo', 'contact', 'blog', 'pages', 'campaign', 'smsTemplates', 'gateways', 'abandonedCart', 'categories', 'warehouses'] as const;
/** Content keys the public website may read. smsTemplates/gateways/abandonedCart stay staff-only. */
export const PUBLIC_CONTENT = ['videos', 'banners', 'services', 'popup', 'seo', 'contact', 'blog', 'pages', 'campaign', 'categories', 'warehouses'];

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private prisma: PrismaService, private audit: AuditService, private sms: SmsService) {}

  // ───── dashboard ─────
  @Get('dashboard') async dashboard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [byStatus, todayOrders, pendingPayments, openTickets, openComplaints, shipReqs, customers, income, decisions] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.complaint.count({ where: { status: 'REVIEW' } }),
      this.prisma.shipRequest.count({ where: { status: 'AWAITING_ARRIVAL' } }),
      this.prisma.user.count({ where: { kind: 'CUSTOMER' } }),
      this.prisma.ledgerEntry.aggregate({ where: { kind: 'INCOME', createdAt: { gte: startOfDay } }, _sum: { amount: true } }),
      this.prisma.decision.count({ where: { answer: 'PENDING' } }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      todayOrders,
      pendingPayments,
      openTickets,
      openComplaints,
      awaitingShipRequests: shipReqs,
      customers,
      todayIncomePaisa: income._sum.amount ?? 0,
      pendingDecisions: decisions,
    };
  }

  // ───── customers ─────
  @Get('customers') @Roles('BD_ORDER', 'ACCOUNTS', 'BD_DELIVERY')
  customers(@Query('q') q?: string, @Query('skip') skip?: string) {
    const where: Prisma.UserWhereInput = { kind: 'CUSTOMER' };
    if (q) where.OR = [{ phone: { contains: q } }, { name: { contains: q, mode: 'insensitive' } }, { customerCode: { contains: q, mode: 'insensitive' } }];
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: Number(skip ?? 0),
      select: { id: true, phone: true, name: true, customerCode: true, buyerType: true, walletPaisa: true, isBlocked: true, createdAt: true, _count: { select: { orders: true } } },
    });
  }

  @Get('customers/:id') @Roles('BD_ORDER', 'ACCOUNTS', 'BD_DELIVERY')
  async customer(@Param('id') id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, email: true, name: true, customerCode: true, buyerType: true, walletPaisa: true, isBlocked: true, internalNote: true, createdAt: true,
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 50, select: { code: true, status: true, createdAt: true, payNowPaisa: true, paidPaisa: true } },
        walletTxns: { orderBy: { createdAt: 'desc' }, take: 50 },
        cart: { select: { productId: true, skuLabel: true, qty: true, updatedAt: true } },
      },
    });
    if (!u) throw new NotFoundException();
    return u;
  }

  @Patch('customers/:id') @Roles('BD_ORDER')
  async patchCustomer(@Req() r: AuthedRequest, @Param('id') id: string, @Body() d: CustomerPatchDto) {
    const u = await this.prisma.user.update({ where: { id }, data: d });
    if (d.isBlocked) await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: r.user.id, action: 'CUSTOMER_UPDATE', entity: 'User', entityId: id, after: d });
    return { id: u.id, isBlocked: u.isBlocked };
  }

  @Post('customers/:id/wallet') @Roles('ACCOUNTS')
  async walletAdjust(@Req() r: AuthedRequest, @Param('id') id: string, @Body() d: WalletAdjustDto) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    if (u.walletPaisa + d.amount < 0) throw new BadRequestException('WALLET_NEGATIVE');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { walletPaisa: { increment: d.amount } } }),
      this.prisma.walletTxn.create({ data: { userId: id, type: 'ADJUSTMENT', amount: d.amount, note: d.note, createdBy: r.user.id } }),
    ]);
    await this.audit.log({ actorId: r.user.id, action: 'WALLET_ADJUST', entity: 'User', entityId: id, before: { wallet: u.walletPaisa }, after: d });
    return { balancePaisa: u.walletPaisa + d.amount };
  }

  /** Customers who left items in the cart (for the "abandoned cart" reminder). */
  @Get('abandoned-carts') @Roles('BD_ORDER')
  async abandoned(@Query('hours') hours?: string) {
    const before = new Date(Date.now() - Number(hours ?? 24) * 3600_000);
    const rows = await this.prisma.cartItem.findMany({ where: { updatedAt: { lt: before } }, include: { user: { select: { id: true, name: true, phone: true } } } });
    const by = new Map<string, { user: { id: string; name: string | null; phone: string }; items: number; lastAt: Date }>();
    for (const r of rows) {
      const e = by.get(r.userId) ?? { user: r.user, items: 0, lastAt: r.updatedAt };
      e.items += r.qty;
      if (r.updatedAt > e.lastAt) e.lastAt = r.updatedAt;
      by.set(r.userId, e);
    }
    return [...by.values()];
  }

  @Post('abandoned-carts/:userId/remind') @Roles('BD_ORDER')
  async remindCart(@Param('userId') userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException();
    await this.sms.send(u.phone, 'DeshTori: আপনার কার্টে পণ্য অপেক্ষা করছে। অর্ডার শেষ করুন: deshtori.com/cart');
    return { ok: true };
  }

  // ───── coupons ─────
  @Get('coupons') @Roles('BD_ORDER', 'ACCOUNTS') coupons() {
    return this.prisma.coupon.findMany({ orderBy: { code: 'asc' } });
  }
  @Post('coupons') @Roles('OWNER')
  async addCoupon(@Req() r: AuthedRequest, @Body() d: CouponDto) {
    const data = { ...d, code: d.code.toUpperCase(), startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null };
    const c = await this.prisma.coupon.upsert({ where: { code: data.code }, create: data, update: data });
    await this.audit.log({ actorId: r.user.id, action: 'COUPON_SAVE', entity: 'Coupon', entityId: c.id, after: d });
    return c;
  }

  // ───── blocked keywords ─────
  @Get('blocked-keywords') @Roles('BD_ORDER') keywords() {
    return this.prisma.blockedKeyword.findMany({ orderBy: { keyword: 'asc' } });
  }
  @Post('blocked-keywords') @Roles('OWNER')
  async addKeyword(@Req() r: AuthedRequest, @Body() d: KeywordDto) {
    const k = await this.prisma.blockedKeyword.upsert({ where: { keyword: d.keyword.toLowerCase() }, create: { keyword: d.keyword.toLowerCase() }, update: {} });
    await this.audit.log({ actorId: r.user.id, action: 'BLOCKED_ADD', entity: 'BlockedKeyword', entityId: k.id, after: d });
    return k;
  }
  @Delete('blocked-keywords/:id') @Roles('OWNER')
  async delKeyword(@Req() r: AuthedRequest, @Param('id') id: string) {
    await this.prisma.blockedKeyword.delete({ where: { id } });
    await this.audit.log({ actorId: r.user.id, action: 'BLOCKED_REMOVE', entity: 'BlockedKeyword', entityId: id });
    return { ok: true };
  }

  // ───── freight rates ─────
  @Get('freight') @Roles('SHIPMENT', 'ACCOUNTS') freight() {
    return this.prisma.freightCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }
  @Put('freight/:code') @Roles('OWNER')
  async saveFreight(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: FreightDto) {
    const before = await this.prisma.freightCategory.findUnique({ where: { code } });
    const f = await this.prisma.freightCategory.upsert({ where: { code }, create: { code, ...d }, update: d });
    await this.audit.log({ actorId: r.user.id, action: 'FREIGHT_SAVE', entity: 'FreightCategory', entityId: f.id, before, after: d });
    return f;
  }

  // ───── staff & roles ─────
  @Get('staff') @Roles('OWNER') staff() {
    return this.prisma.user.findMany({ where: { kind: 'STAFF' }, orderBy: { createdAt: 'asc' }, select: { id: true, phone: true, name: true, roles: true, isBlocked: true, createdAt: true } });
  }
  @Post('staff') @Roles('OWNER')
  async addStaff(@Req() r: AuthedRequest, @Body() d: StaffDto) {
    const phone = normalizeBdPhone(d.phone);
    if (!phone) throw new BadRequestException('INVALID_PHONE');
    if (!/[A-Za-z]/.test(d.password) || !/\d/.test(d.password)) throw new BadRequestException('WEAK_PASSWORD');
    const exists = await this.prisma.user.findUnique({ where: { phone } });
    if (exists) throw new BadRequestException('PHONE_ALREADY_USED');
    const u = await this.prisma.user.create({ data: { phone, phoneVerified: true, name: d.name, kind: 'STAFF', roles: d.roles as StaffRole[], passwordHash: await bcrypt.hash(d.password, 12) } });
    await this.audit.log({ actorId: r.user.id, action: 'STAFF_ADD', entity: 'User', entityId: u.id, after: { phone, roles: d.roles } });
    return { id: u.id, phone: u.phone, name: u.name, roles: u.roles };
  }
  @Patch('staff/:id') @Roles('OWNER')
  async patchStaff(@Req() r: AuthedRequest, @Param('id') id: string, @Body() d: StaffPatchDto) {
    if (id === r.user.id && (d.isBlocked || (d.roles && !d.roles.includes('OWNER')))) throw new BadRequestException('CANNOT_DEMOTE_SELF');
    const before = await this.prisma.user.findUnique({ where: { id }, select: { roles: true, isBlocked: true, kind: true } });
    if (!before || before.kind !== 'STAFF') throw new NotFoundException();
    const u = await this.prisma.user.update({ where: { id }, data: { ...(d.roles ? { roles: d.roles as StaffRole[] } : {}), ...(d.isBlocked !== undefined ? { isBlocked: d.isBlocked } : {}) } });
    await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }); // roles live in the token → force re-login
    await this.audit.log({ actorId: r.user.id, action: 'STAFF_UPDATE', entity: 'User', entityId: id, before, after: d });
    return { id: u.id, roles: u.roles, isBlocked: u.isBlocked };
  }

  @Get('audit') @Roles('OWNER')
  auditLog(@Query('entity') entity?: string, @Query('skip') skip?: string) {
    return this.prisma.auditLog.findMany({ where: entity ? { entity } : undefined, orderBy: { createdAt: 'desc' }, take: 100, skip: Number(skip ?? 0) });
  }

  // ───── accounts ─────
  @Get('ledger') @Roles('ACCOUNTS')
  async ledger(@Query('from') from?: string, @Query('to') to?: string) {
    const where: Prisma.LedgerEntryWhereInput = {};
    if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const [entries, sums] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.ledgerEntry.groupBy({ by: ['kind'], where, _sum: { amount: true } }),
    ]);
    const t = Object.fromEntries(sums.map((s) => [s.kind, s._sum.amount ?? 0])) as Record<string, number>;
    const out = (t.EXPENSE ?? 0) + (t.SUPPLIER ?? 0) + (t.REFUND ?? 0);
    return { entries, totals: t, netPaisa: (t.INCOME ?? 0) - out };
  }
  @Post('ledger') @Roles('ACCOUNTS')
  async addLedger(@Req() r: AuthedRequest, @Body() d: LedgerDto) {
    let orderId: string | undefined;
    if (d.orderCode) {
      const o = await this.prisma.order.findUnique({ where: { code: d.orderCode } });
      if (!o) throw new NotFoundException('ORDER_NOT_FOUND');
      orderId = o.id;
    }
    const { orderCode, ...rest } = d;
    void orderCode;
    const e = await this.prisma.ledgerEntry.create({ data: { ...rest, orderId, createdBy: r.user.id } });
    await this.audit.log({ actorId: r.user.id, action: 'LEDGER_ADD', entity: 'LedgerEntry', entityId: e.id, after: d });
    return e;
  }

  @Get('withdrawals') @Roles('ACCOUNTS') withdrawals() {
    return this.prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Patch('withdrawals/:id') @Roles('ACCOUNTS')
  async payWithdrawal(@Req() r: AuthedRequest, @Param('id') id: string, @Body() d: WithdrawalDto) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w || w.status !== 'PENDING') throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({ where: { id }, data: { status: d.status, trxId: d.trxId, sentAt: d.status === 'SENT' ? new Date() : null } });
      if (d.status === 'REJECTED') {
        // money was held when the request was made → give it back
        await tx.user.update({ where: { id: w.userId }, data: { walletPaisa: { increment: w.amount } } });
        await tx.walletTxn.create({ data: { userId: w.userId, type: 'ADJUSTMENT', amount: w.amount, note: 'উত্তোলন বাতিল – টাকা ফেরত', createdBy: r.user.id } });
      } else {
        await tx.ledgerEntry.create({ data: { kind: 'REFUND', category: 'WALLET_WITHDRAWAL', amount: w.amount, note: `${w.method} ${d.trxId ?? ''}`, createdBy: r.user.id } });
      }
    });
    await this.audit.log({ actorId: r.user.id, action: 'WITHDRAWAL_' + d.status, entity: 'Withdrawal', entityId: id, after: d });
    return { ok: true };
  }

  // ───── site content (videos, banners, popup, SEO…) ─────
  @Get('content/:key') @Roles('BD_ORDER')
  async content(@Param('key') key: string) {
    if (!(CONTENT_KEYS as readonly string[]).includes(key)) throw new NotFoundException();
    const row = await this.prisma.setting.findUnique({ where: { key: `content.${key}` } });
    return row?.value ?? null;
  }
  @Put('content/:key') @Roles('OWNER')
  async saveContent(@Req() r: AuthedRequest, @Param('key') key: string, @Body() body: { value: unknown }) {
    if (!(CONTENT_KEYS as readonly string[]).includes(key)) throw new NotFoundException();
    if (body?.value === undefined) throw new BadRequestException('VALUE_REQUIRED');
    if (JSON.stringify(body.value).length > 200_000) throw new BadRequestException('TOO_LARGE');
    const k = `content.${key}`;
    const value = body.value as Prisma.InputJsonValue;
    const before = await this.prisma.setting.findUnique({ where: { key: k } });
    await this.prisma.setting.upsert({ where: { key: k }, create: { key: k, value, updatedBy: r.user.id }, update: { value, updatedBy: r.user.id } });
    await this.audit.log({ actorId: r.user.id, action: 'CONTENT_SAVE', entity: 'Setting', entityId: k, before: before?.value, after: body.value });
    return { ok: true };
  }
}
