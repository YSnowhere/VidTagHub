/** 主区域列表的过滤与排序：关键词/标签/库/NSFW 过滤，系列展开视图与库根视图统一处理 */

import { useMemo } from 'react';
import {
  isComicLeaf,
  memberIdSet,
  memberSeriesIdSet,
  seriesEffectiveRestricted,
  seriesEffectiveTags,
  seriesSubSeries,
  seriesTreeMembers,
} from '../../services/series';
import type { MediaItem, Series, Tag } from '../../types';

export type GridItem =
  | { kind: 'media'; media: MediaItem }
  | { kind: 'series'; series: Series };

export interface GridFilterOptions {
  media: MediaItem[];
  series: Series[];
  tags: Tag[];
  selectedLibraryId: string | null;
  search: string;
  tagFilter: string[];
  showNSFW: boolean;
  onlyNSFW: boolean;
  searchFields: Record<'name' | 'tags' | 'description', boolean>;
  searchMode: 'and' | 'or';
  searchSubEpisodes: boolean;
  /** 当前被隐藏的库（NSFW 未开启 / 折叠） */
  hiddenLibraryIds: Set<string>;
  /** 非空表示当前处于「展开某个系列」视图 */
  viewingSeries: Series | null;
}

/** 依据当前筛选条件得到要展示的网格条目（媒体 + 系列），并按名称自然排序 */
export function useGridItems(opts: GridFilterOptions): GridItem[] {
  const {
    media,
    series,
    tags,
    selectedLibraryId,
    search,
    tagFilter,
    showNSFW,
    onlyNSFW,
    searchFields,
    searchMode,
    searchSubEpisodes,
    hiddenLibraryIds,
    viewingSeries,
  } = opts;

  return useMemo<GridItem[]>(() => {
    const keywords = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const tagName: Record<string, string> = {};
    tags.forEach((t) => {
      tagName[t.id] = t.name.toLowerCase();
    });
    const hiddenMembers = memberIdSet(series);
    const hiddenSubSeries = memberSeriesIdSet(series);

    const matchesKeyword = (text: string, kw: string): boolean => text.toLowerCase().includes(kw);
    const mediaKeywordHit = (m: MediaItem, kw: string): boolean => {
      const hitName = searchFields.name && matchesKeyword(m.fileName, kw);
      const hitTags = searchFields.tags && m.tags.some((t) => (tagName[t] ?? '').includes(kw));
      const hitDesc = searchFields.description && matchesKeyword(m.description, kw);
      return hitName || hitTags || hitDesc;
    };

    const matchMedia = (m: MediaItem): boolean => {
      if (hiddenMembers.has(m.id)) return false;
      if (hiddenLibraryIds.has(m.libraryId)) return false;
      if (selectedLibraryId && m.libraryId !== selectedLibraryId) return false;
      if (!showNSFW && m.restricted) return false;
      if (onlyNSFW && !m.restricted) return false;
      if (tagFilter.length && !tagFilter.every((t) => m.tags.includes(t))) return false;
      if (keywords.length) {
        return searchMode === 'or'
          ? keywords.some((kw) => mediaKeywordHit(m, kw))
          : keywords.every((kw) => mediaKeywordHit(m, kw));
      }
      return true;
    };

    const matchSeries = (s: Series, withinView: boolean): boolean => {
      if (!withinView && hiddenSubSeries.has(s.id)) return false;
      if (hiddenLibraryIds.has(s.libraryId)) return false;
      if (selectedLibraryId && s.libraryId !== selectedLibraryId) return false;
      if (!showNSFW && seriesEffectiveRestricted(s, series, media)) return false;
      if (onlyNSFW && !seriesEffectiveRestricted(s, series, media)) return false;
      const effTags = seriesEffectiveTags(s, series, media);
      if (tagFilter.length && !tagFilter.every((t) => effTags.includes(t))) return false;
      if (keywords.length) {
        const hit = (kw: string): boolean => {
          const hitTitle = searchFields.name && matchesKeyword(s.title, kw);
          const hitTags = searchFields.tags && effTags.some((t) => (tagName[t] ?? '').includes(kw));
          const hitDesc = searchFields.description && matchesKeyword(s.description, kw);
          if (hitTitle || hitTags || hitDesc) return true;
          if (searchSubEpisodes) {
            if (seriesSubSeries(s, series).some((sub) => matchesKeyword(sub.title, kw))) return true;
            return seriesTreeMembers(s, series, media).some((m) => mediaKeywordHit(m, kw));
          }
          return false;
        };
        return searchMode === 'or' ? keywords.some(hit) : keywords.every(hit);
      }
      return true;
    };

    let list: GridItem[];
    if (viewingSeries) {
      if (isComicLeaf(viewingSeries)) {
        // 漫画叶子：不显示细分与成员媒体，仅保留漫画阅读功能
        list = [];
      } else {
        const subItems = seriesSubSeries(viewingSeries, series)
          .filter((s) => matchSeries(s, true))
          .map((s) => ({ kind: 'series' as const, series: s }));
        const mediaItems = viewingSeries.memberIds
          .map((id) => media.find((m) => m.id === id))
          .filter((m): m is MediaItem => Boolean(m))
          .filter((m) => {
            if (!showNSFW && m.restricted) return false;
            if (onlyNSFW && !m.restricted) return false;
            if (keywords.length) {
              return searchMode === 'or'
                ? keywords.some((kw) => mediaKeywordHit(m, kw))
                : keywords.every((kw) => mediaKeywordHit(m, kw));
            }
            return true;
          })
          .map((m) => ({ kind: 'media' as const, media: m }));
        list = [...subItems, ...mediaItems];
      }
    } else {
      list = [
        ...media.filter(matchMedia).map((m) => ({ kind: 'media' as const, media: m })),
        ...series.filter((s) => matchSeries(s, false)).map((s) => ({ kind: 'series' as const, series: s })),
      ];
    }
    return list.sort((a, b) => {
      const na = a.kind === 'media' ? a.media.fileName : a.series.title;
      const nb = b.kind === 'media' ? b.media.fileName : b.series.title;
      return na.localeCompare(nb, 'zh', { numeric: true, sensitivity: 'base' });
    });
  }, [
    media,
    series,
    tags,
    selectedLibraryId,
    search,
    tagFilter,
    showNSFW,
    onlyNSFW,
    searchFields,
    searchMode,
    searchSubEpisodes,
    viewingSeries,
    hiddenLibraryIds,
  ]);
}
