/** 右侧标签列表：新增标签、封面缩略图与行内操作（NSFW、重命名、封面、删除） */

import { Badge, Button, Input, Text, Tooltip } from '@fluentui/react-components';
import {
  Add20Regular,
  Checkmark20Regular,
  Delete20Regular,
  Folder20Regular,
  Image20Regular,
  Rename20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import { previewUrl } from '../../services/format';
import { useTagManagerStyles } from './styles';
import type { Tag } from '../../types';

export interface TagListProps {
  category: string;
  tags: Tag[];
  newTag: string;
  onNewTagChange: (value: string) => void;
  onAddTag: () => void;
  onSetCover: (tagId: string) => void;
  onRename: (tagId: string, name: string) => void;
  onToggleRestricted: (tagId: string, restricted: boolean) => void;
  onDelete: (tagId: string) => void;
}

export function TagList(props: TagListProps) {
  const { category, tags, newTag, onNewTagChange, onAddTag, onSetCover, onRename, onToggleRestricted, onDelete } = props;
  const styles = useTagManagerStyles();

  return (
    <div className={styles.content}>
      <div className={styles.contentHead}>
        <div className={styles.contentTitle}>
          <Folder20Regular />
          <Text weight="semibold" size={400}>
            {category}
          </Text>
          <Badge appearance="tint" size="small">
            {tags.length} 个标签
          </Badge>
        </div>
        <div className={styles.addRow}>
          <Input
            className={styles.grow}
            style={{ width: 220 }}
            value={newTag}
            placeholder={`在「${category}」下添加标签`}
            onChange={(_, d) => onNewTagChange(d.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddTag();
            }}
          />
          <Button icon={<Add20Regular />} onClick={onAddTag}>
            添加
          </Button>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>该分类下还没有标签，请在上方添加</Text>
        </div>
      ) : (
        tags.map((tag) => (
          <div key={tag.id} className={styles.tagRow}>
            {tag.coverPath ? (
              <img className={styles.tagThumb} src={previewUrl(tag.coverPath)} alt="" draggable={false} loading="lazy" decoding="async" />
            ) : (
              <div className={styles.tagThumbPlaceholder}>
                <Tag20Regular />
              </div>
            )}
            <span className={styles.tagName} title={tag.name}>
              <Text size={300}>{tag.name}</Text>
            </span>
            {tag.restricted && (
              <Badge size="small" appearance="filled" color="danger">
                NSFW
              </Badge>
            )}
            <div className={styles.tagActions}>
              <Tooltip content={tag.restricted ? '取消 NSFW 标记' : '标记为 NSFW'} relationship="label">
                <Button
                  icon={tag.restricted ? <Checkmark20Regular /> : <Tag20Regular />}
                  size="small"
                  appearance={tag.restricted ? 'primary' : 'subtle'}
                  onClick={() => onToggleRestricted(tag.id, !tag.restricted)}
                />
              </Tooltip>
              <Tooltip content="重命名标签" relationship="label">
                <Button
                  icon={<Rename20Regular />}
                  size="small"
                  appearance="subtle"
                  onClick={() => onRename(tag.id, tag.name)}
                />
              </Tooltip>
              <Tooltip content="设置封面" relationship="label">
                <Button
                  icon={<Image20Regular />}
                  size="small"
                  appearance="subtle"
                  onClick={() => onSetCover(tag.id)}
                />
              </Tooltip>
              <Tooltip content="删除标签" relationship="label">
                <Button
                  icon={<Delete20Regular />}
                  size="small"
                  appearance="subtle"
                  onClick={() => onDelete(tag.id)}
                />
              </Tooltip>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
