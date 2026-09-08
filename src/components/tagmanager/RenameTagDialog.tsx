/** 重命名标签对话框 */

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
} from '@fluentui/react-components';
import { useState } from 'react';

export interface RenameTagDialogProps {
  name: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export function RenameTagDialog({ name, onClose, onConfirm }: RenameTagDialogProps) {
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
