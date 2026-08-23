import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { AppData, AppSettings, Library, MediaItem, ScanResult, Tag, DEFAULT_DATA } from '../types';

const initialState: AppData = DEFAULT_DATA;

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    hydrate: (state, action: PayloadAction<AppData>) => ({
      ...DEFAULT_DATA,
      ...action.payload,
      categories: action.payload.categories?.length ? action.payload.categories : DEFAULT_DATA.categories,
      media: action.payload.media.map((m) => ({ ...m, restricted: m.restricted ?? false })),
      settings: { ...DEFAULT_DATA.settings, ...(action.payload.settings ?? {}) },
    }),
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
      state.media = state.media.filter((m) => m.id !== action.payload);
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
        payload: { id: nanoid(), name: payload.name, category: payload.category },
      }),
    },
    updateTag: (
      state,
      action: PayloadAction<{ id: string; patch: Partial<Pick<Tag, 'name' | 'category' | 'coverPath'>> }>
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
    },
    updateSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      Object.assign(state.settings, action.payload);
    },
  },
});

export const {
  hydrate,
  addLibrary,
  removeLibrary,
  addMediaFromScan,
  updateMedia,
  removeMedia,
  addCategory,
  removeCategory,
  addTag,
  updateTag,
  removeTag,
  updateSettings,
} = dataSlice.actions;

export default dataSlice.reducer;