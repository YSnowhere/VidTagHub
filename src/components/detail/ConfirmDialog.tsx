/** 通用确认对话框：媒体/系列删除前的二次确认（可显示警告文案与路径） */

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  tokens,
} from '@fluentui/react-components';
import { Delete20Regular } from '@fluentui/react-icons';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 主要提示语 */
  message: string;
  /** 红色警示语（如「不可恢复」） */
  dangerNote?: string;
  /** 展示的路径（可选） */
  detailPath?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, message, dangerNote, detailPath, confirmLabel = '彻底删除', onClose, onConfirm } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <Text size={300}>{message}</Text>
            {dangerNote && (
              <Text size={200} style={{ display: 'block', marginTop: 8, color: tokens.colorPaletteRedForeground1 }}>
                {dangerNote}
              </Text>
            )}
            {detailPath && (
              <Text size={200} style={{ display: 'block', marginTop: 4, color: tokens.colorNeutralForeground3 }}>
                {detailPath}
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button appearance="primary" icon={<Delete20Regular />} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
