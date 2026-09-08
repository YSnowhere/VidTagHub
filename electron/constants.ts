/** 主进程常量：支持的扩展名、MIME、默认数据、缩略图参数 */

import type { GlobalData, TagData } from './types';

export const VIDEO_EXTS = [
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.ts',
  '.m4v',
  '.mpg',
  '.mpeg',
  '.rmvb',
];
export const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico'];
export const PDF_EXTS = ['.pdf'];

export const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

export const MEDIA_EXTENSIONS = [...VIDEO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS].map((e) => e.slice(1));

export const DEFAULT_TAG_DATA: TagData = {
  categories: ['动漫', '真人'],
  tags: [],
};

export const DEFAULT_GLOBAL: GlobalData = {
  libraries: [],
};

/** 系列文件夹内的数据文件名（隐藏文件，随文件夹一起移动） */
export const SERIES_MARKER_NAME = '.vision-series.json';

/** 库文件夹内的数据文件名 */
export const LIBRARY_DATA_NAME = '.vision-library.json';

/** 封面目录名（裁剪/截帧产物，随数据目录一起迁移） */
export const COVERS_DIR_NAME = 'covers';

/** 缩略图缓存参数 */
export const THUMB_MAX = 512;
export const THUMB_MIN_SIZE = 5 * 1024 * 1024;
export const THUMB_CACHE_MAX = 1000;
export const THUMB_DIR_NAME = 'thumbs';
