/** 媒体详情面板：封面、名称、类型/标签、播放/删除、简介、自定义封面与相关弹窗 */

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
  Delete20Regular,
  Dismiss20Regular,
  Document20Regular,
  Eye20Regular,
  Image20Regular,
  Play20Regular,
  Rename20Regular,
  Tag20Regular,
  VideoClip20Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { removeMedia, updateMedia } from '../../store/dataSlice';
import { setSelectedMedia } from '../../store/uiSlice';
import { displayName, previewUrl, formatSize, formatDate } from '../../services/format';
import { seriesContainingMedia, seriesEffectiveTags } from '../../services/series';
import { visibleTags } from '../../services/tags';
import { TagEditDialog } from '../TagEditDialog';
import { RenameDialog } from '../RenameDialog';
import { FrameCaptureDialog } from '../FrameCaptureDialog';
import { CropImageDialog } from '../CropImageDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { useDetailStyles } from './styles';
import type { MediaItem, Tag } from '../../types';

export function MediaDetail({ item }: { item: MediaItem }) {
  const dispatch = useAppDispatch();
  const tags = useAppSelector((s) => s.data.tags);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const seriesList = useAppSelector((s) => s.data.series);
  const allMedia = useAppSelector((s) => s.data.media);
  const styles = useDetailStyles();

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
  const ownerSeries = seriesContainingMedia(item, seriesList, allMedia);
  const inTaglessSeries = Boolean(ownerSeries);
  const ownerSeriesTags = ownerSeries
    ? seriesEffectiveTags(ownerSeries, seriesList, allMedia)
        .map((id) => tags.find((t) => t.id === id))
        .filter((t): t is Tag => Boolean(t))
    : [];
  const visibleOwnerSeriesTags = visibleTags(ownerSeriesTags, showNSFW);
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
            <Badge size="large" appearance="tint" color="danger">
              NSFW
            </Badge>
          )}
          <Badge
            size="large"
            appearance="tint"
            color={item.type === 'video' ? 'informative' : item.type === 'pdf' ? 'warning' : 'success'}
          >
            {item.type === 'video' ? '视频' : item.type === 'pdf' ? 'PDF' : '图片'}
          </Badge>
          {ownerSeries ? (
            <>
              {visibleOwnerSeriesTags.length === 0 && <Text size={200}>未添加标签</Text>}
              {visibleOwnerSeriesTags.map((t) => (
                <Badge key={t.id} size="large" appearance="tint">
                  {t.name}
                </Badge>
              ))}
            </>
          ) : (
            <>
              {itemTags.length === 0 && <Text size={200}>未添加标签</Text>}
              {visibleItemTags.map((t) => (
                <Badge key={t.id} size="large" appearance="tint">
                  {t.name}
                </Badge>
              ))}
            </>
          )}
        </div>
        {!inTaglessSeries && (
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
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button icon={<Image20Regular />}>设置封面</Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {item.type === 'image' ? (
                <MenuItem icon={<Image20Regular />} onClick={() => setCropTarget(item.filePath)}>
                  裁剪封面
                </MenuItem>
              ) : (
                <>
                  <MenuItem icon={<Image20Regular />} onClick={() => void pickCover()}>
                    选择封面图片
                  </MenuItem>
                  {item.type === 'video' && (
                    <MenuItem icon={<VideoClip20Regular />} onClick={() => setFrameCaptureOpen(true)}>
                      从视频截帧
                    </MenuItem>
                  )}
                </>
              )}
              {item.coverPath && (
                <MenuItem
                  onClick={() => dispatch(updateMedia({ id: item.id, patch: { coverPath: undefined } }))}
                >
                  {item.type === 'image' ? '使用原图' : '移除封面'}
                </MenuItem>
              )}
            </MenuList>
          </MenuPopover>
        </Menu>
      </Field>

      <div className={styles.metaRow}>
        <Text size={200} className={styles.metaText}>
          {formatSize(item.size)} · 创建于 {formatDate(item.createdAt)}
        </Text>
      </div>

      {!inTaglessSeries && (
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
      )}
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

      <ConfirmDialog
        open={deleteOpen}
        title="彻底删除"
        message={`确定要彻底删除「${displayName(item.fileName)}」吗？`}
        dangerNote="该文件将从磁盘上永久删除，无法恢复。"
        detailPath={item.filePath}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleRemove}
      />
    </>
  );
}
