import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CacheService } from './redis.service';
import { AuditService } from './audit.service';

@Global()
@Module({ providers: [PrismaService, CacheService, AuditService], exports: [PrismaService, CacheService, AuditService] })
export class PrismaModule {}
