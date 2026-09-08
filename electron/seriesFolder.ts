/** 系列文件夹数据文件（.vision-series.json）的读写，以及系列树的成员收集 */

import * as fs from 'fs';
import { seriesMarkerFile } from './paths';
import type { MediaItem, Series, SeriesFolderData } from './types';

/** 读取系列标记文件中的 id（不存在或损坏返回 null） */
export function readSeriesMarker(folderPath: string): { id?: string } | null {
  try {
    if (!fs.existsSync(seriesMarkerFile(folderPath))) return null;
    return JSON.parse(fs.readFileSync(seriesMarkerFile(folderPath), 'utf-8')) as { id?: string };
  } catch {
    return null;
  }
}

/** 读取系列文件夹数据文件（标记 id + 可选的具体媒体信息） */
export function readSeriesFolderData(folderPath: string): SeriesFolderData | null {
  try {
    if (!fs.existsSync(seriesMarkerFile(folderPath))) return null;
    return JSON.parse(fs.readFileSync(seriesMarkerFile(folderPath), 'utf-8')) as SeriesFolderData;
  } catch {
    return null;
  }
}

/** 计算某个系列（含后代系列）的全部媒体成员 */
export function collectTreeMembers(s: Series, allSeries: Series[], media: MediaItem[]): MediaItem[] {
  const result: MediaItem[] = [];
  const visited = new Set<string>();
  const visit = (cur: Series): void => {
    if (visited.has(cur.id)) return;
    visited.add(cur.id);
    for (const id of cur.memberIds) {
      const m = media.find((x) => x.id === id);
      if (m) result.push(m);
    }
    for (const sid of cur.memberSeriesIds ?? []) {
      const sub = allSeries.find((x) => x.id === sid);
      if (sub) visit(sub);
    }
  };
  visit(s);
  return result;
}
