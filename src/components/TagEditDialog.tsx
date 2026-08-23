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
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateMedia } from '../store/dataSlice';
import type { MediaItem } from '../types';

interface Props {
  item: MediaItem;
  open: boolean;
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
  restrictRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacingVerticalM,
  },
});

export function TagEditDialog({ item, open, onClose }: Props) {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((s) => s.data.categories);
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  const toggle = (tagId: string) => {
    const has = item.tags.includes(tagId);
    dispatch(
      updateMedia({
        id: item.id,
        patch: {
          tags: has ? item.tags.filter((t) => t !== tagId) : [...item.tags, tagId],
        },
      })
    );
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
          <DialogTitle>修改标签</DialogTitle>
          <DialogContent>
            <Text size={300} weight="semibold">
              {item.fileName}
            </Text>

            <div className={styles.restrictRow}>
              <div>
                <Text weight="semibold" size={300}>
                  限制内容（NSFW）
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  限制标签，不参与分类；开启后默认隐藏，需在侧边栏开启「NSFW 内容」才能显示
                </Text>
              </div>
              <Switch
                checked={item.restricted}
                onChange={(_, data) =>
                  dispatch(updateMedia({ id: item.id, patch: { restricted: !!data.checked } }))
                }
                label="限制"
              />
            </div>

            {categories.map((cat) => {
              const catTags = tags.filter((t) => t.category === cat);
              if (catTags.length === 0) return null;
              return (
                <div key={cat} className={styles.catGroup}>
                  <div className={styles.catTitle}>
                    <Text weight="semibold" size={300}>
                      {cat}
                    </Text>
                    <Badge appearance="outline" size="small">
                      分类
                    </Badge>
                  </div>
                  {catTags.map((tag) => (
                    <Checkbox
                      key={tag.id}
                      label={tag.name}
                      checked={item.tags.includes(tag.id)}
                      onChange={() => toggle(tag.id)}
                    />
                  ))}
                </div>
              );
            })}

            {categories.every((cat) => tags.filter((t) => t.category === cat).length === 0) && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 8 }}>
                暂无标签，可在右上角「标签管理」中添加
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose}>
              完成
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}