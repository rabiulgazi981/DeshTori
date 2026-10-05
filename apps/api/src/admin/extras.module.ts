import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { AdminController } from './admin.controller';
import { OpsController } from './ops.controller';
import { ShipController } from '../ship/ship.controller';
import { DecisionsController } from '../decisions/decisions.controller';
import { InvoicesController } from '../invoices/invoices.controller';
import { SupportController } from '../support/support.controller';
import { GatewayController } from '../gateway/gateway.controller';
import { WishlistController } from '../wishlist/wishlist.controller';
import { UploadsController } from '../uploads/uploads.controller';

/** Admin panel + the customer features built on top of orders. */
@Module({
  imports: [OrdersModule, PaymentsModule, ProductsModule],
  controllers: [AdminController, OpsController, ShipController, DecisionsController, InvoicesController, SupportController, GatewayController, WishlistController, UploadsController],
})
export class ExtrasModule {}
