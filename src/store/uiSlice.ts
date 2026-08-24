import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  hydrated: boolean;
  selectedLibraryId: string | null;
  search: string;
  tagFilter: string[];
  selectedMediaId: string | null;
  selectedSeriesId: string | null;
  seriesViewId: string | null;
  selectionMode: boolean;
  selectedIds: string[];
  seriesTarget: string | null;
  libraryDialogOpen: boolean;
  settingsOpen: boolean;
  showNSFW: boolean;
  searchFields: Record<'name' | 'tags' | 'description', boolean>;
  searchMode: 'and' | 'or';
  searchSubEpisodes: boolean;
  view: 'media' | 'tags';
  selectedCategory: string | null;
}

const initialState: UiState = {
  hydrated: false,
  selectedLibraryId: null,
  search: '',
  tagFilter: [],
  selectedMediaId: null,
  selectedSeriesId: null,
  seriesViewId: null,
  selectionMode: false,
  selectedIds: [],
  seriesTarget: null,
  libraryDialogOpen: false,
  settingsOpen: false,
  showNSFW: false,
  searchFields: { name: true, tags: true, description: true },
  searchMode: 'and',
  searchSubEpisodes: false,
  view: 'media',
  selectedCategory: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setHydrated: (state, action: PayloadAction<boolean>) => {
      state.hydrated = action.payload;
    },
    setSelectedLibrary: (state, action: PayloadAction<string | null>) => {
      state.selectedLibraryId = action.payload;
      state.selectedMediaId = null;
      state.selectedSeriesId = null;
      state.seriesViewId = null;
    },
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
    },
    toggleTagFilter: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.tagFilter = state.tagFilter.includes(id)
        ? state.tagFilter.filter((t) => t !== id)
        : [...state.tagFilter, id];
    },
    clearTagFilter: (state) => {
      state.tagFilter = [];
    },
    setTagFilter: (state, action: PayloadAction<string[]>) => {
      state.tagFilter = action.payload;
    },
    setSelectedMedia: (state, action: PayloadAction<string | null>) => {
      state.selectedMediaId = action.payload;
      state.selectedSeriesId = null;
    },
    setSelectedSeries: (state, action: PayloadAction<string | null>) => {
      state.selectedSeriesId = action.payload;
      state.selectedMediaId = null;
    },
    setSelectionMode: (state, action: PayloadAction<boolean>) => {
      state.selectionMode = action.payload;
      if (!action.payload) {
        state.selectedIds = [];
        state.seriesTarget = null;
      }
    },
    toggleSelectedId: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((s) => s !== id)
        : [...state.selectedIds, id];
    },
    clearSelectedIds: (state) => {
      state.selectedIds = [];
    },
    setSeriesTarget: (state, action: PayloadAction<string | null>) => {
      state.seriesTarget = action.payload;
    },
    setLibraryDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.libraryDialogOpen = action.payload;
    },
    setSettingsOpen: (state, action: PayloadAction<boolean>) => {
      state.settingsOpen = action.payload;
    },
    setShowNSFW: (state, action: PayloadAction<boolean>) => {
      state.showNSFW = action.payload;
    },
    setSearchField: (
      state,
      action: PayloadAction<{ field: keyof UiState['searchFields']; value: boolean }>
    ) => {
      state.searchFields[action.payload.field] = action.payload.value;
    },
    setSearchMode: (state, action: PayloadAction<'and' | 'or'>) => {
      state.searchMode = action.payload;
    },
    setSearchSubEpisodes: (state, action: PayloadAction<boolean>) => {
      state.searchSubEpisodes = action.payload;
    },
    setView: (state, action: PayloadAction<'media' | 'tags'>) => {
      state.view = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload;
      state.selectedMediaId = null;
      state.selectedSeriesId = null;
      state.seriesViewId = null;
    },
    setSeriesView: (state, action: PayloadAction<string | null>) => {
      state.seriesViewId = action.payload;
    },
    clearSeriesView: (state) => {
      state.seriesViewId = null;
    },
  },
});

export const {
  setHydrated,
  setSelectedLibrary,
  setSearch,
  toggleTagFilter,
  clearTagFilter,
  setTagFilter,
  setSelectedMedia,
  setSelectedSeries,
  setSeriesView,
  clearSeriesView,
  setSelectionMode,
  toggleSelectedId,
  clearSelectedIds,
  setSeriesTarget,
  setLibraryDialogOpen,
  setSettingsOpen,
  setShowNSFW,
  setSearchField,
  setSearchMode,
  setSearchSubEpisodes,
  setView,
  setSelectedCategory,
} = uiSlice.actions;

export default uiSlice.reducer;