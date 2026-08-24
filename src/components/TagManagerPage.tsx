import {
  Badge,
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
  ArrowLeft20Regular,
  Delete20Regular,
  Image20Regular,
  Tag20Regular,
  Rename20Regular,
  Folder20Regular,
  Checkmark20Regular,
} from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addCategory,
  addTag,
  removeCategory,
  removeTag,
  updateTag,
} from '../store/dataSlice';
import { mediaUrl } from '../services/format';
import { CropImageDialog } from './CropImageDialog';

const TAG_COVER_RATIO = 16 / 10;

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: tokens.colorNeutralBackground2,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    background: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  toolbarTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
  },
  body: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalS}`,
    background: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    overflowY: 'auto',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `0 ${tokens.spacingHorizontalS}`,
    marginTop: tokens.spacingVerticalM,
  },
  treeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    ':hover': {
      background: tokens.colorNeutralBackground1Hover,
    },
  },
  treeSelected: {
    background: tokens.colorNeutralBackground3Selected,
  },
  treeName: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  treeCount: {
    flexShrink: 0,
  },
  treeDelete: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
    padding: tokens.spacingHorizontalL,
    paddingBottom: tokens.spacingVerticalXXL,
  },
  contentHead: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  contentTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    ':hover': {
      background: tokens.colorNeutralBackground1Hover,
    },
  },
  tagThumb: {
    width: '64px',
    height: '40px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    background: tokens.colorNeutralBackground3,
    flexShrink: 0,
  },
  tagThumbPlaceholder: {
    width: '64px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadiusSmall,
    background: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  tagName: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tagActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  addRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  grow: {
    flex: 1,
  },
  empty: {
    margin: 'auto',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalXXL,
  },
});

export function TagManagerPage() {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((s) => s.data.categories);
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  useEffect(() => {
    window.__tagManagerMode = true;
    return () => {
      window.__tagManagerMode = false;
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const t = setTimeout(() => {
      void window.electronAPI.saveTags(categories, tags);
    }, 300);
    return () => clearTimeout(t);
  }, [categories, tags]);

  const [newCategory, setNewCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [cropTarget, setCropTarget] = useState<{ tagId: string; imagePath: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ tagId: string; name: string } | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null);

  const effectiveCategory = selectedCategory ?? null;
  const catTags = effectiveCategory
    ? tags.filter((t) => t.category === effectiveCategory)
    : [];

  const countForCategory = (cat: string) => tags.filter((t) => t.category === cat).length;

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    dispatch(addCategory(newCategory.trim()));
    setNewCategory('');
  };

  const handleAddTag = () => {
    if (!effectiveCategory || !newTag.trim()) return;
    dispatch(addTag({ name: newTag.trim(), category: effectiveCategory }));
    setNewTag('');
  };

  const handleSetCover = async (tagId: string) => {
    const p = await window.electronAPI.pickImage();
    if (p) setCropTarget({ tagId, imagePath: p });
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button
          appearance="outline"
          icon={<ArrowLeft20Regular />}
          onClick={() => window.close()}
          title="关闭标签管理窗口"
        >
          关闭
        </Button>
        <div className={styles.toolbarTitle}>
          <Tag20Regular />
          <Text weight="semibold" size={400}>
            标签管理
          </Text>
          <Badge appearance="tint" size="small">
            {tags.length} 个标签 · {categories.length} 个分类
          </Badge>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.sidebar}>
          <div className={styles.sectionTitle}>
            <Folder20Regular />
            <Text weight="semibold">分类</Text>
          </div>

          <Field label="新增分类">
            <div className={styles.addRow}>
              <Input
                className={styles.grow}
                value={newCategory}
                placeholder="分类名称"
                onChange={(_, d) => setNewCategory(d.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                }}
              />
              <Button icon={<Add20Regular />} size="small" onClick={handleAddCategory} />
            </div>
          </Field>

          {categories.map((cat) => (
            <div
              key={cat}
              className={`${styles.treeItem} ${effectiveCategory === cat ? styles.treeSelected : ''}`}
              onClick={() => setSelectedCategory(effectiveCategory === cat ? null : cat)}
            >
              <Folder20Regular />
              <span className={styles.treeName} title={cat}>
                <Text size={300}>{cat}</Text>
              </span>
              <Badge className={styles.treeCount} size="small" appearance="tint">
                {countForCategory(cat)}
              </Badge>
              <div className={styles.treeDelete}>
                <Tooltip content="删除分类（会一并删除该分类下的标签）" relationship="label">
                  <Button
                    icon={<Delete20Regular />}
                    size="small"
                    appearance="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteCategoryTarget(cat);
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, padding: `0 ${tokens.spacingHorizontalS}` }}>
              暂无分类，请在上方添加
            </Text>
          )}
        </div>

        <div className={styles.content}>
          {!effectiveCategory ? (
            <div className={styles.empty}>
              <Text size={400}>请在左侧选择一个分类来管理其下的标签</Text>
            </div>
          ) : (
            <>
              <div className={styles.contentHead}>
                <div className={styles.contentTitle}>
                  <Folder20Regular />
                  <Text weight="semibold" size={400}>
                    {effectiveCategory}
                  </Text>
                  <Badge appearance="tint" size="small">
                    {catTags.length} 个标签
                  </Badge>
                </div>
                <div className={styles.addRow}>
                  <Input
                    className={styles.grow}
                    style={{ width: 220 }}
                    value={newTag}
                    placeholder={`在「${effectiveCategory}」下添加标签`}
                    onChange={(_, d) => setNewTag(d.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag();
                    }}
                  />
                  <Button icon={<Add20Regular />} onClick={handleAddTag}>
                    添加
                  </Button>
                </div>
              </div>

              {catTags.length === 0 ? (
                <div className={styles.empty}>
                  <Text size={400}>该分类下还没有标签，请在上方添加</Text>
                </div>
              ) : (
                catTags.map((tag) => (
                  <div key={tag.id} className={styles.tagRow}>
                    {tag.coverPath ? (
                      <img className={styles.tagThumb} src={mediaUrl(tag.coverPath)} alt="" draggable={false} />
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
                          onClick={() =>
                            dispatch(updateTag({ id: tag.id, patch: { restricted: !tag.restricted } }))
                          }
                        />
                      </Tooltip>
                      <Tooltip content="重命名标签" relationship="label">
                        <Button
                          icon={<Rename20Regular />}
                          size="small"
                          appearance="subtle"
                          onClick={() => setRenameTarget({ tagId: tag.id, name: tag.name })}
                        />
                      </Tooltip>
                      <Tooltip content="设置封面" relationship="label">
                        <Button
                          icon={<Image20Regular />}
                          size="small"
                          appearance="subtle"
                          onClick={() => void handleSetCover(tag.id)}
                        />
                      </Tooltip>
                      <Tooltip content="删除标签" relationship="label">
                        <Button
                          icon={<Delete20Regular />}
                          size="small"
                          appearance="subtle"
                          onClick={() => dispatch(removeTag(tag.id))}
                        />
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

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

      {renameTarget && (
        <RenameTagDialog
          name={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onConfirm={(name) => {
            dispatch(updateTag({ id: renameTarget.tagId, patch: { name } }));
            setRenameTarget(null);
          }}
        />
      )}

      <Dialog
        open={deleteCategoryTarget !== null}
        onOpenChange={(_, data) => {
          if (!data.open) setDeleteCategoryTarget(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除分类</DialogTitle>
            <DialogContent>
              <Text size={300}>确定要删除分类「{deleteCategoryTarget}」吗？该分类下的所有标签也会一并删除。</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteCategoryTarget(null)}>
                取消
              </Button>
              <Button
                appearance="primary"
                icon={<Delete20Regular />}
                onClick={() => {
                  if (deleteCategoryTarget) {
                    dispatch(removeCategory(deleteCategoryTarget));
                    if (effectiveCategory === deleteCategoryTarget) setSelectedCategory(null);
                  }
                  setDeleteCategoryTarget(null);
                }}
              >
                确认删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function RenameTagDialog({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <Dialog open onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>重命名标签</DialogTitle>
          <DialogContent>
            <Field label="标签名称">
              <Input
                value={value}
                onChange={(_, d) => setValue(d.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
                }}
                autoFocus
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button appearance="primary" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
