/** 数据读写：全局库列表、标签、各库文件夹数据，以及旧数据的迁移与漫画模式的实时枚举 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_GLOBAL, DEFAULT_TAG_DATA } from './constants';
import { listMediaInFolder, normPath, randomId } from './fileOps';
import {
  globalFile,
  libraryDataFile,
  resolveStoredPath,
  seriesMarkerFile,
  tagsFile,
  toRelativePath,
} from './paths';
import { collectTreeMembers, readSeriesFolderData } from './seriesFolder';
import type {
  AppData,
  GlobalData,
  LibraryFile,
  MediaItem,
  Series,
  SeriesFolderData,
  Tag,
  TagData,
} from './types';

const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

export function loadGlobal(): GlobalData {
  try {
    if (!fs.existsSync(globalFile())) return clone(DEFAULT_GLOBAL);
    const parsed = JSON.parse(fs.readFileSync(globalFile(), 'utf-8')) as Partial<GlobalData>;
    return {
      libraries: parsed.libraries ?? [],
    };
  } catch {
    return clone(DEFAULT_GLOBAL);
  }
}

export function saveGlobal(global: GlobalData): void {
  fs.mkdirSync(path.dirname(globalFile()), { recursive: true });
  fs.writeFileSync(globalFile(), JSON.stringify(global, null, 2), 'utf-8');
}

export function loadTags(): TagData {
  try {
    if (!fs.existsSync(tagsFile())) return clone(DEFAULT_TAG_DATA);
    const parsed = JSON.parse(fs.readFileSync(tagsFile(), 'utf-8')) as Partial<TagData>;
    return {
      categories: parsed.categories ?? [],
      tags: parsed.tags ?? [],
    };
  } catch {
    return clone(DEFAULT_TAG_DATA);
  }
}

/** 读取一个库文件夹的全部数据：主 JSON + 各系列文件夹数据 + 旧格式迁移 + 漫画模式实时枚举 */
export function loadLibraryFile(libPath: string): LibraryFile {
  let parsed: LibraryFile;
  try {
    parsed = JSON.parse(fs.readFileSync(libraryDataFile(libPath), 'utf-8')) as LibraryFile;
  } catch {
    return { media: [], series: [] };
  }

  const mediaById = new Map<string, MediaItem>();
  const addMedia = (m: MediaItem): void => {
    if (!mediaById.has(m.id)) mediaById.set(m.id, m);
  };

  for (const m of parsed.media ?? []) {
    addMedia({
      ...m,
      filePath: resolveStoredPath(libPath, m.filePath),
      ...(m.coverPath ? { coverPath: resolveStoredPath(libPath, m.coverPath) } : {}),
    });
  }

  const series: Series[] = (parsed.series ?? []).map((s) => ({
    ...s,
    mode: s.mode,
    ...(s.coverPath ? { coverPath: resolveStoredPath(libPath, s.coverPath) } : {}),
    ...(s.folderPath ? { folderPath: resolveStoredPath(libPath, s.folderPath) } : {}),
  }));

  // 1) 读取各系列文件夹数据文件（新格式：具体媒体信息存放在系列文件夹内）
  for (const s of series) {
    if (!s.folderPath) continue;
    const fd = readSeriesFolderData(s.folderPath);
    if (fd?.media?.length) {
      for (const m of fd.media) {
        addMedia({
          ...m,
          filePath: resolveStoredPath(libPath, m.filePath),
          ...(m.coverPath ? { coverPath: resolveStoredPath(libPath, m.coverPath) } : {}),
        });
      }
    }
  }

  // 2) 迁移：旧数据没有 mode 字段，纯图片系列默认按「漫画」处理，
  //    并把成员图片的受限标记合并到系列本身，避免 NSFW 信息丢失（标签属于系列本身，不再合并）
  const isPureImageTree = (s: Series, visited: Set<string>): boolean => {
    if (visited.has(s.id)) return false;
    visited.add(s.id);
    const members = s.memberIds
      .map((id) => mediaById.get(id))
      .filter((m): m is MediaItem => Boolean(m));
    if (members.length === 0 && (s.memberSeriesIds?.length ?? 0) === 0) return false;
    if (members.some((m) => m.type !== 'image')) return false;
    for (const sid of s.memberSeriesIds ?? []) {
      const sub = series.find((x) => x.id === sid);
      if (!sub || !isPureImageTree(sub, visited)) return false;
    }
    return true;
  };

  for (const s of series) {
    if (s.mode !== undefined) continue;
    if (!isPureImageTree(s, new Set())) continue;
    const treeMembers = collectTreeMembers(s, series, Array.from(mediaById.values()));
    s.mode = 'comic';
    if (treeMembers.some((m) => m.restricted)) s.restricted = true;
  }

  // 3) 漫画模式：丢弃旧 JSON 中系列文件夹内的成员媒体（不再存入 JSON），改为实时枚举
  const oldMediaIds = new Set(mediaById.keys());
  const protectedIds = new Set<string>();
  for (const s of series) {
    if (s.mode === 'comic') continue;
    for (const id of s.memberIds) protectedIds.add(id);
  }
  for (const s of series) {
    if (s.mode !== 'comic' || !s.folderPath) continue;
    const folder = normPath(s.folderPath);
    for (const id of oldMediaIds) {
      if (protectedIds.has(id)) continue;
      const m = mediaById.get(id);
      if (!m) continue;
      const p = normPath(m.filePath);
      if (p === folder || p.startsWith(folder + '/')) mediaById.delete(id);
    }
    const ephemeral: MediaItem[] = listMediaInFolder(s.folderPath).map((r) => ({
      id: randomId(),
      libraryId: s.libraryId,
      filePath: r.filePath,
      fileName: r.fileName,
      type: r.type,
      size: r.size,
      modifiedAt: r.modifiedAt,
      tags: [],
      description: '',
      createdAt: Date.now(),
      restricted: false,
    }));
    s.memberIds = ephemeral.map((m) => m.id);
    for (const m of ephemeral) addMedia(m);
  }

  return { media: Array.from(mediaById.values()), series };
}

/** 读取全部库的数据，合并为一个 AppData 交给渲染进程 */
export function loadData(): AppData {
  const global = loadGlobal();
  const tagData = loadTags();
  const media: MediaItem[] = [];
  const series: Series[] = [];
  for (const lib of global.libraries) {
    const libFile = loadLibraryFile(lib.path);
    media.push(...(libFile.media ?? []));
    series.push(...(libFile.series ?? []));
  }
  return {
    libraries: global.libraries,
    categories: tagData.categories,
    tags: tagData.tags,
    media,
    series,
  };
}

/** 保存全部数据：全局库列表 + 标签 + 每个库文件夹（主 JSON 只留系列条目，媒体信息写入系列文件夹） */
export function saveData(data: AppData): void {
  const global: GlobalData = {
    libraries: data.libraries.map((l) => ({
      id: l.id,
      name: l.name,
      path: l.path,
      nsfw: l.nsfw,
      collapsed: l.collapsed,
    })),
  };
  saveGlobal(global);

  const tagData: TagData = {
    categories: data.categories,
    tags: data.tags,
  };
  fs.mkdirSync(path.dirname(tagsFile()), { recursive: true });
  fs.writeFileSync(tagsFile(), JSON.stringify(tagData, null, 2), 'utf-8');

  for (const lib of data.libraries) {
    try {
      if (!fs.existsSync(lib.path)) continue; // 文件夹已被移动或删除，跳过保存
      const libMedia = data.media.filter((m) => m.libraryId === lib.id);
      const libSeries = data.series.filter((s) => s.libraryId === lib.id);
      const serializeMedia = (m: MediaItem): MediaItem => ({
        ...m,
        filePath: toRelativePath(lib.path, m.filePath),
        ...(m.coverPath ? { coverPath: toRelativePath(lib.path, m.coverPath) } : {}),
      });

      // 主 JSON 只保留系列条目；具体媒体信息放入各系列文件夹
      const folderSeries = libSeries.filter((s) => s.folderPath);
      const folderMemberIds = new Set<string>();
      for (const s of folderSeries) for (const id of s.memberIds) folderMemberIds.add(id);

      const mainMedia = libMedia
        .filter((m) => !folderMemberIds.has(m.id))
        .map(serializeMedia);

      const mainSeries = libSeries.map((s) => ({
        ...s,
        ...(s.mode === 'comic' ? { memberIds: [] } : {}), // 漫画模式不持久化成员
        ...(s.coverPath ? { coverPath: toRelativePath(lib.path, s.coverPath) } : {}),
        ...(s.folderPath ? { folderPath: toRelativePath(lib.path, s.folderPath) } : {}),
      }));

      // 各系列文件夹数据文件：保留具体媒体信息（漫画模式只留标记）
      for (const s of libSeries) {
        if (!s.folderPath) continue;
        try {
          if (!fs.existsSync(s.folderPath)) continue;
          const payload: SeriesFolderData =
            s.mode === 'comic'
              ? { id: s.id }
              : { id: s.id, media: libMedia.filter((m) => s.memberIds.includes(m.id)).map(serializeMedia) };
          fs.writeFileSync(seriesMarkerFile(s.folderPath), JSON.stringify(payload, null, 2), 'utf-8');
        } catch {
          /* 单个系列文件夹不可用，忽略 */
        }
      }

      fs.writeFileSync(
        libraryDataFile(lib.path),
        JSON.stringify(
          { libraryId: lib.id, libraryName: lib.name, media: mainMedia, series: mainSeries },
          null,
          2
        ),
        'utf-8'
      );
    } catch {
      /* 文件夹可能不可用，忽略 */
    }
  }
}

export function saveTags(categories: string[], tags: Tag[]): { ok: boolean; error?: string } {
  try {
    const tagData: TagData = { categories, tags };
    fs.mkdirSync(path.dirname(tagsFile()), { recursive: true });
    fs.writeFileSync(tagsFile(), JSON.stringify(tagData, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
