/** 标签管理窗口：分类侧边栏 + 标签列表，编辑结果自动保存到 vision-tags.json */

import { Button, Text } from '@fluentui/react-components';
import { ArrowLeft20Regular, Tag20Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addCategory, addTag, removeCategory, removeTag, updateTag } from '../../store/dataSlice';
import { CropImageDialog } from '../CropImageDialog';
import { CategorySidebar } from './CategorySidebar';
import { TagList } from './TagList';
import { RenameTagDialog } from './RenameTagDialog';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import { TAG_COVER_RATIO, useTagManagerStyles } from './styles';

export function TagManagerPage() {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((s) => s.data.categories);
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useTagManagerStyles();

  useEffect(() => {
    window.__tagManagerMode = true;
    return () => {
      window.__tagManagerMode = false;
    };
  }, []);

  // 标签数据独立保存（不写入各库的 JSON）
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
  const catTags = effectiveCategory ? tags.filter((t) => t.category === effectiveCategory) : [];
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

  const handleDeleteCategory = (category: string) => {
    dispatch(removeCategory(category));
    if (effectiveCategory === category) setSelectedCategory(null);
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
        </div>
      </div>

      <div className={styles.body}>
        <CategorySidebar
          categories={categories}
          selectedCategory={effectiveCategory}
          countForCategory={countForCategory}
          newCategory={newCategory}
          onNewCategoryChange={setNewCategory}
          onAddCategory={handleAddCategory}
          onSelectCategory={setSelectedCategory}
          onRequestDelete={setDeleteCategoryTarget}
        />

        {!effectiveCategory ? (
          <div className={styles.content}>
            <div className={styles.empty}>
              <Text size={400}>请在左侧选择一个分类来管理其下的标签</Text>
            </div>
          </div>
        ) : (
          <TagList
            category={effectiveCategory}
            tags={catTags}
            newTag={newTag}
            onNewTagChange={setNewTag}
            onAddTag={handleAddTag}
            onSetCover={(tagId) => void handleSetCover(tagId)}
            onRename={(tagId, name) => setRenameTarget({ tagId, name })}
            onToggleRestricted={(tagId, restricted) => dispatch(updateTag({ id: tagId, patch: { restricted } }))}
            onDelete={(tagId) => dispatch(removeTag(tagId))}
          />
        )}
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

      <DeleteCategoryDialog
        category={deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
}
