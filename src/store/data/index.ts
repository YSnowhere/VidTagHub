/** data slice 组装：各领域 reducers 在此合并为一个 slice，state 结构与 action 名称保持不变 */

import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_DATA, type AppData } from '../../types';
import { libraryReducers } from './libraryReducers';
import { mediaReducers } from './mediaReducers';
import { seriesReducers } from './seriesReducers';
import { tagReducers } from './tagReducers';

const initialState: AppData = DEFAULT_DATA;

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    ...libraryReducers,
    ...mediaReducers,
    ...tagReducers,
    ...seriesReducers,
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
  setSeriesComicMode,
  setSeriesImageMode,
  addSeriesMembers,
  addSubSeries,
  removeSubSeries,
  removeSeriesMember,
  removeSeries,
} = dataSlice.actions;

export default dataSlice.reducer;
