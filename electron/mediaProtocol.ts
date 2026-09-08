/** 自定义 media:// 协议：把本地文件以流的方式提供给渲染进程（图片预览、视频拖动、Range 请求） */

import { net, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { MIME, THUMB_MIN_SIZE } from './constants';
import { serveThumbnail } from './thumbnails';

/** 必须在 app ready 之前调用，把 media 注册为标准且安全的协议 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  ]);
}

/** app ready 之后调用，注册 media:// 的请求处理器 */
export function handleMediaProtocol(): void {
  protocol.handle('media', async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!filePath || !fs.existsSync(filePath)) {
      return new Response('Not Found', { status: 404 });
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return new Response('Not Found', { status: 404 });
    }
    if (url.searchParams.get('preview') === '1') {
      // 仅对过大的图片生成/读取缩略图，小图直接返回原图
      if (stat.size > THUMB_MIN_SIZE) {
        return serveThumbnail(filePath);
      }
    }
    const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    // 支持 Range 请求，使 <video> 可以拖动进度条定位播放
    const range = request.headers.get('range');
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      if (m) {
        const start = Math.max(0, parseInt(m[1], 10));
        const end = m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(stream as unknown as BodyInit, {
          status: 206,
          headers: {
            'content-range': `bytes ${start}-${end}/${stat.size}`,
            'accept-ranges': 'bytes',
            'content-type': mime,
            'content-length': String(end - start + 1),
          },
        });
      }
    }
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      try {
        const buf = await fs.promises.readFile(filePath);
        return new Response(new Uint8Array(buf), {
          headers: { 'content-type': mime },
        });
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }
  });
}
