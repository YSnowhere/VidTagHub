/** 系列级 IPC：系列文件夹的创建、标记、移动、重命名、解散、删除与成员枚举 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { dissolveFolder, listMediaInFolder, moveFilesIntoFolder, movePath, moveSeriesFolder, sanitizeFolderName, uniqueFolderPath } from '../fileOps';
import { getDataDir, seriesMarkerFile } from '../paths';
import { app } from 'electron';
import type { LegacySeriesPayload, MovedFile } from '../types';

export function registerSeriesIpc(): void {
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
}
