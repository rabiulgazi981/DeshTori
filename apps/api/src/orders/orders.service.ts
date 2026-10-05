import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryMethod, OrderStatus, Prisma, ShipMode } from '@prisma/client';
import { canTransition, Coupon as QCoupon, quoteCheckout, Role, STATUS_LABEL_BN, summarizeBill, BillLine } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';

export interface CheckoutInput {
  advancePercent: number;
  couponCode?: string;
  addressId: string;
  deliveryMethod: DeliveryMethod;
  note?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cart: CartService,
    private settings: SettingsService,
    private audit: AuditService,
    private sms: SmsService,
  ) {}

  private async loadCoupon(code: string | undefined, userId: string): Promise<QCoupon | undefined> {
    if (!code) return undefined;
    const c = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();
    if (!c || !c.active || (c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt < now)) throw new BadRequestException('COUPON_INVALID');
    if (c.usageLimit && c.used >= c.usageLimit) throw new BadRequestException('COUPON_USED_UP');
    if (c.firstOrderOnly && (await this.prisma.order.count({ where: { userId } })) > 0) throw new BadRequestException('COUPON_FIRST_ORDER_ONLY');
    if (c.type !== 'PERCENT' && c.type !== 'FLAT') throw new BadRequestException('COUPON_NOT_FOR_PRODUCTS');
    return { code: c.code, type: c.type, value: c.value, minOrderPaisa: c.minOrder ?? undefined, maxDiscountPaisa: c.maxDiscount ?? undefined };
  }

  private async nextOrderCode(tx: Prisma.TransactionClient) {
    const n = await tx.order.count();
    return `DT-${10001 + n}`;
  }

  /** Quote shown on the checkout page (same maths the order will use). */
  async quote(userId: string, advancePercent: number, couponCode?: string) {
    const cart = await this.cart.view(userId);
    const plan = cart.advancePlans.find((p) => p.percent === advancePercent);
    if (!plan) throw new BadRequestException('INVALID_PLAN');
    const lines = cart.groups.flatMap((g) => g.rows.map((r) => ({ unitPaisa: r.unitPaisa, qty: r.qty })));
    const coupon = await this.loadCoupon(couponCode, userId).catch((e: Error) => {
      throw e;
    });
    return quoteCheckout(lines, plan, coupon);
  }

  async checkout(userId: string, input: CheckoutInput) {
    const s = await this.settings.get();
    const plan = s.advancePlans.find((p) => p.percent === input.advancePercent);
    if (!plan) throw new BadRequestException('INVALID_PLAN');
    const address = await this.prisma.address.findFirst({ where: { id: input.addressId, userId } });
    if (!address) throw new BadRequestException('ADDRESS_REQUIRED');
    const cart = await this.cart.view(userId);
    const rows = cart.groups.flatMap((g) => g.rows.map((r) => ({ g, r })));
    if (!rows.length) throw new BadRequestException('CART_EMPTY');
    if (rows.some(({ r }) => !r.inStock)) throw new BadRequestException('ITEM_OUT_OF_STOCK');

    const coupon = await this.loadCoupon(input.couponCode, userId);
    const all = quoteCheckout(rows.map(({ r }) => ({ unitPaisa: r.unitPaisa, qty: r.qty })), plan, coupon);
    if (coupon && all.couponError) throw new BadRequestException(all.couponError);

    // Air and Sea arrive at different times → separate orders
    const byMode = new Map<ShipMode, typeof rows>();
    for (const x of rows) byMode.set(x.r.shipMode, [...(byMode.get(x.r.shipMode) ?? []), x]);

    const orders = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const [mode, list] of byMode) {
        const q = quoteCheckout(list.map(({ r }) => ({ unitPaisa: r.unitPaisa, qty: r.qty })), plan);
        // share the coupon discount proportionally
        const couponShare = all.subtotal ? Math.round((all.couponDiscount * q.subtotal) / all.subtotal) : 0;
        const net = Math.max(0, q.net - couponShare);
        const payNow = Math.round((net * plan.percent) / 100);
        const order = await tx.order.create({
          data: {
            code: await this.nextOrderCode(tx),
            userId,
            shipMode: mode,
            cnyRate: s.pricing.cnyRate,
            marginPct: s.pricing.marginPct,
            advancePct: plan.percent,
            advanceDiscPct: plan.discountPct,
            couponCode: coupon?.code,
            subtotalPaisa: q.subtotal,
            discountPaisa: q.advanceDiscount,
            couponPaisa: couponShare,
            payNowPaisa: payNow,
            deliveryMethod: input.deliveryMethod,
            addressSnapshot: { label: address.label, name: address.name, phone: address.phone, district: address.district, area: address.area, line: address.line },
            note: input.note,
            items: {
              create: list.map(({ g, r }) => ({
                productId: g.productId,
                title: g.title,
                image: g.image,
                sourceUrl: g.sourceUrl,
                skuId: r.skuId,
                skuLabel: r.label,
                qty: r.qty,
                unitFen: r.unitFen,
                unitPaisa: r.unitPaisa,
              })),
            },
            events: { create: { toStatus: 'PENDING_PAYMENT', note: 'অর্ডার তৈরি', actorId: userId } },
          },
        });
        created.push(order);
      }
      if (coupon) await tx.coupon.update({ where: { code: coupon.code }, data: { used: { increment: 1 } } });
      await tx.cartItem.deleteMany({ where: { userId } });
      return created;
    });
    return { orders: orders.map((o) => ({ code: o.code, shipMode: o.shipMode, payNowPaisa: o.payNowPaisa })), payNowTotal: orders.reduce((a, o) => a + o.payNowPaisa, 0) };
  }

  /** Bill lines for an order (product part + charges added later). */
  billFor(o: Prisma.OrderGetPayload<{ include: { charges: true } }>) {
    const lines: BillLine[] = [
      { code: 'PRODUCT', label: 'পণ্যের দাম', amount: o.subtotalPaisa },
      ...(o.discountPaisa ? [{ code: 'ADVANCE_DISCOUNT' as const, label: `অ্যাডভান্স ছাড় (${o.advanceDiscPct}%)`, amount: -o.discountPaisa }] : []),
      ...(o.couponPaisa ? [{ code: 'COUPON' as const, label: `কুপন ${o.couponCode}`, amount: -o.couponPaisa }] : []),
      ...o.charges.map((c) => ({ code: c.code as BillLine['code'], label: c.label, amount: c.amount })),
    ];
    return summarizeBill(lines, o.paidPaisa);
  }

  async mine(userId: string) {
    const list = await this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { items: true, charges: true } });
    return list.map((o) => ({ code: o.code, createdAt: o.createdAt, status: o.status, statusBn: STATUS_LABEL_BN[o.status], shipMode: o.shipMode, advancePct: o.advancePct, images: o.items.slice(0, 3).map((i) => i.image), bill: this.billFor(o) }));
  }

  async oneForCustomer(userId: string, code: string) {
    const o = await this.prisma.order.findUnique({ where: { code }, include: { items: true, charges: true, events: { where: { internal: false }, orderBy: { createdAt: 'asc' } }, qcPhotos: true, decisions: true } });
    if (!o || o.userId !== userId) throw new NotFoundException();
    const { cnyRate, marginPct, ...safe } = o; // never expose supplier rate to customers
    void cnyRate;
    void marginPct;
    return { ...safe, items: o.items.map(({ unitFen, actualFen, ...i }) => (void unitFen, void actualFen, i)), bill: this.billFor(o) };
  }

  // ───────── staff ─────────

  adminList(status?: OrderStatus, take = 50, skip = 0) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { user: { select: { name: true, phone: true, customerCode: true } }, items: true },
    });
  }

  async changeStatus(code: string, to: OrderStatus, actor: { id: string; roles: string[] }, note?: string, notify = true) {
    const o = await this.prisma.order.findUnique({ where: { code }, include: { user: true } });
    if (!o) throw new NotFoundException();
    const role = (actor.roles.includes('OWNER') ? 'OWNER' : actor.roles[0]) as Role;
    const allowed = actor.roles.some((r) => canTransition(o.status, to, r as Role)) || canTransition(o.status, to, role);
    if (!allowed) throw new ForbiddenException(`CANNOT_MOVE_${o.status}_TO_${to}`);
    const updated = await this.prisma.order.update({
      where: { code },
      data: { status: to, events: { create: { fromStatus: o.status, toStatus: to, note, actorId: actor.id } } },
    });
    await this.audit.log({ actorId: actor.id, action: 'ORDER_STATUS', entity: 'Order', entityId: o.id, before: { status: o.status }, after: { status: to, note } });
    if (notify) {
      await this.sms.send(o.user.phone, `DeshTori: আপনার অর্ডার ${o.code} এখন "${STATUS_LABEL_BN[to]}"। বিস্তারিত: deshtori.com/account`).catch(() => undefined);
    }
    return updated;
  }

  async addCharge(code: string, charge: { code: string; label: string; amount: number }, actorId: string) {
    const o = await this.prisma.order.findUnique({ where: { code } });
    if (!o) throw new NotFoundException();
    const c = await this.prisma.orderCharge.create({ data: { orderId: o.id, ...charge, createdBy: actorId } });
    await this.audit.log({ actorId, action: 'ORDER_CHARGE', entity: 'Order', entityId: o.id, after: charge });
    return c;
  }
}
