/** 文件/文件夹操作与库扫描：移动、重命名、解散系列、递归扫描媒体文件 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { IMAGE_EXTS, LIBRARY_DATA_NAME, PDF_EXTS, SERIES_MARKER_NAME, VIDEO_EXTS } from './constants';
import { readSeriesMarker } from './seriesFolder';
import type { FolderScan, LibraryScan, MediaType, MovedFile, ScanResult } from './types';

/** 把文件或目录从 from 移动到 to（to 不能位于 from 内部）。优先原子重命名，失败才回退到逐文件复制。
 *  只有某个文件成功复制后才删除源文件；失败项留在源目录，绝不静默丢失数据。 */
export function movePath(from: string, to: string, log?: MovedFile[]): boolean {
  const rel = path.relative(path.resolve(from), path.resolve(to));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    return false; // 目标位于源目录内部或相同，禁止移动，避免无限递归
  }
  try {
    // 整目录/整文件原子重命名：同一分区内不会丢数据
    fs.renameSync(from, to);
    if (log) logMovedTree(from, to, log);
    return true;
  } catch {
    // 跨分区(EXDEV)或其它原因 → 回退为逐文件复制
  }
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    let okAll = true;
    for (const e of fs.readdirSync(from)) {
      const childOk = movePath(path.join(from, e), path.join(to, e), log);
      if (!childOk) okAll = false;
    }
    if (okAll) {
      try {
        fs.rmdirSync(from);
      } catch {
        /* ignore */
      }
    }
    return okAll;
  } else {
    try {
      if (fs.existsSync(to)) return false; // 不覆盖既有目标，避免误删
      fs.copyFileSync(from, to);
      fs.rmSync(from, { force: true });
      log?.push({ from, to });
      return true;
    } catch {
      return false;
    }
  }
}

/** 目录被整体重命名后，把其中每个文件都记入移动日志（按相对路径反推旧路径） */
function logMovedTree(from: string, to: string, log: MovedFile[]): void {
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(to, full);
        log.push({ from: path.join(from, rel), to: full });
      }
    }
  };
  walk(to);
}

/** 把一个系列文件夹移动到目标父目录下（自动处理重名编号），返回新路径与移动日志 */
export function moveSeriesFolder(
  folderPath: string,
  targetParent: string
): { ok: boolean; newFolderPath?: string; title?: string; moved?: MovedFile[]; error?: string } {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) return { ok: false, error: '系列文件夹不存在' };
    if (!targetParent || !fs.existsSync(targetParent)) return { ok: false, error: '目标文件夹不存在' };
    const from = path.resolve(folderPath);
    const parent = path.resolve(targetParent);
    const base = path.basename(from);
    let name = base;
    let dest = path.join(parent, name);
    let i = 1;
    while (fs.existsSync(dest) && path.resolve(dest) !== from) {
      name = `${base} (${i})`;
      dest = path.join(parent, name);
      i++;
    }
    if (path.resolve(dest) === from) {
      // 已在目标位置（同名）
      return { ok: true, newFolderPath: from, title: base, moved: [] };
    }
    const destRel = path.relative(from, dest);
    if (destRel === '' || (!destRel.startsWith('..') && !path.isAbsolute(destRel))) {
      return { ok: false, error: '不能将文件夹移动到其自身内部' };
    }
    const moved: MovedFile[] = [];
    movePath(from, dest, moved);
    return { ok: true, newFolderPath: dest, title: name, moved };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** 统一的路径比较用归一化（Windows 大小写不敏感、分隔符统一） */
export const normPath = (p: string): string => p.replace(/[\\/]+/g, '/').toLowerCase();

export function randomId(): string {
  return randomUUID().replace(/-/g, '');
}

/** 按扩展名判断媒体类型并把文件加入扫描结果（未知类型/无法读取则跳过） */
function pushScanResult(media: ScanResult[], full: string, entryName: string): void {
  const ext = path.extname(entryName).toLowerCase();
  const type: MediaType | null = VIDEO_EXTS.includes(ext)
    ? 'video'
    : IMAGE_EXTS.includes(ext)
    ? 'image'
    : PDF_EXTS.includes(ext)
    ? 'pdf'
    : null;
  if (!type) return;
  let stat;
  try {
    stat = fs.statSync(full);
  } catch {
    return;
  }
  media.push({
    filePath: full,
    fileName: entryName,
    type,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
  });
}

/** 枚举某个系列文件夹内直属的媒体文件（不递归子文件夹），用于漫画模式按需读取 */
export function listMediaInFolder(folderPath: string): ScanResult[] {
  const media: ScanResult[] = [];
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return media;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isFile()) continue;
    pushScanResult(media, path.join(folderPath, entry.name), entry.name);
  }
  return media;
}

/** 递归扫描一个文件夹：直属媒体 + 子文件夹树 + 是否已有系列标记 */
function scanFolderRecursive(folderPath: string): FolderScan {
  const marker = readSeriesMarker(folderPath);
  const media: ScanResult[] = [];
  const subFolders: FolderScan[] = [];
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return { markerId: marker?.id ?? null, title: path.basename(folderPath), folderPath, media, subFolders };
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      subFolders.push(scanFolderRecursive(full));
    } else if (entry.isFile()) {
      pushScanResult(media, full, entry.name);
    }
  }
  return { markerId: marker?.id ?? null, title: path.basename(folderPath), folderPath, media, subFolders };
}

/** 扫描一个库文件夹：根目录直属媒体 + 每个子文件夹的树 */
export function scanLibrary(libraryPath: string): LibraryScan {
  const media: ScanResult[] = [];
  const folders: FolderScan[] = [];
  let entries;
  try {
    entries = fs.readdirSync(libraryPath, { withFileTypes: true });
  } catch {
    return { media, folders };
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(libraryPath, entry.name);
    if (entry.isDirectory()) {
      folders.push(scanFolderRecursive(full));
    } else if (entry.isFile()) {
      pushScanResult(media, full, entry.name);
    }
  }
  return { media, folders };
}

/** 去掉系列名中的非法字符 */
export function sanitizeFolderName(name: string): string {
  return (name ?? '').trim().replace(/[\\/:*?"<>|]/g, '_');
}

/** 在父目录下取一个不重名的文件夹名（追加 (1)、(2)…） */
export function uniqueFolderPath(parent: string, base: string): { folderPath: string; name: string } {
  let name = base;
  let folderPath = path.join(parent, name);
  let i = 1;
  while (fs.existsSync(folderPath)) {
    name = `${base} (${i})`;
    folderPath = path.join(parent, name);
    i++;
  }
  return { folderPath, name };
}

/** 把单个文件移入目标文件夹（重名时自动编号），返回移动记录 */
export function moveFileIntoFolder(src: string, destFolder: string): MovedFile | null {
  try {
    if (!src || !fs.existsSync(src)) return null;
    if (path.dirname(path.resolve(src)) === path.resolve(destFolder)) return null; // 已在目标文件夹中
    const base = path.basename(src);
    let dest = path.join(destFolder, base);
    let i = 1;
    while (fs.existsSync(dest)) {
      const ext = path.extname(base);
      const stem = path.basename(base, ext);
      dest = path.join(destFolder, `${stem} (${i})${ext}`);
      i++;
    }
    try {
      fs.renameSync(src, dest);
    } catch {
      fs.copyFileSync(src, dest);
      fs.rmSync(src, { force: true });
    }
    return { from: src, to: dest };
  } catch {
    return null;
  }
}

/** 批量移入文件夹，忽略单个失败项 */
export function moveFilesIntoFolder(destFolder: string, filePaths: string[]): MovedFile[] {
  const moved: MovedFile[] = [];
  for (const src of filePaths ?? []) {
    const r = moveFileIntoFolder(src, destFolder);
    if (r) moved.push(r);
  }
  return moved;
}

/** 解散系列：直属媒体文件释放到上级目录；子系列文件夹整体上移到上级（保留结构，避免散开与重名编号）。
 *  全部成功后才删除原文件夹；任一失败则保留原文件夹，绝不误删数据。 */
export function dissolveFolder(folderPath: string): {
  moved: MovedFile[];
  movedFolders: { from: string; to: string }[];
} {
  const parent = path.dirname(folderPath);
  const moved: MovedFile[] = [];
  const movedFolders: { from: string; to: string }[] = [];
  let failed = false;
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return { moved: [], movedFolders: [] };
  }
  for (const entry of entries) {
    // 软件自身的标记/数据文件不释放到上级，随原文件夹一并清理
    if (entry.name === SERIES_MARKER_NAME || entry.name === LIBRARY_DATA_NAME) continue;
    const full = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      // 子系列文件夹整体上移到上级，保留其结构（避免内容散开与重名编号）
      const res = moveSeriesFolder(full, parent);
      if (res.ok && res.newFolderPath && path.resolve(res.newFolderPath) !== path.resolve(full)) {
        if (res.moved?.length) moved.push(...res.moved);
        movedFolders.push({ from: full, to: res.newFolderPath });
      } else {
        // 子系列未实际移走（仍在原文件夹内）：标记失败，避免原文件夹连同其内容被误删
        failed = true;
      }
    } else {
      const r = moveFileIntoFolder(full, parent);
      if (r) moved.push(r);
      else failed = true; // 单个文件移走失败：绝不递归删除该目录，避免误删数据
    }
  }
  // 全部移走后，删除原文件夹（含残留标记文件/空子目录）
  if (!failed) {
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
    } catch {
      /* 仍有内容被占用则保留 */
    }
  }
  return { moved, movedFolders };
}
