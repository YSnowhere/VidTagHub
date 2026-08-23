import {
  Badge,
  Button,
  Divider,
  Field,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Delete20Regular,
  Dismiss20Regular,
  Image20Regular,
  Play20Regular,
  Rename20Regular,
  Tag20Regular,
  VideoClip20Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeMedia, updateMedia } from '../store/dataSlice';
import { setSelectedMedia } from '../store/uiSlice';
import { mediaUrl, formatSize, formatDate } from '../services/format';
import { playMedia } from '../services/play';
import { TagEditDialog } from './TagEditDialog';
import { RenameDialog } from './RenameDialog';
import { FrameCaptureDialog } from './FrameCaptureDialog';

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
});

export function DetailPanel() {
  const dispatch = useAppDispatch();
  const selectedMediaId = useAppSelector((s) => s.ui.selectedMediaId);
  const item = useAppSelector((s) => s.data.media.find((m) => m.id === selectedMediaId));
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  const [tagEditOpen, setTagEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [frameCaptureOpen, setFrameCaptureOpen] = useState(false);

  if (!item) {
    return (
      <div className={styles.empty}>
        <Text size={300}>选择媒体以查看详情</Text>
      </div>
    );
  }

  const coverSrc =
    item.type === 'image' ? mediaUrl(item.filePath) : item.coverPath ? mediaUrl(item.coverPath) : null;
  const itemTags = item.tags.map((id) => tags.find((t) => t.id === id)).filter(Boolean);

  const pickCover = async () => {
    const p = await window.electronAPI.pickImage();
    if (p) dispatch(updateMedia({ id: item.id, patch: { coverPath: p } }));
  };

  const handleRemove = () => {
    dispatch(removeMedia(item.id));
    dispatch(setSelectedMedia(null));
  };

  return (
    <div className={styles.root}>
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
            {item.fileName}
          </Text>
          <Button
            icon={<Rename20Regular />}
            size="small"
            onClick={() => setRenameOpen(true)}
            title="重命名文件"
          />
        </div>
      </Field>

      <Field label="类型">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge appearance="tint" color={item.type === 'video' ? 'informative' : 'success'}>
            {item.type === 'video' ? '视频' : '图片'}
          </Badge>
          {item.restricted && (
            <Badge appearance="tint" color="danger">
              限制内容（NSFW）
            </Badge>
          )}
        </div>
      </Field>

      <Field label="大小">
        <Text size={200}>{formatSize(item.size)}</Text>
      </Field>

      <Field label="修改时间">
        <Text size={200}>{formatDate(item.modifiedAt)}</Text>
      </Field>

      <Field label="路径">
        <Text size={200} title={item.filePath}>
          {item.filePath}
        </Text>
      </Field>

      <Divider />

      <Field label="标签">
        <div className={styles.tagSummary}>
          {itemTags.length === 0 && <Text size={200}>未添加标签</Text>}
          {itemTags.map((t) => (
            <Badge key={t!.id} size="small" appearance="tint">
              {t!.name}
            </Badge>
          ))}
        </div>
        <Button icon={<Tag20Regular />} size="small" onClick={() => setTagEditOpen(true)}>
          修改标签
        </Button>
      </Field>

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
          <Button icon={<Image20Regular />} onClick={() => void pickCover()}>
            选择封面图片
          </Button>
          {item.type === 'video' && (
            <Button icon={<VideoClip20Regular />} onClick={() => setFrameCaptureOpen(true)}>
              从视频截帧
            </Button>
          )}
          {item.coverPath && (
            <Button onClick={() => dispatch(updateMedia({ id: item.id, patch: { coverPath: undefined } }))}>
              移除封面
            </Button>
          )}
        </div>
      </Field>

      <div className={styles.actions}>
        <Button appearance="primary" icon={<Play20Regular />} onClick={() => void playMedia(item)}>
          播放
        </Button>
        <Button icon={<Delete20Regular />} onClick={handleRemove}>
          从库移除
        </Button>
      </div>

      <TagEditDialog item={item} open={tagEditOpen} onClose={() => setTagEditOpen(false)} />
      <RenameDialog item={item} open={renameOpen} onClose={() => setRenameOpen(false)} />
      {item.type === 'video' && (
        <FrameCaptureDialog
          item={item}
          open={frameCaptureOpen}
          onClose={() => setFrameCaptureOpen(false)}
        />
      )}
    </div>
  );
}