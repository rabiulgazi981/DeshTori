import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { PUBLIC_CONTENT } from '../admin/admin.controller';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';

class WishDto {
  @IsIn(['M1688', 'TAOBAO', 'TMALL']) market: 'M1688' | 'TAOBAO' | 'TMALL';
  @IsString() @MaxLength(40) id: string;
}

@Controller()
export class WishlistController {
  constructor(private prisma: PrismaService, private products: ProductsService) {}

  @Get('wishlist') @UseGuards(JwtAuthGuard)
  list(@Req() r: AuthedRequest) {
    return this.prisma.wishlistItem.findMany({ where: { userId: r.user.id }, orderBy: { createdAt: 'desc' } });
  }

  /** Price is taken from our own product endpoint (BDT), never from the client. */
  @Post('wishlist') @UseGuards(JwtAuthGuard)
  async add(@Req() r: AuthedRequest, @Body() d: WishDto) {
    const p = await this.products.detail(d.market, d.id);
    const pricePaisa = Math.min(...p.skus.map((s: { pricePaisa: number }) => s.pricePaisa));
    const data = { userId: r.user.id, market: d.market, sourceId: d.id, title: p.title, image: p.images[0] ?? null, pricePaisa };
    return this.prisma.wishlistItem.upsert({ where: { userId_market_sourceId: { userId: r.user.id, market: d.market, sourceId: d.id } }, create: data, update: data });
  }

  @Delete('wishlist/:id') @UseGuards(JwtAuthGuard)
  remove(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.prisma.wishlistItem.deleteMany({ where: { id, userId: r.user.id } });
  }

  /** Public site content (videos, banners, popup, SEO, pages…). */
  @Get('content/:key')
  async content(@Param('key') key: string) {
    if (!PUBLIC_CONTENT.includes(key)) throw new NotFoundException();
    const row = await this.prisma.setting.findUnique({ where: { key: `content.${key}` } });
    return { value: row?.value ?? null };
  }
}
