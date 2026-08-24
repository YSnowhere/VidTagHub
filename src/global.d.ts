import type { AppData, ScanResult, Tag } from './types';

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
      pickPlayer: () => Promise<string | null>;
      detectPlayer: () => Promise<string | null>;
      scanLibrary: (folder: string) => Promise<ScanResult[]>;
      ensureFolder: (folder: string) => Promise<{ ok: boolean; error?: string }>;
      removeFolder: (folder: string) => Promise<{ ok: boolean; error?: string }>;
      importFiles: (sources: string[], targetFolder: string) => Promise<string[]>;
      openWithPlayer: (playerPath: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;
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
    };
  }
}

export {};