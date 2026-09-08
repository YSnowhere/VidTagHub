/** 系列详情面板：封面、标题、类型/标签、阅读/展开/删除、系列模式切换、成员列表与封面设置 */

import {
  Badge,
  Button,
  Field,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components';
import {
  BookOpen20Regular,
  Camera20Regular,
  Collections20Regular,
  Delete20Regular,
  Dismiss20Regular,
  Image20Regular,
  Open20Regular,
  Rename20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addSeriesMembers,
  addSubSeries,
  removeSeries,
  setMediaPaths,
  setSeriesComicMode,
  setSeriesImageMode,
  updateSeries,
} from '../../store/dataSlice';
import {
  clearSeriesView,
  setSelectedSeries,
  setSelectionMode,
  setSeriesTarget,
  setSeriesView,
  setView,
} from '../../store/uiSlice';
import { displayName, formatDate, formatSize, previewUrl } from '../../services/format';
import {
  isComicLeaf,
  isComicSeries,
  isPureImageSeries,
  isTopLevelSeries,
  seriesCoverCandidates,
  seriesEffectiveRestricted,
  seriesEffectiveTags,
  seriesMembers,
  seriesSubSeries,
  seriesTotalSize,
  seriesTypeLabel,
} from '../../services/series';
import { renameSeries } from '../../services/seriesRename';
import { visibleTags } from '../../services/tags';
import { SeriesTitleDialog } from '../SeriesTitleDialog';
import { TagEditDialog } from '../TagEditDialog';
import { CropImageDialog } from '../CropImageDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { SeriesMemberList } from './SeriesMemberList';
import { useDetailStyles } from './styles';
import type { Series, Tag } from '../../types';

export function SeriesDetail({ series }: { series: Series }) {
  const dispatch = useAppDispatch();
  const tags = useAppSelector((s) => s.data.tags);
  const allSeries = useAppSelector((s) => s.data.series);
  const media = useAppSelector((s) => s.data.media);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const styles = useDetailStyles();

  const [renameOpen, setRenameOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);
  const [tagEditOpen, setTagEditOpen] = useState(false);
  const [deleteSeriesOpen, setDeleteSeriesOpen] = useState(false);

  const members = seriesMembers(series, media);
  const subSeries = seriesSubSeries(series, allSeries);
  const effectiveTags = seriesEffectiveTags(series, allSeries, media);
  const totalSize = seriesTotalSize(series, allSeries, media);
  const coverCandidates = seriesCoverCandidates(series, allSeries, media);
  const effectiveRestricted = seriesEffectiveRestricted(series, allSeries, media);
  const comic = isComicSeries(series);
  const comicLeaf = isComicLeaf(series);
  const pureImages = isPureImageSeries(series, allSeries, media);
  const typeLabel = seriesTypeLabel(series, allSeries, media);
  const isTopLevel = isTopLevelSeries(series, allSeries);

  const firstCover = (() => {
    if (series.coverPath) return previewUrl(series.coverPath);
    const firstImage = members.find((m) => m.type === 'image');
    const firstVideoWithCover = members.find((m) => m.type === 'video' && m.coverPath);
    const m = firstImage ?? firstVideoWithCover;
    if (!m) return null;
    if (m.type === 'image') return previewUrl(m.coverPath ?? m.filePath);
    return m.coverPath ? previewUrl(m.coverPath) : null;
  })();

  const itemTags = effectiveTags
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  const visibleItemTags = visibleTags(itemTags, showNSFW);

  const pickCover = async () => {
    const p = await window.electronAPI.pickImage();
    if (p) setCropTarget(p);
  };

  const handleExpand = () => {
    dispatch(setSeriesView(series.id));
    dispatch(setView('media'));
  };

  /** 解散系列：文件释放到上级目录，成员与子系列归属到父系列，并切换视角 */
  const handleRemove = async () => {
    const parentSeries = allSeries.find((s) => (s.memberSeriesIds ?? []).includes(series.id));
    if (series.folderPath) {
      const res = await window.electronAPI.dissolveSeriesFolder(series.folderPath);
      if (res.ok && res.moved?.length) {
        const updates: { id: string; filePath: string }[] = [];
        for (const mv of res.moved) {
          const m = media.find((x) => x.filePath === mv.from);
          if (m) updates.push({ id: m.id, filePath: mv.to });
        }
        if (updates.length) dispatch(setMediaPaths(updates));
      }
      // 子系列文件夹上移后，同步其 folderPath（及内部媒体路径已由 moved 更新）
      for (const f of res.movedFolders ?? []) {
        const sub = allSeries.find((s) => s.folderPath === f.from);
        if (sub) {
          dispatch(updateSeries({ id: sub.id, patch: { folderPath: f.to } }));
        }
      }
    }
    // 直属媒体与子系列重新归属到父系列（若有），文件落在父系列文件夹中
    if (parentSeries) {
      if (series.memberIds.length) {
        dispatch(addSeriesMembers({ id: parentSeries.id, memberIds: series.memberIds }));
      }
      const childIds = series.memberSeriesIds ?? [];
      if (childIds.length) {
        dispatch(addSubSeries({ id: parentSeries.id, seriesIds: childIds }));
      }
    }
    dispatch(removeSeries(series.id));
    // 视角切换到文件所在位置：有父系列则显示父系列视图，否则回到库根
    if (parentSeries) {
      dispatch(setSelectedSeries(parentSeries.id));
      dispatch(setSeriesView(parentSeries.id));
    } else {
      dispatch(setSelectedSeries(null));
      dispatch(clearSeriesView());
    }
  };

  /** 漫画系列删除：连同文件夹一起从磁盘删除 */
  const handleComicDelete = async () => {
    setDeleteSeriesOpen(false);
    if (series.folderPath) {
      const res = await window.electronAPI.deleteSeriesFolder(series.folderPath);
      if (!res.ok) return;
    }
    const parentSeries = allSeries.find((s) => (s.memberSeriesIds ?? []).includes(series.id));
    dispatch(removeSeries(series.id));
    if (parentSeries) {
      dispatch(setSelectedSeries(parentSeries.id));
      dispatch(setSeriesView(parentSeries.id));
    } else {
      dispatch(setSelectedSeries(null));
      dispatch(clearSeriesView());
    }
  };

  const handleAddMedia = () => {
    dispatch(setSeriesTarget(series.id));
    dispatch(setSelectionMode(true));
    dispatch(setView('media'));
  };

  /** 切换为图片模式：把文件夹内现有文件登记为系列成员 */
  const handleSwitchToImage = async () => {
    if (!series.folderPath) return;
    const files = await window.electronAPI.listSeriesFolder(series.folderPath);
    dispatch(setSeriesImageMode({ id: series.id, files }));
  };

  const handleSwitchToComic = () => {
    dispatch(setSeriesComicMode(series.id));
  };

  return (
    <>
      <div className={styles.head}>
        <Text weight="semibold" size={300}>
          系列详情
        </Text>
        <Button
          icon={<Dismiss20Regular />}
          size="small"
          appearance="subtle"
          onClick={() => dispatch(setSelectedSeries(null))}
        />
      </div>

      <div className={styles.cover}>
        {firstCover ? (
          <img className={styles.img} src={firstCover} alt={series.title} draggable={false} />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Collections20Regular />
          </div>
        )}
      </div>

      <Field label="标题">
        <div className={styles.nameRow}>
          <Text className={styles.name} size={300} weight="semibold" title={series.title}>
            {series.title}
          </Text>
          <Button
            icon={<Rename20Regular />}
            size="small"
            onClick={() => setRenameOpen(true)}
            title="重命名系列"
          />
        </div>
      </Field>

      <Field label="类型 / 标签">
        <div className={styles.tagSummary}>
          {effectiveRestricted && (
            <Badge size="large" appearance="tint" color="danger">
              NSFW
            </Badge>
          )}
          <Badge
            size="large"
            appearance="filled"
            color={typeLabel === '漫画' ? 'brand' : typeLabel === '视频' ? 'informative' : typeLabel === 'PDF' ? 'warning' : 'success'}
          >
            {typeLabel}
          </Badge>
          {itemTags.length === 0 && <Text size={200}>未添加标签</Text>}
          {visibleItemTags.map((t) => (
            <Badge key={t.id} size="large" appearance="tint">
              {t.name}
            </Badge>
          ))}
        </div>
        {isTopLevel && (
          <Button
            icon={<Tag20Regular />}
            size="small"
            style={{ marginTop: tokens.spacingVerticalS }}
            onClick={() => setTagEditOpen(true)}
          >
            修改标签
          </Button>
        )}
      </Field>

      <div className={styles.actions}>
        {comicLeaf ? (
          <Button
            appearance="primary"
            icon={<BookOpen20Regular />}
            onClick={() => void window.electronAPI.openComicReader(series.id)}
          >
            漫画阅读
          </Button>
        ) : (
          <Button appearance="primary" icon={<Open20Regular />} onClick={handleExpand}>
            展开
          </Button>
        )}
        <Button
          icon={<Delete20Regular />}
          onClick={() => (comic ? setDeleteSeriesOpen(true) : void handleRemove())}
        >
          {comic ? '删除系列' : '解散系列'}
        </Button>
      </div>

      {isTopLevel && (comic || pureImages) && (
        <Field label="系列模式">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge appearance="tint" color={comic ? 'brand' : 'informative'} size="small">
              {comic ? '漫画模式' : '图片模式'}
            </Badge>
            {comic ? (
              <Button size="small" appearance="outline" onClick={() => void handleSwitchToImage()}>
                切换为图片模式
              </Button>
            ) : (
              <Button size="small" appearance="outline" onClick={handleSwitchToComic}>
                切换为漫画模式
              </Button>
            )}
          </div>
        </Field>
      )}

      <Field label="简介">
        <Textarea
          value={series.description}
          placeholder="为这个系列写点简介…"
          onChange={(_, data) =>
            dispatch(updateSeries({ id: series.id, patch: { description: data.value } }))
          }
        />
      </Field>

      {!comicLeaf && (
        <Field label="成员">
          <SeriesMemberList
            series={series}
            members={members}
            subSeries={subSeries}
            onAddMedia={handleAddMedia}
          />
        </Field>
      )}

      <Field label="自定义封面">
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button icon={<Image20Regular />}>设置封面</Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<Image20Regular />} onClick={() => void pickCover()}>
                上传封面
              </MenuItem>
              {coverCandidates.length > 0 && (
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <MenuItem icon={<Camera20Regular />}>从剧集选择</MenuItem>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {coverCandidates.map(({ member, coverPath }) => (
                        <MenuItem
                          key={member.id}
                          onClick={() => dispatch(updateSeries({ id: series.id, patch: { coverPath } }))}
                        >
                          <img className={styles.coverCandidateThumb} src={previewUrl(coverPath)} alt="" draggable={false} loading="lazy" decoding="async" />
                          <Text
                            size={200}
                            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={member.fileName}
                          >
                            {displayName(member.fileName)}
                          </Text>
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuPopover>
                </Menu>
              )}
              {series.coverPath && (
                <MenuItem
                  onClick={() => dispatch(updateSeries({ id: series.id, patch: { coverPath: undefined } }))}
                >
                  移除封面
                </MenuItem>
              )}
            </MenuList>
          </MenuPopover>
        </Menu>
      </Field>

      <div className={styles.metaRow}>
        <Text size={200} className={styles.metaText}>
          {formatSize(totalSize)} · 创建于 {formatDate(series.createdAt)}
        </Text>
      </div>

      <SeriesTitleDialog
        open={renameOpen}
        title={series.title}
        confirmLabel="保存"
        onClose={() => setRenameOpen(false)}
        onConfirm={(title) => {
          void (async () => {
            await renameSeries(dispatch, series, allSeries, media, title);
            setRenameOpen(false);
          })();
        }}
      />
      <TagEditDialog
        open={tagEditOpen}
        title={series.title}
        tags={series.tags}
        restricted={series.restricted}
        onToggleTag={(tagId) =>
          dispatch(
            updateSeries({
              id: series.id,
              patch: {
                tags: series.tags.includes(tagId)
                  ? series.tags.filter((t) => t !== tagId)
                  : [...series.tags, tagId],
              },
            })
          )
        }
        onSetRestricted={(v) => dispatch(updateSeries({ id: series.id, patch: { restricted: v } }))}
        onClose={() => setTagEditOpen(false)}
      />
      {cropTarget && (
        <CropImageDialog
          open
          imagePath={cropTarget}
          aspectRatio={16 / 9}
          onClose={() => setCropTarget(null)}
          onSaved={(filePath) => {
            dispatch(updateSeries({ id: series.id, patch: { coverPath: filePath } }));
            setCropTarget(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleteSeriesOpen}
        title="删除系列"
        message={`确定要删除系列「${series.title}」吗？`}
        dangerNote="此操作将删除该系列文件夹及其中的所有文件，不可恢复。"
        detailPath={series.folderPath}
        confirmLabel="确认删除"
        onClose={() => setDeleteSeriesOpen(false)}
        onConfirm={() => void handleComicDelete()}
      />
    </>
  );
}
