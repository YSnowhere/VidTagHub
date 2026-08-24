import { Badge, Button, Checkbox, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Play20Regular, PlayCircle24Regular, Eye20Regular } from '@fluentui/react-icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedMedia, toggleSelectedId } from '../store/uiSlice';
import { displayName, mediaUrl } from '../services/format';
import { visibleTags } from '../services/tags';
import { playMedia } from '../services/play';
import type { MediaItem, Tag } from '../types';

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    cursor: 'pointer',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardSelected: {
    outline: `2px solid ${tokens.colorBrandStroke1}`,
  },
  cover: {
    position: 'relative',
    aspectRatio: '16 / 9',
    background: tokens.colorNeutralBackground3,
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground2}, ${tokens.colorNeutralBackground3})`,
    color: tokens.colorNeutralForeground2,
  },
  coverActions: {
    position: 'absolute',
    right: '6px',
    bottom: '6px',
    display: 'flex',
    gap: '4px',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.15s ease',
  },
  cardHoverActions: {
    opacity: 1,
    pointerEvents: 'auto',
  },
  typeBadge: {
    position: 'absolute',
    left: '6px',
    top: '6px',
  },
  selectBox: {
    position: 'absolute',
    right: '6px',
    top: '6px',
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
  },
  info: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
});

interface Props {
  item: MediaItem;
}

export function VideoCard({ item }: Props) {
  const dispatch = useAppDispatch();
  const selectedMediaId = useAppSelector((s) => s.ui.selectedMediaId);
  const selectionMode = useAppSelector((s) => s.ui.selectionMode);
  const selectedIds = useAppSelector((s) => s.ui.selectedIds);
  const showFileExt = useAppSelector((s) => s.data.settings.showFileExt);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  const coverSrc =
    item.type === 'image'
      ? item.coverPath
        ? mediaUrl(item.coverPath)
        : mediaUrl(item.filePath)
      : item.coverPath
      ? mediaUrl(item.coverPath)
      : null;
  const itemTags = visibleTags(
    item.tags
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is Tag => Boolean(t)),
    showNSFW
  );
  const selected = selectedMediaId === item.id;
  const isChecked = selectedIds.includes(item.id);

  const handleClick = () => {
    if (selectionMode) {
      dispatch(toggleSelectedId(item.id));
    } else {
      dispatch(setSelectedMedia(item.id));
    }
  };

  const handleQuickAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'video') {
      void playMedia(item);
    } else {
      void window.electronAPI.openWithSystem(item.filePath);
    }
  };

  return (
    <div
      className={`${styles.card} ${selected || isChecked ? styles.cardSelected : ''}`}
      onClick={handleClick}
      title={item.fileName}
    >
      <div className={styles.cover}>
        {coverSrc ? (
          <img className={styles.img} src={coverSrc} alt={item.fileName} draggable={false} />
        ) : (
          <div className={styles.placeholder}>
            <PlayCircle24Regular />
          </div>
        )}
        <Badge className={styles.typeBadge} size="small" appearance="filled" color={item.type === 'video' ? 'informative' : 'success'}>
          {item.type === 'video' ? '视频' : '图片'}
        </Badge>
        {selectionMode && (
          <div className={styles.selectBox}>
            <Checkbox
              checked={isChecked}
              onChange={() => dispatch(toggleSelectedId(item.id))}
              onClick={(e) => e.stopPropagation()}
              aria-label="选择"
            />
          </div>
        )}
        <div className={`${styles.coverActions} ${selected ? styles.cardHoverActions : ''}`}>
          <Button
            icon={item.type === 'video' ? <Play20Regular /> : <Eye20Regular />}
            size="small"
            appearance="primary"
            onClick={handleQuickAction}
          >
            {item.type === 'video' ? '播放' : '查看'}
          </Button>
        </div>
      </div>
      <div className={styles.info}>
        <Text className={styles.name} size={200} title={item.fileName}>
          {displayName(item.fileName, showFileExt)}
        </Text>
        <div className={styles.tags}>
          {itemTags.map((t) => (
            <Badge key={t!.id} size="small" appearance="outline">
              {t!.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}