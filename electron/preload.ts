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
  pickPlayer: () => ipcRenderer.invoke('dialog:pickPlayer'),
  detectPlayer: () => ipcRenderer.invoke('player:detect'),
  scanLibrary: (folder: string) => ipcRenderer.invoke('library:scan', folder),
  ensureFolder: (folder: string) => ipcRenderer.invoke('folder:ensure', folder),
  removeFolder: (folder: string) => ipcRenderer.invoke('folder:remove', folder),
  importFiles: (sources: string[], targetFolder: string) =>
    ipcRenderer.invoke('file:importFiles', sources, targetFolder),
  openWithPlayer: (playerPath: string, filePath: string) =>
    ipcRenderer.invoke('player:open', playerPath, filePath),
  openWithSystem: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
  renameFile: (filePath: string, newName: string) => ipcRenderer.invoke('file:rename', filePath, newName),
  saveFrame: (dataUrl: string, folder: string, baseName: string) =>
    ipcRenderer.invoke('file:saveFrame', dataUrl, folder, baseName),
  saveCrop: (dataUrl: string) => ipcRenderer.invoke('file:saveCrop', dataUrl),
});