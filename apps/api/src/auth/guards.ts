import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtUser {
  id: string;
  kind: 'CUSTOMER' | 'STAFF';
  roles: string[];
  sid: string;
}
export type AuthedRequest = Request & { user: JwtUser };

export const AUTH_COOKIE = 'dt_session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = (req.cookies?.[AUTH_COOKIE] as string | undefined) ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException('LOGIN_REQUIRED');
    try {
      req.user = await this.jwt.verifyAsync<JwtUser>(token);
    } catch {
      throw new UnauthorizedException('SESSION_EXPIRED');
    }
    const s = await this.prisma.session.findUnique({ where: { id: req.user.sid }, select: { revokedAt: true, expiresAt: true } });
    if (!s || s.revokedAt || s.expiresAt < new Date()) throw new UnauthorizedException('SESSION_EXPIRED');
    return true;
  }
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const need = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || user.kind !== 'STAFF') throw new ForbiddenException('STAFF_ONLY');
    if (!need?.length || user.roles.includes('OWNER') || need.some((r) => user.roles.includes(r))) return true;
    throw new ForbiddenException('ROLE_REQUIRED');
  }
}
