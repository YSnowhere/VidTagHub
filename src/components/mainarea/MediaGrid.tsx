/** 主区域媒体网格：筛选状态、批量操作（合并/加标签/移出系列）与卡片网格渲染 */

import { Text } from '@fluentui/react-components';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addSeriesMembers,
  addSubSeries,
  addTagToMediaBatch,
  createSeries,
  removeSeriesMember,
  removeSubSeries,
  setMediaPaths,
  setMediaRestrictedBatch,
} from '../../store/dataSlice';
import {
  clearSelectedIds,
  clearSeriesView,
  clearTagFilter,
  setSelectedIds,
  setSelectedMedia,
  setSelectedSeries,
  setSelectionMode,
  setSeriesView,
  setTagFilter,
  setView,
} from '../../store/uiSlice';
import { isComicLeaf, isTopLevelSeries, seriesTreeMembers } from '../../services/series';
import { moveMediaOutOfSeries, moveSubSeriesInto, moveSubSeriesOut } from '../../services/seriesMove';
import { VideoCard } from '../VideoCard';
import { SeriesCard } from '../SeriesCard';
import { SeriesTitleDialog } from '../SeriesTitleDialog';
import { BatchTagDialog } from '../BatchTagDialog';
import { GridToolbar } from './GridToolbar';
import { useGridItems } from './useGridItems';
import { useMainAreaStyles } from './styles';
import type { MediaItem } from '../../types';

export function MediaGrid() {
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
  const styles = useMainAreaStyles();

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

  const items = useGridItems({
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
  });

  const goHome = () => {
    dispatch(setSelectedMedia(null));
    dispatch(setTagFilter([]));
    dispatch(clearSeriesView());
    dispatch(setSelectionMode(false));
    dispatch(setView('media'));
  };

  const goUp = () => {
    if (viewingSeries) {
      // 当前在子系列展开视图：返回其母系列展开视图（而非库根）
      const parent = series.find((s) => (s.memberSeriesIds ?? []).includes(viewingSeries.id));
      if (parent) {
        dispatch(setSeriesView(parent.id));
        return;
      }
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

  const selectedTagNames = tagFilter.map((id) => tags.find((t) => t.id === id)?.name ?? id);
  const targetSeries = seriesTarget ? series.find((s) => s.id === seriesTarget) : null;
  const comicLeaf = Boolean(viewingSeries && isComicLeaf(viewingSeries));

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

  // 系列成员文件不再支持单独打标签（标签属于系列本身）
  const taglessMemberIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of series) {
      for (const m of seriesTreeMembers(s, series, media)) set.add(m.id);
    }
    return set;
  }, [series, media]);

  const batchTagTargetIds = useMemo(
    () => batchTargetIds.filter((id) => !taglessMemberIds.has(id)),
    [batchTargetIds, taglessMemberIds]
  );

  /** 文件移动后，把受影响媒体的路径同步到 state */
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

  /** 合并：已指定目标系列则直接并入，否则弹出命名对话框创建新系列 */
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

  /** 新建系列：在库根或母系列内部建文件夹，并把选中项移入 */
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
    // 禁止在子系列里创建子系列
    if (viewingSeries && !isTopLevelSeries(viewingSeries, series)) {
      setTitleDialog(false);
      return;
    }
    // 在母系列展开视图创建时，新系列作为母系列的子系列（文件夹建在母系列内部）
    const parentSeries = viewingSeries ?? null;
    const createFolder = parentSeries?.folderPath ?? lib.path;
    if (parentSeries && !createFolder) {
      setTitleDialog(false);
      return;
    }
    const mediaIds = selectedIds.filter((id) => media.some((m) => m.id === id));
    const seriesIds = selectedIds.filter((id) => series.some((s) => s.id === id));
    const files = mediaIds
      .map((id) => media.find((m) => m.id === id)?.filePath)
      .filter((p): p is string => Boolean(p));
    const res = await window.electronAPI.createSeriesFolder(createFolder, title, files);
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
      // 新系列作为母系列的子系列，并入的媒体/子系列从母系列直属中移除
      if (parentSeries) {
        dispatch(addSubSeries({ id: parentSeries.id, seriesIds: [action.payload.id] }));
        for (const mid of mediaIds) {
          if (parentSeries.memberIds.includes(mid)) {
            dispatch(removeSeriesMember({ id: parentSeries.id, memberId: mid }));
          }
        }
        for (const sid of seriesIds) {
          if ((parentSeries.memberSeriesIds ?? []).includes(sid)) {
            dispatch(removeSubSeries({ id: parentSeries.id, seriesId: sid }));
          }
        }
      }
    }
    dispatch(setSelectionMode(false));
    dispatch(setSelectedSeries(action.payload.id));
    // 创建后视角切到新建系列那一级（无论是否位于母系列内）
    dispatch(setSeriesView(action.payload.id));
  };

  const handleSelectAll = () => {
    dispatch(setSelectedIds(items.map((it) => (it.kind === 'media' ? it.media.id : it.series.id))));
  };

  const handleBatchTag = (tagIds: string[], restricted: boolean) => {
    if (tagIds.length) {
      dispatch(addTagToMediaBatch({ ids: batchTagTargetIds, tagIds }));
    }
    dispatch(setMediaRestrictedBatch({ ids: batchTargetIds, restricted }));
  };

  /** 把选中的媒体/子系列从当前展开的系列中移出 */
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

  const canCreateSeries = Boolean(
    targetSeries || !viewingSeries || isTopLevelSeries(viewingSeries, series)
  );

  return (
    <div className={styles.root}>
      <GridToolbar
        viewingSeries={viewingSeries}
        comicLeaf={comicLeaf}
        selectedTagNames={selectedTagNames}
        tagFilterActive={tagFilter.length > 0}
        selectionMode={selectionMode}
        itemCount={items.length}
        selectedCount={selectedIds.length}
        canCreateSeries={canCreateSeries}
        targetSeries={targetSeries ?? null}
        batchTagDisabled={batchTargetIds.length === 0}
        onGoUp={goUp}
        onGoHome={goHome}
        onClearTagFilter={() => dispatch(clearTagFilter())}
        onOpenReader={() => {
          if (viewingSeries) void window.electronAPI.openComicReader(viewingSeries.id);
        }}
        onSelectAll={handleSelectAll}
        onMerge={() => void handleMerge()}
        onBatchTag={() => setBatchTagOpen(true)}
        onRemoveFromSeries={handleRemoveFromSeries}
        onClearSelection={() => dispatch(clearSelectedIds())}
        onToggleSelectionMode={() => dispatch(setSelectionMode(!selectionMode))}
      />

      {libraries.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>还没有库，点击左上角「新建库」选择一个文件夹开始管理你的媒体</Text>
        </div>
      ) : items.length === 0 && comicLeaf ? (
        <div className={styles.empty}>
          <Text size={400}>漫画系列已就绪，点击上方「漫画阅读」开始阅读</Text>
        </div>
      ) : items.length === 0 && !comicLeaf ? (
        <div className={styles.empty}>
          <Text size={400}>
            {viewingSeries ? '该系列暂无剧集，可在右侧详情中添加媒体' : '没有找到匹配的媒体'}
          </Text>
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
        onConfirm={handleBatchTag}
        onClose={() => setBatchTagOpen(false)}
      />
    </div>
  );
}
