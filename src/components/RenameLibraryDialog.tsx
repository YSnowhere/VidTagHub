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
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  currentName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
});

export function RenameLibraryDialog({ open, currentName, onConfirm, onClose }: Props) {
  const styles = useStyles();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError('');
    }
  }, [open, currentName]);

  const handleConfirm = () => {
    if (!value.trim()) {
      setError('请输入库名称');
      return;
    }
    onConfirm(value.trim());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>重命名库</DialogTitle>
          <DialogContent>
            <div className={styles.root}>
              <Field label="库名称">
                <Input
                  value={value}
                  placeholder="输入新的库名称"
                  onChange={(_, d) => setValue(d.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
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
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button appearance="primary" onClick={handleConfirm}>
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
