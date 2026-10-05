import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { OtpPurpose, User } from '@prisma/client';
import { normalizeBdPhone } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../prisma/redis.service';
import { SmsService } from '../notify/sms.service';
import { AuditService } from '../prisma/audit.service';
import { JwtUser } from './guards';

const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_FAILS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private log = new Logger('Auth');
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private sms: SmsService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  phoneOrThrow(raw: string): string {
    const p = normalizeBdPhone(raw);
    if (!p) throw new BadRequestException('INVALID_PHONE');
    return p;
  }

  /** Step 1 of the login page: new number → OTP flow, existing → password. */
  async checkPhone(raw: string) {
    const phone = this.phoneOrThrow(raw);
    const u = await this.prisma.user.findUnique({ where: { phone }, select: { passwordHash: true, kind: true } });
    return { phone, exists: !!u?.passwordHash, staff: u?.kind === 'STAFF' };
  }

  private hashOtp(phone: string, code: string) {
    return createHmac('sha256', process.env.JWT_SECRET ?? 'dev').update(`${phone}:${code}`).digest('hex');
  }

  /** OTP is only sent for: new account, forgotten password, staff 2FA (saves SMS cost). */
  async sendOtp(phone: string, purpose: OtpPurpose, ip?: string) {
    if ((await this.cache.incr(`otp:cool:${phone}`, 60)) > 1) throw new HttpException('OTP_WAIT_60S', HttpStatus.TOO_MANY_REQUESTS);
    if ((await this.cache.incr(`otp:day:${phone}`, 86_400)) > 5) throw new HttpException('OTP_DAILY_LIMIT', HttpStatus.TOO_MANY_REQUESTS);
    if (ip && (await this.cache.incr(`otp:ip:${ip}`, 3_600)) > 20) throw new HttpException('OTP_IP_LIMIT', HttpStatus.TOO_MANY_REQUESTS);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.create({
      data: { phone, purpose, codeHash: this.hashOtp(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
    });
    await this.sms.send(phone, `DeshTori কোড: ${code}। ${OTP_TTL_MIN} মিনিট কাজ করবে। কাউকে বলবেন না।`);
    const echo = process.env.OTP_DEV_ECHO === 'true' && process.env.NODE_ENV !== 'production';
    return { sent: true, ttlMinutes: OTP_TTL_MIN, ...(echo ? { devCode: code } : {}) };
  }

  async requestOtp(raw: string, purpose: 'REGISTER' | 'RESET_PASSWORD', ip?: string) {
    const phone = this.phoneOrThrow(raw);
    const u = await this.prisma.user.findUnique({ where: { phone } });
    if (purpose === 'REGISTER' && u?.passwordHash) throw new BadRequestException('ALREADY_REGISTERED');
    if (purpose === 'RESET_PASSWORD' && !u?.passwordHash) throw new BadRequestException('NOT_REGISTERED');
    return this.sendOtp(phone, purpose, ip);
  }

  private async consumeOtp(phone: string, purpose: OtpPurpose, code: string) {
    const otp = await this.prisma.otpCode.findFirst({ where: { phone, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date()) throw new BadRequestException('OTP_EXPIRED');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new BadRequestException('OTP_TOO_MANY_ATTEMPTS');
    if (otp.codeHash !== this.hashOtp(phone, code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException({ message: 'OTP_WRONG', triesLeft: OTP_MAX_ATTEMPTS - otp.attempts - 1 });
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  }

  private async nextCustomerCode(): Promise<string> {
    const n = await this.prisma.user.count({ where: { kind: 'CUSTOMER' } });
    return `DT-${2000 + n + 1}`;
  }

  async register(dto: { phone: string; code: string; name: string; email?: string; password: string; buyerType?: 'PERSONAL' | 'BUSINESS' }) {
    const phone = this.phoneOrThrow(dto.phone);
    await this.consumeOtp(phone, 'REGISTER', dto.code);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const user = await this.prisma.user.upsert({
          where: { phone },
          create: { phone, phoneVerified: true, name: dto.name, email: dto.email, passwordHash, buyerType: dto.buyerType, customerCode: await this.nextCustomerCode() },
          update: { phoneVerified: true, name: dto.name, email: dto.email, passwordHash, buyerType: dto.buyerType },
        });
        return user;
      } catch (e) {
        if (attempt === 2) throw e; // customerCode collision → retry
      }
    }
    throw new BadRequestException('REGISTER_FAILED');
  }

  async login(raw: string, password: string, ip?: string) {
    const phone = this.phoneOrThrow(raw);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user?.passwordHash) throw new UnauthorizedException('WRONG_CREDENTIALS');
    if (user.isBlocked) throw new ForbiddenException('ACCOUNT_BLOCKED');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new ForbiddenException({ message: 'ACCOUNT_LOCKED', until: user.lockedUntil });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const fails = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: fails >= LOGIN_MAX_FAILS ? 0 : fails, lockedUntil: fails >= LOGIN_MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      throw new UnauthorizedException({ message: 'WRONG_CREDENTIALS', triesLeft: Math.max(0, LOGIN_MAX_FAILS - fails) });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

    if (user.kind === 'STAFF') {
      // staff must pass OTP (2FA) before a session is issued
      await this.cache.set(`staff2fa:${phone}`, { userId: user.id }, 600);
      const r = await this.sendOtp(phone, 'STAFF_2FA', ip);
      return { needOtp: true as const, ...r };
    }
    return { needOtp: false as const, user };
  }

  async staffVerify(raw: string, code: string) {
    const phone = this.phoneOrThrow(raw);
    const pending = await this.cache.get<{ userId: string }>(`staff2fa:${phone}`);
    if (!pending) throw new UnauthorizedException('LOGIN_AGAIN');
    await this.consumeOtp(phone, 'STAFF_2FA', code);
    await this.cache.del(`staff2fa:${phone}`);
    return this.prisma.user.findUniqueOrThrow({ where: { id: pending.userId } });
  }

  async resetPassword(raw: string, code: string, password: string) {
    const phone = this.phoneOrThrow(raw);
    await this.consumeOtp(phone, 'RESET_PASSWORD', code);
    const user = await this.prisma.user.update({ where: { phone }, data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null } });
    await this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'PASSWORD_RESET', entity: 'User', entityId: user.id });
    return user;
  }

  async issueSession(user: User, meta: { ip?: string; userAgent?: string }) {
    const days = 30;
    const session = await this.prisma.session.create({
      data: { userId: user.id, ip: meta.ip, userAgent: meta.userAgent, expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    const payload: JwtUser = { id: user.id, kind: user.kind, roles: user.roles, sid: session.id };
    const token = await this.jwt.signAsync(payload, { expiresIn: `${days}d` });
    return { token, maxAgeMs: days * 86_400_000 };
  }

  async revoke(sid: string) {
    await this.prisma.session.update({ where: { id: sid }, data: { revokedAt: new Date() } }).catch(() => undefined);
  }

  publicUser(u: User) {
    return { id: u.id, phone: u.phone, name: u.name, email: u.email, kind: u.kind, roles: u.roles, customerCode: u.customerCode, walletPaisa: u.walletPaisa, buyerType: u.buyerType };
  }
}
