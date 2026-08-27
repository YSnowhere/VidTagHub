import { store } from '../store';
import { addSeriesMembers, setMediaPaths, updateSeries } from '../store/dataSlice';
import type { AppDispatch } from '../store';
import type { MovedFile, Series } from '../types';

const normPath = (p: string): string => p.replace(/[\\/]+/g, '/').toLowerCase();
const dirnamePath = (p: string): string => p.replace(/[\\/]+[^\\/]*$/, '');

/** 将磁盘移动记录转换为媒体路径更新（按旧路径匹配媒体） */
export function applyMovedFiles(moved: MovedFile[]): { id: string; filePath: string }[] {
  const state = store.getState();
  const updates: { id: string; filePath: string }[] = [];
  for (const mv of moved ?? []) {
    const m = state.data.media.find((x) => x.filePath === mv.from);
    if (m) updates.push({ id: m.id, filePath: mv.to });
  }
  return updates;
}

// 子系列文件夹移动后，同步其自身及所有后代系列的 folderPath
function updateDescendantFolderPaths(sub: Series, oldPath: string, newPath: string, dispatch: AppDispatch): void {
  if (oldPath === newPath) return;
  dispatch(updateSeries({ id: sub.id, patch: { folderPath: newPath } }));
  const state = store.getState();
  for (const s of state.data.series) {
    if (s.id === sub.id) continue;
    if (s.folderPath && s.folderPath.startsWith(oldPath)) {
      dispatch(updateSeries({ id: s.id, patch: { folderPath: newPath + s.folderPath.slice(oldPath.length) } }));
    }
  }
}

/** 将若干子系列文件夹移动到父系列文件夹内，并同步状态 */
export async function moveSubSeriesInto(
  parentFolderPath: string,
  seriesIds: string[],
  dispatch: AppDispatch
): Promise<void> {
  const updates: { id: string; filePath: string }[] = [];
  for (const sid of seriesIds) {
    const sub = store.getState().data.series.find((s) => s.id === sid);
    if (!sub?.folderPath) continue;
    const res = await window.electronAPI.moveSeriesFolderInto(sub.folderPath, parentFolderPath);
    if (!res.ok) continue;
    if (res.moved?.length) updates.push(...applyMovedFiles(res.moved));
    if (res.newFolderPath) {
      updateDescendantFolderPaths(sub, sub.folderPath, res.newFolderPath, dispatch);
    }
  }
  if (updates.length) dispatch(setMediaPaths(updates));
}

/** 将子系列文件夹移出父系列（移到父系列同级的兄弟位置），并同步状态 */
export async function moveSubSeriesOut(
  parentFolderPath: string,
  sub: Series,
  dispatch: AppDispatch
): Promise<void> {
  if (!sub.folderPath) return;
  const res = await window.electronAPI.moveSeriesFolderOut(sub.folderPath, parentFolderPath);
  if (!res.ok) return;
  if (res.moved?.length) dispatch(setMediaPaths(applyMovedFiles(res.moved)));
  if (res.newFolderPath) {
    updateDescendantFolderPaths(sub, sub.folderPath, res.newFolderPath, dispatch);
  }
}

/** 将媒体文件移出系列文件夹（移到系列文件夹的上级目录），并同步状态 */
export async function moveMediaOutOfSeries(
  seriesFolderPath: string,
  mediaIds: string[],
  dispatch: AppDispatch
): Promise<void> {
  const state = store.getState();
  const files = mediaIds
    .map((id) => state.data.media.find((m) => m.id === id)?.filePath)
    .filter((p): p is string => Boolean(p));
  if (!files.length) return;
  const res = await window.electronAPI.moveSeriesMembersOut(seriesFolderPath, files);
  if (!res.ok) return;
  const moved = res.moved ?? [];
  if (moved.length) dispatch(setMediaPaths(applyMovedFiles(moved)));

  // 文件移出后落在上级目录：若该目录正好是某个系列的文件夹，则将其纳入该系列（而不是显示为库根目录的散落文件）
  const live = store.getState();
  const parentDir = dirnamePath(seriesFolderPath);
  const parentSeries = live.data.series.find(
    (s) => s.folderPath && normPath(s.folderPath) === normPath(parentDir)
  );
  if (!parentSeries) return;
  const movedIds = moved
    .map((mv) => live.data.media.find((m) => m.filePath === mv.to)?.id)
    .filter((id): id is string => Boolean(id));
  if (movedIds.length) {
    dispatch(addSeriesMembers({ id: parentSeries.id, memberIds: movedIds }));
  }
}