import { Body, Controller, Get, Headers, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';
import { mediaIdFromFile } from './image';
import { MediaService } from './media.service';

/** Legacy disk folder. New uploads go to Postgres; old files here are still served by main.ts. */
export const uploadDir = () => {
  const d = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
  mkdirSync(d, { recursive: true });
  return d;
};

export class UploadDto {
  /** data:image/jpeg;base64,... */
  @IsString() @MaxLength(6 * 1024 * 1024) dataUrl: string;
  /** original file name (for search in the media library) */
  @IsOptional() @IsString() @MaxLength(200) name?: string;
}

/**
 * Image uploads (payment screenshots, QC photos, complaint photos, image search).
 * Only jpg/png/webp, max 4 MB, magic bytes checked, random ids. Stored in Postgres (Media table).
 */
@Controller('uploads')
export class UploadsController {
  constructor(private media: MediaService) {}

  @Post() @UseGuards(JwtAuthGuard)
  async upload(@Req() r: AuthedRequest, @Body() d: UploadDto) {
    const m = await this.media.save(d.dataUrl, { name: d.name, scope: 'UPLOAD', userId: r.user.id });
    return { url: m.url, id: m.id };
  }

  /** Public, immutable: ids are never reused, so browsers/CDNs may cache for a year. */
  @Get(':file') @SkipThrottle()
  async serve(@Param('file') file: string, @Headers('if-none-match') inm: string | undefined, @Res() res: Response) {
    const id = mediaIdFromFile(file);
    const m = id ? await this.media.read(id) : null;
    if (!m) throw new NotFoundException();
    const etag = `"${id}"`;
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (inm === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', m.mime);
    res.setHeader('Content-Length', String(m.bytes.length));
    res.end(m.bytes);
  }
}
