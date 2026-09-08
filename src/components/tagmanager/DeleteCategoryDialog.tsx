/** 删除分类确认对话框（该分类下的标签会一并删除） */

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
} from '@fluentui/react-components';
import { Delete20Regular } from '@fluentui/react-icons';

export interface DeleteCategoryDialogProps {
  category: string | null;
  onClose: () => void;
  onConfirm: (category: string) => void;
}

export function DeleteCategoryDialog({ category, onClose, onConfirm }: DeleteCategoryDialogProps) {
  return (
    <Dialog
      open={category !== null}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>删除分类</DialogTitle>
          <DialogContent>
            <Text size={300}>确定要删除分类「{category}」吗？该分类下的所有标签也会一并删除。</Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              appearance="primary"
              icon={<Delete20Regular />}
              onClick={() => {
                if (category) onConfirm(category);
                onClose();
              }}
            >
              确认删除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
