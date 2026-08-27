import type { AppData, FolderScan, LibraryScan, MediaItem, MovedFile, ScanResult, Series, Tag } from './types';

interface AdoptedLibrary {
  libraryId: string | null;
  libraryName: string | null;
  media: MediaItem[];
  series: Series[];
}

declare global {
  interface Window {
    __tagManagerMode?: boolean;
    __comicReaderMode?: boolean;
    electronAPI: {
      loadData: () => Promise<AppData>;
      saveData: (data: AppData) => Promise<{ ok: boolean; error?: string }>;
      saveTags: (categories: string[], tags: Tag[]) => Promise<{ ok: boolean; error?: string }>;
      onTagsChanged: (callback: () => void) => () => void;
      openTagManager: () => Promise<{ ok: boolean }>;
      openComicReader: (seriesId: string) => Promise<{ ok: boolean; error?: string }>;
      onComicReaderNavigate: (callback: (seriesId: string) => void) => () => void;
      pickFolder: () => Promise<string | null>;
      pickFiles: () => Promise<string[]>;
      pickImage: () => Promise<string | null>;
      scanLibrary: (folder: string) => Promise<LibraryScan>;
      adoptLibrary: (folder: string) => Promise<AdoptedLibrary | null>;
      createSeriesFolder: (
        libraryPath: string,
        title: string,
        filePaths: string[]
      ) => Promise<{ ok: boolean; folderPath?: string; title?: string; moved?: MovedFile[]; error?: string }>;
      markSeriesFolder: (folderPath: string, seriesId: string) => Promise<{ ok: boolean; error?: string }>;
      migrateLegacySeries: (
        libraryPath: string,
        seriesList: { id: string; title: string; memberFilePaths: string[] }[]
      ) => Promise<{
        ok: boolean;
        migrated?: { id: string; folderPath: string; title: string; moved?: MovedFile[] }[];
        error?: string;
      }>;
      moveSeriesMembers: (
        folderPath: string,
        filePaths: string[]
      ) => Promise<{ ok: boolean; moved?: MovedFile[]; error?: string }>;
      moveSeriesMembersOut: (
        folderPath: string,
        filePaths: string[]
      ) => Promise<{ ok: boolean; moved?: MovedFile[]; error?: string }>;
      renameSeriesFolder: (
        folderPath: string,
        newTitle: string
      ) => Promise<{ ok: boolean; folderPath?: string; title?: string; error?: string }>;
      dissolveSeriesFolder: (
        folderPath: string
      ) => Promise<{ ok: boolean; moved?: MovedFile[]; error?: string }>;
      moveSeriesFolderInto: (
        folderPath: string,
        targetParentFolder: string
      ) => Promise<{ ok: boolean; newFolderPath?: string; title?: string; moved?: MovedFile[]; error?: string }>;
      moveSeriesFolderOut: (
        folderPath: string,
        parentFolderPath: string
      ) => Promise<{ ok: boolean; newFolderPath?: string; title?: string; moved?: MovedFile[]; error?: string }>;
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