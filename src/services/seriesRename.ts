/** 系列重命名：磁盘文件夹改名后，递归同步所有后代系列的路径与媒体文件路径，避免路径断链 */

import { setMediaPaths, updateSeries } from '../store/dataSlice';
import type { AppDispatch } from '../store';
import type { MediaItem, Series } from '../types';
import { translatePath } from './seriesMove';

/**
 * 重命名系列。
 * - 无文件夹：只改标题。
 * - 有文件夹：先让主进程重命名文件夹，再同步自身 title/folderPath/coverPath，
 *   递归修正所有后代系列的 folderPath/coverPath，并按移动日志更新媒体文件路径。
 */
export async function renameSeries(
  dispatch: AppDispatch,
  series: Series,
  allSeries: Series[],
  media: MediaItem[],
  title: string
): Promise<void> {
  if (!series.folderPath) {
    dispatch(updateSeries({ id: series.id, patch: { title } }));
    return;
  }
  const res = await window.electronAPI.renameSeriesFolder(series.folderPath, title);
  if (!res.ok || !res.folderPath) return;

  const oldPath = series.folderPath;
  const newPath = res.folderPath;
  dispatch(
    updateSeries({
      id: series.id,
      patch: {
        title: res.title ?? title,
        folderPath: newPath,
        coverPath: translatePath(series.coverPath, oldPath, newPath),
      },
    })
  );

  // 关键修复：递归同步所有后代系列的 folderPath / coverPath（避免路径断链）
  for (const d of allSeries) {
    if (d.id === series.id) continue;
    if (d.folderPath && d.folderPath.startsWith(oldPath)) {
      dispatch(
        updateSeries({
          id: d.id,
          patch: {
            folderPath: newPath + d.folderPath.slice(oldPath.length),
            coverPath: translatePath(d.coverPath, oldPath, newPath),
          },
        })
      );
    }
  }

  // 同步文件夹内媒体文件路径
  if (res.moved?.length) {
    const updates: { id: string; filePath: string }[] = [];
    for (const mv of res.moved) {
      const m = media.find((x) => x.filePath === mv.from);
      if (m) updates.push({ id: m.id, filePath: mv.to });
    }
    if (updates.length) dispatch(setMediaPaths(updates));
  }
}
