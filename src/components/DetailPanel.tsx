import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  Field,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Delete20Regular,
  Dismiss20Regular,
  Eye20Regular,
  Image20Regular,
  Open20Regular,
  Play20Regular,
  Rename20Regular,
  Tag20Regular,
  VideoClip20Regular,
  Add20Regular,
  Collections20Regular,
  Camera20Regular,
  Document20Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  removeMedia,
  removeSeries,
  removeSeriesMember,
  removeSubSeries,
  setMediaPaths,
  updateMedia,
  updateSeries,
} from '../store/dataSlice';
import {
  setSelectedMedia,
  setSelectedSeries,
  setSelectionMode,
  setSeriesTarget,
  setSeriesView,
  clearSeriesView,
  setView,
} from '../store/uiSlice';
import { displayName, previewUrl, formatSize, formatDate } from '../services/format';
import {
  seriesCoverCandidates,
  seriesEffectiveRestricted,
  seriesEffectiveTags,
  seriesMembers,
  seriesSubSeries,
  seriesTypeText,
  seriesTotalSize,
} from '../services/series';
import { visibleTags } from '../services/tags';
import { TagEditDialog } from './TagEditDialog';
import { RenameDialog } from './RenameDialog';
import { FrameCaptureDialog } from './FrameCaptureDialog';
import { CropImageDialog } from './CropImageDialog';
import { SeriesTitleDialog } from './SeriesTitleDialog';
import type { MediaItem, Series, Tag } from '../types';

const useStyles = makeStyles({
  root: {
    width: '340px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    background: tokens.colorNeutralBackground1,
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
    overflowY: 'auto',
    minHeight: 0,
  },
  empty: {
    width: '340px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
    background: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground3,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  cover: {
    aspectRatio: '16 / 9',
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground3,
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  name: {
    flex: 1,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  tagSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
    flexShrink: 0,
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
    cursor: 'pointer',
    ':hover': {
      background: tokens.colorNeutralBackground3,
    },
  },
  memberThumb: {
    width: '64px',
    height: '36px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    background: tokens.colorNeutralBackground3,
    flexShrink: 0,
  },
  memberName: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    maxHeight: '260px',
    overflowY: 'auto',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  metaText: {
    color: tokens.colorNeutralForeground3,
  },
  coverCandidate: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
    cursor: 'pointer',
    minWidth: '220px',
    ':hover': {
      background: tokens.colorNeutralBackground3,
    },
  },
  coverCandidateThumb: {
    width: '40px',
    height: '22px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    background: tokens.colorNeutralBackground3,
    flexShrink: 0,
  },
  coverCandidateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    maxHeight: '220px',
    overflowY: 'auto',
    padding: tokens.spacingVerticalXS,
  },
});

export function DetailPanel() {
  const dispatch = useAppDispatch();
  const selectedMediaId = useAppSelector((s) => s.ui.selectedMediaId);
  const selectedSeriesId = useAppSelector((s) => s.ui.selectedSeriesId);
  const item = useAppSelector((s) => s.data.media.find((m) => m.id === selectedMediaId));
  const series = useAppSelector((s) => s.data.series.find((x) => x.id === selectedSeriesId));
  const styles = useStyles();

  if (!item && !series) {
    return (
      <div className={styles.empty}>
        <Text size={300}>选择媒体以查看详情</Text>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {item ? (
        <MediaDetail item={item} />
      ) : (
        <SeriesDetail series={series!} />
      )}
    </div>
  );
}

function MediaDetail({ item }: { item: MediaItem }) {
  const dispatch = useAppDispatch();
  const tags = useAppSelector((s) => s.data.tags);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const seriesList = useAppSelector((s) => s.data.series);
  const styles = useStyles();

  const [tagEditOpen, setTagEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [frameCaptureOpen, setFrameCaptureOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const coverSrc =
    item.type === 'image'
      ? item.coverPath
        ? previewUrl(item.coverPath)
        : previewUrl(item.filePath)
      : item.coverPath
      ? previewUrl(item.coverPath)
      : null;
  const isPdf = item.type === 'pdf';
  const itemTags = item.tags
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  const visibleItemTags = visibleTags(itemTags, showNSFW);

  const pickCover = async () => {
    const p = await window.electronAPI.pickImage();
    if (p) setCropTarget(p);
  };

  const handleRemove = () => {
    setDeleteOpen(false);
    void window.electronAPI.deleteFile(item.filePath);
    const affected = seriesList.filter((s) => s.memberIds.includes(item.id));
    dispatch(removeMedia(item.id));
    for (const s of affected) {
      const remains = s.memberIds.filter((mid) => mid !== item.id);
      if (remains.length === 0 && s.folderPath) {
        void window.electronAPI.dissolveSeriesFolder(s.folderPath);
      }
    }
    dispatch(setSelectedMedia(null));
  };

  const handlePrimaryAction = () => {
    void window.electronAPI.openWithSystem(item.filePath);
  };

  return (
    <>
      <div className={styles.head}>
        <Text weight="semibold" size={300}>
          详情
        </Text>
        <Button
          icon={<Dismiss20Regular />}
          size="small"
          appearance="subtle"
          onClick={() => dispatch(setSelectedMedia(null))}
        />
      </div>

      <div className={styles.cover}>
        {coverSrc ? (
          <img className={styles.img} src={coverSrc} alt={item.fileName} draggable={false} decoding="async" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {isPdf ? <Document20Regular style={{ width: 40, height: 40 }} /> : null}
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {isPdf ? '暂无封面，可自定义封面图片' : '暂无封面'}
            </Text>
          </div>
        )}
      </div>

      <Field label="名称">
        <div className={styles.nameRow}>
          <Text className={styles.name} size={300} weight="semibold" title={item.fileName}>
            {displayName(item.fileName)}
          </Text>
          <Button
            icon={<Rename20Regular />}
            size="small"
            onClick={() => setRenameOpen(true)}
            title="重命名文件"
          />
        </div>
      </Field>

      <Field label="类型 / 标签">
        <div className={styles.tagSummary}>
          {item.restricted && (
            <Badge size="small" appearance="tint" color="danger">
              NSFW
            </Badge>
          )}
          <Badge
            size="small"
            appearance="tint"
            color={item.type === 'video' ? 'informative' : item.type === 'pdf' ? 'warning' : 'success'}
          >
            {item.type === 'video' ? '视频' : item.type === 'pdf' ? 'PDF' : '图片'}
          </Badge>
          {itemTags.length === 0 && <Text size={200}>未添加标签</Text>}
          {visibleItemTags.map((t) => (
            <Badge key={t.id} size="small" appearance="tint">
              {t.name}
            </Badge>
          ))}
        </div>
        <Button icon={<Tag20Regular />} size="small" onClick={() => setTagEditOpen(true)}>
          修改标签
        </Button>
      </Field>

      <div className={styles.actions}>
        <Button
          appearance="primary"
          icon={item.type === 'video' ? <Play20Regular /> : item.type === 'pdf' ? <Document20Regular /> : <Eye20Regular />}
          onClick={handlePrimaryAction}
        >
          {item.type === 'video' ? '播放' : item.type === 'pdf' ? '打开' : '查看'}
        </Button>
        <Button icon={<Delete20Regular />} onClick={() => setDeleteOpen(true)}>
          彻底删除
        </Button>
      </div>

      <Field label="简介">
        <Textarea
          value={item.description}
          placeholder="为这个媒体写点简介…"
          onChange={(_, data) =>
            dispatch(updateMedia({ id: item.id, patch: { description: data.value } }))
          }
        />
      </Field>

      <Field label="自定义封面">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.type === 'image' ? (
            <Button icon={<Image20Regular />} onClick={() => setCropTarget(item.filePath)}>
              裁剪封面
            </Button>
          ) : (
            <>
              <Button icon={<Image20Regular />} onClick={() => void pickCover()}>
                选择封面图片
              </Button>
              {item.type === 'video' && (
                <Button icon={<VideoClip20Regular />} onClick={() => setFrameCaptureOpen(true)}>
                  从视频截帧
                </Button>
              )}
            </>
          )}
          {item.coverPath && (
            <Button onClick={() => dispatch(updateMedia({ id: item.id, patch: { coverPath: undefined } }))}>
              {item.type === 'image' ? '使用原图' : '移除封面'}
            </Button>
          )}
        </div>
        {item.type === 'image' && !item.coverPath && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 4 }}>
            图片默认以自身作为封面，可裁剪调整显示区域
          </Text>
        )}
      </Field>

      <div className={styles.metaRow}>
        <Text size={200} className={styles.metaText}>
          {formatSize(item.size)} · 创建于 {formatDate(item.createdAt)}
        </Text>
      </div>

      <TagEditDialog
        open={tagEditOpen}
        title={displayName(item.fileName)}
        tags={item.tags}
        restricted={item.restricted}
        onToggleTag={(tagId) =>
          dispatch(
            updateMedia({
              id: item.id,
              patch: {
                tags: item.tags.includes(tagId)
                  ? item.tags.filter((t) => t !== tagId)
                  : [...item.tags, tagId],
              },
            })
          )
        }
        onSetRestricted={(v) => dispatch(updateMedia({ id: item.id, patch: { restricted: v } }))}
        onClose={() => setTagEditOpen(false)}
      />
      <RenameDialog item={item} open={renameOpen} onClose={() => setRenameOpen(false)} />
      {item.type === 'video' && (
        <FrameCaptureDialog
          item={item}
          open={frameCaptureOpen}
          onClose={() => setFrameCaptureOpen(false)}
        />
      )}
      {cropTarget && (
        <CropImageDialog
          open
          imagePath={cropTarget}
          aspectRatio={16 / 9}
          onClose={() => setCropTarget(null)}
          onSaved={(filePath) => {
            dispatch(updateMedia({ id: item.id, patch: { coverPath: filePath } }));
            setCropTarget(null);
          }}
        />
      )}

      <Dialog
        open={deleteOpen}
        onOpenChange={(_, data) => {
          if (!data.open) setDeleteOpen(false);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>彻底删除</DialogTitle>
            <DialogContent>
              <Text size={300}>确定要彻底删除「{displayName(item.fileName)}」吗？</Text>
              <Text size={200} style={{ display: 'block', marginTop: 8, color: tokens.colorPaletteRedForeground1 }}>
                该文件将从磁盘上永久删除，无法恢复。
              </Text>
              <Text size={200} style={{ display: 'block', marginTop: 4, color: tokens.colorNeutralForeground3 }}>
                {item.filePath}
              </Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteOpen(false)}>
                取消
              </Button>
              <Button appearance="primary" icon={<Delete20Regular />} onClick={handleRemove}>
                彻底删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function SeriesDetail({ series }: { series: Series }) {
  const dispatch = useAppDispatch();
  const tags = useAppSelector((s) => s.data.tags);
  const allSeries = useAppSelector((s) => s.data.series);
  const media = useAppSelector((s) => s.data.media);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const styles = useStyles();

  const [renameOpen, setRenameOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  const members = seriesMembers(series, media);
  const subSeries = seriesSubSeries(series, allSeries);
  const effectiveTags = seriesEffectiveTags(series, allSeries, media);
  const totalSize = seriesTotalSize(series, allSeries, media);
  const typeText = seriesTypeText(series, allSeries, media);
  const coverCandidates = seriesCoverCandidates(series, allSeries, media);
  const effectiveRestricted = seriesEffectiveRestricted(series, allSeries, media);

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

  const handleRemove = async () => {
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
    }
    dispatch(removeSeries(series.id));
    dispatch(setSelectedSeries(null));
    dispatch(clearSeriesView());
  };

  const handleAddMedia = () => {
    dispatch(setSeriesTarget(series.id));
    dispatch(setSelectionMode(true));
    dispatch(setView('media'));
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
            <Badge size="small" appearance="tint" color="danger">
              NSFW
            </Badge>
          )}
          <Badge size="small" appearance="filled" color="brand">
            系列
          </Badge>
          <Badge
            size="small"
            appearance="filled"
            color={typeText.startsWith('视频') ? 'informative' : 'success'}
          >
            {typeText}
          </Badge>
          {itemTags.length === 0 && <Text size={200}>未添加标签</Text>}
          {visibleItemTags.map((t) => (
            <Badge key={t.id} size="small" appearance="tint">
              {t.name}
            </Badge>
          ))}
        </div>
      </Field>

      <div className={styles.actions}>
        <Button appearance="primary" icon={<Open20Regular />} onClick={handleExpand}>
          展开
        </Button>
        <Button icon={<Delete20Regular />} onClick={handleRemove}>
          删除系列
        </Button>
      </div>

      <Field label="简介">
        <Textarea
          value={series.description}
          placeholder="为这个系列写点简介…"
          onChange={(_, data) =>
            dispatch(updateSeries({ id: series.id, patch: { description: data.value } }))
          }
        />
      </Field>

      <Field label="成员">
        <Text size={200}>
          {members.length} 个媒体{subSeries.length > 0 ? ` · ${subSeries.length} 个子系列` : ''}
        </Text>
        <div className={styles.memberList}>
          {subSeries.map((sub) => (
            <div
              key={sub.id}
              className={styles.memberRow}
              onClick={() => {
                dispatch(setSelectedSeries(sub.id));
                dispatch(setSeriesView(sub.id));
                dispatch(setView('media'));
              }}
            >
              {sub.coverPath ? (
                <img className={styles.memberThumb} src={previewUrl(sub.coverPath)} alt="" draggable={false} loading="lazy" decoding="async" />
              ) : (
                <div className={styles.memberThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Collections20Regular />
                </div>
              )}
              <Text className={styles.memberName} size={200} title={sub.title}>
                {sub.title}
              </Text>
              <Button
                icon={<Dismiss20Regular />}
                size="small"
                appearance="subtle"
                title="从系列移除"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(removeSubSeries({ id: series.id, seriesId: sub.id }));
                }}
              />
            </div>
          ))}
          {members.map((m) => {
            const thumb = m.coverPath
              ? previewUrl(m.coverPath)
              : m.type === 'image'
              ? previewUrl(m.filePath)
              : '';
            return (
              <div
                key={m.id}
                className={styles.memberRow}
                onClick={() => dispatch(setSelectedMedia(m.id))}
              >
                {thumb ? (
                  <img className={styles.memberThumb} src={thumb} alt="" draggable={false} loading="lazy" decoding="async" />
                ) : (
                  <div className={styles.memberThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.type === 'pdf' ? <Document20Regular /> : <VideoClip20Regular />}
                  </div>
                )}
                <Text className={styles.memberName} size={200} title={m.fileName}>
                  {displayName(m.fileName)}
                </Text>
                <Button
                  icon={<Dismiss20Regular />}
                  size="small"
                  appearance="subtle"
                  title="从系列移除"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(removeSeriesMember({ id: series.id, memberId: m.id }));
                  }}
                />
              </div>
            );
          })}
        </div>
        <Button icon={<Add20Regular />} size="small" onClick={handleAddMedia}>
          添加媒体
        </Button>
      </Field>

      <Divider />

      <Field label="自定义封面">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<Image20Regular />} onClick={() => void pickCover()}>
            上传封面
          </Button>
          {coverCandidates.length > 0 && (
            <Popover>
              <PopoverTrigger disableButtonEnhancement>
                <Button icon={<Camera20Regular />}>从剧集选择</Button>
              </PopoverTrigger>
              <PopoverSurface>
                <div className={styles.coverCandidateList}>
                  {coverCandidates.map(({ member, coverPath }) => (
                    <div
                      key={member.id}
                      className={styles.coverCandidate}
                      onClick={() =>
                        dispatch(updateSeries({ id: series.id, patch: { coverPath } }))
                      }
                    >
                      <img className={styles.coverCandidateThumb} src={previewUrl(coverPath)} alt="" draggable={false} loading="lazy" decoding="async" />
                      <Text
                        size={200}
                        style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={member.fileName}
                      >
                        {displayName(member.fileName)}
                      </Text>
                    </div>
                  ))}
                </div>
              </PopoverSurface>
            </Popover>
          )}
          {series.coverPath && (
            <Button
              onClick={() => dispatch(updateSeries({ id: series.id, patch: { coverPath: undefined } }))}
            >
              移除封面
            </Button>
          )}
        </div>
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
            if (series.folderPath) {
              const res = await window.electronAPI.renameSeriesFolder(series.folderPath, title);
              if (res.ok) {
                dispatch(
                  updateSeries({
                    id: series.id,
                    patch: { title: res.title ?? title, folderPath: res.folderPath },
                  })
                );
              }
            } else {
              dispatch(updateSeries({ id: series.id, patch: { title } }));
            }
            setRenameOpen(false);
          })();
        }}
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
    </>
  );
}