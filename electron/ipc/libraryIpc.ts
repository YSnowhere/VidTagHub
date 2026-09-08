/** 库级 IPC：扫描、认领已有库、删除库数据、迁移数据目录、清理缓存 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { COVERS_DIR_NAME, THUMB_DIR_NAME } from '../constants';
import { loadData, loadGlobal, loadLibraryFile, saveData, saveGlobal } from '../dataStore';
import { movePath, scanLibrary } from '../fileOps';
import { getCoversDir, getDataDir, globalFile, setDataDir, tagsFile } from '../paths';
import { clearThumbCache } from '../thumbnails';

export function registerLibraryIpc(): void {
  ipcMain.handle('library:scan', (_event, folder: string) => scanLibrary(folder));

  ipcMain.handle('library:adopt', (_event, folder: string) => {
    if (!folder) return null;
    const dataFile = path.join(folder, '.vision-library.json');
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
      const oldCovers = getCoversDir();
      const newCovers = path.join(target, COVERS_DIR_NAME);
      const libPaths = new Set(data.libraries.map((l) => path.resolve(l.path)));
      fs.mkdirSync(target, { recursive: true });
      // 只迁移软件自身的业务数据文件/目录。
      // 注意：不能迁移 Electron/Chromium 运行时文件（Cache、Preferences、Local Storage 等），
      // 它们在运行期间会被进程占用而无法删除，若一并迁移会在原目录残留旧文件，
      // 且删除旧文件后会导致软件数据丢失的错觉。
      const APP_DATA_NAMES = new Set([
        path.basename(globalFile()),
        path.basename(tagsFile()),
        COVERS_DIR_NAME,
        THUMB_DIR_NAME,
      ]);
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
      setDataDir(target);
      try {
        saveData({ ...data, media, series, tags });
      } catch (err) {
        setDataDir(oldData);
        return { ok: false, error: String(err) };
      }
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

  ipcMain.handle('cache:clear', () => clearThumbCache());
}
