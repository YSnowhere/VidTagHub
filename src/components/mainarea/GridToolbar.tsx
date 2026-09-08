/** 主区域顶部工具栏：返回/主页、标签筛选徽章、漫画阅读入口、多选与批量操作按钮 */

import { Badge, Button } from '@fluentui/react-components';
import {
  ArrowLeft20Regular,
  BookOpen20Regular,
  DismissCircle20Regular,
  Home20Regular,
  SelectAllOff20Regular,
  Tag20Regular,
  TagMultiple20Regular,
} from '@fluentui/react-icons';
import { useMainAreaStyles } from './styles';
import type { Series } from '../../types';

export interface GridToolbarProps {
  /** 当前展开的系列（库根视图为 null） */
  viewingSeries: Series | null;
  /** 当前展开的系列是漫画叶子 */
  comicLeaf: boolean;
  /** 已选标签筛选项的名称 */
  selectedTagNames: string[];
  /** 标签筛选是否生效 */
  tagFilterActive: boolean;
  selectionMode: boolean;
  itemCount: number;
  selectedCount: number;
  /** 是否允许「合并为系列」（子系列内不允许再建子系列） */
  canCreateSeries: boolean;
  /** 已指定「加入某系列」时的目标系列 */
  targetSeries: Series | null;
  batchTagDisabled: boolean;
  onGoUp: () => void;
  onGoHome: () => void;
  onClearTagFilter: () => void;
  onOpenReader: () => void;
  onSelectAll: () => void;
  onMerge: () => void;
  onBatchTag: () => void;
  onRemoveFromSeries: () => void;
  onClearSelection: () => void;
  onToggleSelectionMode: () => void;
}

export function GridToolbar(props: GridToolbarProps) {
  const {
    viewingSeries,
    comicLeaf,
    selectedTagNames,
    tagFilterActive,
    selectionMode,
    itemCount,
    selectedCount,
    canCreateSeries,
    targetSeries,
    batchTagDisabled,
    onGoUp,
    onGoHome,
    onClearTagFilter,
    onOpenReader,
    onSelectAll,
    onMerge,
    onBatchTag,
    onRemoveFromSeries,
    onClearSelection,
    onToggleSelectionMode,
  } = props;
  const styles = useMainAreaStyles();

  return (
    <div className={styles.bar}>
      {viewingSeries && (
        <Button appearance="outline" size="small" icon={<ArrowLeft20Regular />} onClick={onGoUp}>
          返回上级
        </Button>
      )}
      {!viewingSeries && tagFilterActive && (
        <>
          <Button appearance="outline" size="small" icon={<ArrowLeft20Regular />} onClick={onGoUp}>
            返回上级
          </Button>
          <Button appearance="subtle" size="small" icon={<Home20Regular />} onClick={onGoHome}>
            回到主页
          </Button>
        </>
      )}
      {comicLeaf && (
        <Button appearance="primary" size="small" icon={<BookOpen20Regular />} onClick={onOpenReader}>
          漫画阅读
        </Button>
      )}
      {selectedTagNames.map((name) => (
        <Badge key={name} appearance="tint" color="brand">
          {name}
        </Badge>
      ))}
      {tagFilterActive && (
        <Button size="small" appearance="subtle" onClick={onClearTagFilter}>
          清除标签筛选
        </Button>
      )}
      <div style={{ flex: 1 }} />
      {selectionMode && (
        <>
          {itemCount > 0 && selectedCount < itemCount && (
            <Button size="small" appearance="outline" icon={<SelectAllOff20Regular />} onClick={onSelectAll}>
              全选
            </Button>
          )}
          {selectedCount > 0 && (
            <>
              <Button
                appearance="primary"
                size="small"
                icon={<TagMultiple20Regular />}
                disabled={!canCreateSeries}
                title={!canCreateSeries ? '不能在子系列里创建子系列' : undefined}
                onClick={onMerge}
              >
                {targetSeries ? `加入「${targetSeries.title}」` : '合并为系列'}
              </Button>
              <Button
                size="small"
                appearance="outline"
                icon={<Tag20Regular />}
                disabled={batchTagDisabled}
                onClick={onBatchTag}
              >
                加标签
              </Button>
              {viewingSeries && (
                <Button
                  size="small"
                  appearance="outline"
                  icon={<DismissCircle20Regular />}
                  onClick={onRemoveFromSeries}
                >
                  从系列移除
                </Button>
              )}
            </>
          )}
          {selectedCount >= 2 && (
            <Button size="small" appearance="outline" onClick={onClearSelection}>
              清除
            </Button>
          )}
        </>
      )}
      <Button
        appearance={selectionMode ? 'primary' : 'outline'}
        size="small"
        icon={<SelectAllOff20Regular />}
        onClick={onToggleSelectionMode}
      >
        {selectionMode ? '退出多选' : '多选'}
      </Button>
    </div>
  );
}
