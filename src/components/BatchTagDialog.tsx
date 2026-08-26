import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Switch,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';

interface Props {
  open: boolean;
  targetCount: number;
  onConfirm: (tagIds: string[], restricted: boolean) => void;
  onClose: () => void;
}

const useStyles = makeStyles({
  catGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalM,
  },
  catTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginBottom: tokens.spacingVerticalXS,
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  restrictRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacingVerticalM,
  },
});

export function BatchTagDialog({ open, targetCount, onConfirm, onClose }: Props) {
  const categories = useAppSelector((s) => s.data.categories);
  const allTags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  const [selected, setSelected] = useState<string[]>([]);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setRestricted(false);
    }
  }, [open]);

  const toggle = (tagId: string) => {
    setSelected((cur) =>
      cur.includes(tagId) ? cur.filter((t) => t !== tagId) : [...cur, tagId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selected, restricted);
    onClose();
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
          <DialogTitle>批量添加标签</DialogTitle>
          <DialogContent>
            <Text size={300} weight="semibold">
              将所选标签添加到 {targetCount} 个媒体
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 4 }}>
              勾选需要添加的标签，未勾选的标签保持不变（含 NSFW 标签）
            </Text>

            <div className={styles.restrictRow}>
              <div>
                <Text weight="semibold" size={300}>
                  标记为 NSFW
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  开启后为所选媒体批量设置 NSFW 限制；关闭则保持原有设置不变
                </Text>
              </div>
              <Switch
                checked={restricted}
                onChange={(_, data) => setRestricted(!!data.checked)}
                label="限制"
              />
            </div>

            {categories.map((cat) => {
              const catTags = allTags.filter((t) => t.category === cat);
              if (catTags.length === 0) return null;
              return (
                <div key={cat} className={styles.catGroup}>
                  <div className={styles.catTitle}>
                    <Text weight="semibold" size={300}>
                      {cat}
                    </Text>
                  </div>
                  {catTags.map((tag) => (
                    <div key={tag.id} className={styles.tagRow}>
                      <Checkbox
                        label={tag.name}
                        checked={selected.includes(tag.id)}
                        onChange={() => toggle(tag.id)}
                      />
                      {tag.restricted && (
                        <Badge size="small" appearance="filled" color="danger">
                          NSFW
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {categories.every((cat) => allTags.filter((t) => t.category === cat).length === 0) && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 8 }}>
                暂无标签，可在右上角「标签管理」中添加
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button appearance="primary" disabled={selected.length === 0 && !restricted} onClick={handleConfirm}>
              {selected.length === 0 && restricted ? '设置 NSFW' : `添加 (${selected.length})`}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}