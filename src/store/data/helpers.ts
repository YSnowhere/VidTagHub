/** dataSlice 的纯逻辑辅助：系列树遍历、模式判定、媒体对象工厂 */

import { nanoid } from '@reduxjs/toolkit';
import type { AppData, MediaItem, ScanResult, Series, SeriesMode } from '../../types';

/** 判断把 child 加入 parent 是否会造成循环嵌套（child 的子树已包含 parent） */
export function wouldCreateCycle(child: Series, parentId: string, all: Series[]): boolean {
  const stack = [...(child.memberSeriesIds ?? [])];
  while (stack.length) {
    const curId = stack.pop() as string;
    if (curId === parentId) return true;
    const cur = all.find((x) => x.id === curId);
    if (cur) stack.push(...(cur.memberSeriesIds ?? []));
  }
  return false;
}

/** 收集系列树（自身 + 全部子系列）中的媒体成员 */
export function collectTreeMembers(state: AppData, s: Series): MediaItem[] {
  const result: MediaItem[] = [];
  const visited = new Set<string>();
  const visit = (cur: Series): void => {
    if (visited.has(cur.id)) return;
    visited.add(cur.id);
    for (const id of cur.memberIds) {
      const m = state.media.find((x) => x.id === id);
      if (m) result.push(m);
    }
    for (const sid of cur.memberSeriesIds ?? []) {
      const sub = state.series.find((x) => x.id === sid);
      if (sub) visit(sub);
    }
  };
  visit(s);
  return result;
}

/** 判断一个系列（含子系列）是否全部由图片组成 */
export function isPureImageTree(state: AppData, s: Series): boolean {
  const visited = new Set<string>();
  const visit = (cur: Series): boolean => {
    if (visited.has(cur.id)) return false;
    visited.add(cur.id);
    const members = cur.memberIds
      .map((id) => state.media.find((m) => m.id === id))
      .filter((m): m is MediaItem => Boolean(m));
    if (members.length === 0 && (cur.memberSeriesIds?.length ?? 0) === 0) return false;
    if (members.some((m) => m.type !== 'image')) return false;
    for (const sid of cur.memberSeriesIds ?? []) {
      const sub = state.series.find((x) => x.id === sid);
      if (!sub || !visit(sub)) return false;
    }
    return true;
  };
  return visit(s);
}

/** 将成员图片的受限标记合并到系列本身（漫画模式丢弃成员前调用，避免 NSFW 信息丢失）；标签属于系列本身，不再合并 */
export function mergeMemberFlagsToSeries(state: AppData, s: Series): void {
  const members = collectTreeMembers(state, s);
  if (members.some((m) => m.restricted)) s.restricted = true;
}

/** 将某个系列的全部后代（子系列及嵌套子系列）的 mode 统一为指定值 */
export function setDescendantModes(state: AppData, rootId: string, mode: SeriesMode): void {
  const visit = (id: string): void => {
    const cur = state.series.find((s) => s.id === id);
    if (!cur) return;
    for (const sid of cur.memberSeriesIds ?? []) {
      const sub = state.series.find((s) => s.id === sid);
      if (sub) {
        sub.mode = mode;
        visit(sub.id);
      }
    }
  };
  visit(rootId);
}

/** 由扫描结果创建媒体条目（三个 reducers 共用的对象结构） */
export function createMediaItem(libraryId: string, file: ScanResult): MediaItem {
  return {
    id: nanoid(),
    libraryId,
    filePath: file.filePath,
    fileName: file.fileName,
    type: file.type,
    size: file.size,
    modifiedAt: file.modifiedAt,
    tags: [],
    description: '',
    createdAt: Date.now(),
    restricted: false,
  };
}
