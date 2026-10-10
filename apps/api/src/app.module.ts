import { IntegrationsModule } from './integrations/integrations.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { NotifyModule } from './notify/notify.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AccountModule } from './account/account.module';
import { ExtrasModule } from './admin/extras.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    IntegrationsModule,
    SettingsModule,
    NotifyModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    AccountModule,
    ExtrasModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
