import type { MediaItem, Series } from '../types';

export function memberIdSet(seriesList: Series[]): Set<string> {
  const set = new Set<string>();
  for (const s of seriesList) {
    for (const id of s.memberIds) set.add(id);
  }
  return set;
}

export function seriesEffectiveTags(s: Series, media: MediaItem[]): string[] {
  const set = new Set<string>();
  for (const id of s.memberIds) {
    const m = media.find((x) => x.id === id);
    if (m) for (const t of m.tags) set.add(t);
  }
  return Array.from(set);
}

export function seriesEffectiveRestricted(s: Series, media: MediaItem[]): boolean {
  return s.restricted || s.memberIds.some((id) => media.find((m) => m.id === id)?.restricted ?? false);
}

export function seriesTypeText(s: Series, media: MediaItem[]): string {
  const members = s.memberIds
    .map((id) => media.find((m) => m.id === id))
    .filter((m): m is MediaItem => Boolean(m));
  const hasVideo = members.some((m) => m.type === 'video');
  const hasImage = members.some((m) => m.type === 'image');
  const hasPdf = members.some((m) => m.type === 'pdf');
  const parts: string[] = [];
  if (hasVideo) parts.push('视频');
  if (hasImage) parts.push('图片');
  if (hasPdf) parts.push('PDF');
  return parts.length > 0 ? parts.join(' / ') : '系列';
}

export function seriesTotalSize(s: Series, media: MediaItem[]): number {
  let total = 0;
  for (const id of s.memberIds) {
    const m = media.find((x) => x.id === id);
    if (m) total += m.size;
  }
  return total;
}

export function seriesMembers(s: Series, media: MediaItem[]): MediaItem[] {
  return s.memberIds
    .map((id) => media.find((m) => m.id === id))
    .filter((m): m is MediaItem => Boolean(m))
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh', { numeric: true, sensitivity: 'base' }));
}

export function seriesCoverCandidates(s: Series, media: MediaItem[]): { member: MediaItem; coverPath: string }[] {
  const result: { member: MediaItem; coverPath: string }[] = [];
  for (const m of seriesMembers(s, media)) {
    if (m.type === 'image') {
      result.push({ member: m, coverPath: m.coverPath ?? m.filePath });
    } else if (m.coverPath) {
      result.push({ member: m, coverPath: m.coverPath });
    }
  }
  return result;
}