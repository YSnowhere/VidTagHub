import type { MediaItem } from '../types';

export async function playMedia(item: MediaItem): Promise<void> {
  await window.electronAPI.openWithSystem(item.filePath);
}