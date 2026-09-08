/** 媒体级 reducers：扫描导入、字段更新、删除、路径同步、批量标签/NSFW、整库扫描对齐 */

import { type PayloadAction } from '@reduxjs/toolkit';
import type { AppData, MediaItem, ScanFolder, ScanResult } from '../../types';
import { createMediaItem, isPureImageTree } from './helpers';

export const mediaReducers = {
  /** 把一次扫描到的文件补充为新媒体（已存在同路径则跳过） */
  addMediaFromScan: (state: AppData, action: PayloadAction<{ libraryId: string; files: ScanResult[] }>) => {
    const { libraryId, files } = action.payload;
    const existing = new Set(state.media.map((m) => m.filePath));
    for (const f of files) {
      if (existing.has(f.filePath)) continue;
      state.media.push(createMediaItem(libraryId, f));
      existing.add(f.filePath);
    }
  },

  updateMedia: (
    state: AppData,
    action: PayloadAction<{
      id: string;
      patch: Partial<
        Pick<MediaItem, 'tags' | 'description' | 'coverPath' | 'fileName' | 'filePath' | 'restricted'>
      >;
    }>
  ) => {
    const item = state.media.find((m) => m.id === action.payload.id);
    if (item) Object.assign(item, action.payload.patch);
  },

  /** 删除媒体，并从所有系列中摘掉该成员（空系列一并移除） */
  removeMedia: (state: AppData, action: PayloadAction<string>) => {
    const id = action.payload;
    state.media = state.media.filter((m) => m.id !== id);
    state.series = state.series
      .map((s) => ({ ...s, memberIds: s.memberIds.filter((mid) => mid !== id) }))
      .filter((s) => s.memberIds.length > 0);
  },

  /** 文件被移动后同步新的绝对路径 */
  setMediaPaths: (state: AppData, action: PayloadAction<{ id: string; filePath: string }[]>) => {
    for (const u of action.payload) {
      const item = state.media.find((m) => m.id === u.id);
      if (item) item.filePath = u.filePath;
    }
  },

  /** 用磁盘扫描结果对齐某个库：补新文件/新文件夹，删已消失的媒体与系列，清理悬挂引用 */
  applyScan: (
    state: AppData,
    action: PayloadAction<{
      libraryId: string;
      media: ScanResult[];
      folders: ScanFolder[];
    }>
  ) => {
    const { libraryId } = action.payload;
    const norm = (p: string): string => p.replace(/[\\/]+/g, '/').toLowerCase();
    const scannedPaths = new Set<string>();
    const scannedFolders = new Set<string>();
    for (const f of action.payload.media) scannedPaths.add(norm(f.filePath));
    const collectFolders = (folders: ScanFolder[]): void => {
      for (const folder of folders) {
        scannedFolders.add(norm(folder.folderPath));
        for (const m of folder.media) scannedPaths.add(norm(m.filePath));
        collectFolders(folder.subFolders);
      }
    };
    collectFolders(action.payload.folders);

    // 同步扫描结果：删除 JSON 中磁盘上已不存在的媒体，并从未自系列中移除引用
    const removedIds = new Set<string>();
    for (const m of state.media) {
      if (m.libraryId !== libraryId) continue;
      if (!scannedPaths.has(norm(m.filePath))) removedIds.add(m.id);
    }
    if (removedIds.size) {
      state.media = state.media.filter((m) => !removedIds.has(m.id));
      for (const s of state.series) {
        if (s.libraryId === libraryId) {
          s.memberIds = s.memberIds.filter((mid) => !removedIds.has(mid));
        }
      }
    }

    // 同步扫描结果：删除 JSON 中文件夹已不存在的系列
    state.series = state.series.filter(
      (s) => s.libraryId !== libraryId || !s.folderPath || scannedFolders.has(norm(s.folderPath))
    );
    // 清理指向已被删除子系列的悬挂引用
    const validSeriesIds = new Set(state.series.map((s) => s.id));
    for (const s of state.series) {
      if (s.libraryId !== libraryId) continue;
      s.memberSeriesIds = (s.memberSeriesIds ?? []).filter((sid) => validSeriesIds.has(sid));
    }

    const ensureMedia = (file: ScanResult): MediaItem => {
      const existing = state.media.find((m) => m.libraryId === libraryId && m.filePath === file.filePath);
      if (existing) return existing;
      const m = createMediaItem(libraryId, file);
      state.media.push(m);
      return m;
    };
    for (const f of action.payload.media) ensureMedia(f);
    const ensureSeries = (folder: ScanFolder): { id: string } => {
      let series = state.series.find((s) => s.id === folder.id && s.libraryId === libraryId);
      if (!series) {
        series = {
          id: folder.id,
          libraryId,
          title: folder.title,
          tags: [],
          description: '',
          createdAt: Date.now(),
          restricted: false,
          memberIds: [],
          memberSeriesIds: [],
          folderPath: folder.folderPath,
        };
        state.series.push(series);
      }
      series.folderPath = folder.folderPath;
      series.title = folder.title;
      series.memberIds = folder.media.map((f) => ensureMedia(f).id);
      series.memberSeriesIds = folder.subFolders.map((sub) => ensureSeries(sub).id);
      return series;
    };
    for (const folder of action.payload.folders) ensureSeries(folder);

    // 纯图片系列默认按「图片」模式处理（已有明确模式则保留）
    for (const s of state.series) {
      if (s.libraryId !== libraryId) continue;
      if (s.mode !== undefined) continue;
      if (isPureImageTree(state, s)) s.mode = 'image';
    }
  },

  addTagToMediaBatch: (state: AppData, action: PayloadAction<{ ids: string[]; tagIds: string[] }>) => {
    const idSet = new Set(action.payload.ids);
    for (const m of state.media) {
      if (!idSet.has(m.id)) continue;
      for (const t of action.payload.tagIds) {
        if (!m.tags.includes(t)) m.tags.push(t);
      }
    }
  },

  setMediaRestrictedBatch: (state: AppData, action: PayloadAction<{ ids: string[]; restricted: boolean }>) => {
    const idSet = new Set(action.payload.ids);
    for (const m of state.media) {
      if (!idSet.has(m.id)) continue;
      m.restricted = action.payload.restricted;
    }
  },
};
