import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryMethod, OrderStatus } from '@prisma/client';
import { ORDER_STATUSES } from '@deshtori/shared';
import { OrdersService } from './orders.service';
import { AuthedRequest, JwtAuthGuard, Roles, RolesGuard } from '../auth/guards';

class CheckoutDto {
  @IsIn([60, 80, 100]) advancePercent: number;
  @IsOptional() @IsString() @MaxLength(30) couponCode?: string;
  @IsString() addressId: string;
  @IsIn(['COURIER_HOME', 'OFFICE_PICKUP', 'CONDITION_COD', 'TRUCK']) deliveryMethod: DeliveryMethod;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
class QuoteQuery {
  @Type(() => Number) @IsIn([60, 80, 100]) advancePercent: number;
  @IsOptional() @IsString() couponCode?: string;
}
class StatusDto {
  @IsIn(ORDER_STATUSES as unknown as string[]) status: OrderStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsBoolean() notify?: boolean;
}
class ChargeDto {
  @IsIn(['CN_LOCAL_COURIER', 'PACKAGING', 'FREIGHT', 'EXTRA_SERVICE', 'BD_COURIER', 'ADJUSTMENT']) code: string;
  @IsString() @MaxLength(120) label: string;
  @IsInt() amount: number;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get('checkout/quote') quote(@Req() r: AuthedRequest, @Query() q: QuoteQuery) {
    return this.orders.quote(r.user.id, q.advancePercent, q.couponCode);
  }
  @Post('checkout') checkout(@Req() r: AuthedRequest, @Body() d: CheckoutDto) {
    return this.orders.checkout(r.user.id, d);
  }
  @Get('orders') mine(@Req() r: AuthedRequest) {
    return this.orders.mine(r.user.id);
  }
  @Get('orders/:code') one(@Req() r: AuthedRequest, @Param('code') code: string) {
    return this.orders.oneForCustomer(r.user.id, code);
  }

  // staff
  @Get('admin/orders') @UseGuards(RolesGuard) @Roles('BD_ORDER', 'CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY', 'ACCOUNTS')
  list(@Query('status') status?: OrderStatus, @Query('skip') skip?: string) {
    return this.orders.adminList(status, 50, Number(skip ?? 0));
  }
  @Patch('admin/orders/:code/status') @UseGuards(RolesGuard)
  status(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: StatusDto) {
    return this.orders.changeStatus(code, d.status, r.user, d.note, d.notify ?? true);
  }
  @Post('admin/orders/:code/charges') @UseGuards(RolesGuard) @Roles('CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY', 'ACCOUNTS')
  charge(@Req() r: AuthedRequest, @Param('code') code: string, @Body() d: ChargeDto) {
    return this.orders.addCharge(code, d, r.user.id);
  }
}
