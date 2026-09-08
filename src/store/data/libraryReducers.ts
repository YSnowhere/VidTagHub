/** 库级 reducers：初始化/水合、库的增删改、单库数据整体替换 */

import { nanoid, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_DATA, type AppData, type Library, type MediaItem, type Series, type Tag } from '../../types';

export const libraryReducers = {
  /** 用主进程读取的数据初始化整个 store */
  hydrate: (state: AppData, action: PayloadAction<AppData>) => ({
    ...DEFAULT_DATA,
    ...action.payload,
    libraries: (action.payload.libraries ?? []).map((l) => ({
      ...l,
      nsfw: l.nsfw ?? false,
      collapsed: l.collapsed ?? false,
    })),
    categories: action.payload.categories?.length ? action.payload.categories : DEFAULT_DATA.categories,
    tags: (action.payload.tags ?? []).map((t) => ({ ...t, restricted: t.restricted ?? false })),
    media: action.payload.media.map((m) => ({ ...m, restricted: m.restricted ?? false })),
    series: (action.payload.series ?? []).map((s) => ({
      ...s,
      tags: s.tags ?? [],
      memberIds: s.memberIds ?? [],
      memberSeriesIds: s.memberSeriesIds ?? [],
      restricted: s.restricted ?? false,
      description: s.description ?? '',
    })),
  }),

  /** 只刷新标签数据（标签管理窗口改动后主窗口同步） */
  hydrateTags: (state: AppData, action: PayloadAction<{ categories: string[]; tags: Tag[] }>) => {
    state.categories = action.payload.categories?.length
      ? action.payload.categories
      : DEFAULT_DATA.categories;
    state.tags = (action.payload.tags ?? []).map((t) => ({ ...t, restricted: t.restricted ?? false }));
  },

  addLibrary: {
    reducer: (state: AppData, action: PayloadAction<Library>) => {
      if (state.libraries.some((l) => l.path === action.payload.path)) return;
      state.libraries.push(action.payload);
    },
    prepare: (payload: { name: string; path: string }) => ({
      payload: {
        id: nanoid(),
        name: payload.name,
        path: payload.path,
        nsfw: false,
        collapsed: false,
      },
    }),
  },

  /** 移除库：连同其媒体与系列一起从内存中清掉 */
  removeLibrary: (state: AppData, action: PayloadAction<string>) => {
    const id = action.payload;
    state.libraries = state.libraries.filter((l) => l.id !== id);
    state.media = state.media.filter((m) => m.libraryId !== id);
    state.series = state.series.filter((s) => s.libraryId !== id);
  },

  upsertLibrary: (state: AppData, action: PayloadAction<Library>) => {
    const lib = action.payload;
    const existing = state.libraries.find((l) => l.id === lib.id);
    if (existing) {
      existing.name = lib.name;
      existing.path = lib.path;
      existing.nsfw = lib.nsfw ?? false;
      existing.collapsed = lib.collapsed ?? false;
    } else {
      state.libraries.push({ ...lib, nsfw: lib.nsfw ?? false, collapsed: lib.collapsed ?? false });
    }
  },

  /** 用某个库的完整数据替换该库的媒体与系列 */
  setLibraryData: (
    state: AppData,
    action: PayloadAction<{ libraryId: string; media: MediaItem[]; series: Series[] }>
  ) => {
    const { libraryId, media, series } = action.payload;
    state.media = state.media.filter((m) => m.libraryId !== libraryId);
    state.series = state.series.filter((s) => s.libraryId !== libraryId);
    state.media.push(...media.map((m) => ({ ...m, libraryId })));
    state.series.push(...series.map((s) => ({ ...s, libraryId })));
  },
};
