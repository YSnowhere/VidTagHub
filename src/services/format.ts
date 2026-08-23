export const mediaUrl = (filePath: string): string => 'media://local/' + encodeURIComponent(filePath);

export function displayName(fileName: string, showFileExt: boolean): string {
  if (showFileExt) return fileName;
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}