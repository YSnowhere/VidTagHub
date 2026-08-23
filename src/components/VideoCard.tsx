import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Play20Regular, PlayCircle24Regular } from '@fluentui/react-icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedMedia } from '../store/uiSlice';
import { mediaUrl } from '../services/format';
import { playMedia } from '../services/play';
import type { MediaItem } from '../types';

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
    transition: 'opacity 0.15s ease',
  },
  cardHoverActions: {
    opacity: 1,
  },
  typeBadge: {
    position: 'absolute',
    left: '6px',
    top: '6px',
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
  const tags = useAppSelector((s) => s.data.tags);
  const styles = useStyles();

  const coverSrc =
    item.type === 'image' ? mediaUrl(item.filePath) : item.coverPath ? mediaUrl(item.coverPath) : null;
  const itemTags = item.tags.map((id) => tags.find((t) => t.id === id)).filter(Boolean);
  const selected = selectedMediaId === item.id;

  return (
    <div
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={() => dispatch(setSelectedMedia(item.id))}
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
        <div className={`${styles.coverActions} ${selected ? styles.cardHoverActions : ''}`}>
          <Button
            icon={<Play20Regular />}
            size="small"
            appearance="primary"
            onClick={(e) => {
              e.stopPropagation();
              void playMedia(item);
            }}
          >
            播放
          </Button>
        </div>
      </div>
      <div className={styles.info}>
        <Text className={styles.name} size={200} title={item.fileName}>
          {item.fileName}
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