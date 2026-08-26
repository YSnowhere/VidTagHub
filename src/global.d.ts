import type { AppData, MediaItem, ScanResult, Series, Tag } from './types';

interface AdoptedLibrary {
  libraryId: string | null;
  libraryName: string | null;
  media: MediaItem[];
  series: Series[];
}

declare global {
  interface Window {
    __tagManagerMode?: boolean;
    electronAPI: {
      loadData: () => Promise<AppData>;
      saveData: (data: AppData) => Promise<{ ok: boolean; error?: string }>;
      saveTags: (categories: string[], tags: Tag[]) => Promise<{ ok: boolean; error?: string }>;
      onTagsChanged: (callback: () => void) => () => void;
      openTagManager: () => Promise<{ ok: boolean }>;
      pickFolder: () => Promise<string | null>;
      pickFiles: () => Promise<string[]>;
      pickImage: () => Promise<string | null>;
      scanLibrary: (folder: string) => Promise<ScanResult[]>;
      adoptLibrary: (folder: string) => Promise<AdoptedLibrary | null>;
      ensureFolder: (folder: string) => Promise<{ ok: boolean; error?: string }>;
      importFiles: (sources: string[], targetFolder: string) => Promise<string[]>;
      deleteFile: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
      deleteLibraryData: (libraryId: string) => Promise<{ ok: boolean; error?: string }>;
      openWithSystem: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
      renameFile: (
        filePath: string,
        newName: string
      ) => Promise<{ ok: boolean; newPath?: string; error?: string }>;
      saveFrame: (
        dataUrl: string,
        folder: string,
        baseName: string
      ) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
      saveCrop: (dataUrl: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
      migrateData: (targetDir: string) => Promise<{ ok: boolean; error?: string }>;
      clearCache: () => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

export {};