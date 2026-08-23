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

export interface Series {
  id: string;
  libraryId: string;
  title: string;
  tags: string[];
  coverPath?: string;
  description: string;
  createdAt: number;
  restricted: boolean;
  memberIds: string[];
}

export interface AppSettings {
  playerPath: string;
  showFileExt: boolean;
}

export interface AppData {
  libraries: Library[];
  categories: string[];
  tags: Tag[];
  media: MediaItem[];
  series: Series[];
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
  series: [],
  settings: { playerPath: '', showFileExt: false },
};