import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Add20Regular,
  Delete20Regular,
  Image20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addCategory, addTag, removeCategory, removeTag, updateTag } from '../store/dataSlice';
import { setTagManagerOpen } from '../store/uiSlice';
import { mediaUrl } from '../services/format';
import { CropImageDialog } from './CropImageDialog';

const TAG_COVER_RATIO = 16 / 10;

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  addRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  grow: {
    flex: 1,
  },
  categoryBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalS,
  },
  categoryHead: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalS,
  },
  thumb: {
    width: '48px',
    height: '30px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    flexShrink: 0,
  },
  thumbPlaceholder: {
    width: '48px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadiusSmall,
    background: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
});

export function TagManagerDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.tagManagerOpen);
  const categories = useAppSelector((s) => s.data.categories);
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  const [newCategory, setNewCategory] = useState('');
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [cropTarget, setCropTarget] = useState<{ tagId: string; imagePath: string } | null>(null);

  if (!open) return null;

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    dispatch(addCategory(newCategory.trim()));
    setNewCategory('');
  };

  const handleAddTag = (category: string) => {
    const name = (tagInputs[category] ?? '').trim();
    if (!name) return;
    dispatch(addTag({ name, category }));
    setTagInputs((prev) => ({ ...prev, [category]: '' }));
  };

  const handleSetCover = async (tagId: string) => {
    const p = await window.electronAPI.pickImage();
    if (p) setCropTarget({ tagId, imagePath: p });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          if (!data.open) dispatch(setTagManagerOpen(false));
        }}
      >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>标签管理</DialogTitle>
          <DialogContent>
            <div className={styles.root}>
              <Field label="新增分类">
                <div className={styles.addRow}>
                  <Input
                    className={styles.grow}
                    value={newCategory}
                    placeholder="输入分类名称，例如：动漫、真人"
                    onChange={(_, d) => setNewCategory(d.value)}
                  />
                  <Button icon={<Add20Regular />} onClick={handleAddCategory}>
                    添加分类
                  </Button>
                </div>
              </Field>

              {categories.length === 0 && <Text size={200}>暂无分类，请先添加分类</Text>}

              {categories.map((cat) => {
                const catTags = tags.filter((t) => t.category === cat);
                return (
                  <div key={cat} className={styles.categoryBlock}>
                    <div className={styles.categoryHead}>
                      <Tag20Regular />
                      <Text weight="semibold" size={300}>
                        {cat}
                      </Text>
                      <div className={styles.grow} />
                      <Tooltip content="删除分类（会一并删除该分类下的标签）" relationship="label">
                        <Button
                          icon={<Delete20Regular />}
                          size="small"
                          appearance="subtle"
                          onClick={() => dispatch(removeCategory(cat))}
                        />
                      </Tooltip>
                    </div>

                    {catTags.map((tag) => (
                      <div key={tag.id} className={styles.tagRow}>
                        {tag.coverPath ? (
                          <img className={styles.thumb} src={mediaUrl(tag.coverPath)} alt="" />
                        ) : (
                          <div className={styles.thumbPlaceholder}>
                            <Tag20Regular />
                          </div>
                        )}
                        <Text size={300}>{tag.name}</Text>
                        <div className={styles.grow} />
                        <Tooltip content="设置封面" relationship="label">
                          <Button
                            icon={<Image20Regular />}
                            size="small"
                            appearance="subtle"
                            onClick={() => void handleSetCover(tag.id)}
                          />
                        </Tooltip>
                        <Button
                          icon={<Delete20Regular />}
                          size="small"
                          appearance="subtle"
                          onClick={() => dispatch(removeTag(tag.id))}
                        />
                      </div>
                    ))}

                    <div className={styles.addRow}>
                      <Input
                        className={styles.grow}
                        value={tagInputs[cat] ?? ''}
                        placeholder={`在「${cat}」分类下添加标签`}
                        onChange={(_, d) => setTagInputs((prev) => ({ ...prev, [cat]: d.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTag(cat);
                        }}
                      />
                      <Button icon={<Add20Regular />} onClick={() => handleAddTag(cat)}>
                        添加
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => dispatch(setTagManagerOpen(false))}>
              完成
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
    {cropTarget && (
        <CropImageDialog
          open
          imagePath={cropTarget.imagePath}
          aspectRatio={TAG_COVER_RATIO}
          onClose={() => setCropTarget(null)}
          onSaved={(filePath) => {
            dispatch(updateTag({ id: cropTarget.tagId, patch: { coverPath: filePath } }));
            setCropTarget(null);
          }}
        />
      )}
    </>
  );
}