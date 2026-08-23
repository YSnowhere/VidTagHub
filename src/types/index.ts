export type MediaType = 'video' | 'image';

export interface Library {
  id: string;
  name: string;
  path: string;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  coverPath?: string;
}

export interface MediaItem {
  id: string;
  libraryId: string;
  filePath: string;
  fileName: string;
  type: MediaType;
  size: number;
  modifiedAt: number;
  tags: string[];
  coverPath?: string;
  description: string;
  createdAt: number;
  restricted: boolean;
}

export interface AppSettings {
  playerPath: string;
}

export interface AppData {
  libraries: Library[];
  categories: string[];
  tags: Tag[];
  media: MediaItem[];
  settings: AppSettings;
}

export interface ScanResult {
  filePath: string;
  fileName: string;
  type: MediaType;
  size: number;
  modifiedAt: number;
}

export const DEFAULT_DATA: AppData = {
  libraries: [],
  categories: ['动漫', '真人'],
  tags: [],
  media: [],
  settings: { playerPath: '' },
};