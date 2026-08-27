import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowLeft20Regular, BookOpen20Regular, DismissCircle20Regular, Home20Regular, SelectAllOff20Regular, Tag20Regular, TagMultiple20Regular } from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addSeriesMembers,
  addSubSeries,
  addTagToMediaBatch,
  createSeries,
  removeSeriesMember,
  removeSubSeries,
  setMediaPaths,
  setMediaRestrictedBatch,
  updateSeries,
} from '../store/dataSlice';
import {
  clearTagFilter,
  clearSelectedIds,
  clearSeriesView,
  setSelectedIds,
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
import { BatchTagDialog } from './BatchTagDialog';
import { moveMediaOutOfSeries, moveSubSeriesInto, moveSubSeriesOut } from '../services/seriesMove';
import {
  memberIdSet,
  memberSeriesIdSet,
  seriesEffectiveRestricted,
  seriesEffectiveTags,
  seriesSubSeries,
  seriesTreeMembers,
  isPureImageSeries,
} from '../services/series';
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
  const [batchTagOpen, setBatchTagOpen] = useState(false);

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

  const selectedTagNames = tagFilter.map((id) => tags.find((t) => t.id === id)?.name ?? id);
  const nsfwCount = useMemo(() => {
    const hiddenMembers = memberIdSet(series);
    const hiddenSubSeries = memberSeriesIdSet(series);
    let m = media.filter((x) => !hiddenMembers.has(x.id) && !hiddenLibraryIds.has(x.libraryId));
    let s = series.filter(
      (x) => !hiddenLibraryIds.has(x.libraryId) && !hiddenSubSeries.has(x.id)
    );
    if (selectedLibraryId) {
      m = m.filter((x) => x.libraryId === selectedLibraryId);
      s = s.filter((x) => x.libraryId === selectedLibraryId);
    }
    return m.filter((x) => x.restricted).length + s.filter((x) => x.restricted).length;
  }, [media, series, selectedLibraryId, hiddenLibraryIds]);

  const targetSeries = seriesTarget ? series.find((s) => s.id === seriesTarget) : null;

  const batchTargetIds = useMemo(() => {
    const ids: string[] = [];
    const push = (id: string): void => {
      if (!ids.includes(id)) ids.push(id);
    };
    for (const id of selectedIds) {
      const m = media.find((x) => x.id === id);
      if (m) {
        push(id);
        continue;
      }
      const s = series.find((x) => x.id === id);
      if (s) {
        for (const mid of seriesTreeMembers(s, series, media)) push(mid.id);
      }
    }
    return ids;
  }, [selectedIds, media, series]);

  const resolveMovedUpdates = (moved: { from: string; to: string }[]) => {
    const updates: { id: string; filePath: string }[] = [];
    for (const m of moved) {
      const id = selectedIds.find(
        (sid) => media.find((x) => x.id === sid)?.filePath === m.from
      );
      if (id) updates.push({ id, filePath: m.to });
    }
    return updates;
  };

  const handleMerge = async () => {
    if (selectedIds.length === 0) return;
    if (seriesTarget) {
      if (targetSeries?.folderPath) {
        const files = selectedIds
          .map((id) => media.find((m) => m.id === id)?.filePath)
          .filter((p): p is string => Boolean(p));
        if (files.length) {
          const res = await window.electronAPI.moveSeriesMembers(targetSeries.folderPath, files);
          if (res.ok && res.moved?.length) {
            dispatch(setMediaPaths(resolveMovedUpdates(res.moved)));
          }
        }
      }
      const mediaIds = selectedIds.filter((id) => media.some((m) => m.id === id));
      const seriesIds = selectedIds.filter((id) => series.some((s) => s.id === id));
      if (mediaIds.length) dispatch(addSeriesMembers({ id: seriesTarget, memberIds: mediaIds }));
      if (seriesIds.length) {
        if (targetSeries?.folderPath) {
          await moveSubSeriesInto(targetSeries.folderPath, seriesIds, dispatch);
        }
        dispatch(addSubSeries({ id: seriesTarget, seriesIds }));
      }
      dispatch(setSelectionMode(false));
      dispatch(setSelectedSeries(seriesTarget));
      return;
    }
    const libId =
      selectedLibraryId ??
      media.find((m) => selectedIds.includes(m.id))?.libraryId ??
      series.find((s) => selectedIds.includes(s.id))?.libraryId;
    if (!libId) return;
    setTitleDialog(true);
  };

  const handleCreateSeries = async (title: string) => {
    const libId =
      selectedLibraryId ??
      media.find((m) => selectedIds.includes(m.id))?.libraryId ??
      series.find((s) => selectedIds.includes(s.id))?.libraryId;
    if (!libId) return;
    const lib = libraries.find((l) => l.id === libId);
    if (!lib) {
      setTitleDialog(false);
      return;
    }
    const mediaIds = selectedIds.filter((id) => media.some((m) => m.id === id));
    const seriesIds = selectedIds.filter((id) => series.some((s) => s.id === id));
    const files = mediaIds
      .map((id) => media.find((m) => m.id === id)?.filePath)
      .filter((p): p is string => Boolean(p));
    const res = await window.electronAPI.createSeriesFolder(lib.path, title, files);
    setTitleDialog(false);
    if (!res.ok) return;
    if (res.moved?.length) {
      dispatch(setMediaPaths(resolveMovedUpdates(res.moved)));
    }
    let memberIds = mediaIds;
    if (res.moved?.length) {
      const movedIds = res.moved
        .map((m) => mediaIds.find((sid) => media.find((x) => x.id === sid)?.filePath === m.from))
        .filter((id): id is string => Boolean(id));
      if (movedIds.length) memberIds = movedIds;
    }
    const action = dispatch(
      createSeries({
        libraryId: libId,
        title: res.title ?? title,
        memberIds,
        memberSeriesIds: seriesIds,
        folderPath: res.folderPath,
      })
    );
    if (res.folderPath) {
      void window.electronAPI.markSeriesFolder(res.folderPath, action.payload.id);
      if (seriesIds.length) {
        await moveSubSeriesInto(res.folderPath, seriesIds, dispatch);
      }
    }
    dispatch(setSelectionMode(false));
    dispatch(setSelectedSeries(action.payload.id));
  };

  const handleSelectAll = () => {
    dispatch(setSelectedIds(items.map((it) => (it.kind === 'media' ? it.media.id : it.series.id))));
  };

  const handleBatchTag = (tagIds: string[], restricted: boolean) => {
    if (tagIds.length) {
      dispatch(addTagToMediaBatch({ ids: batchTargetIds, tagIds }));
    }
    dispatch(setMediaRestrictedBatch({ ids: batchTargetIds, restricted }));
  };

  const handleRemoveFromSeries = () => {
    if (!viewingSeries) return;
    const mediaIds = selectedIds.filter((id) => viewingSeries.memberIds.includes(id));
    const seriesIds = selectedIds.filter((id) => (viewingSeries.memberSeriesIds ?? []).includes(id));
    if (viewingSeries.folderPath && mediaIds.length) {
      void moveMediaOutOfSeries(viewingSeries.folderPath, mediaIds, dispatch);
    }
    for (const mid of mediaIds) {
      dispatch(removeSeriesMember({ id: viewingSeries.id, memberId: mid }));
    }
    for (const sid of seriesIds) {
      const sub = series.find((s) => s.id === sid);
      if (sub && viewingSeries.folderPath) {
        void moveSubSeriesOut(viewingSeries.folderPath, sub, dispatch);
      }
      dispatch(removeSubSeries({ id: viewingSeries.id, seriesId: sid }));
    }
    dispatch(clearSelectedIds());
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
        {viewingSeries && isPureImageSeries(viewingSeries, series, media) && (
          <Button
            appearance="primary"
            size="small"
            icon={<BookOpen20Regular />}
            onClick={() => void window.electronAPI.openComicReader(viewingSeries.id)}
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
            {items.length > 0 && (
              <Button size="small" appearance="outline" icon={<SelectAllOff20Regular />} onClick={handleSelectAll}>
                全选
              </Button>
            )}
            {selectedIds.length > 0 && (
              <>
                <Button
                  appearance="primary"
                  size="small"
                  icon={<TagMultiple20Regular />}
                  onClick={handleMerge}
                >
                  {targetSeries ? `加入「${targetSeries.title}」` : '合并为系列'}
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  icon={<Tag20Regular />}
                  disabled={batchTargetIds.length === 0}
                  onClick={() => setBatchTagOpen(true)}
                >
                  加标签 ({batchTargetIds.length})
                </Button>
                {viewingSeries && (
                  <Button
                    size="small"
                    appearance="outline"
                    icon={<DismissCircle20Regular />}
                    onClick={handleRemoveFromSeries}
                  >
                    从系列移除
                  </Button>
                )}
              </>
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
        onConfirm={(title) => void handleCreateSeries(title)}
      />
      <BatchTagDialog
        open={batchTagOpen}
        targetCount={batchTargetIds.length}
        onConfirm={handleBatchTag}
        onClose={() => setBatchTagOpen(false)}
      />
    </div>
  );
}