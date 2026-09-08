/** 主进程入口：注册自定义协议、初始化缓存、装配 IPC 与窗口。
 *  具体实现按领域拆分在：types/constants/paths/seriesFolder/fileOps/dataStore/thumbnails/
 *  mediaProtocol/windows/ipc/*，本文件只负责装配与生命周期。 */

import { app, BrowserWindow, Menu } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { registerIpc } from './ipc';
import { handleMediaProtocol, registerMediaScheme } from './mediaProtocol';
import { initThumbCache } from './thumbnails';
import { createWindow } from './windows';

// 自定义协议必须在 app ready 之前完成注册
registerMediaScheme();

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  initThumbCache();

  // 迁移：删除旧版全局数据文件，数据改为存储在对应的库文件夹中
  try {
    fs.rmSync(path.join(app.getPath('userData'), 'vision-library-data.json'), { force: true });
  } catch {
    /* ignore */
  }

  handleMediaProtocol();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
