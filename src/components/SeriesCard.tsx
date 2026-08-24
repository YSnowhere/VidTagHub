import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Collections20Regular, Open20Regular } from '@fluentui/react-icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSelectedSeries, setSeriesView, setView } from '../store/uiSlice';
import { mediaUrl } from '../services/format';
import { seriesEffectiveTags, seriesTypeText } from '../services/series';
import { visibleTags } from '../services/tags';
import type { Series, Tag } from '../types';

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
  typeBadge: {
    position: 'absolute',
    left: '6px',
    top: '6px',
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
  series: Series;
}

export function SeriesCard({ series }: Props) {
  const dispatch = useAppDispatch();
  const selectedSeriesId = useAppSelector((s) => s.ui.selectedSeriesId);
  const tags = useAppSelector((s) => s.data.tags);
  const media = useAppSelector((s) => s.data.media);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const styles = useStyles();

  const itemTags = visibleTags(
    seriesEffectiveTags(series, media)
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is Tag => Boolean(t)),
    showNSFW
  );
  const selected = selectedSeriesId === series.id;
  const memberCount = series.memberIds.length;
  const typeText = seriesTypeText(series, media);

  const openSeries = () => {
    dispatch(setSelectedSeries(series.id));
    dispatch(setSeriesView(series.id));
    dispatch(setView('media'));
  };

  return (
    <div
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={() => dispatch(setSelectedSeries(series.id))}
      title={series.title}
    >
      <div className={styles.cover}>
        {series.coverPath ? (
          <img className={styles.img} src={mediaUrl(series.coverPath)} alt={series.title} draggable={false} />
        ) : (
          <div className={styles.placeholder}>
            <Collections20Regular />
          </div>
        )}
        <Badge className={styles.typeBadge} size="small" appearance="filled" color="brand">
          系列
        </Badge>
        <Badge
          size="small"
          appearance="filled"
          color={typeText.startsWith('视频') ? 'informative' : 'success'}
          style={{ position: 'absolute', left: '6px', top: '28px' }}
        >
          {typeText}
        </Badge>
        <div className={`${styles.coverActions} ${selected ? styles.cardHoverActions : ''}`}>
          <Button
            icon={<Open20Regular />}
            size="small"
            appearance="primary"
            onClick={(e) => {
              e.stopPropagation();
              openSeries();
            }}
          >
            展开
          </Button>
        </div>
      </div>
      <div className={styles.info}>
        <Text className={styles.name} size={200} title={series.title}>
          {series.title}
        </Text>
        <div className={styles.tags}>
          {itemTags.map((t) => (
            <Badge key={t!.id} size="small" appearance="outline">
              {t!.name}
            </Badge>
          ))}
        </div>
      </div>
      <Badge size="small" appearance="outline" style={{ alignSelf: 'flex-start', margin: `0 0 6px 6px` }}>
        {memberCount} 项
      </Badge>
    </div>
  );
}