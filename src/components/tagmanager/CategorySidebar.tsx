/** 左侧分类列表：新增分类、选择分类、删除分类（带标签数量徽章） */

import { Badge, Button, Field, Input, Text, Tooltip, tokens } from '@fluentui/react-components';
import { Add20Regular, Delete20Regular, Folder20Regular } from '@fluentui/react-icons';
import { useTagManagerStyles } from './styles';

export interface CategorySidebarProps {
  categories: string[];
  selectedCategory: string | null;
  /** 某个分类下的标签数量 */
  countForCategory: (category: string) => number;
  newCategory: string;
  onNewCategoryChange: (value: string) => void;
  onAddCategory: () => void;
  onSelectCategory: (category: string | null) => void;
  onRequestDelete: (category: string) => void;
}

export function CategorySidebar(props: CategorySidebarProps) {
  const {
    categories,
    selectedCategory,
    countForCategory,
    newCategory,
    onNewCategoryChange,
    onAddCategory,
    onSelectCategory,
    onRequestDelete,
  } = props;
  const styles = useTagManagerStyles();

  return (
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
            onChange={(_, d) => onNewCategoryChange(d.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddCategory();
            }}
          />
          <Button icon={<Add20Regular />} size="small" onClick={onAddCategory} />
        </div>
      </Field>

      {categories.map((cat) => (
        <div
          key={cat}
          className={`${styles.treeItem} ${selectedCategory === cat ? styles.treeSelected : ''}`}
          onClick={() => onSelectCategory(selectedCategory === cat ? null : cat)}
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
                  onRequestDelete(cat);
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
  );
}
