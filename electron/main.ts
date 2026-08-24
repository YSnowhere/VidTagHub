import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, shell } from 'electron';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

type MediaType = 'video' | 'image';

interface Library {
  id: string;
  name: string;
  path: string;
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

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m4v', '.mpg', '.mpeg', '.rmvb'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico'];

const DEFAULT_TAG_DATA: TagData = {
  categories: ['动漫', '真人'],
  tags: [],
};

const DEFAULT_GLOBAL: GlobalData = {
  libraries: [],
};

let mainWindow: BrowserWindow | null = null;
let tagManagerWindow: BrowserWindow | null = null;

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

function movePath(from: string, to: string): void {
  const rel = path.relative(path.resolve(from), path.resolve(to));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    return; // 目标位于源目录内部或相同，禁止移动，避免无限递归
  }
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from)) {
      try {
        movePath(path.join(from, e), path.join(to, e));
      } catch {
        /* 单个文件失败继续 */
      }
    }
    try {
      fs.rmdirSync(from);
    } catch {
      /* ignore */
    }
  } else {
    try {
      if (fs.existsSync(to)) fs.rmSync(to, { force: true });
      fs.copyFileSync(from, to);
      fs.rmSync(from, { force: true });
    } catch {
      /* ignore */
    }
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
  try {
    const parsed = JSON.parse(fs.readFileSync(libraryDataFile(libPath), 'utf-8')) as LibraryFile;
    return {
      media: (parsed.media ?? []).map((m) => ({
        ...m,
        filePath: resolveStoredPath(libPath, m.filePath),
        ...(m.coverPath ? { coverPath: resolveStoredPath(libPath, m.coverPath) } : {}),
      })),
      series: (parsed.series ?? []).map((s) => ({
        ...s,
        ...(s.coverPath ? { coverPath: resolveStoredPath(libPath, s.coverPath) } : {}),
      })),
    };
  } catch {
    return { media: [], series: [] };
  }
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
    libraries: data.libraries.map((l) => ({ id: l.id, name: l.name, path: l.path })),
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
      const libData = {
        libraryId: lib.id,
        libraryName: lib.name,
        media: data.media
          .filter((m) => m.libraryId === lib.id)
          .map((m) => ({
            ...m,
            filePath: toRelativePath(lib.path, m.filePath),
            ...(m.coverPath ? { coverPath: toRelativePath(lib.path, m.coverPath) } : {}),
          })),
        series: data.series
          .filter((s) => s.libraryId === lib.id)
          .map((s) => ({
            ...s,
            ...(s.coverPath ? { coverPath: toRelativePath(lib.path, s.coverPath) } : {}),
          })),
      };
      fs.writeFileSync(libraryDataFile(lib.path), JSON.stringify(libData, null, 2), 'utf-8');
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

function scanMedia(folder: string): ScanResult[] {
  const results: ScanResult[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const type: MediaType | null = VIDEO_EXTS.includes(ext)
          ? 'video'
          : IMAGE_EXTS.includes(ext)
          ? 'image'
          : null;
        if (!type) continue;
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        results.push({
          filePath: full,
          fileName: entry.name,
          type,
          size: stat.size,
          modifiedAt: stat.mtimeMs,
        });
      }
    }
  };
  walk(folder);
  return results;
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
};

const MEDIA_EXTENSIONS = [...VIDEO_EXTS, ...IMAGE_EXTS].map((e) => e.slice(1));

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

function registerIpc(): void {
  ipcMain.handle('data:load', () => loadData());

  ipcMain.handle('window:openTagManager', () => {
    createTagManagerWindow();
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

  ipcMain.handle('library:scan', (_event, folder: string) => scanMedia(folder));

  ipcMain.handle('library:adopt', (_event, folder: string) => {
    if (!folder) return null;
    const dataFile = libraryDataFile(folder);
    if (!fs.existsSync(dataFile)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as {
        libraryId?: string;
        libraryName?: string;
        media?: MediaItem[];
        series?: Series[];
      };
      return {
        libraryId: parsed.libraryId ?? null,
        libraryName: parsed.libraryName ?? null,
        media: (parsed.media ?? []).map((m) => ({
          ...m,
          filePath: resolveStoredPath(folder, m.filePath),
          ...(m.coverPath ? { coverPath: resolveStoredPath(folder, m.coverPath) } : {}),
        })),
        series: (parsed.series ?? []).map((s) => ({
          ...s,
          ...(s.coverPath ? { coverPath: resolveStoredPath(folder, s.coverPath) } : {}),
        })),
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
    const copied: string[] = [];
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
        copied.push(dest);
      } catch {
        /* 忽略单个失败 */
      }
    }
    return copied;
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