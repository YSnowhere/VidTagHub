import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  hydrated: boolean;
  selectedLibraryId: string | null;
  search: string;
  tagFilter: string[];
  selectedMediaId: string | null;
  libraryDialogOpen: boolean;
  tagManagerOpen: boolean;
  settingsOpen: boolean;
  showNSFW: boolean;
  searchFields: Record<'name' | 'tags' | 'description', boolean>;
  searchMode: 'and' | 'or';
  view: 'media' | 'tags';
  selectedCategory: string | null;
}

const initialState: UiState = {
  hydrated: false,
  selectedLibraryId: null,
  search: '',
  tagFilter: [],
  selectedMediaId: null,
  libraryDialogOpen: false,
  tagManagerOpen: false,
  settingsOpen: false,
  showNSFW: false,
  searchFields: { name: true, tags: true, description: true },
  searchMode: 'and',
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
    },
    setLibraryDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.libraryDialogOpen = action.payload;
    },
    setTagManagerOpen: (state, action: PayloadAction<boolean>) => {
      state.tagManagerOpen = action.payload;
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
    setView: (state, action: PayloadAction<'media' | 'tags'>) => {
      state.view = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload;
      state.selectedMediaId = null;
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
  setLibraryDialogOpen,
  setTagManagerOpen,
  setSettingsOpen,
  setShowNSFW,
  setSearchField,
  setSearchMode,
  setView,
  setSelectedCategory,
} = uiSlice.actions;

export default uiSlice.reducer;