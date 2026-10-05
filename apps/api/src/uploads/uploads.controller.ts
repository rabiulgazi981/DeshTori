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

class UploadDto {
  /** data:image/jpeg;base64,... */
  @IsString() @MaxLength(6 * 1024 * 1024) dataUrl: string;
}

/**
 * Image uploads (payment screenshots, QC photos, complaint photos, image search).
 * Only jpg/png/webp, max 4 MB, random file names. Production can swap this for S3/R2.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  @Post() upload(@Req() r: AuthedRequest, @Body() d: UploadDto) {
    const m = d.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new BadRequestException('IMAGE_ONLY');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BYTES) throw new BadRequestException('IMAGE_TOO_LARGE');
    // check magic bytes so a renamed file can't pass as an image
    const ok = (m[1] === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8) || (m[1] === 'image/png' && buf[0] === 0x89 && buf[1] === 0x50) || (m[1] === 'image/webp' && buf.subarray(8, 12).toString() === 'WEBP');
    if (!ok) throw new BadRequestException('IMAGE_ONLY');
    const name = `${Date.now().toString(36)}-${randomBytes(9).toString('hex')}.${TYPES[m[1]]}`;
    writeFileSync(join(uploadDir(), name), buf);
    const base = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
    void r;
    return { url: `${base}/uploads/${name}` };
  }
}
