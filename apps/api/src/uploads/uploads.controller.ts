import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { AuthedRequest, JwtAuthGuard } from '../auth/guards';

export const uploadDir = () => {
  const d = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
  mkdirSync(d, { recursive: true });
  return d;
};

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 4 * 1024 * 1024;
/** base64 of a 4 MB file plus the data-URL prefix */
export const MAX_DATA_URL = 6 * 1024 * 1024;

/**
 * Validate a `data:image/...;base64,` URL (type, size, magic bytes), write it to the upload dir
 * under a random name and return its public URL (PUBLIC_API_URL/uploads/<name>).
 */
export const saveImageDataUrl = (dataUrl: string): string => {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new BadRequestException('IMAGE_ONLY');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new BadRequestException('IMAGE_TOO_LARGE');
  // check magic bytes so a renamed file can't pass as an image
  const ok = (m[1] === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8) || (m[1] === 'image/png' && buf[0] === 0x89 && buf[1] === 0x50) || (m[1] === 'image/webp' && buf.subarray(8, 12).toString() === 'WEBP');
  if (!ok) throw new BadRequestException('IMAGE_ONLY');
  const name = `${Date.now().toString(36)}-${randomBytes(9).toString('hex')}.${TYPES[m[1]]}`;
  writeFileSync(join(uploadDir(), name), buf);
  const base = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
  return `${base}/uploads/${name}`;
};

class UploadDto {
  /** data:image/jpeg;base64,... */
  @IsString() @MaxLength(MAX_DATA_URL) dataUrl: string;
}

/**
 * Image uploads (payment screenshots, QC photos, complaint photos).
 * Only jpg/png/webp, max 4 MB, random file names. Production can swap this for S3/R2.
 * Image search does not need this (login-only) route: POST /products/search-image takes a dataUrl directly.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  @Post() upload(@Req() r: AuthedRequest, @Body() d: UploadDto) {
    void r;
    return { url: saveImageDataUrl(d.dataUrl) };
  }
}
