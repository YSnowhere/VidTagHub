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
  Spinner,
  Switch,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowClockwise20Regular, Delete20Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addMediaFromScan, removeLibrary, upsertLibrary } from '../store/dataSlice';
import { setSelectedLibrary } from '../store/uiSlice';
import type { Library } from '../types';

interface Props {
  open: boolean;
  libraryId: string | null;
  onClose: () => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
});

export function EditLibraryDialog({ open, libraryId, onClose }: Props) {
  const dispatch = useAppDispatch();
  const library = useAppSelector((s) => s.data.libraries.find((l) => l.id === libraryId));
  const selectedLibraryId = useAppSelector((s) => s.ui.selectedLibraryId);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const styles = useStyles();

  useEffect(() => {
    if (open) {
      setName(library?.name ?? '');
      setError('');
    }
  }, [open, library?.name]);

  if (!library) return null;

  const save = (patch: Partial<Library>) => {
    dispatch(
      upsertLibrary({
        id: library.id,
        name: library.name,
        path: library.path,
        nsfw: library.nsfw,
        collapsed: library.collapsed,
        ...patch,
      })
    );
  };

  const handleSaveName = () => {
    if (!name.trim()) {
      setError('请输入库名称');
      return;
    }
    save({ name: name.trim() });
    onClose();
  };

  const handleRescan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const files = await window.electronAPI.scanLibrary(library.path);
      dispatch(addMediaFromScan({ libraryId: library.id, files }));
    } finally {
      setScanning(false);
    }
  };

  const handleDeleteData = async () => {
    setDeleteDataOpen(false);
    const res = await window.electronAPI.deleteLibraryData(library.id);
    if (res.ok) {
      if (selectedLibraryId === library.id) dispatch(setSelectedLibrary(null));
      dispatch(removeLibrary(library.id));
      onClose();
    } else {
      setError(res.error ?? '删除失败');
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          if (!data.open) onClose();
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>修改库</DialogTitle>
            <DialogContent>
              <div className={styles.root}>
                <Field label="库名称">
                  <Input
                    value={name}
                    onChange={(_, d) => setName(d.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                    }}
                  />
                </Field>
                {error && (
                  <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                    {error}
                  </Text>
                )}
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <Text size={300}>重新扫描</Text>
                    <Text size={200} block className={styles.hint}>
                      重新扫描该库文件夹，添加新增的媒体文件
                    </Text>
                  </div>
                  <Button
                    icon={<ArrowClockwise20Regular />}
                    size="small"
                    disabled={scanning}
                    onClick={() => void handleRescan()}
                  >
                    {scanning ? '扫描中…' : '重新扫描'}
                  </Button>
                </div>
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <Text size={300}>NSFW 库</Text>
                    <Text size={200} block className={styles.hint}>
                      未开启「显示 NSFW 内容」时，该库及其内容完全不显示
                    </Text>
                  </div>
                  <Switch checked={!!library.nsfw} onChange={(_, d) => save({ nsfw: !!d.checked })} label="启用" />
                </div>
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <Text size={300}>折叠库</Text>
                    <Text size={200} block className={styles.hint}>
                      左侧仍显示该库，但在「全部」中不显示其内容（包括搜索）
                    </Text>
                  </div>
                  <Switch
                    checked={!!library.collapsed}
                    onChange={(_, d) => save({ collapsed: !!d.checked })}
                    label="启用"
                  />
                </div>
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <Text size={300}>删除数据</Text>
                    <Text size={200} block style={{ color: tokens.colorPaletteRedForeground1 }}>
                      彻底删除该库文件夹及其中所有文件，与「删除库」不同
                    </Text>
                  </div>
                  <Button
                    size="small"
                    appearance="primary"
                    icon={<Delete20Regular />}
                    onClick={() => setDeleteDataOpen(true)}
                  >
                    删除数据
                  </Button>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose}>
                取消
              </Button>
              <Button appearance="primary" onClick={handleSaveName}>
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog
        open={deleteDataOpen}
        onOpenChange={(_, data) => {
          if (!data.open) setDeleteDataOpen(false);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>删除数据</DialogTitle>
            <DialogContent>
              <Text size={300}>确定要彻底删除库「{library.name}」吗？</Text>
              <Text size={200} style={{ display: 'block', marginTop: 8, color: tokens.colorPaletteRedForeground1 }}>
                此操作不可恢复，将永久删除该库文件夹及其中的所有媒体文件。
              </Text>
              <Text size={200} style={{ display: 'block', marginTop: 4, color: tokens.colorNeutralForeground3 }}>
                {library.path}
              </Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteDataOpen(false)}>
                取消
              </Button>
              <Button appearance="primary" icon={<Delete20Regular />} onClick={() => void handleDeleteData()}>
                确认删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}