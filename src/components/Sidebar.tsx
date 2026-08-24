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
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Add20Regular,
  ArrowClockwise20Regular,
  Delete20Regular,
  Folder20Regular,
  Rename20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addMediaFromScan, removeLibrary, upsertLibrary } from '../store/dataSlice';
import {
  setLibraryDialogOpen,
  setSelectedLibrary,
  setSelectedCategory,
  setView,
} from '../store/uiSlice';
import { store } from '../store';
import { memberIdSet } from '../services/series';
import { RenameLibraryDialog } from './RenameLibraryDialog';
import type { Library } from '../types';

const useStyles = makeStyles({
  root: {
    width: '260px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalS}`,
    background: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    ':hover': {
      background: tokens.colorNeutralBackground1Hover,
    },
  },
  navSelected: {
    background: tokens.colorNeutralBackground3Selected,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginTop: 0,
    padding: `0 ${tokens.spacingHorizontalS}`,
  },
  item: {
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
  itemSelected: {
    background: tokens.colorNeutralBackground3Selected,
  },
  name: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  count: {
    flexShrink: 0,
  },
});

export function Sidebar() {
  const dispatch = useAppDispatch();
  const libraries = useAppSelector((s) => s.data.libraries);
  const media = useAppSelector((s) => s.data.media);
  const series = useAppSelector((s) => s.data.series);
  const selectedLibraryId = useAppSelector((s) => s.ui.selectedLibraryId);
  const view = useAppSelector((s) => s.ui.view);
  const selectedCategory = useAppSelector((s) => s.ui.selectedCategory);
  const categories = useAppSelector((s) => s.data.categories);

  const styles = useStyles();
  const [removeTarget, setRemoveTarget] = useState<Library | null>(null);
  const [renameTarget, setRenameTarget] = useState<Library | null>(null);

  const hiddenMembers = memberIdSet(series);

  const countForLibrary = (libId: string) =>
    media.filter((m) => m.libraryId === libId && !hiddenMembers.has(m.id)).length +
    series.filter((s) => s.libraryId === libId).length;

  const handleRescan = async (libId: string) => {
    const lib = store.getState().data.libraries.find((l) => l.id === libId);
    if (!lib || !window.electronAPI) return;
    const files = await window.electronAPI.scanLibrary(lib.path);
    dispatch(addMediaFromScan({ libraryId: libId, files }));
  };

  const handleConfirmRemove = () => {
    if (!removeTarget) return;
    const lib = removeTarget;
    setRemoveTarget(null);
    dispatch(removeLibrary(lib.id));
    if (selectedLibraryId === lib.id) dispatch(setSelectedLibrary(null));
  };

  return (
    <div className={styles.root}>
      <div className={styles.sectionTitle}>
        <Tag20Regular />
        <Text weight="semibold">分类</Text>
      </div>

      {categories.map((cat) => (
        <div
          key={cat}
          className={`${styles.item} ${view === 'tags' && selectedCategory === cat ? styles.itemSelected : ''}`}
          onClick={() => {
            dispatch(setSelectedCategory(cat));
            dispatch(setView('tags'));
          }}
        >
          <Tag20Regular />
          <span className={styles.name}>
            <Text size={300}>{cat}</Text>
          </span>
        </div>
      ))}
      {categories.length === 0 && (
        <Text size={200} style={{ padding: `0 ${tokens.spacingHorizontalS}`, color: tokens.colorNeutralForeground3 }}>
          暂无分类，可在右上角「标签管理」中添加
        </Text>
      )}

      <Divider style={{ flex: '0 0 auto' }} />

      <div className={styles.sectionTitle}>
        <Folder20Regular />
        <Text weight="semibold">库</Text>
        <div style={{ flex: 1 }} />
        <Button
          icon={<Add20Regular />}
          appearance="subtle"
          size="small"
          onClick={() => dispatch(setLibraryDialogOpen(true))}
        >
          添加库
        </Button>
      </div>

      <div
        className={`${styles.item} ${selectedLibraryId === null ? styles.itemSelected : ''}`}
        onClick={() => dispatch(setSelectedLibrary(null))}
      >
        <Tag20Regular />
        <span className={styles.name}>
          <Text size={300}>全部</Text>
        </span>
        <Badge className={styles.count} size="small" appearance="tint">
          {media.filter((m) => !hiddenMembers.has(m.id)).length + series.length}
        </Badge>
      </div>

      {libraries.map((lib) => (
        <div
          key={lib.id}
          className={`${styles.item} ${selectedLibraryId === lib.id ? styles.itemSelected : ''}`}
          onClick={() => dispatch(setSelectedLibrary(lib.id))}
        >
          <Folder20Regular />
          <span className={styles.name} title={lib.path}>
            <Text size={300}>{lib.name}</Text>
          </span>
          <Badge className={styles.count} size="small" appearance="tint">
            {countForLibrary(lib.id)}
          </Badge>
          <Tooltip content="重新扫描" relationship="label">
            <Button
              icon={<ArrowClockwise20Regular />}
              size="small"
              appearance="subtle"
              onClick={(e) => {
                e.stopPropagation();
                void handleRescan(lib.id);
              }}
            />
          </Tooltip>
          <Tooltip content="重命名库" relationship="label">
            <Button
              icon={<Rename20Regular />}
              size="small"
              appearance="subtle"
              onClick={(e) => {
                e.stopPropagation();
                setRenameTarget(lib);
              }}
            />
          </Tooltip>
          <Tooltip content="删除库（不删除本地文件）" relationship="label">
            <Button
              icon={<Delete20Regular />}
              size="small"
              appearance="subtle"
              onClick={(e) => {
                e.stopPropagation();
                setRemoveTarget(lib);
              }}
            />
          </Tooltip>
        </div>
      ))}

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(_, data) => {
          if (!data.open) setRemoveTarget(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除库</DialogTitle>
            <DialogContent>
              <Text size={300}>确定要从应用中移除库「{removeTarget?.name}」吗？</Text>
              <Text
                size={300}
                style={{ display: 'block', marginTop: 8, color: tokens.colorNeutralForeground3 }}
              >
                仅从应用移除该库，不会删除本地文件夹及其中的文件。
              </Text>
              <Text size={200} style={{ display: 'block', marginTop: 4, color: tokens.colorNeutralForeground3 }}>
                {removeTarget?.path}
              </Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setRemoveTarget(null)}>
                取消
              </Button>
              <Button appearance="primary" icon={<Delete20Regular />} onClick={handleConfirmRemove}>
                确认移除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <RenameLibraryDialog
        open={renameTarget !== null}
        currentName={renameTarget?.name ?? ''}
        onClose={() => setRenameTarget(null)}
        onConfirm={(name) => {
          if (renameTarget) {
            dispatch(upsertLibrary({ id: renameTarget.id, name, path: renameTarget.path }));
            setRenameTarget(null);
          }
        }}
      />
    </div>
  );
}