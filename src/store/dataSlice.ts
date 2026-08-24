import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { AppData, Library, MediaItem, ScanResult, Series, Tag, DEFAULT_DATA } from '../types';

const initialState: AppData = DEFAULT_DATA;

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    hydrate: (state, action: PayloadAction<AppData>) => ({
      ...DEFAULT_DATA,
      ...action.payload,
      categories: action.payload.categories?.length ? action.payload.categories : DEFAULT_DATA.categories,
      tags: (action.payload.tags ?? []).map((t) => ({ ...t, restricted: t.restricted ?? false })),
      media: action.payload.media.map((m) => ({ ...m, restricted: m.restricted ?? false })),
      series: (action.payload.series ?? []).map((s) => ({
        ...s,
        tags: s.tags ?? [],
        memberIds: s.memberIds ?? [],
        restricted: s.restricted ?? false,
        description: s.description ?? '',
      })),
    }),
    hydrateTags: (state, action: PayloadAction<{ categories: string[]; tags: Tag[] }>) => {
      state.categories = action.payload.categories?.length
        ? action.payload.categories
        : DEFAULT_DATA.categories;
      state.tags = (action.payload.tags ?? []).map((t) => ({ ...t, restricted: t.restricted ?? false }));
    },
    addLibrary: {
      reducer: (state, action: PayloadAction<Library>) => {
        if (state.libraries.some((l) => l.path === action.payload.path)) return;
        state.libraries.push(action.payload);
      },
      prepare: (payload: { name: string; path: string }) => ({
        payload: { id: nanoid(), name: payload.name, path: payload.path },
      }),
    },
    removeLibrary: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.libraries = state.libraries.filter((l) => l.id !== id);
      state.media = state.media.filter((m) => m.libraryId !== id);
      state.series = state.series.filter((s) => s.libraryId !== id);
    },
    upsertLibrary: (state, action: PayloadAction<Library>) => {
      const lib = action.payload;
      const existing = state.libraries.find((l) => l.id === lib.id);
      if (existing) {
        existing.name = lib.name;
        existing.path = lib.path;
      } else {
        state.libraries.push(lib);
      }
    },
    setLibraryData: (
      state,
      action: PayloadAction<{ libraryId: string; media: MediaItem[]; series: Series[] }>
    ) => {
      const { libraryId, media, series } = action.payload;
      state.media = state.media.filter((m) => m.libraryId !== libraryId);
      state.series = state.series.filter((s) => s.libraryId !== libraryId);
      state.media.push(...media.map((m) => ({ ...m, libraryId })));
      state.series.push(...series.map((s) => ({ ...s, libraryId })));
    },
    addMediaFromScan: (state, action: PayloadAction<{ libraryId: string; files: ScanResult[] }>) => {
      const { libraryId, files } = action.payload;
      const existing = new Set(state.media.map((m) => m.filePath));
      for (const f of files) {
        if (existing.has(f.filePath)) continue;
        state.media.push({
          id: nanoid(),
          libraryId,
          filePath: f.filePath,
          fileName: f.fileName,
          type: f.type,
          size: f.size,
          modifiedAt: f.modifiedAt,
          tags: [],
          description: '',
          createdAt: Date.now(),
          restricted: false,
        });
        existing.add(f.filePath);
      }
    },
    updateMedia: (
      state,
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
    removeMedia: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.media = state.media.filter((m) => m.id !== id);
      state.series = state.series
        .map((s) => ({ ...s, memberIds: s.memberIds.filter((mid) => mid !== id) }))
        .filter((s) => s.memberIds.length > 0);
    },
    addCategory: (state, action: PayloadAction<string>) => {
      const name = action.payload.trim();
      if (!name || state.categories.includes(name)) return;
      state.categories.push(name);
    },
    removeCategory: (state, action: PayloadAction<string>) => {
      const name = action.payload;
      state.categories = state.categories.filter((c) => c !== name);
      const removedIds = new Set(state.tags.filter((t) => t.category === name).map((t) => t.id));
      state.tags = state.tags.filter((t) => t.category !== name);
      state.media.forEach((m) => {
        m.tags = m.tags.filter((id) => !removedIds.has(id));
      });
    },
    addTag: {
      reducer: (state, action: PayloadAction<Tag>) => {
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
      state,
      action: PayloadAction<{ id: string; patch: Partial<Pick<Tag, 'name' | 'category' | 'coverPath' | 'restricted'>> }>
    ) => {
      const tag = state.tags.find((t) => t.id === action.payload.id);
      if (tag) Object.assign(tag, action.payload.patch);
    },
    removeTag: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.tags = state.tags.filter((t) => t.id !== id);
      state.media.forEach((m) => {
        m.tags = m.tags.filter((t) => t !== id);
      });
      state.series.forEach((s) => {
        s.tags = s.tags.filter((t) => t !== id);
      });
    },
    createSeries: {
      reducer: (state, action: PayloadAction<Series>) => {
        state.series.push(action.payload);
      },
      prepare: (payload: { libraryId: string; title: string; memberIds: string[] }) => ({
        payload: {
          id: nanoid(),
          libraryId: payload.libraryId,
          title: payload.title,
          tags: [],
          description: '',
          createdAt: Date.now(),
          restricted: false,
          memberIds: payload.memberIds,
        },
      }),
    },
    updateSeries: (
      state,
      action: PayloadAction<{
        id: string;
        patch: Partial<Pick<Series, 'title' | 'tags' | 'coverPath' | 'description' | 'restricted'>>;
      }>
    ) => {
      const series = state.series.find((s) => s.id === action.payload.id);
      if (series) Object.assign(series, action.payload.patch);
    },
    addSeriesMembers: (state, action: PayloadAction<{ id: string; memberIds: string[] }>) => {
      const series = state.series.find((s) => s.id === action.payload.id);
      if (!series) return;
      for (const mid of action.payload.memberIds) {
        if (!series.memberIds.includes(mid)) series.memberIds.push(mid);
      }
    },
    removeSeriesMember: (state, action: PayloadAction<{ id: string; memberId: string }>) => {
      const series = state.series.find((s) => s.id === action.payload.id);
      if (!series) return;
      series.memberIds = series.memberIds.filter((m) => m !== action.payload.memberId);
    },
    removeSeries: (state, action: PayloadAction<string>) => {
      state.series = state.series.filter((s) => s.id !== action.payload);
    },
  },
});

export const {
  hydrate,
  hydrateTags,
  addLibrary,
  removeLibrary,
  upsertLibrary,
  setLibraryData,
  addMediaFromScan,
  updateMedia,
  removeMedia,
  addCategory,
  removeCategory,
  addTag,
  updateTag,
  removeTag,
  createSeries,
  updateSeries,
  addSeriesMembers,
  removeSeriesMember,
  removeSeries,
} = dataSlice.actions;

export default dataSlice.reducer;