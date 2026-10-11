import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../prisma/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthedRequest, JwtAuthGuard, RolesGuard } from '../auth/guards';
import { MEDIA_SELECT, MediaService, mediaUrl } from './media.service';
import { UploadDto } from './uploads.controller';

const PAGE = 60;

/** Admin media library ("মিডিয়া লাইব্রেরি"). Any staff may browse/upload; deletes are audited. */
@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private prisma: PrismaService, private media: MediaService, private audit: AuditService) {}

  /** ?q= name search · ?scope=LIBRARY (default) | UPLOAD | ALL · ?cursor= id of the last item */
  @Get()
  async list(@Query('q') q?: string, @Query('scope') scope?: string, @Query('cursor') cursor?: string) {
    const where: Prisma.MediaWhereInput = {};
    if (scope !== 'ALL') where.scope = scope === 'UPLOAD' ? 'UPLOAD' : 'LIBRARY';
    if (q?.trim()) where.name = { contains: q.trim().slice(0, 80), mode: 'insensitive' };
    const rows = await this.prisma.media.findMany({
      where,
      select: MEDIA_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const more = rows.length > PAGE;
    const items = rows.slice(0, PAGE).map((m) => ({ ...m, url: mediaUrl(m) }));
    return { items, next: more ? items[items.length - 1].id : null };
  }

  /** One image per request (JSON body limit is 6 MB); the admin UI loops for multi-upload. */
  @Post()
  async upload(@Req() r: AuthedRequest, @Body() d: UploadDto) {
    const m = await this.media.save(d.dataUrl, { name: d.name, scope: 'LIBRARY', userId: r.user.id });
    await this.audit.log({ actorId: r.user.id, action: 'MEDIA_UPLOAD', entity: 'Media', entityId: m.id, after: { name: m.name, size: m.size } });
    return m;
  }

  @Delete(':id')
  async remove(@Req() r: AuthedRequest, @Param('id') id: string) {
    const m = await this.prisma.media.findUnique({ where: { id }, select: MEDIA_SELECT });
    if (!m) throw new NotFoundException();
    // customer uploads (payment screenshots, QC photos) are evidence: only the owner may remove them
    if (m.scope !== 'LIBRARY' && !r.user.roles.includes('OWNER')) throw new ForbiddenException('ROLE_REQUIRED');
    await this.prisma.media.delete({ where: { id } });
    this.media.forget(id);
    await this.audit.log({ actorId: r.user.id, action: 'MEDIA_DELETE', entity: 'Media', entityId: id, before: { name: m.name, mime: m.mime, size: m.size, scope: m.scope, url: mediaUrl(m) } });
    return { ok: true };
  }
}
