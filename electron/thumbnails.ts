/** 缩略图生成与缓存：仅对超过阈值的图片生成小图，减少列表滚动时的解码开销 */

import { createHash } from 'crypto';
import { nativeImage, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { THUMB_CACHE_MAX, THUMB_DIR_NAME, THUMB_MAX } from './constants';
import { getDataDir } from './paths';

const thumbCache = new Map<string, { mtimeMs: number; buffer: Buffer; mime: string }>();

export const THUMB_DIR = (): string => path.join(getDataDir(), THUMB_DIR_NAME);

function thumbResponse(buffer: Buffer, mime: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': mime,
      'content-length': String(buffer.length),
      'cache-control': 'public, max-age=86400',
    },
  });
}

/** 生成/读取缩略图：内存缓存 → 磁盘缓存 → 现算（nativeImage 缩放，失败则回退原图） */
export async function serveThumbnail(filePath: string): Promise<Response> {
  try {
    const stat = fs.statSync(filePath);
    const cached = thumbCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return thumbResponse(cached.buffer, cached.mime);
    }
    const ext = path.extname(filePath).toLowerCase();
    const isPng = ext === '.png' || ext === '.webp' || ext === '.gif';
    const mime = isPng ? 'image/png' : 'image/jpeg';
    const key = createHash('sha1').update(filePath).digest('hex').slice(0, 16);
    const diskPath = path.join(
      THUMB_DIR(),
      `${key}_${Math.round(stat.mtimeMs)}.${isPng ? 'png' : 'jpg'}`
    );
    if (fs.existsSync(diskPath)) {
      const buffer = fs.readFileSync(diskPath);
      thumbCache.set(filePath, { mtimeMs: stat.mtimeMs, buffer, mime });
      return thumbResponse(buffer, mime);
    }
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) {
      return net.fetch(pathToFileURL(filePath).toString());
    }
    const size = img.getSize();
    const scale = Math.min(1, THUMB_MAX / Math.max(size.width, size.height));
    const resized =
      scale < 1
        ? img.resize({ width: Math.max(1, Math.round(size.width * scale)), quality: 'good' })
        : img;
    const buffer = isPng ? resized.toPNG() : resized.toJPEG(80);
    try {
      fs.mkdirSync(THUMB_DIR(), { recursive: true });
      fs.writeFileSync(diskPath, buffer);
    } catch {
      /* ignore */
    }
    thumbCache.set(filePath, { mtimeMs: stat.mtimeMs, buffer, mime });
    if (thumbCache.size > THUMB_CACHE_MAX) {
      const oldest = thumbCache.keys().next().value;
      if (oldest !== undefined) thumbCache.delete(oldest);
    }
    return thumbResponse(buffer, mime);
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

/** 启动时清理：缩略图文件过多（说明路径/时间戳碎片太多）则整体清空 */
export function initThumbCache(): void {
  try {
    const dir = THUMB_DIR();
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    if (files.length > 5000) {
      for (const f of files) fs.rmSync(path.join(dir, f), { force: true });
    }
  } catch {
    /* ignore */
  }
}

/** 清空内存与磁盘缩略图缓存（设置里的「清理缓存」） */
export function clearThumbCache(): { ok: boolean; error?: string } {
  try {
    thumbCache.clear();
    const dir = THUMB_DIR();
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        try {
          fs.rmSync(path.join(dir, f), { force: true });
        } catch {
          /* ignore */
        }
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
