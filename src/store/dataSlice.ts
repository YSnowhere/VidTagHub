import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { AppData, Library, MediaItem, ScanFolder, ScanResult, Series, Tag, DEFAULT_DATA } from '../types';

const initialState: AppData = DEFAULT_DATA;

// 判断把 child 加入 parent 是否会造成循环嵌套（child 的子树已包含 parent）
function wouldCreateCycle(child: Series, parentId: string, all: Series[]): boolean {
  const stack = [...(child.memberSeriesIds ?? [])];
  while (stack.length) {
    const curId = stack.pop() as string;
    if (curId === parentId) return true;
    const cur = all.find((x) => x.id === curId);
    if (cur) stack.push(...(cur.memberSeriesIds ?? []));
  }
  return false;
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    hydrate: (state, action: PayloadAction<AppData>) => ({
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
        payload: {
          id: nanoid(),
          name: payload.name,
          path: payload.path,
          nsfw: false,
          collapsed: false,
        },
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
        existing.nsfw = lib.nsfw ?? false;
        existing.collapsed = lib.collapsed ?? false;
      } else {
        state.libraries.push({ ...lib, nsfw: lib.nsfw ?? false, collapsed: lib.collapsed ?? false });
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
    setMediaPaths: (state, action: PayloadAction<{ id: string; filePath: string }[]>) => {
      for (const u of action.payload) {
        const item = state.media.find((m) => m.id === u.id);
        if (item) item.filePath = u.filePath;
      }
    },
    applyScan: (
      state,
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
        const m: MediaItem = {
          id: nanoid(),
          libraryId,
          filePath: file.filePath,
          fileName: file.fileName,
          type: file.type,
          size: file.size,
          modifiedAt: file.modifiedAt,
          tags: [],
          description: '',
          createdAt: Date.now(),
          restricted: false,
        };
        state.media.push(m);
        return m;
      };
      for (const f of action.payload.media) ensureMedia(f);
      const ensureSeries = (folder: ScanFolder): Series => {
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
    },
    addTagToMediaBatch: (state, action: PayloadAction<{ ids: string[]; tagIds: string[] }>) => {
      const idSet = new Set(action.payload.ids);
      for (const m of state.media) {
        if (!idSet.has(m.id)) continue;
        for (const t of action.payload.tagIds) {
          if (!m.tags.includes(t)) m.tags.push(t);
        }
      }
    },
    setMediaRestrictedBatch: (state, action: PayloadAction<{ ids: string[]; restricted: boolean }>) => {
      const idSet = new Set(action.payload.ids);
      for (const m of state.media) {
        if (!idSet.has(m.id)) continue;
        m.restricted = action.payload.restricted;
      }
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
      state,
      action: PayloadAction<{
        id: string;
        patch: Partial<
          Pick<Series, 'title' | 'tags' | 'coverPath' | 'description' | 'restricted' | 'folderPath' | 'memberSeriesIds'>
        >;
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
    addSubSeries: (state, action: PayloadAction<{ id: string; seriesIds: string[] }>) => {
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
    removeSubSeries: (state, action: PayloadAction<{ id: string; seriesId: string }>) => {
      const series = state.series.find((s) => s.id === action.payload.id);
      if (!series) return;
      series.memberSeriesIds = (series.memberSeriesIds ?? []).filter((sid) => sid !== action.payload.seriesId);
    },
    removeSeriesMember: (state, action: PayloadAction<{ id: string; memberId: string }>) => {
      const series = state.series.find((s) => s.id === action.payload.id);
      if (!series) return;
      series.memberIds = series.memberIds.filter((m) => m !== action.payload.memberId);
    },
    removeSeries: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.series = state.series.filter((s) => s.id !== id);
      for (const s of state.series) {
        if (s.memberSeriesIds?.includes(id)) {
          s.memberSeriesIds = s.memberSeriesIds.filter((sid) => sid !== id);
        }
      }
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
  setMediaPaths,
  applyScan,
  addTagToMediaBatch,
  setMediaRestrictedBatch,
  addCategory,
  removeCategory,
  addTag,
  updateTag,
  removeTag,
  createSeries,
  updateSeries,
  addSeriesMembers,
  addSubSeries,
  removeSubSeries,
  removeSeriesMember,
  removeSeries,
} = dataSlice.actions;

export default dataSlice.reducer;