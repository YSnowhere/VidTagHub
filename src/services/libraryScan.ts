import { nanoid } from '@reduxjs/toolkit';
import { store } from '../store';
import { applyScan, setMediaPaths, updateSeries } from '../store/dataSlice';
import type { AppDispatch } from '../store';
import type { FolderScan, ScanFolder, Series } from '../types';

const normPath = (p: string): string => p.replace(/[\\/]+/g, '/').toLowerCase();

export async function scanAndApplyLibrary(
  dispatch: AppDispatch,
  libraryId: string,
  libraryPath: string
): Promise<void> {
  const state = store.getState();
  const existingSeries = state.data.series.filter((s) => s.libraryId === libraryId);

  const legacySeries = existingSeries.filter((s) => !s.folderPath);
  if (legacySeries.length) {
    const payload = legacySeries.map((s) => ({
      id: s.id,
      title: s.title,
      memberFilePaths: s.memberIds
        .map((mid) => state.data.media.find((m) => m.id === mid)?.filePath)
        .filter((p): p is string => Boolean(p)),
    }));
    const mres = await window.electronAPI.migrateLegacySeries(libraryPath, payload);
    if (mres.ok && mres.migrated?.length) {
      const mediaUpdates: { id: string; filePath: string }[] = [];
      for (const item of mres.migrated) {
        for (const mv of item.moved ?? []) {
          const mediaItem = state.data.media.find((m) => m.filePath === mv.from);
          if (mediaItem) mediaUpdates.push({ id: mediaItem.id, filePath: mv.to });
        }
      }
      if (mediaUpdates.length) dispatch(setMediaPaths(mediaUpdates));
      for (const item of mres.migrated) {
        dispatch(updateSeries({ id: item.id, patch: { folderPath: item.folderPath, title: item.title } }));
      }
    }
  }

  const res = await window.electronAPI.scanLibrary(libraryPath);

  const assignIds = (folders: FolderScan[], existing: Series[]): ScanFolder[] =>
    folders.map((f) => {
      const known = f.markerId && existing.some((s) => s.id === f.markerId);
      const byPath =
        !known && existing.find((s) => s.folderPath && normPath(s.folderPath) === normPath(f.folderPath));
      const id = known ? (f.markerId as string) : byPath ? byPath.id : nanoid();
      return {
        ...f,
        id,
        subFolders: assignIds(f.subFolders, existing),
      };
    });
  const folders = assignIds(res.folders, existingSeries);

  dispatch(applyScan({ libraryId, media: res.media, folders }));

  const allFolders: ScanFolder[] = [];
  const collect = (list: ScanFolder[]): void => {
    for (const f of list) {
      allFolders.push(f);
      collect(f.subFolders);
    }
  };
  collect(folders);
  for (const f of allFolders) {
    if (!f.markerId || f.markerId !== f.id) {
      void window.electronAPI.markSeriesFolder(f.folderPath, f.id);
    }
  }
}