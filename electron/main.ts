import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, shell } from 'electron';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

type MediaType = 'video' | 'image' | 'pdf';

interface Library {
  id: string;
  name: string;
  path: string;
  nsfw?: boolean;
  collapsed?: boolean;
}

interface Tag {
  id: string;
  name: string;
  category: string;
  coverPath?: string;
  restricted?: boolean;
}

interface MediaItem {
  id: string;
  libraryId: string;
  filePath: string;
  fileName: string;
  type: MediaType;
  size: number;
  modifiedAt: number;
  tags: string[];
  coverPath?: string;
  description: string;
  createdAt: number;
  restricted: boolean;
}

interface Series {
  id: string;
  libraryId: string;
  title: string;
  tags: string[];
  coverPath?: string;
  description: string;
  createdAt: number;
  restricted: boolean;
  memberIds: string[];
  memberSeriesIds?: string[];
  folderPath?: string;
  /** 纯图片系列的展示模式：漫画（隐藏细分、不入 JSON）或图片（原始图库行为） */
  mode?: 'comic' | 'image';
}

interface SeriesFolderData {
  id?: string;
  media?: MediaItem[];
}

interface AppData {
  libraries: Library[];
  categories: string[];
  tags: Tag[];
  media: MediaItem[];
  series: Series[];
}

interface LibraryFile {
  media?: MediaItem[];
  series?: Series[];
}

interface GlobalData {
  libraries: Library[];
}

interface TagData {
  categories: string[];
  tags: Tag[];
}

interface ScanResult {
  filePath: string;
  fileName: string;
  type: MediaType;
  size: number;
  modifiedAt: number;
}

interface FolderScan {
  markerId: string | null;
  title: string;
  folderPath: string;
  media: ScanResult[];
  subFolders: FolderScan[];
}

interface LibraryScan {
  media: ScanResult[];
  folders: FolderScan[];
}

interface MovedFile {
  from: string;
  to: string;
}

interface LegacySeriesPayload {
  id: string;
  title: string;
  memberFilePaths: string[];
}

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m4v', '.mpg', '.mpeg', '.rmvb'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico'];
const PDF_EXTS = ['.pdf'];

const DEFAULT_TAG_DATA: TagData = {
  categories: ['动漫', '真人'],
  tags: [],
};

const DEFAULT_GLOBAL: GlobalData = {
  libraries: [],
};

let mainWindow: BrowserWindow | null = null;
let tagManagerWindow: BrowserWindow | null = null;
let comicReaderWindow: BrowserWindow | null = null;

const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

function dataLocationFile(): string {
  return path.join(app.getPath('userData'), 'data-location.json');
}

let dataDir = '';

function getDataDir(): string {
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

function setDataDir(dir: string): void {
  dataDir = dir;
  fs.mkdirSync(path.dirname(dataLocationFile()), { recursive: true });
  fs.writeFileSync(dataLocationFile(), JSON.stringify({ dir }, null, 2), 'utf-8');
}

function globalFile(): string {
  return path.join(getDataDir(), 'vision-libraries.json');
}

function tagsFile(): string {
  return path.join(getDataDir(), 'vision-tags.json');
}

function getCoversDir(): string {
  return path.join(getDataDir(), 'covers');
}

function libraryDataFile(libPath: string): string {
  return path.join(libPath, '.vision-library.json');
}

function toRelativePath(libPath: string, filePath: string): string {
  const rel = path.relative(libPath, filePath);
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? filePath : rel;
}

function resolveStoredPath(libPath: string, stored: string): string {
  return path.isAbsolute(stored) ? stored : path.resolve(libPath, stored);
}

function loadGlobal(): GlobalData {
  try {
    if (!fs.existsSync(globalFile())) return clone(DEFAULT_GLOBAL);
    const parsed = JSON.parse(fs.readFileSync(globalFile(), 'utf-8')) as Partial<GlobalData>;
    return {
      libraries: parsed.libraries ?? [],
    };
  } catch {
    return clone(DEFAULT_GLOBAL);
  }
}

function saveGlobal(global: GlobalData): void {
  fs.mkdirSync(path.dirname(globalFile()), { recursive: true });
  fs.writeFileSync(globalFile(), JSON.stringify(global, null, 2), 'utf-8');
}

/** 把文件或目录从 from 移动到 to（to 不能位于 from 内部）。优先原子重命名，失败才回退到逐文件复制。
 *  只有某个文件成功复制后才删除源文件；失败项留在源目录，绝不静默丢失数据。 */
function movePath(from: string, to: string, log?: MovedFile[]): boolean {
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

function moveSeriesFolder(
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

function loadTags(): TagData {
  try {
    if (!fs.existsSync(tagsFile())) return clone(DEFAULT_TAG_DATA);
    const parsed = JSON.parse(fs.readFileSync(tagsFile(), 'utf-8')) as Partial<TagData>;
    return {
      categories: parsed.categories ?? [],
      tags: parsed.tags ?? [],
    };
  } catch {
    return clone(DEFAULT_TAG_DATA);
  }
}

function loadLibraryFile(libPath: string): LibraryFile {
  let parsed: LibraryFile;
  try {
    parsed = JSON.parse(fs.readFileSync(libraryDataFile(libPath), 'utf-8')) as LibraryFile;
  } catch {
    return { media: [], series: [] };
  }

  const mediaById = new Map<string, MediaItem>();
  const addMedia = (m: MediaItem): void => {
    if (!mediaById.has(m.id)) mediaById.set(m.id, m);
  };

  for (const m of parsed.media ?? []) {
    addMedia({
      ...m,
      filePath: resolveStoredPath(libPath, m.filePath),
      ...(m.coverPath ? { coverPath: resolveStoredPath(libPath, m.coverPath) } : {}),
    });
  }

  const series: Series[] = (parsed.series ?? []).map((s) => ({
    ...s,
    mode: s.mode,
    ...(s.coverPath ? { coverPath: resolveStoredPath(libPath, s.coverPath) } : {}),
    ...(s.folderPath ? { folderPath: resolveStoredPath(libPath, s.folderPath) } : {}),
  }));

  // 1) 读取各系列文件夹数据文件（新格式：具体媒体信息存放在系列文件夹内）
  for (const s of series) {
    if (!s.folderPath) continue;
    const fd = readSeriesFolderData(s.folderPath);
    if (fd?.media?.length) {
      for (const m of fd.media) {
        addMedia({
          ...m,
          filePath: resolveStoredPath(libPath, m.filePath),
          ...(m.coverPath ? { coverPath: resolveStoredPath(libPath, m.coverPath) } : {}),
        });
      }
    }
  }

  // 2) 迁移：旧数据没有 mode 字段，纯图片系列默认按「漫画」处理，
  //    并把成员图片的受限标记合并到系列本身，避免 NSFW 信息丢失（标签属于系列本身，不再合并）
  const isPureImageTree = (s: Series, visited: Set<string>): boolean => {
    if (visited.has(s.id)) return false;
    visited.add(s.id);
    const members = s.memberIds
      .map((id) => mediaById.get(id))
      .filter((m): m is MediaItem => Boolean(m));
    if (members.length === 0 && (s.memberSeriesIds?.length ?? 0) === 0) return false;
    if (members.some((m) => m.type !== 'image')) return false;
    for (const sid of s.memberSeriesIds ?? []) {
      const sub = series.find((x) => x.id === sid);
      if (!sub || !isPureImageTree(sub, visited)) return false;
    }
    return true;
  };

  for (const s of series) {
    if (s.mode !== undefined) continue;
    if (!isPureImageTree(s, new Set())) continue;
    const treeMembers = collectTreeMembers(s, series, Array.from(mediaById.values()));
    s.mode = 'comic';
    if (treeMembers.some((m) => m.restricted)) s.restricted = true;
  }

  // 3) 漫画模式：丢弃旧 JSON 中系列文件夹内的成员媒体（不再存入 JSON），改为实时枚举
  const oldMediaIds = new Set(mediaById.keys());
  const protectedIds = new Set<string>();
  for (const s of series) {
    if (s.mode === 'comic') continue;
    for (const id of s.memberIds) protectedIds.add(id);
  }
  for (const s of series) {
    if (s.mode !== 'comic' || !s.folderPath) continue;
    const folder = normPath(s.folderPath);
    for (const id of oldMediaIds) {
      if (protectedIds.has(id)) continue;
      const m = mediaById.get(id);
      if (!m) continue;
      const p = normPath(m.filePath);
      if (p === folder || p.startsWith(folder + '/')) mediaById.delete(id);
    }
    const ephemeral: MediaItem[] = listMediaInFolder(s.folderPath).map((r) => ({
      id: randomId(),
      libraryId: s.libraryId,
      filePath: r.filePath,
      fileName: r.fileName,
      type: r.type,
      size: r.size,
      modifiedAt: r.modifiedAt,
      tags: [],
      description: '',
      createdAt: Date.now(),
      restricted: false,
    }));
    s.memberIds = ephemeral.map((m) => m.id);
    for (const m of ephemeral) addMedia(m);
  }

  return { media: Array.from(mediaById.values()), series };
}

function loadData(): AppData {
  const global = loadGlobal();
  const tagData = loadTags();
  const media: MediaItem[] = [];
  const series: Series[] = [];
  for (const lib of global.libraries) {
    const libFile = loadLibraryFile(lib.path);
    media.push(...(libFile.media ?? []));
    series.push(...(libFile.series ?? []));
  }
  return {
    libraries: global.libraries,
    categories: tagData.categories,
    tags: tagData.tags,
    media,
    series,
  };
}

function saveData(data: AppData): void {
  const global: GlobalData = {
    libraries: data.libraries.map((l) => ({
      id: l.id,
      name: l.name,
      path: l.path,
      nsfw: l.nsfw,
      collapsed: l.collapsed,
    })),
  };
  saveGlobal(global);

  const tagData: TagData = {
    categories: data.categories,
    tags: data.tags,
  };
  fs.mkdirSync(path.dirname(tagsFile()), { recursive: true });
  fs.writeFileSync(tagsFile(), JSON.stringify(tagData, null, 2), 'utf-8');

  for (const lib of data.libraries) {
    try {
      if (!fs.existsSync(lib.path)) continue; // 文件夹已被移动或删除，跳过保存
      const libMedia = data.media.filter((m) => m.libraryId === lib.id);
      const libSeries = data.series.filter((s) => s.libraryId === lib.id);
      const serializeMedia = (m: MediaItem): MediaItem => ({
        ...m,
        filePath: toRelativePath(lib.path, m.filePath),
        ...(m.coverPath ? { coverPath: toRelativePath(lib.path, m.coverPath) } : {}),
      });

      // 主 JSON 只保留系列条目；具体媒体信息放入各系列文件夹
      const folderSeries = libSeries.filter((s) => s.folderPath);
      const folderMemberIds = new Set<string>();
      for (const s of folderSeries) for (const id of s.memberIds) folderMemberIds.add(id);

      const mainMedia = libMedia
        .filter((m) => !folderMemberIds.has(m.id))
        .map(serializeMedia);

      const mainSeries = libSeries.map((s) => ({
        ...s,
        ...(s.mode === 'comic' ? { memberIds: [] } : {}), // 漫画模式不持久化成员
        ...(s.coverPath ? { coverPath: toRelativePath(lib.path, s.coverPath) } : {}),
        ...(s.folderPath ? { folderPath: toRelativePath(lib.path, s.folderPath) } : {}),
      }));

      // 各系列文件夹数据文件：保留具体媒体信息（漫画模式只留标记）
      for (const s of libSeries) {
        if (!s.folderPath) continue;
        try {
          if (!fs.existsSync(s.folderPath)) continue;
          const payload: SeriesFolderData =
            s.mode === 'comic'
              ? { id: s.id }
              : { id: s.id, media: libMedia.filter((m) => s.memberIds.includes(m.id)).map(serializeMedia) };
          fs.writeFileSync(seriesMarkerFile(s.folderPath), JSON.stringify(payload, null, 2), 'utf-8');
        } catch {
          /* 单个系列文件夹不可用，忽略 */
        }
      }

      fs.writeFileSync(
        libraryDataFile(lib.path),
        JSON.stringify(
          { libraryId: lib.id, libraryName: lib.name, media: mainMedia, series: mainSeries },
          null,
          2
        ),
        'utf-8'
      );
    } catch {
      /* 文件夹可能不可用，忽略 */
    }
  }
}

function saveTags(categories: string[], tags: Tag[]): { ok: boolean; error?: string } {
  try {
    const tagData: TagData = { categories, tags };
    fs.mkdirSync(path.dirname(tagsFile()), { recursive: true });
    fs.writeFileSync(tagsFile(), JSON.stringify(tagData, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function notifyTagsChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tags:changed');
  }
}

function seriesMarkerFile(folderPath: string): string {
  return path.join(folderPath, '.vision-series.json');
}

function readSeriesMarker(folderPath: string): { id?: string } | null {
  try {
    if (!fs.existsSync(seriesMarkerFile(folderPath))) return null;
    return JSON.parse(fs.readFileSync(seriesMarkerFile(folderPath), 'utf-8')) as { id?: string };
  } catch {
    return null;
  }
}

/** 读取系列文件夹数据文件（标记 id + 可选的具体媒体信息） */
function readSeriesFolderData(folderPath: string): SeriesFolderData | null {
  try {
    if (!fs.existsSync(seriesMarkerFile(folderPath))) return null;
    return JSON.parse(fs.readFileSync(seriesMarkerFile(folderPath), 'utf-8')) as SeriesFolderData;
  } catch {
    return null;
  }
}

/** 计算某个系列（含后代系列）的全部媒体成员 */
function collectTreeMembers(s: Series, allSeries: Series[], media: MediaItem[]): MediaItem[] {
  const result: MediaItem[] = [];
  const visited = new Set<string>();
  const visit = (cur: Series): void => {
    if (visited.has(cur.id)) return;
    visited.add(cur.id);
    for (const id of cur.memberIds) {
      const m = media.find((x) => x.id === id);
      if (m) result.push(m);
    }
    for (const sid of cur.memberSeriesIds ?? []) {
      const sub = allSeries.find((x) => x.id === sid);
      if (sub) visit(sub);
    }
  };
  visit(s);
  return result;
}

const normPath = (p: string): string => p.replace(/[\\/]+/g, '/').toLowerCase();

function randomId(): string {
  return randomUUID().replace(/-/g, '');
}

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
function listMediaInFolder(folderPath: string): ScanResult[] {
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

function scanLibrary(libraryPath: string): LibraryScan {
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

function sanitizeFolderName(name: string): string {
  return (name ?? '').trim().replace(/[\\/:*?"<>|]/g, '_');
}

function uniqueFolderPath(parent: string, base: string): { folderPath: string; name: string } {
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

function moveFileIntoFolder(src: string, destFolder: string): MovedFile | null {
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

function moveFilesIntoFolder(destFolder: string, filePaths: string[]): MovedFile[] {
  const moved: MovedFile[] = [];
  for (const src of filePaths ?? []) {
    const r = moveFileIntoFolder(src, destFolder);
    if (r) moved.push(r);
  }
  return moved;
}

/** 解散系列：直属媒体文件释放到上级目录；子系列文件夹整体上移到上级（保留结构，避免散开与重名编号）。
 *  全部成功后才删除原文件夹；任一失败则保留原文件夹，绝不误删数据。 */
function dissolveFolder(folderPath: string): {
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
    if (entry.name === '.vision-series.json' || entry.name === '.vision-library.json') continue;
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
const MIME: Record<string, string> = {
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

const MEDIA_EXTENSIONS = [...VIDEO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS].map((e) => e.slice(1));

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'VidTagHub',
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTagManagerWindow(): void {
  if (tagManagerWindow) {
    tagManagerWindow.focus();
    return;
  }
  tagManagerWindow = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 760,
    minHeight: 520,
    title: '标签管理 - VidTagHub',
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    void tagManagerWindow.loadURL(`${devUrl}?page=tagmanager`);
  } else {
    void tagManagerWindow.loadFile(path.join(__dirname, '..', 'index.html'), {
      search: 'page=tagmanager',
    });
  }

  tagManagerWindow.on('closed', () => {
    tagManagerWindow = null;
  });
}

function createComicReaderWindow(seriesId: string): void {
  if (comicReaderWindow && !comicReaderWindow.isDestroyed()) {
    comicReaderWindow.webContents.send('reader:navigate', seriesId);
    comicReaderWindow.focus();
    return;
  }
  comicReaderWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    title: '漫画阅读 - VidTagHub',
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const devUrl = process.env.ELECTRON_START_URL;
  const query = `page=comicreader&series=${encodeURIComponent(seriesId)}`;
  if (devUrl) {
    void comicReaderWindow.loadURL(`${devUrl}?${query}`);
  } else {
    void comicReaderWindow.loadFile(path.join(__dirname, '..', 'index.html'), {
      search: query,
    });
  }

  comicReaderWindow.on('closed', () => {
    comicReaderWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle('data:load', () => loadData());

  ipcMain.handle('window:openTagManager', () => {
    createTagManagerWindow();
    return { ok: true };
  });

  ipcMain.handle('reader:open', (_event, seriesId: string) => {
    if (!seriesId) return { ok: false, error: '无效的参数' };
    createComicReaderWindow(seriesId);
    return { ok: true };
  });

  ipcMain.handle('tags:save', (_event, categories: string[], tags: Tag[]) => {
    const res = saveTags(categories, tags);
    if (res.ok) notifyTagsChanged();
    return res;
  });

  ipcMain.handle('data:save', (_event, data: AppData) => {
    try {
      saveData(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('dialog:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择媒体文件夹',
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:pickFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined!, {
      properties: ['openFile', 'multiSelections'],
      title: '选择要导入的媒体文件',
      filters: [{ name: '媒体文件', extensions: MEDIA_EXTENSIONS }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:pickImage', async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      title: '选择封面图片',
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    const focusTarget = parent ?? tagManagerWindow;
    if (focusTarget && !focusTarget.isDestroyed()) {
      focusTarget.show();
      focusTarget.focus();
    }
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('library:scan', (_event, folder: string) => scanLibrary(folder));

  ipcMain.handle('series:createFolder', (_event, libraryPath: string, title: string, filePaths: string[]) => {
    try {
      const clean = sanitizeFolderName(title);
      if (!clean) return { ok: false, error: '无效的系列名称' };
      if (!libraryPath || !fs.existsSync(libraryPath)) {
        return { ok: false, error: '库文件夹不存在' };
      }
      const { folderPath, name } = uniqueFolderPath(libraryPath, clean);
      fs.mkdirSync(folderPath, { recursive: true });
      const moved = moveFilesIntoFolder(folderPath, filePaths ?? []);
      return { ok: true, folderPath, title: name, moved };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('series:markFolder', (_event, folderPath: string, seriesId: string) => {
    try {
      if (!folderPath || !seriesId) return { ok: false, error: '无效的参数' };
      fs.mkdirSync(folderPath, { recursive: true });
      fs.writeFileSync(seriesMarkerFile(folderPath), JSON.stringify({ id: seriesId }, null, 2), 'utf-8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('series:listFolder', (_event, folderPath: string) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return [];
      return listMediaInFolder(folderPath);
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    'series:migrateLegacy',
    (_event, libraryPath: string, seriesList: LegacySeriesPayload[]) => {
      try {
        if (!libraryPath || !fs.existsSync(libraryPath)) {
          return { ok: false, error: '库文件夹不存在' };
        }
        const migrated: { id: string; folderPath: string; title: string; moved: MovedFile[] }[] = [];
        for (const s of seriesList ?? []) {
          const clean = sanitizeFolderName(s.title);
          if (!clean) continue;
          const { folderPath, name } = uniqueFolderPath(libraryPath, clean);
          fs.mkdirSync(folderPath, { recursive: true });
          const moved = moveFilesIntoFolder(folderPath, s.memberFilePaths ?? []);
          fs.writeFileSync(seriesMarkerFile(folderPath), JSON.stringify({ id: s.id }, null, 2), 'utf-8');
          migrated.push({ id: s.id, folderPath, title: name, moved });
        }
        return { ok: true, migrated };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
  );

  ipcMain.handle('series:moveMembers', (_event, folderPath: string, filePaths: string[]) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { ok: false, error: '系列文件夹不存在' };
      }
      const moved = moveFilesIntoFolder(folderPath, filePaths ?? []);
      return { ok: true, moved };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('series:moveMembersOut', (_event, folderPath: string, filePaths: string[]) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { ok: false, error: '系列文件夹不存在' };
      }
      const target = path.dirname(folderPath);
      const moved = moveFilesIntoFolder(target, filePaths ?? []);
      return { ok: true, moved };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('series:renameFolder', (_event, folderPath: string, newTitle: string) => {
    try {
      const clean = sanitizeFolderName(newTitle);
      if (!clean) return { ok: false, error: '无效的系列名称' };
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { ok: false, error: '系列文件夹不存在' };
      }
      const parent = path.dirname(folderPath);
      let name = clean;
      let target = path.join(parent, name);
      let i = 1;
      while (fs.existsSync(target) && path.resolve(target) !== path.resolve(folderPath)) {
        name = `${clean} (${i})`;
        target = path.join(parent, name);
        i++;
      }
      if (path.resolve(target) === path.resolve(folderPath)) {
        return { ok: true, folderPath, title: name, moved: [] };
      }
      const moved: MovedFile[] = [];
      movePath(folderPath, target, moved);
      return { ok: true, folderPath: target, title: name, moved };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('series:dissolveFolder', (_event, folderPath: string) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { ok: false, error: '系列文件夹不存在' };
      }
      const { moved, movedFolders } = dissolveFolder(folderPath);
      return { ok: true, moved, movedFolders };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // 彻底删除系列文件夹（含其中所有文件），带路径保护，仅用于漫画系列删除
  ipcMain.handle('series:deleteFolder', (_event, folderPath: string) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { ok: false, error: '系列文件夹不存在' };
      }
      const lp = path.resolve(folderPath);
      const protectedPaths = [
        path.resolve(getDataDir()),
        path.resolve(app.getPath('userData')),
        path.resolve(app.getPath('home')),
      ];
      if (
        protectedPaths.some((p) => {
          const rel = path.relative(lp, p);
          return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
        })
      ) {
        return { ok: false, error: '该路径受保护，无法删除' };
      }
      fs.rmSync(lp, { recursive: true, force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('series:moveFolderInto', (_event, folderPath: string, targetParentFolder: string) =>
    moveSeriesFolder(folderPath, targetParentFolder)
  );

  ipcMain.handle('series:moveFolderOut', (_event, folderPath: string, parentFolderPath: string) => {
    try {
      if (!parentFolderPath) return { ok: false, error: '无效的父系列文件夹' };
      return moveSeriesFolder(folderPath, path.dirname(parentFolderPath));
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('library:adopt', (_event, folder: string) => {
    if (!folder) return null;
    const dataFile = libraryDataFile(folder);
    if (!fs.existsSync(dataFile)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as {
        libraryId?: string;
        libraryName?: string;
      };
      const libFile = loadLibraryFile(folder);
      return {
        libraryId: parsed.libraryId ?? null,
        libraryName: parsed.libraryName ?? null,
        media: libFile.media,
        series: libFile.series,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('folder:ensure', (_event, folderPath: string) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('file:importFiles', (_event, sources: string[], targetFolder: string) => {
    const moved: string[] = [];
    for (const src of sources) {
      try {
        const base = path.basename(src);
        let dest = path.join(targetFolder, base);
        let i = 1;
        while (fs.existsSync(dest)) {
          const ext = path.extname(base);
          const stem = path.basename(base, ext);
          dest = path.join(targetFolder, `${stem} (${i})${ext}`);
          i++;
        }
        fs.copyFileSync(src, dest);
        fs.rmSync(src, { force: true });
        moved.push(dest);
      } catch {
        /* 忽略单个失败 */
      }
    }
    return moved;
  });

  ipcMain.handle('file:delete', (_event, filePath: string) => {
    try {
      if (!filePath) return { ok: false, error: '无效的文件路径' };
      fs.rmSync(filePath, { force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    const error = await shell.openPath(filePath);
    return { ok: !error, error: error || undefined };
  });

  ipcMain.handle('file:rename', (_event, filePath: string, newName: string) => {
    const trimmed = (newName ?? '').trim();
    if (!filePath || !trimmed) {
      return { ok: false, error: '无效的文件名' };
    }
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    let target = trimmed;
    if (ext && !path.extname(target)) {
      target += ext;
    }
    const newPath = path.join(dir, target);
    if (newPath === filePath) {
      return { ok: true, newPath };
    }
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: '文件不存在，可能已被移动或删除' };
    }
    if (fs.existsSync(newPath)) {
      return { ok: false, error: '目标文件名已存在' };
    }
    try {
      fs.renameSync(filePath, newPath);
      return { ok: true, newPath };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('file:saveFrame', (_event, dataUrl: string, folder: string, baseName: string) => {
    try {
      const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl ?? '');
      if (!m) return { ok: false, error: '无效的图像数据' };
      const buf = Buffer.from(m[1], 'base64');
      const coversDir = path.join(folder, '.covers');
      fs.mkdirSync(coversDir, { recursive: true });
      const safeBase = (baseName || 'frame').replace(/[\\/:*?"<>|]/g, '_');
      const outPath = path.join(coversDir, `${safeBase}.png`);
      fs.writeFileSync(outPath, buf);
      return { ok: true, filePath: outPath };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('file:saveCrop', (_event, dataUrl: string) => {
    try {
      const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl ?? '');
      if (!m) return { ok: false, error: '无效的图像数据' };
      const buf = Buffer.from(m[2], 'base64');
      const ext = m[1] === 'png' ? 'png' : 'jpg';
      const coversDir = getCoversDir();
      fs.mkdirSync(coversDir, { recursive: true });
      const outPath = path.join(coversDir, `crop_${Date.now()}_${Math.round(Math.random() * 1e9)}.${ext}`);
      fs.writeFileSync(outPath, buf);
      return { ok: true, filePath: outPath };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('data:migrate', (_event, targetDir: string) => {
    try {
      if (!targetDir || !path.isAbsolute(targetDir)) return { ok: false, error: '目标文件夹无效' };
      const target = path.resolve(targetDir);
      const oldData = getDataDir();
      if (target === path.resolve(oldData)) {
        return { ok: false, error: '目标文件夹与当前数据文件夹一致' };
      }
      const srcList = [app.getPath('userData'), oldData];
      for (const src of srcList) {
        const r = path.resolve(src);
        const rel = path.relative(r, target);
        if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
          return { ok: false, error: '目标文件夹不能是数据目录本身或其子目录' };
        }
      }
      const data = loadData();
      const oldCovers = path.join(oldData, 'covers');
      const newCovers = path.join(target, 'covers');
      const libPaths = new Set(data.libraries.map((l) => path.resolve(l.path)));
      fs.mkdirSync(target, { recursive: true });
      // 只迁移软件自身的业务数据文件/目录。
      // 注意：不能迁移 Electron/Chromium 运行时文件（Cache、Preferences、Local Storage 等），
      // 它们在运行期间会被进程占用而无法删除，若一并迁移会在原目录残留旧文件，
      // 且删除旧文件后会导致软件数据丢失的错觉。
      const APP_DATA_NAMES = new Set(['vision-libraries.json', 'vision-tags.json', 'covers', 'thumbs']);
      const sources = new Set([app.getPath('userData'), oldData]);
      for (const src of sources) {
        const srcResolved = path.resolve(src);
        if (srcResolved === target || !fs.existsSync(src)) continue;
        if (libPaths.has(srcResolved)) continue; // 源目录本身是库文件夹，不迁移其内容（数据路径与库路径相同）
        for (const name of fs.readdirSync(src)) {
          if (name === 'data-location.json') continue; // 指针必须留在用户数据目录
          if (!APP_DATA_NAMES.has(name)) continue; // 只迁移业务数据，跳过运行时文件
          const from = path.join(src, name);
          if (libPaths.has(path.resolve(from))) continue; // 库文件夹不迁移
          // 跳过位于任何库文件夹内部的子目录/文件，避免库数据被一并迁移
          if ([...libPaths].some((lp) => {
            const r = path.relative(lp, path.resolve(from));
            return r !== '' && r !== '..' && !r.startsWith('..') && !path.isAbsolute(r);
          })) continue;
          try {
            movePath(from, path.join(target, name));
          } catch {
            /* 单条失败继续 */
          }
        }
      }
      // 更新封面引用到新目录，防止 JSON 对应不上
      const oldPrefix = oldCovers + path.sep;
      const replaceCover = (p?: string): string | undefined =>
        p && p.startsWith(oldPrefix) ? path.join(newCovers, path.basename(p)) : p;
      const media = data.media.map((m) => ({
        ...m,
        ...(m.coverPath ? { coverPath: replaceCover(m.coverPath) } : {}),
      }));
      const series = data.series.map((s) => ({
        ...s,
        ...(s.coverPath ? { coverPath: replaceCover(s.coverPath) } : {}),
      }));
      const tags = data.tags.map((t) => ({
        ...t,
        ...(t.coverPath ? { coverPath: replaceCover(t.coverPath) } : {}),
      }));
      dataDir = target;
      try {
        saveData({ ...data, media, series, tags });
      } catch (err) {
        dataDir = oldData;
        return { ok: false, error: String(err) };
      }
      setDataDir(target);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('library:deleteData', (_event, libraryId: string) => {
    try {
      const global = loadGlobal();
      const lib = global.libraries.find((l) => l.id === libraryId);
      if (!lib) return { ok: false, error: '库不存在' };
      const lp = path.resolve(lib.path);
      const dataDir = getDataDir();
      const protectedPaths = [
        path.resolve(dataDir),
        path.resolve(app.getPath('userData')),
        path.resolve(app.getPath('home')),
      ];
      // 保护：不能删除数据目录/用户目录/家目录，也不能删除包含数据目录的目录
      if (
        protectedPaths.some((p) => {
          const rel = path.relative(lp, p);
          return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
        })
      ) {
        return { ok: false, error: '该路径受保护，无法删除' };
      }
      fs.rmSync(lp, { recursive: true, force: true });
      global.libraries = global.libraries.filter((l) => l.id !== libraryId);
      saveGlobal(global);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('cache:clear', () => {
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
  });
}

const thumbCache = new Map<string, { mtimeMs: number; buffer: Buffer; mime: string }>();
const THUMB_MAX = 512;
const THUMB_MIN_SIZE = 5 * 1024 * 1024;
const THUMB_CACHE_MAX = 1000;
const THUMB_DIR = (): string => path.join(getDataDir(), 'thumbs');

function thumbResponse(buffer: Buffer, mime: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': mime,
      'content-length': String(buffer.length),
      'cache-control': 'public, max-age=86400',
    },
  });
}

async function serveThumbnail(filePath: string): Promise<Response> {
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

function initThumbCache(): void {
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  initThumbCache();

  // 迁移：删除旧版全局数据文件，数据改为存储在对应的库文件夹中
  try {
    fs.rmSync(path.join(app.getPath('userData'), 'vision-library-data.json'), { force: true });
  } catch {
    /* ignore */
  }

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

  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});