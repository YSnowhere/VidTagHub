/** 标签级 reducers：分类增删、标签增删改（删除时同步清理媒体/系列上的引用） */

import { nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { AppData, Tag } from '../../types';

export const tagReducers = {
  addCategory: (state: AppData, action: PayloadAction<string>) => {
    const name = action.payload.trim();
    if (!name || state.categories.includes(name)) return;
    state.categories.push(name);
  },

  /** 删除分类：其下标签一并删除，并从媒体上摘掉这些标签引用 */
  removeCategory: (state: AppData, action: PayloadAction<string>) => {
    const name = action.payload;
    state.categories = state.categories.filter((c) => c !== name);
    const removedIds = new Set(state.tags.filter((t) => t.category === name).map((t) => t.id));
    state.tags = state.tags.filter((t) => t.category !== name);
    state.media.forEach((m) => {
      m.tags = m.tags.filter((id) => !removedIds.has(id));
    });
  },

  addTag: {
    reducer: (state: AppData, action: PayloadAction<Tag>) => {
      const tag = action.payload;
      const dup = state.tags.some(
        (t) => t.name === tag.name && t.category === tag.category
      );
      if (dup) return;
      if (!state.categories.includes(tag.category)) {
        state.categories.push(tag.category);
      }
      state.tags.push(tag);
    },
    prepare: (payload: { name: string; category: string }) => ({
      payload: { id: nanoid(), name: payload.name, category: payload.category, restricted: false },
    }),
  },

  updateTag: (
    state: AppData,
    action: PayloadAction<{ id: string; patch: Partial<Pick<Tag, 'name' | 'category' | 'coverPath' | 'restricted'>> }>
  ) => {
    const tag = state.tags.find((t) => t.id === action.payload.id);
    if (tag) Object.assign(tag, action.payload.patch);
  },

  /** 删除标签：同时从媒体与系列上摘掉引用 */
  removeTag: (state: AppData, action: PayloadAction<string>) => {
    const id = action.payload;
    state.tags = state.tags.filter((t) => t.id !== id);
    state.media.forEach((m) => {
      m.tags = m.tags.filter((t) => t !== id);
    });
    state.series.forEach((s) => {
      s.tags = s.tags.filter((t) => t !== id);
    });
  },
};
