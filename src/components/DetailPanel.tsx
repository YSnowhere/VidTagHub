import {
  Badge,
  Button,
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
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  removeMedia,
  removeSeries,
  removeSeriesMember,
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
import { displayName, mediaUrl, formatSize, formatDate } from '../services/format';
import {
  seriesCoverCandidates,
  seriesEffectiveRestricted,
  seriesEffectiveTags,
  seriesMembers,
  seriesTypeText,
  seriesTotalSize,
} from '../services/series';
import { visibleTags } from '../services/tags';
import { playMedia } from '../services/play';
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
  const showFileExt = useAppSelector((s) => s.data.settings.showFileExt);
  const styles = useStyles();

  const [tagEditOpen, setTagEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [frameCaptureOpen, setFrameCaptureOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  const coverSrc =
    item.type === 'image'
      ? item.coverPath
        ? mediaUrl(item.coverPath)
        : mediaUrl(item.filePath)
      : item.coverPath
      ? mediaUrl(item.coverPath)
      : null;
  const itemTags = item.tags
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  const visibleItemTags = visibleTags(itemTags, showNSFW);

  const pickCover = async () => {
    const p = await window.electronAPI.pickImage();
    if (p) setCropTarget(p);
  };

  const handleRemove = () => {
    dispatch(removeMedia(item.id));
    dispatch(setSelectedMedia(null));
  };

  const handlePrimaryAction = () => {
    if (item.type === 'video') {
      void playMedia(item);
    } else {
      void window.electronAPI.openWithSystem(item.filePath);
    }
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
          <img className={styles.img} src={coverSrc} alt={item.fileName} draggable={false} />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              暂无封面
            </Text>
          </div>
        )}
      </div>

      <Field label="名称">
        <div className={styles.nameRow}>
          <Text className={styles.name} size={300} weight="semibold" title={item.fileName}>
            {displayName(item.fileName, showFileExt)}
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
            color={item.type === 'video' ? 'informative' : 'success'}
          >
            {item.type === 'video' ? '视频' : '图片'}
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
          icon={item.type === 'video' ? <Play20Regular /> : <Eye20Regular />}
          onClick={handlePrimaryAction}
        >
          {item.type === 'video' ? '播放' : '查看'}
        </Button>
        <Button icon={<Delete20Regular />} onClick={handleRemove}>
          从库移除
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
              <Button icon={<VideoClip20Regular />} onClick={() => setFrameCaptureOpen(true)}>
                从视频截帧
              </Button>
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
        title={displayName(item.fileName, showFileExt)}
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
    </>
  );
}

function SeriesDetail({ series }: { series: Series }) {
  const dispatch = useAppDispatch();
  const tags = useAppSelector((s) => s.data.tags);
  const media = useAppSelector((s) => s.data.media);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const styles = useStyles();

  const [renameOpen, setRenameOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  const members = seriesMembers(series, media);
  const effectiveTags = seriesEffectiveTags(series, media);
  const totalSize = seriesTotalSize(series, media);
  const typeText = seriesTypeText(series, media);
  const coverCandidates = seriesCoverCandidates(series, media);
  const effectiveRestricted = seriesEffectiveRestricted(series, media);

  const firstCover = (() => {
    if (series.coverPath) return mediaUrl(series.coverPath);
    const firstImage = members.find((m) => m.type === 'image');
    const firstVideoWithCover = members.find((m) => m.type === 'video' && m.coverPath);
    const m = firstImage ?? firstVideoWithCover;
    if (!m) return null;
    if (m.type === 'image') return mediaUrl(m.coverPath ?? m.filePath);
    return m.coverPath ? mediaUrl(m.coverPath) : null;
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

  const handleRemove = () => {
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
        <Text size={200}>{members.length} 项</Text>
        <div className={styles.memberList}>
          {members.map((m) => {
            const thumb = m.coverPath
              ? mediaUrl(m.coverPath)
              : m.type === 'image'
              ? mediaUrl(m.filePath)
              : '';
            return (
              <div
                key={m.id}
                className={styles.memberRow}
                onClick={() => dispatch(setSelectedMedia(m.id))}
              >
                {thumb ? (
                  <img className={styles.memberThumb} src={thumb} alt="" draggable={false} />
                ) : (
                  <div className={styles.memberThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VideoClip20Regular />
                  </div>
                )}
                <Text className={styles.memberName} size={200} title={m.fileName}>
                  {m.fileName}
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
                      <img className={styles.coverCandidateThumb} src={mediaUrl(coverPath)} alt="" draggable={false} />
                      <Text
                        size={200}
                        style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {member.fileName}
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
          dispatch(updateSeries({ id: series.id, patch: { title } }));
          setRenameOpen(false);
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