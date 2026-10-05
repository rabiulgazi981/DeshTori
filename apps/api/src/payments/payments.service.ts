import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../prisma/audit.service';
import { SmsService } from '../notify/sms.service';

const MANUAL: PaymentMethod[] = ['MANUAL_BKASH', 'MANUAL_NAGAD', 'MANUAL_BANK'];

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private sms: SmsService) {}

  /** Customer submits a manual payment (TrxID + screenshot); Accounts verifies later. */
  async submitManual(userId: string, d: { orderCode: string; method: PaymentMethod; amount: number; trxId: string; fromNumber?: string; screenshot?: string }) {
    if (!MANUAL.includes(d.method)) throw new BadRequestException('NOT_MANUAL_METHOD');
    const order = await this.prisma.order.findUnique({ where: { code: d.orderCode } });
    if (!order || order.userId !== userId) throw new NotFoundException();
    const dup = await this.prisma.payment.findFirst({ where: { trxId: d.trxId, method: d.method, status: { not: 'REJECTED' } } });
    if (dup) throw new BadRequestException('TRXID_ALREADY_USED');
    const p = await this.prisma.payment.create({ data: { orderId: order.id, userId, method: d.method, amount: d.amount, trxId: d.trxId, fromNumber: d.fromNumber, screenshot: d.screenshot } });
    if (order.status === 'PENDING_PAYMENT') {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_REVIEW', events: { create: { fromStatus: order.status, toStatus: 'PAYMENT_REVIEW', note: `${d.method} TrxID ${d.trxId}`, actorId: userId } } } });
    }
    return p;
  }

  pending() {
    return this.prisma.payment.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, include: { order: { select: { code: true, payNowPaisa: true } } } });
  }

  async verify(paymentId: string, ok: boolean, actorId: string) {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!p || p.status !== 'PENDING') throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: p.id }, data: { status: ok ? 'VERIFIED' : 'REJECTED', verifiedBy: actorId, verifiedAt: new Date() } });
      if (p.order) {
        if (ok) {
          await tx.order.update({
            where: { id: p.order.id },
            data: {
              paidPaisa: { increment: p.amount },
              ...(p.order.status === 'PAYMENT_REVIEW' || p.order.status === 'PENDING_PAYMENT'
                ? { status: 'NEW', events: { create: { fromStatus: p.order.status, toStatus: 'NEW', note: 'পেমেন্ট যাচাই হয়েছে', actorId } } }
                : {}),
            },
          });
          await tx.ledgerEntry.create({ data: { kind: 'INCOME', category: 'CUSTOMER_PAYMENT', amount: p.amount, orderId: p.order.id, note: `${p.method} ${p.trxId ?? ''}`, createdBy: actorId } });
        } else if (p.order.status === 'PAYMENT_REVIEW') {
          await tx.order.update({ where: { id: p.order.id }, data: { status: 'PENDING_PAYMENT', events: { create: { fromStatus: 'PAYMENT_REVIEW', toStatus: 'PENDING_PAYMENT', note: 'পেমেন্ট মেলেনি', actorId } } } });
        }
      }
    });
    await this.audit.log({ actorId, action: ok ? 'PAYMENT_VERIFY' : 'PAYMENT_REJECT', entity: 'Payment', entityId: p.id, after: { amount: p.amount, trxId: p.trxId } });
    const user = await this.prisma.user.findUnique({ where: { id: p.userId } });
    if (user) {
      const msg = ok ? `DeshTori: ৳${Math.round(p.amount / 100)} পেমেন্ট পাওয়া গেছে (${p.order?.code ?? ''})। ধন্যবাদ!` : `DeshTori: আপনার পেমেন্ট (TrxID ${p.trxId}) মেলানো যায়নি। অনুগ্রহ করে যোগাযোগ করুন 01938273878।`;
      await this.sms.send(user.phone, msg).catch(() => undefined);
    }
    return { ok: true };
  }

  /** Money that is already confirmed (gateway success or wallet): credit the order immediately. */
  async recordConfirmed(d: { orderId: string; userId: string; method: PaymentMethod; amount: number; trxId?: string; raw?: unknown; actorId?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id: d.orderId } });
    if (!order) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      if (d.method === 'WALLET') {
        const u = await tx.user.updateMany({ where: { id: d.userId, walletPaisa: { gte: d.amount } }, data: { walletPaisa: { decrement: d.amount } } });
        if (u.count !== 1) throw new BadRequestException('WALLET_LOW');
        await tx.walletTxn.create({ data: { userId: d.userId, type: 'ORDER_PAYMENT', amount: -d.amount, note: `অর্ডার ${order.code}`, orderId: order.id } });
      }
      await tx.payment.create({ data: { orderId: order.id, userId: d.userId, method: d.method, amount: d.amount, trxId: d.trxId, status: 'VERIFIED', verifiedAt: new Date(), verifiedBy: d.actorId ?? 'gateway', raw: (d.raw ?? undefined) as never } });
      const move = order.status === 'PENDING_PAYMENT' || order.status === 'PAYMENT_REVIEW';
      await tx.order.update({
        where: { id: order.id },
        data: {
          paidPaisa: { increment: d.amount },
          ...(move ? { status: 'NEW', events: { create: { fromStatus: order.status, toStatus: 'NEW', note: `${d.method} ${d.trxId ?? ''}`.trim(), actorId: d.userId } } } : {}),
        },
      });
      if (d.method !== 'WALLET') await tx.ledgerEntry.create({ data: { kind: 'INCOME', category: 'CUSTOMER_PAYMENT', amount: d.amount, orderId: order.id, note: `${d.method} ${d.trxId ?? ''}`, createdBy: d.actorId ?? 'gateway' } });
    });
    await this.audit.log({ actorId: d.userId, action: 'PAYMENT_CONFIRMED', entity: 'Order', entityId: order.id, after: { method: d.method, amount: d.amount, trxId: d.trxId } });
    return { ok: true, orderCode: order.code };
  }
}
