/** 文件级 IPC：导入、删除、重命名、截帧/裁剪保存、用系统程序打开 */

import { ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getCoversDir } from '../paths';

export function registerFileIpc(): void {
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
}
