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
  title: string;
  confirmLabel: string;
  onConfirm: (title: string) => void;
  onClose: () => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
});

export function SeriesTitleDialog({ open, title, confirmLabel, onConfirm, onClose }: Props) {
  const styles = useStyles();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValue(title);
      setError('');
    }
  }, [open, title]);

  const handleConfirm = () => {
    if (!value.trim()) {
      setError('请输入标题');
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
          <DialogTitle>{title ? '重命名系列' : '新建系列'}</DialogTitle>
          <DialogContent>
            <div className={styles.root}>
              <Field label="系列标题" hint="一个系列可包含多张图片和视频，统一显示一个标题与标签">
                <Input
                  value={value}
                  placeholder="输入系列标题"
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
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}