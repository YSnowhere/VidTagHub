import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowLeft20Regular, BookOpen20Regular, Home20Regular, SelectAllOff20Regular, TagMultiple20Regular } from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addSeriesMembers,
  createSeries,
} from '../store/dataSlice';
import {
  clearTagFilter,
  clearSelectedIds,
  clearSeriesView,
  setComicReaderSeries,
  setSelectedMedia,
  setSelectedSeries,
  setSelectionMode,
  setTagFilter,
  setView,
} from '../store/uiSlice';
import { VideoCard } from './VideoCard';
import { SeriesCard } from './SeriesCard';
import { TagBrowser } from './TagBrowser';
import { SeriesTitleDialog } from './SeriesTitleDialog';
import { memberIdSet, seriesEffectiveRestricted, seriesEffectiveTags, isPureImageSeries } from '../services/series';
import type { MediaItem, Series } from '../types';

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
    background: tokens.colorNeutralBackground2,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    flexWrap: 'wrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingHorizontalL} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalXXL}`,
  },
  empty: {
    margin: 'auto',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalXXL,
  },
});

type GridItem =
  | { kind: 'media'; media: MediaItem }
  | { kind: 'series'; series: Series };

export function MainArea() {
  const view = useAppSelector((s) => s.ui.view);

  if (view === 'tags') {
    return <TagBrowser />;
  }
  return <MediaGrid />;
}

function MediaGrid() {
  const dispatch = useAppDispatch();
  const media = useAppSelector((s) => s.data.media);
  const series = useAppSelector((s) => s.data.series);
  const tags = useAppSelector((s) => s.data.tags);
  const libraries = useAppSelector((s) => s.data.libraries);
  const selectedLibraryId = useAppSelector((s) => s.ui.selectedLibraryId);
  const selectedCategory = useAppSelector((s) => s.ui.selectedCategory);
  const search = useAppSelector((s) => s.ui.search);
  const tagFilter = useAppSelector((s) => s.ui.tagFilter);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const onlyNSFW = useAppSelector((s) => s.ui.onlyNSFW);
  const searchFields = useAppSelector((s) => s.ui.searchFields);
  const searchMode = useAppSelector((s) => s.ui.searchMode);
  const selectionMode = useAppSelector((s) => s.ui.selectionMode);
  const selectedIds = useAppSelector((s) => s.ui.selectedIds);
  const seriesTarget = useAppSelector((s) => s.ui.seriesTarget);
  const seriesViewId = useAppSelector((s) => s.ui.seriesViewId);
  const searchSubEpisodes = useAppSelector((s) => s.ui.searchSubEpisodes);
  const styles = useStyles();

  const viewingSeries = seriesViewId ? series.find((s) => s.id === seriesViewId) ?? null : null;

  const hiddenLibraryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lib of libraries) {
      if (!showNSFW && lib.nsfw) ids.add(lib.id);
      if (selectedLibraryId === null && lib.collapsed) ids.add(lib.id);
    }
    return ids;
  }, [libraries, showNSFW, selectedLibraryId]);

  const [titleDialog, setTitleDialog] = useState(false);

  const goHome = () => {
    dispatch(setSelectedMedia(null));
    dispatch(setTagFilter([]));
    dispatch(clearSeriesView());
    dispatch(setSelectionMode(false));
    dispatch(setView('media'));
  };

  const goUp = () => {
    if (viewingSeries) {
      dispatch(clearSeriesView());
      return;
    }
    if (selectedCategory) {
      dispatch(setTagFilter([]));
      dispatch(setView('tags'));
      return;
    }
    goHome();
  };

  const items = useMemo<GridItem[]>(() => {
    const keywords = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const tagName: Record<string, string> = {};
    tags.forEach((t) => {
      tagName[t.id] = t.name.toLowerCase();
    });
    const hiddenMembers = memberIdSet(series);

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

    const matchSeries = (s: Series): boolean => {
      if (hiddenLibraryIds.has(s.libraryId)) return false;
      if (selectedLibraryId && s.libraryId !== selectedLibraryId) return false;
      if (!showNSFW && seriesEffectiveRestricted(s, media)) return false;
      if (onlyNSFW && !seriesEffectiveRestricted(s, media)) return false;
      const effTags = seriesEffectiveTags(s, media);
      if (tagFilter.length && !tagFilter.every((t) => effTags.includes(t))) return false;
      if (keywords.length) {
        const hit = (kw: string): boolean => {
          const hitTitle = searchFields.name && matchesKeyword(s.title, kw);
          const hitTags = searchFields.tags && effTags.some((t) => (tagName[t] ?? '').includes(kw));
          const hitDesc = searchFields.description && matchesKeyword(s.description, kw);
          if (hitTitle || hitTags || hitDesc) return true;
          if (searchSubEpisodes) {
            return s.memberIds.some((id) => {
              const m = media.find((x) => x.id === id);
              return m ? mediaKeywordHit(m, kw) : false;
            });
          }
          return false;
        };
        return searchMode === 'or' ? keywords.some(hit) : keywords.every(hit);
      }
      return true;
    };

    let list: GridItem[];
    if (viewingSeries) {
      const members = viewingSeries.memberIds
        .map((id) => media.find((m) => m.id === id))
        .filter((m): m is MediaItem => Boolean(m));
      list = members
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
    } else {
      list = [
        ...media.filter(matchMedia).map((m) => ({ kind: 'media' as const, media: m })),
        ...series.filter(matchSeries).map((s) => ({ kind: 'series' as const, series: s })),
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

  const selectedTagNames = tagFilter.map((id) => tags.find((t) => t.id === id)?.name ?? id);
  const nsfwCount = useMemo(() => {
    const hiddenMembers = memberIdSet(series);
    let m = media.filter((x) => !hiddenMembers.has(x.id) && !hiddenLibraryIds.has(x.libraryId));
    let s = series.filter((x) => !hiddenLibraryIds.has(x.libraryId));
    if (selectedLibraryId) {
      m = m.filter((x) => x.libraryId === selectedLibraryId);
      s = s.filter((x) => x.libraryId === selectedLibraryId);
    }
    return m.filter((x) => x.restricted).length + s.filter((x) => x.restricted).length;
  }, [media, series, selectedLibraryId, hiddenLibraryIds]);

  const targetSeries = seriesTarget ? series.find((s) => s.id === seriesTarget) : null;

  const handleMerge = () => {
    if (selectedIds.length === 0) return;
    if (seriesTarget) {
      dispatch(addSeriesMembers({ id: seriesTarget, memberIds: selectedIds }));
      dispatch(setSelectionMode(false));
      dispatch(setSelectedSeries(seriesTarget));
      return;
    }
    const libId = selectedLibraryId ?? media.find((m) => selectedIds.includes(m.id))?.libraryId;
    if (!libId) return;
    setTitleDialog(true);
  };

  const handleCreateSeries = (title: string) => {
    const libId = selectedLibraryId ?? media.find((m) => selectedIds.includes(m.id))?.libraryId;
    if (!libId) return;
    const action = dispatch(createSeries({ libraryId: libId, title, memberIds: selectedIds }));
    setTitleDialog(false);
    dispatch(setSelectionMode(false));
    dispatch(setSelectedSeries(action.payload.id));
  };

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        {viewingSeries && (
          <Button appearance="outline" size="small" icon={<ArrowLeft20Regular />} onClick={goUp}>
            返回上级
          </Button>
        )}
        {!viewingSeries && tagFilter.length > 0 && (
          <>
            <Button appearance="outline" size="small" icon={<ArrowLeft20Regular />} onClick={goUp}>
              返回上级
            </Button>
            <Button appearance="subtle" size="small" icon={<Home20Regular />} onClick={goHome}>
              回到主页
            </Button>
          </>
        )}
        <Text size={300}>共 {items.length} 项</Text>
        {viewingSeries && (
          <Badge appearance="tint" color="brand">
            系列：{viewingSeries.title}
          </Badge>
        )}
        {viewingSeries && isPureImageSeries(viewingSeries, media) && (
          <Button
            appearance="primary"
            size="small"
            icon={<BookOpen20Regular />}
            onClick={() => dispatch(setComicReaderSeries(viewingSeries.id))}
          >
            漫画阅读
          </Button>
        )}
        {selectedTagNames.map((name) => (
          <Badge key={name} appearance="tint" color="brand">
            {name}
          </Badge>
        ))}
        {tagFilter.length > 0 && (
          <Button size="small" appearance="subtle" onClick={() => dispatch(clearTagFilter())}>
            清除标签筛选
          </Button>
        )}
        {!showNSFW && nsfwCount > 0 && (
          <Badge appearance="tint" color="danger">
            已隐藏 {nsfwCount} 条 NSFW
          </Badge>
        )}
        <div style={{ flex: 1 }} />
        <Button
          appearance={selectionMode ? 'primary' : 'outline'}
          size="small"
          icon={<SelectAllOff20Regular />}
          onClick={() => dispatch(setSelectionMode(!selectionMode))}
        >
          {selectionMode ? '退出多选' : '多选'}
        </Button>
        {selectionMode && (
          <>
            <Badge appearance="tint" color="brand">
              已选 {selectedIds.length} 项
            </Badge>
            {selectedIds.length > 0 && (
              <Button
                appearance="primary"
                size="small"
                icon={<TagMultiple20Regular />}
                onClick={handleMerge}
              >
                {targetSeries ? `加入「${targetSeries.title}」` : '合并为系列'}
              </Button>
            )}
            <Button size="small" appearance="subtle" onClick={() => dispatch(clearSelectedIds())}>
              清除
            </Button>
          </>
        )}
      </div>

      {libraries.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>还没有库，点击左上角「新建库」选择一个文件夹开始管理你的媒体</Text>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>{viewingSeries ? '该系列暂无剧集，可在右侧详情中添加媒体' : '没有找到匹配的媒体'}</Text>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((it) =>
            it.kind === 'media' ? (
              <VideoCard key={it.media.id} item={it.media} />
            ) : (
              <SeriesCard key={it.series.id} series={it.series} />
            )
          )}
        </div>
      )}

      <SeriesTitleDialog
        open={titleDialog}
        title=""
        confirmLabel="创建系列"
        onClose={() => setTitleDialog(false)}
        onConfirm={handleCreateSeries}
      />
    </div>
  );
}