import { BadRequestException, Body, Controller, Get, Logger, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsString, Min } from 'class-validator';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';

/**
 * Online payment gateways. All keys live ONLY in the server .env
 * (BKASH_*, SSLCZ_*) – never in the website code or the browser.
 *
 *  - bKash Tokenized Checkout
 *  - SSLCommerz (cards, Nagad, Rocket, internet banking)
 *  - MOCK (GATEWAY_MOCK=true, development only – pays instantly)
 */
type Method = 'BKASH_GATEWAY' | 'SSLCOMMERZ' | 'MOCK';

class InitDto {
  @IsString() orderCode: string;
  @IsIn(['BKASH_GATEWAY', 'SSLCOMMERZ', 'MOCK']) method: Method;
  @IsInt() @Min(100) amount: number; // paisa
}

const apiBase = () => process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
const webBase = () => (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0];
const taka = (paisa: number) => (paisa / 100).toFixed(2);

// ───────────── bKash ─────────────
class Bkash {
  private base = process.env.BKASH_BASE_URL ?? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
  static configured = () => !!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME && process.env.BKASH_PASSWORD);

  private async token() {
    const r = await fetch(`${this.base}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', username: process.env.BKASH_USERNAME!, password: process.env.BKASH_PASSWORD! },
      body: JSON.stringify({ app_key: process.env.BKASH_APP_KEY, app_secret: process.env.BKASH_APP_SECRET }),
    });
    const j = (await r.json()) as { id_token?: string; statusMessage?: string };
    if (!j.id_token) throw new BadRequestException('BKASH_TOKEN_FAILED');
    return j.id_token;
  }
  private headers(token: string) {
    return { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: token, 'X-APP-Key': process.env.BKASH_APP_KEY! };
  }
  async create(sessionId: string, amount: number, invoice: string, payer: string) {
    const token = await this.token();
    const r = await fetch(`${this.base}/tokenized/checkout/create`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ mode: '0011', payerReference: payer, callbackURL: `${apiBase()}/gateway/bkash/callback?s=${sessionId}`, amount: taka(amount), currency: 'BDT', intent: 'sale', merchantInvoiceNumber: invoice }),
    });
    const j = (await r.json()) as { bkashURL?: string; paymentID?: string };
    if (!j.bkashURL || !j.paymentID) throw new BadRequestException('BKASH_CREATE_FAILED');
    return { redirectUrl: j.bkashURL, externalId: j.paymentID };
  }
  async execute(paymentID: string) {
    const token = await this.token();
    const r = await fetch(`${this.base}/tokenized/checkout/execute`, { method: 'POST', headers: this.headers(token), body: JSON.stringify({ paymentID }) });
    return (await r.json()) as { transactionStatus?: string; trxID?: string; amount?: string };
  }
}

// ───────────── SSLCommerz ─────────────
class Sslcz {
  private base = process.env.SSLCZ_BASE_URL ?? 'https://sandbox.sslcommerz.com';
  static configured = () => !!(process.env.SSLCZ_STORE_ID && process.env.SSLCZ_STORE_PASSWORD);

  async create(sessionId: string, amount: number, invoice: string, cus: { name: string; phone: string }) {
    const f = new URLSearchParams({
      store_id: process.env.SSLCZ_STORE_ID!,
      store_passwd: process.env.SSLCZ_STORE_PASSWORD!,
      total_amount: taka(amount),
      currency: 'BDT',
      tran_id: sessionId,
      success_url: `${apiBase()}/gateway/sslcz/return`,
      fail_url: `${apiBase()}/gateway/sslcz/return`,
      cancel_url: `${apiBase()}/gateway/sslcz/return`,
      ipn_url: `${apiBase()}/gateway/sslcz/return`,
      cus_name: cus.name,
      cus_phone: cus.phone,
      cus_email: 'customer@deshtori.com',
      cus_add1: 'Bangladesh',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      product_name: invoice,
      product_category: 'general',
      product_profile: 'general',
    });
    const r = await fetch(`${this.base}/gwprocess/v4/api.php`, { method: 'POST', body: f });
    const j = (await r.json()) as { GatewayPageURL?: string; sessionkey?: string };
    if (!j.GatewayPageURL) throw new BadRequestException('SSLCZ_CREATE_FAILED');
    return { redirectUrl: j.GatewayPageURL, externalId: j.sessionkey };
  }
  async validate(valId: string) {
    const q = new URLSearchParams({ val_id: valId, store_id: process.env.SSLCZ_STORE_ID!, store_passwd: process.env.SSLCZ_STORE_PASSWORD!, format: 'json' });
    const r = await fetch(`${this.base}/validator/api/validationserverAPI.php?${q}`);
    return (await r.json()) as { status?: string; tran_id?: string; amount?: string; bank_tran_id?: string };
  }
}

@Controller('gateway')
export class GatewayController {
  private log = new Logger('Gateway');
  private bkash = new Bkash();
  private sslcz = new Sslcz();

  constructor(private prisma: PrismaService, private payments: PaymentsService, private orders: OrdersService) {}

  /** Which online methods are switched on (no secrets – just yes/no). */
  @Get('methods') async methods() {
    const row = await this.prisma.setting.findUnique({ where: { key: 'content.gateways' } });
    const show = (row?.value ?? {}) as { bkashOn?: boolean; sslczOn?: boolean; manualOn?: boolean };
    return {
      BKASH_GATEWAY: Bkash.configured() && show.bkashOn !== false,
      SSLCOMMERZ: Sslcz.configured() && show.sslczOn !== false,
      MANUAL: show.manualOn !== false,
      MOCK: process.env.GATEWAY_MOCK === 'true' && process.env.NODE_ENV !== 'production',
    };
  }

  @Post('init') @UseGuards(JwtAuthGuard)
  async init(@Req() r: AuthedRequest, @Body() d: InitDto) {
    const o = await this.prisma.order.findUnique({ where: { code: d.orderCode }, include: { charges: true, user: true } });
    if (!o || o.userId !== r.user.id) throw new NotFoundException();
    const due = this.orders.billFor(o).due;
    if (d.amount > due) throw new BadRequestException('MORE_THAN_DUE');
    const on = await this.methods();
    if (!on[d.method]) throw new BadRequestException('GATEWAY_NOT_CONFIGURED');
    const s = await this.prisma.gatewaySession.create({ data: { userId: r.user.id, orderId: o.id, method: d.method, amount: d.amount } });
    let out: { redirectUrl: string; externalId?: string };
    if (d.method === 'BKASH_GATEWAY') out = await this.bkash.create(s.id, d.amount, o.code, o.user.phone);
    else if (d.method === 'SSLCOMMERZ') out = await this.sslcz.create(s.id, d.amount, o.code, { name: o.user.name ?? 'Customer', phone: o.user.phone });
    else out = { redirectUrl: `${apiBase()}/gateway/mock/pay?s=${s.id}` };
    await this.prisma.gatewaySession.update({ where: { id: s.id }, data: { externalId: out.externalId } });
    return { redirectUrl: out.redirectUrl };
  }

  private async finish(sessionId: string, ok: boolean, trxId: string | undefined, raw: unknown, res: Response) {
    const s = await this.prisma.gatewaySession.findUnique({ where: { id: sessionId } });
    if (!s) return res.redirect(`${webBase()}/pay/result?ok=0`);
    const order = await this.prisma.order.findUnique({ where: { id: s.orderId }, select: { code: true } });
    if (s.status !== 'INIT') return res.redirect(`${webBase()}/pay/result?ok=${s.status === 'PAID' ? 1 : 0}&order=${order?.code}`);
    // mark first so a double callback can never credit twice
    const claimed = await this.prisma.gatewaySession.updateMany({ where: { id: s.id, status: 'INIT' }, data: { status: ok ? 'PAID' : 'FAILED', raw: raw as never } });
    if (claimed.count === 1 && ok) {
      await this.payments.recordConfirmed({ orderId: s.orderId, userId: s.userId, method: s.method === 'MOCK' ? 'BKASH_GATEWAY' : (s.method as 'BKASH_GATEWAY' | 'SSLCOMMERZ'), amount: s.amount, trxId, raw });
    }
    return res.redirect(`${webBase()}/pay/result?ok=${ok ? 1 : 0}&order=${order?.code}`);
  }

  @Get('bkash/callback') async bkashCallback(@Query('s') sid: string, @Query('paymentID') paymentID: string, @Query('status') status: string, @Res() res: Response) {
    const s = await this.prisma.gatewaySession.findUnique({ where: { id: sid } });
    if (!s || s.externalId !== paymentID) return res.redirect(`${webBase()}/pay/result?ok=0`);
    if (status !== 'success') return this.finish(sid, false, undefined, { status }, res);
    const ex = await this.bkash.execute(paymentID).catch((e) => (this.log.error(e), {} as Record<string, string>));
    const ok = ex.transactionStatus === 'Completed' && Math.round(Number(ex.amount) * 100) === s.amount;
    return this.finish(sid, ok, ex.trxID, ex, res);
  }

  /** SSLCommerz posts the result here; we never trust the post – we re-validate with SSLCommerz. */
  @Post('sslcz/return') async sslczReturn(@Body() b: { val_id?: string; tran_id?: string; status?: string }, @Res() res: Response) {
    if (!b?.tran_id) return res.redirect(`${webBase()}/pay/result?ok=0`);
    if (!b.val_id || b.status !== 'VALID') return this.finish(b.tran_id, false, undefined, b, res);
    const s = await this.prisma.gatewaySession.findUnique({ where: { id: b.tran_id } });
    const v = await this.sslcz.validate(b.val_id).catch(() => ({}) as Record<string, string>);
    const ok = !!s && (v.status === 'VALID' || v.status === 'VALIDATED') && v.tran_id === s.id && Math.round(Number(v.amount) * 100) === s.amount;
    return this.finish(b.tran_id, ok, v.bank_tran_id, v, res);
  }

  @Get('mock/pay') async mock(@Query('s') sid: string, @Res() res: Response) {
    if (!(await this.methods()).MOCK) throw new NotFoundException();
    return this.finish(sid, true, `MOCK-${Date.now()}`, { mock: true }, res);
  }
}
