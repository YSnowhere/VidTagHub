/** 系列级 reducers：新建/更新/删除系列、成员与子系列增删、漫画/图片模式切换 */

import { nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { AppData, MediaItem, ScanResult, Series } from '../../types';
import {
  createMediaItem,
  isPureImageTree,
  mergeMemberFlagsToSeries,
  setDescendantModes,
  wouldCreateCycle,
} from './helpers';

export const seriesReducers = {
  createSeries: {
    reducer: (state: AppData, action: PayloadAction<Series>) => {
      const s = action.payload;
      if (isPureImageTree(state, s)) {
        s.mode = 'image';
        mergeMemberFlagsToSeries(state, s);
      }
      state.series.push(s);
    },
    prepare: (payload: {
      libraryId: string;
      title: string;
      memberIds: string[];
      memberSeriesIds?: string[];
      folderPath?: string;
    }) => ({
      payload: {
        id: nanoid(),
        libraryId: payload.libraryId,
        title: payload.title,
        tags: [],
        description: '',
        createdAt: Date.now(),
        restricted: false,
        memberIds: payload.memberIds,
        memberSeriesIds: payload.memberSeriesIds ?? [],
        folderPath: payload.folderPath,
      },
    }),
  },

  updateSeries: (
    state: AppData,
    action: PayloadAction<{
      id: string;
      patch: Partial<
        Pick<
          Series,
          'title' | 'tags' | 'coverPath' | 'description' | 'restricted' | 'folderPath' | 'memberSeriesIds' | 'mode'
        >
      >;
    }>
  ) => {
    const series = state.series.find((s) => s.id === action.payload.id);
    if (series) Object.assign(series, action.payload.patch);
  },

  /** 切换为漫画模式：合并成员 NSFW 标记、清空成员、后代一并切换，并丢弃只属于它的媒体条目 */
  setSeriesComicMode: (state: AppData, action: PayloadAction<string>) => {
    const series = state.series.find((s) => s.id === action.payload);
    if (!series) return;
    mergeMemberFlagsToSeries(state, series);
    const dropIds = new Set(series.memberIds);
    series.mode = 'comic';
    series.memberIds = [];
    // 母系列设为漫画时，所有子系列（含后代）一并改为漫画
    setDescendantModes(state, series.id, 'comic');
    for (const s of state.series) {
      if (s.id === series.id) continue;
      for (const id of s.memberIds) dropIds.delete(id);
    }
    state.media = state.media.filter((m) => !dropIds.has(m.id));
  },

  /** 切换为图片模式：把文件夹内的文件登记为系列成员（已存在的复用） */
  setSeriesImageMode: (state: AppData, action: PayloadAction<{ id: string; files: ScanResult[] }>) => {
    const series = state.series.find((s) => s.id === action.payload.id);
    if (!series) return;
    const dropIds = new Set(series.memberIds);
    series.mode = 'image';
    // 母系列设为图片时，所有子系列（含后代）一并改为图片
    setDescendantModes(state, series.id, 'image');
    const newMemberIds = action.payload.files.map((f) => {
      const existing = state.media.find(
        (m) => m.libraryId === series.libraryId && m.filePath === f.filePath
      );
      if (existing) return existing.id;
      const m: MediaItem = createMediaItem(series.libraryId, f);
      state.media.push(m);
      return m.id;
    });
    series.memberIds = newMemberIds;
    const keepIds = new Set(newMemberIds);
    state.media = state.media.filter((m) => !dropIds.has(m.id) || keepIds.has(m.id));
  },

  addSeriesMembers: (state: AppData, action: PayloadAction<{ id: string; memberIds: string[] }>) => {
    const series = state.series.find((s) => s.id === action.payload.id);
    if (!series) return;
    for (const mid of action.payload.memberIds) {
      if (!series.memberIds.includes(mid)) series.memberIds.push(mid);
    }
  },

  /** 添加子系列（跳过自身、重复与会造成循环嵌套的项） */
  addSubSeries: (state: AppData, action: PayloadAction<{ id: string; seriesIds: string[] }>) => {
    const series = state.series.find((s) => s.id === action.payload.id);
    if (!series) return;
    series.memberSeriesIds = series.memberSeriesIds ?? [];
    for (const sid of action.payload.seriesIds) {
      if (sid === series.id) continue;
      if (series.memberSeriesIds.includes(sid)) continue;
      const child = state.series.find((s) => s.id === sid);
      if (child && wouldCreateCycle(child, series.id, state.series)) continue;
      series.memberSeriesIds.push(sid);
    }
  },

  removeSubSeries: (state: AppData, action: PayloadAction<{ id: string; seriesId: string }>) => {
    const series = state.series.find((s) => s.id === action.payload.id);
    if (!series) return;
    series.memberSeriesIds = (series.memberSeriesIds ?? []).filter((sid) => sid !== action.payload.seriesId);
  },

  removeSeriesMember: (state: AppData, action: PayloadAction<{ id: string; memberId: string }>) => {
    const series = state.series.find((s) => s.id === action.payload.id);
    if (!series) return;
    series.memberIds = series.memberIds.filter((m) => m !== action.payload.memberId);
  },

  /** 删除系列，并清理其他系列对它的子系列引用 */
  removeSeries: (state: AppData, action: PayloadAction<string>) => {
    const id = action.payload;
    state.series = state.series.filter((s) => s.id !== id);
    for (const s of state.series) {
      if (s.memberSeriesIds?.includes(id)) {
        s.memberSeriesIds = s.memberSeriesIds.filter((sid) => sid !== id);
      }
    }
  },
};
