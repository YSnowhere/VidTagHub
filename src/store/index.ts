import { configureStore } from '@reduxjs/toolkit';
import dataReducer from './dataSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    data: dataReducer,
    ui: uiReducer,
  },
});

let timer: ReturnType<typeof setTimeout> | null = null;

store.subscribe(() => {
  const state = store.getState();
  if (!state.ui.hydrated || !window.electronAPI) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void window.electronAPI.saveData(JSON.parse(JSON.stringify(state.data)));
  }, 400);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;