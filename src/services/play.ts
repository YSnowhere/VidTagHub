import { store } from '../store';
import type { MediaItem } from '../types';

export async function playMedia(item: MediaItem): Promise<void> {
  const { playerPath } = store.getState().data.settings;
  if (playerPath) {
    await window.electronAPI.openWithPlayer(playerPath, item.filePath);
  } else {
    await window.electronAPI.openWithSystem(item.filePath);
  }
}