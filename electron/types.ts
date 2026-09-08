/** 主进程与渲染进程共享的数据结构定义（与 src/types/index.ts 保持字段一致） */

export type MediaType = 'video' | 'image' | 'pdf';

export interface Library {
  id: string;
  name: string;
  path: string;
  nsfw?: boolean;
  collapsed?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  coverPath?: string;
  restricted?: boolean;
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
  memberSeriesIds?: string[];
  folderPath?: string;
  /** 纯图片系列的展示模式：漫画（隐藏细分、不入 JSON）或图片（原始图库行为） */
  mode?: 'comic' | 'image';
}

/** 系列文件夹内的数据文件（.vision-series.json）内容 */
export interface SeriesFolderData {
  id?: string;
  media?: MediaItem[];
}

export interface AppData {
  libraries: Library[];
  categories: string[];
  tags: Tag[];
  media: MediaItem[];
  series: Series[];
}

/** 单个库文件夹的数据文件（.vision-library.json）内容 */
export interface LibraryFile {
  media?: MediaItem[];
  series?: Series[];
}

/** 全局库列表（vision-libraries.json） */
export interface GlobalData {
  libraries: Library[];
}

/** 标签数据（vision-tags.json） */
export interface TagData {
  categories: string[];
  tags: Tag[];
}

/** 扫描得到的单个媒体文件 */
export interface ScanResult {
  filePath: string;
  fileName: string;
  type: MediaType;
  size: number;
  modifiedAt: number;
}

/** 递归扫描得到的文件夹节点 */
export interface FolderScan {
  markerId: string | null;
  title: string;
  folderPath: string;
  media: ScanResult[];
  subFolders: FolderScan[];
}

/** 扫描一个库的结果 */
export interface LibraryScan {
  media: ScanResult[];
  folders: FolderScan[];
}

/** 文件移动记录（旧路径 → 新路径） */
export interface MovedFile {
  from: string;
  to: string;
}

/** 旧版系列迁移入参 */
export interface LegacySeriesPayload {
  id: string;
  title: string;
  memberFilePaths: string[];
}
