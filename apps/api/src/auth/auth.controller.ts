import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto, OtpRequestDto, PhoneDto, RegisterDto, ResetDto, StaffVerifyDto } from './dto';
import { AUTH_COOKIE, AuthedRequest, JwtAuthGuard } from './guards';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  private async startSession(user: User, req: Request, res: Response) {
    const { token, maxAgeMs } = await this.auth.issueSession(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    res.cookie(AUTH_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: maxAgeMs, path: '/' });
    return { user: this.auth.publicUser(user) };
  }

  @Post('check-phone') @HttpCode(200)
  check(@Body() dto: PhoneDto) {
    return this.auth.checkPhone(dto.phone);
  }

  @Post('otp') @HttpCode(200)
  otp(@Body() dto: OtpRequestDto, @Req() req: Request) {
    return this.auth.requestOtp(dto.phone, dto.purpose, req.ip);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    return this.startSession(user, req, res);
  }

  @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.phone, dto.password, req.ip);
    if (r.needOtp) return r; // staff → 2FA
    return this.startSession(r.user, req, res);
  }

  @Post('staff/verify') @HttpCode(200)
  async staffVerify(@Body() dto: StaffVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.staffVerify(dto.phone, dto.code);
    return this.startSession(user, req, res);
  }

  @Post('password/reset') @HttpCode(200)
  async reset(@Body() dto: ResetDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.resetPassword(dto.phone, dto.code, dto.password);
    return this.startSession(user, req, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthedRequest) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    return { user: this.auth.publicUser(u) };
  }

  @Post('logout') @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.revoke(req.user.sid);
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }
}
