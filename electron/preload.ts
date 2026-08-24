import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data: unknown) => ipcRenderer.invoke('data:save', data),
  saveTags: (categories: string[], tags: unknown[]) => ipcRenderer.invoke('tags:save', categories, tags),
  onTagsChanged: (callback: () => void) => {
    ipcRenderer.on('tags:changed', callback);
    return () => {
      ipcRenderer.removeListener('tags:changed', callback);
    };
  },
  openTagManager: () => ipcRenderer.invoke('window:openTagManager'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickFiles: () => ipcRenderer.invoke('dialog:pickFiles'),
  pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
  scanLibrary: (folder: string) => ipcRenderer.invoke('library:scan', folder),
  adoptLibrary: (folder: string) => ipcRenderer.invoke('library:adopt', folder),
  ensureFolder: (folder: string) => ipcRenderer.invoke('folder:ensure', folder),
  importFiles: (sources: string[], targetFolder: string) =>
    ipcRenderer.invoke('file:importFiles', sources, targetFolder),
  openWithSystem: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
  renameFile: (filePath: string, newName: string) => ipcRenderer.invoke('file:rename', filePath, newName),
  saveFrame: (dataUrl: string, folder: string, baseName: string) =>
    ipcRenderer.invoke('file:saveFrame', dataUrl, folder, baseName),
  saveCrop: (dataUrl: string) => ipcRenderer.invoke('file:saveCrop', dataUrl),
  migrateData: (targetDir: string) => ipcRenderer.invoke('data:migrate', targetDir),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
});