import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { ShipMode } from '@prisma/client';
import { CartService } from './cart.service';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';

class AddDto {
  @IsString() productId: string;
  @IsString() skuId: string;
  @IsInt() @Min(1) @Max(100000) qty: number;
  @IsIn(['AIR', 'SEA']) shipMode: ShipMode;
}
class QtyDto {
  @IsInt() @Min(0) @Max(100000) qty: number;
}

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cart: CartService) {}

  @Get() view(@Req() r: AuthedRequest) {
    return this.cart.view(r.user.id);
  }
  @Post() add(@Req() r: AuthedRequest, @Body() d: AddDto) {
    return this.cart.add(r.user.id, d.productId, d.skuId, d.qty, d.shipMode);
  }
  @Patch(':id') qty(@Req() r: AuthedRequest, @Param('id') id: string, @Body() d: QtyDto) {
    return this.cart.setQty(r.user.id, id, d.qty);
  }
  @Delete(':id') remove(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.cart.remove(r.user.id, id);
  }
}
