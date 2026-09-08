/** 应用级 IPC：数据加载/保存、标签保存、窗口打开、文件选择对话框 */

import { BrowserWindow, dialog, ipcMain } from 'electron';
import { MEDIA_EXTENSIONS } from '../constants';
import { loadData, saveData, saveTags } from '../dataStore';
import { createComicReaderWindow, createTagManagerWindow, getMainWindow, getTagManagerWindow, notifyTagsChanged } from '../windows';
import type { AppData, Tag } from '../types';

export function registerAppIpc(): void {
  ipcMain.handle('data:load', () => loadData());

  ipcMain.handle('data:save', (_event, data: AppData) => {
    try {
      saveData(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('tags:save', (_event, categories: string[], tags: Tag[]) => {
    const res = saveTags(categories, tags);
    if (res.ok) notifyTagsChanged();
    return res;
  });

  ipcMain.handle('window:openTagManager', () => {
    createTagManagerWindow();
    return { ok: true };
  });

  ipcMain.handle('reader:open', (_event, seriesId: string) => {
    if (!seriesId) return { ok: false, error: '无效的参数' };
    createComicReaderWindow(seriesId);
    return { ok: true };
  });

  ipcMain.handle('dialog:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择媒体文件夹',
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:pickFiles', async () => {
    const result = await dialog.showOpenDialog(getMainWindow() ?? undefined!, {
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
    const focusTarget = parent ?? getTagManagerWindow();
    if (focusTarget && !focusTarget.isDestroyed()) {
      focusTarget.show();
      focusTarget.focus();
    }
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
}
