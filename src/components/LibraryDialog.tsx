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
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Folder20Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addLibrary, addMediaFromScan } from '../store/dataSlice';
import { setLibraryDialogOpen } from '../store/uiSlice';
import { store } from '../store';

const useStyles = makeStyles({
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  folderInput: {
    flex: 1,
  },
});

export function LibraryDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.libraryDialogOpen);
  const styles = useStyles();

  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setFolder('');
    setError('');
    setScanning(false);
  };

  const pickFolder = async () => {
    const p = await window.electronAPI.pickFolder();
    if (!p) return;
    setFolder(p);
    if (!name.trim()) setName(p.split(/[\\/]/).filter(Boolean).pop() ?? '');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('请输入库名称');
      return;
    }
    if (!folder) {
      setError('请选择媒体文件夹');
      return;
    }
    const existing = store.getState().data.libraries.some((l) => l.path === folder);
    if (existing) {
      setError('该文件夹已存在于某个库中');
      return;
    }

    dispatch(addLibrary({ name: name.trim(), path: folder }));
    const lib = store.getState().data.libraries.find((l) => l.path === folder);
    if (lib) {
      setScanning(true);
      await window.electronAPI.ensureFolder(folder);
      const files = await window.electronAPI.scanLibrary(folder);
      dispatch(addMediaFromScan({ libraryId: lib.id, files }));
      setScanning(false);
    }
    dispatch(setLibraryDialogOpen(false));
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          dispatch(setLibraryDialogOpen(false));
          reset();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>新建库</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="库名称" required>
                <Input value={name} placeholder="例如：动漫、电影、摄影集…" onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="媒体文件夹" required>
                <div className={styles.row}>
                  <Input
                    className={styles.folderInput}
                    value={folder}
                    placeholder="选择一个本地文件夹"
                    onChange={(_, d) => setFolder(d.value)}
                  />
                  <Button icon={<Folder20Regular />} onClick={() => void pickFolder()}>
                    浏览
                  </Button>
                </div>
              </Field>
              {scanning && <Spinner label="正在扫描文件夹…" size="small" />}
              {error && (
                <div style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</div>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => dispatch(setLibraryDialogOpen(false))}>
              取消
            </Button>
            <Button appearance="primary" disabled={scanning} onClick={() => void handleCreate()}>
              创建并扫描
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}