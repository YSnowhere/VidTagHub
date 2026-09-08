import type { MediaItem, Series } from '../types';

export function memberIdSet(seriesList: Series[]): Set<string> {
  const set = new Set<string>();
  for (const s of seriesList) {
    for (const id of s.memberIds) set.add(id);
  }
  return set;
}

export function memberSeriesIdSet(seriesList: Series[]): Set<string> {
  const set = new Set<string>();
  for (const s of seriesList) {
    for (const id of s.memberSeriesIds ?? []) set.add(id);
  }
  return set;
}

export function seriesSubSeries(s: Series, allSeries: Series[]): Series[] {
  return (s.memberSeriesIds ?? [])
    .map((id) => allSeries.find((x) => x.id === id))
    .filter((x): x is Series => Boolean(x))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh', { numeric: true, sensitivity: 'base' }));
}

export function seriesSubSeriesCount(s: Series): number {
  return (s.memberSeriesIds ?? []).length;
}

/** 收集系列树（自身 + 全部子系列）中按顺序排列的媒体成员 */
export function seriesTreeMembers(s: Series, allSeries: Series[], media: MediaItem[]): MediaItem[] {
  const result: MediaItem[] = [];
  const visited = new Set<string>();
  const visit = (cur: Series): void => {
    if (visited.has(cur.id)) return;
    visited.add(cur.id);
    result.push(...seriesMembers(cur, media));
    for (const sub of seriesSubSeries(cur, allSeries)) visit(sub);
  };
  visit(s);
  return result;
}

/** 系列成员不再支持单独添加标签，标签与类型属于系列本身（全系列共享） */
export function seriesContainingMedia(m: MediaItem, allSeries: Series[], media: MediaItem[]): Series | undefined {
  for (const s of allSeries) {
    if (seriesTreeMembers(s, allSeries, media).some((x) => x.id === m.id)) return s;
  }
  return undefined;
}

/** 系列的标签属于系列本身，只返回直接设置在系列上的标签，不再汇总成员文件的标签 */
export function seriesEffectiveTags(s: Series, _allSeries: Series[], _media: MediaItem[]): string[] {
  return Array.from(s.tags ?? []);
}

/** 该系列是否处于「漫画」模式（纯图片系列隐藏细分、不入 JSON、直接阅读） */
export function isComicSeries(s: Series): boolean {
  return s.mode === 'comic';
}

/** 漫画叶子：漫画模式下没有子系列，展开无意义，卡片以「漫画阅读」为主入口 */
export function isComicLeaf(s: Series): boolean {
  return s.mode === 'comic' && (s.memberSeriesIds?.length ?? 0) === 0;
}

export function seriesEffectiveRestricted(s: Series, allSeries: Series[], media: MediaItem[]): boolean {
  return s.restricted || seriesTreeMembers(s, allSeries, media).some((m) => m.restricted);
}

/** 类型徽章文案：漫画模式显示「漫画」；同为一种文件显示文件类型；混合型（如图片+视频）显示「系列」 */
export function seriesTypeLabel(s: Series, allSeries: Series[], media: MediaItem[]): string {
  if (isComicSeries(s)) return '漫画';
  const members = seriesTreeMembers(s, allSeries, media);
  if (members.length === 0) return '系列';
  const kinds = new Set(members.map((m) => m.type));
  if (kinds.size === 1) {
    if (kinds.has('image')) return '图片';
    if (kinds.has('video')) return '视频';
    return 'PDF';
  }
  return '系列';
}

/** 一级系列：不是任何其他系列的子系列（漫画/图片模式只能在顶级系列详情修改） */
export function isTopLevelSeries(s: Series, allSeries: Series[]): boolean {
  return !allSeries.some((x) => x.id !== s.id && (x.memberSeriesIds ?? []).includes(s.id));
}

export function seriesTotalSize(s: Series, allSeries: Series[], media: MediaItem[]): number {
  let total = 0;
  for (const m of seriesTreeMembers(s, allSeries, media)) total += m.size;
  return total;
}

export function seriesMembers(s: Series, media: MediaItem[]): MediaItem[] {
  return s.memberIds
    .map((id) => media.find((m) => m.id === id))
    .filter((m): m is MediaItem => Boolean(m))
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh', { numeric: true, sensitivity: 'base' }));
}

export function isPureImageSeries(s: Series, allSeries: Series[], media: MediaItem[]): boolean {
  const members = seriesTreeMembers(s, allSeries, media);
  if (members.length === 0) return false;
  return members.every((m) => m.type === 'image');
}

export function seriesCoverCandidates(
  s: Series,
  allSeries: Series[],
  media: MediaItem[]
): { member: MediaItem; coverPath: string }[] {
  const result: { member: MediaItem; coverPath: string }[] = [];
  for (const m of seriesTreeMembers(s, allSeries, media)) {
    if (m.type === 'image') {
      result.push({ member: m, coverPath: m.coverPath ?? m.filePath });
    } else if (m.coverPath) {
      result.push({ member: m, coverPath: m.coverPath });
    }
  }
  return result;
}