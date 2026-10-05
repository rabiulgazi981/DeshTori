import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductsService } from './products.service';
import { Market } from './provider';

class SearchQuery {
  @IsString() @MaxLength(200) q: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @IsIn(['ALL', 'M1688', 'TAOBAO', 'TMALL']) market?: Market | 'ALL';
  @IsOptional() @IsIn(['relevance', 'price_asc', 'price_desc', 'sales']) sort?: 'relevance' | 'price_asc' | 'price_desc' | 'sales';
}

class LinkDto {
  @IsUrl() url: string;
}

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

  @Get(':market/:id')
  detail(@Param('market', new ParseEnumPipe({ M1688: 'M1688', TAOBAO: 'TAOBAO', TMALL: 'TMALL' })) market: Market, @Param('id') id: string) {
    return this.products.detail(market, id);
  }
}
