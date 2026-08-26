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

export function seriesEffectiveTags(s: Series, allSeries: Series[], media: MediaItem[]): string[] {
  const set = new Set<string>();
  for (const m of seriesTreeMembers(s, allSeries, media)) {
    for (const t of m.tags) set.add(t);
  }
  return Array.from(set);
}

export function seriesEffectiveRestricted(s: Series, allSeries: Series[], media: MediaItem[]): boolean {
  return s.restricted || seriesTreeMembers(s, allSeries, media).some((m) => m.restricted);
}

export function seriesTypeText(s: Series, allSeries: Series[], media: MediaItem[]): string {
  const members = seriesTreeMembers(s, allSeries, media);
  const hasVideo = members.some((m) => m.type === 'video');
  const hasImage = members.some((m) => m.type === 'image');
  const hasPdf = members.some((m) => m.type === 'pdf');
  const parts: string[] = [];
  if (hasVideo) parts.push('视频');
  if (hasImage) parts.push('图片');
  if (hasPdf) parts.push('PDF');
  return parts.length > 0 ? parts.join(' / ') : '系列';
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