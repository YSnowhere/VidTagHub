/** 数据目录解析与各处数据文件路径：所有路径都集中在这里，便于迁移数据目录 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { COVERS_DIR_NAME, LIBRARY_DATA_NAME, SERIES_MARKER_NAME } from './constants';

/** 记录「数据目录」指针的文件，固定放在 Electron 用户数据目录中 */
export function dataLocationFile(): string {
  return path.join(app.getPath('userData'), 'data-location.json');
}

let dataDir = '';

/** 当前数据目录：优先读指针文件，否则退回用户数据目录 */
export function getDataDir(): string {
  if (dataDir) return dataDir;
  try {
    if (fs.existsSync(dataLocationFile())) {
      const parsed = JSON.parse(fs.readFileSync(dataLocationFile(), 'utf-8')) as { dir?: string };
      if (parsed.dir && fs.existsSync(parsed.dir)) dataDir = parsed.dir;
    }
  } catch {
    /* ignore */
  }
  return dataDir || app.getPath('userData');
}

/** 迁移数据目录：写入指针文件并立即生效 */
export function setDataDir(dir: string): void {
  dataDir = dir;
  fs.mkdirSync(path.dirname(dataLocationFile()), { recursive: true });
  fs.writeFileSync(dataLocationFile(), JSON.stringify({ dir }, null, 2), 'utf-8');
}

/** 全局库列表文件（vision-libraries.json） */
export function globalFile(): string {
  return path.join(getDataDir(), 'vision-libraries.json');
}

/** 标签数据文件（vision-tags.json） */
export function tagsFile(): string {
  return path.join(getDataDir(), 'vision-tags.json');
}

/** 裁剪/截帧产生的封面目录 */
export function getCoversDir(): string {
  return path.join(getDataDir(), COVERS_DIR_NAME);
}

/** 某个库文件夹的数据文件 */
export function libraryDataFile(libPath: string): string {
  return path.join(libPath, LIBRARY_DATA_NAME);
}

/** 某个系列文件夹的数据文件（标记文件） */
export function seriesMarkerFile(folderPath: string): string {
  return path.join(folderPath, SERIES_MARKER_NAME);
}

/** 存储时尽量用相对库根目录的路径，跨机器/移动文件夹后仍可用 */
export function toRelativePath(libPath: string, filePath: string): string {
  const rel = path.relative(libPath, filePath);
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? filePath : rel;
}

/** 读取存储路径：相对路径按库根目录还原为绝对路径 */
export function resolveStoredPath(libPath: string, stored: string): string {
  return path.isAbsolute(stored) ? stored : path.resolve(libPath, stored);
}
