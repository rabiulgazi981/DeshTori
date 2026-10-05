import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ShipMode } from '@prisma/client';
import { cnyToBdt, pickTier, PriceTier } from '@deshtori/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

interface StoredSku {
  skuId: string;
  props: Record<string, string>;
  fen: number;
  promoFen?: number;
  stock: number;
}

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  async add(userId: string, productId: string, skuId: string, qty: number, shipMode: ShipMode) {
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) throw new NotFoundException('PRODUCT_NOT_FOUND');
    const sku = (p.skus as unknown as StoredSku[]).find((k) => k.skuId === skuId);
    if (!sku) throw new BadRequestException('SKU_NOT_FOUND');
    if (sku.stock <= 0) throw new BadRequestException('OUT_OF_STOCK');
    const skuLabel = Object.values(sku.props).join(' · ');
    return this.prisma.cartItem.upsert({
      where: { userId_productId_skuId: { userId, productId, skuId } },
      create: { userId, productId, skuId, skuLabel, qty, shipMode },
      update: { qty: { increment: qty }, shipMode },
    });
  }

  async setQty(userId: string, id: string, qty: number) {
    const item = await this.prisma.cartItem.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException();
    if (qty <= 0) return this.prisma.cartItem.delete({ where: { id } });
    return this.prisma.cartItem.update({ where: { id }, data: { qty } });
  }

  remove(userId: string, id: string) {
    return this.prisma.cartItem.deleteMany({ where: { id, userId } });
  }

  /**
   * Cart with LIVE prices. Quantity tiers are applied per product on the
   * total quantity of that product (all its SKUs together), like 1688 does.
   */
  async view(userId: string) {
    const items = await this.prisma.cartItem.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const s = await this.settings.get();
    const groups = products.map((p) => {
      const mine = items.filter((i) => i.productId === p.id);
      const totalQty = mine.reduce((a, i) => a + i.qty, 0);
      const tiers = (p.priceTiers ?? []) as unknown as PriceTier[];
      const tier = tiers.length ? pickTier(tiers, totalQty) : undefined;
      const skus = p.skus as unknown as StoredSku[];
      const rows = mine.map((i) => {
        const sku = skus.find((k) => k.skuId === i.skuId);
        const baseFen = sku ? (s.useOriginalPrice || !sku.promoFen ? sku.fen : sku.promoFen) : 0;
        // tier discount ratio applied to the SKU price
        const ratio = tier && tiers.length ? tier.fen / [...tiers].sort((a, b) => a.minQty - b.minQty)[0].fen : 1;
        const unitFen = Math.round(baseFen * ratio);
        return { id: i.id, skuId: i.skuId, label: i.skuLabel, qty: i.qty, shipMode: i.shipMode, unitFen, unitPaisa: cnyToBdt(unitFen, s.pricing), inStock: (sku?.stock ?? 0) > 0 };
      });
      return { productId: p.id, title: p.titleEn, image: p.images[0], market: p.marketplace, sourceId: p.sourceId, sourceUrl: p.sourceUrl, freightCategory: p.freightCategory, weightKg: p.weightKg, rows };
    });
    return { groups, advancePlans: s.advancePlans };
  }
}
