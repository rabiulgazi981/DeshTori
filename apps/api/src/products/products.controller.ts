import { BadRequestException, Body, Controller, Get, Param, PipeTransform, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductsService } from './products.service';
import { Market } from './provider';
import { MAX_DATA_URL, saveImageDataUrl } from '../uploads/uploads.controller';

class SearchQuery {
  @IsString() @MaxLength(200) q: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @IsIn(['ALL', 'M1688', 'TAOBAO', 'TMALL']) market?: Market | 'ALL';
  @IsOptional() @IsIn(['relevance', 'price_asc', 'price_desc', 'sales']) sort?: 'relevance' | 'price_asc' | 'price_desc' | 'sales';
}

class LinkDto {
  @IsUrl() url: string;
}

/** Either an already-uploaded image URL, or the picked file itself as a data URL (guests). */
class ImageDto {
  @IsOptional() @IsUrl({ require_tld: false }) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(MAX_DATA_URL) dataUrl?: string;
  @IsOptional() @Type(() => Number) page?: number;
}

/** Accepts TMALL / tmall / Tmall, and 1688 as M1688. */
const MARKETS: Record<string, Market> = { M1688: 'M1688', '1688': 'M1688', TAOBAO: 'TAOBAO', TMALL: 'TMALL' };
class MarketPipe implements PipeTransform<string, Market> {
  transform(v: string): Market {
    const m = MARKETS[String(v ?? '').toUpperCase()];
    if (!m) throw new BadRequestException('UNKNOWN_MARKET');
    return m;
  }
}

/** Client IP behind Render + the Next.js /api proxy (first X-Forwarded-For entry). */
const clientIp = (req: Request) => {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
};

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get('search')
  search(@Query() q: SearchQuery) {
    return this.products.search(q.q, { page: q.page, market: q.market, sort: q.sort });
  }

  @Post('resolve-link')
  resolve(@Body() dto: LinkDto) {
    return this.products.fromLink(dto.url);
  }

  /** Open to guests (no login); rate limited per IP. */
  @Post('search-image')
  async searchImage(@Req() req: Request, @Body() dto: ImageDto) {
    if (!dto.imageUrl && !dto.dataUrl) throw new BadRequestException('IMAGE_ONLY');
    await this.products.imageSearchAllowed(clientIp(req));
    // validate type / size / magic bytes before saving; the provider fetches it from PUBLIC_API_URL/uploads
    const imageUrl = dto.dataUrl ? saveImageDataUrl(dto.dataUrl) : dto.imageUrl!;
    return this.products.searchByImage(imageUrl, { page: dto.page });
  }

  @Get(':market/:id')
  detail(@Param('market', new MarketPipe()) market: Market, @Param('id') id: string) {
    if (!/^\d{1,20}$/.test(id)) throw new BadRequestException('BAD_PRODUCT_ID');
    return this.products.detail(market, id);
  }
}
