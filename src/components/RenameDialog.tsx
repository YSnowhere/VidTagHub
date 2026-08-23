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
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { updateMedia } from '../store/dataSlice';
import type { MediaItem } from '../types';

interface Props {
  item: MediaItem;
  open: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
});

export function RenameDialog({ item, open, onClose }: Props) {
  const dispatch = useAppDispatch();
  const styles = useStyles();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setError('');
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入新文件名');
      return;
    }
    setSaving(true);
    setError('');
    const res = await window.electronAPI.renameFile(item.filePath, name.trim());
    setSaving(false);
    if (res.ok && res.newPath) {
      const newName = res.newPath.split(/[\\/]/).pop() ?? name.trim();
      dispatch(updateMedia({ id: item.id, patch: { fileName: newName, filePath: res.newPath } }));
      handleOpenChange(false);
    } else {
      setError(res.error ?? '重命名失败');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => handleOpenChange(data.open)}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>重命名文件</DialogTitle>
          <DialogContent>
            <div className={styles.root}>
              <Field label="新文件名" hint="不填扩展名时会自动保留原扩展名">
                <Input
                  value={name}
                  placeholder={item.fileName}
                  onChange={(_, d) => setName(d.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave();
                  }}
                />
              </Field>
              {error && (
                <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                  {error}
                </Text>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button appearance="primary" disabled={saving} onClick={() => void handleSave()}>
              重命名
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}