import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Home20Regular, Tag20Regular } from '@fluentui/react-icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSeriesView, setSelectedCategory, setSelectedMedia, setSelectionMode, setTagFilter, setView } from '../store/uiSlice';
import { previewUrl } from '../services/format';
import { memberIdSet, memberSeriesIdSet, seriesEffectiveRestricted, seriesEffectiveTags } from '../services/series';
import { visibleTags } from '../services/tags';
import type { Tag } from '../types';

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    minWidth: 0,
    overflowY: 'auto',
    background: tokens.colorNeutralBackground2,
    padding: tokens.spacingHorizontalL,
    paddingBottom: tokens.spacingVerticalXXL,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
  },
  hint: {
    margin: 'auto',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalXXL,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalL,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow2,
    cursor: 'pointer',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cover: {
    aspectRatio: '16 / 10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: tokens.colorNeutralForegroundInverted,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  info: {
    padding: tokens.spacingVerticalS,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
  name: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

const GRADIENTS = [
  ['#0078d4', '#00bcf2'],
  ['#b4009e', '#e3008c'],
  ['#038387', '#00b7c3'],
  ['#ca5010', '#ff8c00'],
  ['#8764b8', '#b4a0f4'],
  ['#107c10', '#23a323'],
  ['#e81123', '#ff4c4c'],
];

const gradientFor = (name: string): string[] => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
};

export function TagBrowser() {
  const dispatch = useAppDispatch();
  const selectedCategory = useAppSelector((s) => s.ui.selectedCategory);
  const selectedLibraryId = useAppSelector((s) => s.ui.selectedLibraryId);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const onlyNSFW = useAppSelector((s) => s.ui.onlyNSFW);
  const categories = useAppSelector((s) => s.data.categories);
  const tags = useAppSelector((s) => s.data.tags);
  const media = useAppSelector((s) => s.data.media);
  const series = useAppSelector((s) => s.data.series);
  const libraries = useAppSelector((s) => s.data.libraries);
  const styles = useStyles();

  const hiddenLibraryIds = new Set(
    libraries
      .filter((l) => (!showNSFW && l.nsfw) || (!selectedLibraryId && l.collapsed))
      .map((l) => l.id)
  );

  const scopedMedia = media.filter(
    (m) =>
      !memberIdSet(series).has(m.id) &&
      !hiddenLibraryIds.has(m.libraryId) &&
      (!selectedLibraryId || m.libraryId === selectedLibraryId) &&
      (!onlyNSFW || m.restricted)
  );
  const scopedSeries = series.filter(
    (s) =>
      !memberSeriesIdSet(series).has(s.id) &&
      !hiddenLibraryIds.has(s.libraryId) &&
      (!selectedLibraryId || s.libraryId === selectedLibraryId) &&
      (!onlyNSFW || seriesEffectiveRestricted(s, series, media))
  );
  const scopedTags = visibleTags(tags, showNSFW, onlyNSFW);
  const tagIdToCategory = new Map<string, string>();
  scopedTags.forEach((t) => tagIdToCategory.set(t.id, t.category));

  const countForTag = (tagId: string) =>
    scopedMedia.filter((m) => m.tags.includes(tagId)).length +
    scopedSeries.filter((s) => seriesEffectiveTags(s, series, media).includes(tagId)).length;
  const countForCategory = (cat: string) =>
    scopedMedia.filter((m) => m.tags.some((id) => tagIdToCategory.get(id) === cat)).length +
    scopedSeries.filter((s) => seriesEffectiveTags(s, series, media).some((id) => tagIdToCategory.get(id) === cat))
      .length;

  const handleSelectTag = (tag: Tag) => {
    dispatch(setTagFilter([tag.id]));
    dispatch(setView('media'));
  };

  const goHome = () => {
    dispatch(setSelectedMedia(null));
    dispatch(setTagFilter([]));
    dispatch(clearSeriesView());
    dispatch(setSelectionMode(false));
    dispatch(setView('media'));
  };

  const renderTagCard = (tag: Tag) => {
    const [g1, g2] = gradientFor(tag.name);
    return (
      <div key={tag.id} className={styles.card} onClick={() => handleSelectTag(tag)} title={tag.name}>
        <div className={styles.cover} style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
          {tag.coverPath ? (
            <img className={styles.img} src={previewUrl(tag.coverPath)} alt={tag.name} draggable={false} loading="lazy" decoding="async" />
          ) : (
            <Tag20Regular style={{ width: 48, height: 48 }} />
          )}
        </div>
        <div className={styles.info}>
          <Text className={styles.name} size={300} weight="semibold">
            {tag.name}
          </Text>
          <Badge size="small" appearance="tint">
            {countForTag(tag.id)}
          </Badge>
        </div>
      </div>
    );
  };

  // 分类总览：标签检索的首页
  if (!selectedCategory) {
    return (
      <div className={styles.root}>
        <div className={styles.topBar}>
          <Button appearance="outline" icon={<Home20Regular />} onClick={goHome}>
            回到主页
          </Button>
          <div className={styles.head}>
            <Text weight="semibold" size={400}>
              按分类浏览
            </Text>
            <Badge appearance="tint" size="small">
              {selectedLibraryId ? '当前库' : '全部库'}
            </Badge>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className={styles.hint}>
            <Text size={400}>暂无分类，可在右上角「标签管理」中添加</Text>
          </div>
        ) : (
          <div className={styles.grid}>
            {categories.map((cat) => {
              const [c1, c2] = gradientFor(cat);
              const catTags = scopedTags.filter((t) => t.category === cat);
              const coverTag = catTags.find((t) => t.coverPath) ?? catTags[0];
              return (
                <div
                  key={cat}
                  className={styles.card}
                  onClick={() => dispatch(setSelectedCategory(cat))}
                  title={cat}
                >
                  <div className={styles.cover} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                    {coverTag?.coverPath ? (
                      <img className={styles.img} src={previewUrl(coverTag.coverPath)} alt={cat} draggable={false} loading="lazy" decoding="async" />
                    ) : (
                      <Tag20Regular style={{ width: 48, height: 48 }} />
                    )}
                  </div>
                  <div className={styles.info}>
                    <Text className={styles.name} size={300} weight="semibold">
                      {cat}
                    </Text>
                    <Badge size="small" appearance="tint">
                      {countForCategory(cat)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const catTags = scopedTags.filter((t) => t.category === selectedCategory);

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <Button appearance="subtle" icon={<Home20Regular />} onClick={goHome}>
          回到主页
        </Button>
        <div className={styles.head}>
          <Tag20Regular style={{ width: 20, height: 20 }} />
          <Text weight="semibold" size={400}>
            {selectedCategory}
          </Text>
          <Badge appearance="outline" size="small">
            {catTags.length} 个标签
          </Badge>
          <Badge appearance="tint" size="small">
            {selectedLibraryId ? '当前库' : '全部库'}
          </Badge>
        </div>
      </div>

      {catTags.length === 0 ? (
        <div className={styles.hint}>
          <Text size={400}>该分类下还没有标签，可在右上角「标签管理」中添加</Text>
        </div>
      ) : (
        <div className={styles.grid}>{catTags.map((tag) => renderTagCard(tag))}</div>
      )}
    </div>
  );
}