/** 窗口管理：主窗口、标签管理窗口、漫画阅读窗口的创建与互相通信 */

import { BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let tagManagerWindow: BrowserWindow | null = null;
let comicReaderWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getTagManagerWindow(): BrowserWindow | null {
  return tagManagerWindow;
}

/** 统一的安全 webPreferences（隔离上下文、禁用 node 集成、保持 webSecurity） */
const windowOptions = (): Electron.BrowserWindowConstructorOptions => ({
  icon: path.join(__dirname, '..', 'icon.ico'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
  },
});

/** 开发模式加载 dev server，生产模式加载打包后的 index.html（可附带查询串） */
function loadAppPage(win: BrowserWindow, search?: string): void {
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    void win.loadURL(search ? `${devUrl}?${search}` : devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'index.html'), search ? { search } : undefined);
  }
}

export function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'VidTagHub',
    ...windowOptions(),
  });

  loadAppPage(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

export function createTagManagerWindow(): void {
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
    ...windowOptions(),
  });

  loadAppPage(tagManagerWindow, 'page=tagmanager');

  tagManagerWindow.on('closed', () => {
    tagManagerWindow = null;
  });
}

/** 打开漫画阅读窗口；已存在时改为通知它切换系列，避免重复开窗 */
export function createComicReaderWindow(seriesId: string): void {
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
    ...windowOptions(),
  });

  loadAppPage(comicReaderWindow, `page=comicreader&series=${encodeURIComponent(seriesId)}`);

  comicReaderWindow.on('closed', () => {
    comicReaderWindow = null;
  });
}

/** 标签在标签管理窗口被修改后，通知主窗口刷新 */
export function notifyTagsChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tags:changed');
  }
}
