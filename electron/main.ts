import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron';
import { spawn } from 'child_process';
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

interface AppSettings {
  playerPath: string;
}

interface AppData {
  libraries: Library[];
  categories: string[];
  tags: Tag[];
  media: MediaItem[];
  settings: AppSettings;
}

interface GlobalData {
  libraries: Library[];
  settings: AppSettings;
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
  settings: { playerPath: '' },
};

let mainWindow: BrowserWindow | null = null;

const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

function globalFile(): string {
  return path.join(app.getPath('userData'), 'vision-libraries.json');
}

function tagsFile(): string {
  return path.join(app.getPath('userData'), 'vision-tags.json');
}

function libraryDataFile(libPath: string): string {
  return path.join(libPath, '.vision-library.json');
}

function loadGlobal(): GlobalData {
  try {
    if (!fs.existsSync(globalFile())) return clone(DEFAULT_GLOBAL);
    const parsed = JSON.parse(fs.readFileSync(globalFile(), 'utf-8')) as Partial<GlobalData>;
    return {
      libraries: parsed.libraries ?? [],
      settings: { ...DEFAULT_GLOBAL.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return clone(DEFAULT_GLOBAL);
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

function loadLibraryFile(libPath: string): MediaItem[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(libraryDataFile(libPath), 'utf-8')) as {
      media?: MediaItem[];
    };
    return parsed.media ?? [];
  } catch {
    return [];
  }
}

function loadData(): AppData {
  const global = loadGlobal();
  const tagData = loadTags();
  const media: MediaItem[] = [];
  for (const lib of global.libraries) {
    media.push(...loadLibraryFile(lib.path));
  }
  return {
    libraries: global.libraries,
    categories: tagData.categories,
    tags: tagData.tags,
    media,
    settings: global.settings,
  };
}

function saveData(data: AppData): void {
  const global: GlobalData = {
    libraries: data.libraries.map((l) => ({ id: l.id, name: l.name, path: l.path })),
    settings: data.settings,
  };
  fs.mkdirSync(path.dirname(globalFile()), { recursive: true });
  fs.writeFileSync(globalFile(), JSON.stringify(global, null, 2), 'utf-8');

  const tagData: TagData = {
    categories: data.categories,
    tags: data.tags,
  };
  fs.mkdirSync(path.dirname(tagsFile()), { recursive: true });
  fs.writeFileSync(tagsFile(), JSON.stringify(tagData, null, 2), 'utf-8');

  for (const lib of data.libraries) {
    try {
      fs.mkdirSync(lib.path, { recursive: true });
      const libData = {
        media: data.media.filter((m) => m.libraryId === lib.id),
      };
      fs.writeFileSync(libraryDataFile(lib.path), JSON.stringify(libData, null, 2), 'utf-8');
    } catch {
      /* 文件夹可能不可用，忽略 */
    }
  }
}

function findPotPlayer(): string | null {
  const candidates = [
    'C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe',
    'C:\\Program Files (x86)\\DAUM\\PotPlayer\\PotPlayerMini64.exe',
    'C:\\Program Files\\PotPlayer\\PotPlayerMini64.exe',
    'C:\\Program Files (x86)\\PotPlayer\\PotPlayerMini64.exe',
    'D:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe',
    'D:\\Program Files (x86)\\PotPlayer\\PotPlayerMini64.exe',
    'C:\\Users\\' + (process.env.USERNAME ?? '') + '\\AppData\\Local\\Programs\\PotPlayer\\PotPlayerMini64.exe',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
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

function registerIpc(): void {
  ipcMain.handle('data:load', () => loadData());

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

  ipcMain.handle('dialog:pickImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined!, {
      properties: ['openFile'],
      title: '选择封面图片',
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:pickPlayer', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined!, {
      properties: ['openFile'],
      title: '选择播放器程序',
      filters: [
        { name: '可执行文件', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('player:detect', () => findPotPlayer());

  ipcMain.handle('library:scan', (_event, folder: string) => scanMedia(folder));

  ipcMain.handle('folder:ensure', (_event, folderPath: string) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('folder:remove', (_event, folderPath: string) => {
    if (!folderPath) return { ok: false, error: '路径无效' };
    const root = path.parse(folderPath).root;
    if (folderPath === root || folderPath.length < root.length + 2) {
      return { ok: false, error: '拒绝删除根目录或系统盘' };
    }
    try {
      fs.rmSync(folderPath, { recursive: true, force: true });
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

  ipcMain.handle('player:open', (_event, playerPath: string, filePath: string) => {
    if (!playerPath || !fs.existsSync(playerPath)) {
      return { ok: false, error: '播放器路径无效，请先在设置中配置播放器' };
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, error: '文件不存在' };
    }
    try {
      const child = spawn(playerPath, [filePath], { detached: true, stdio: 'ignore' });
      child.unref();
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
}

app.whenReady().then(() => {
  // 迁移：删除旧版全局数据文件，数据改为存储在对应的库文件夹中
  try {
    fs.rmSync(path.join(app.getPath('userData'), 'vision-library-data.json'), { force: true });
  } catch {
    /* ignore */
  }

  protocol.handle('media', async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return new Response('Not Found', { status: 404 });
    }
    const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    const stat = fs.statSync(filePath);
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