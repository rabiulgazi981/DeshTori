import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { MediaService } from '../uploads/media.service';

/** MediaService lives here because image search stores the picked photo; ExtrasModule gets it through this import. */
@Module({ providers: [ProductsService, MediaService], controllers: [ProductsController], exports: [ProductsService, MediaService] })
export class ProductsModule {}
