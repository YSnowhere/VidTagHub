import { Badge, Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowLeft20Regular, Home20Regular } from '@fluentui/react-icons';
import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  clearTagFilter,
  setSelectedCategory,
  setSelectedLibrary,
  setTagFilter,
  setView,
} from '../store/uiSlice';
import { VideoCard } from './VideoCard';
import { TagBrowser } from './TagBrowser';

const useStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
    background: tokens.colorNeutralBackground2,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingHorizontalL} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalXXL}`,
  },
  empty: {
    margin: 'auto',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalXXL,
  },
});

export function MainArea() {
  const view = useAppSelector((s) => s.ui.view);

  if (view === 'tags') {
    return <TagBrowser />;
  }
  return <MediaGrid />;
}

function MediaGrid() {
  const dispatch = useAppDispatch();
  const media = useAppSelector((s) => s.data.media);
  const tags = useAppSelector((s) => s.data.tags);
  const libraries = useAppSelector((s) => s.data.libraries);
  const selectedLibraryId = useAppSelector((s) => s.ui.selectedLibraryId);
  const search = useAppSelector((s) => s.ui.search);
  const tagFilter = useAppSelector((s) => s.ui.tagFilter);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const searchFields = useAppSelector((s) => s.ui.searchFields);
  const searchMode = useAppSelector((s) => s.ui.searchMode);
  const styles = useStyles();

  const goHome = () => {
    dispatch(setSelectedLibrary(null));
    dispatch(setSelectedCategory(null));
    dispatch(setTagFilter([]));
    dispatch(setView('media'));
  };

  const goUp = () => {
    dispatch(setTagFilter([]));
    dispatch(setView('tags'));
  };

  const items = useMemo(() => {
    const keywords = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const tagName: Record<string, string> = {};
    tags.forEach((t) => {
      tagName[t.id] = t.name.toLowerCase();
    });

    let list = media;
    if (selectedLibraryId) list = list.filter((m) => m.libraryId === selectedLibraryId);
    if (!showNSFW) list = list.filter((m) => !m.restricted);
    if (tagFilter.length) list = list.filter((m) => tagFilter.every((t) => m.tags.includes(t)));
    if (keywords.length) {
      const matchesKeyword = (m: (typeof list)[number], kw: string): boolean => {
        const hitName = searchFields.name && m.fileName.toLowerCase().includes(kw);
        const hitTags = searchFields.tags && m.tags.some((t) => (tagName[t] ?? '').includes(kw));
        const hitDesc = searchFields.description && m.description.toLowerCase().includes(kw);
        return hitName || hitTags || hitDesc;
      };
      list = list.filter((m) =>
        searchMode === 'or'
          ? keywords.some((kw) => matchesKeyword(m, kw))
          : keywords.every((kw) => matchesKeyword(m, kw))
      );
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [media, tags, selectedLibraryId, search, tagFilter, showNSFW, searchFields, searchMode]);

  const selectedTagNames = tagFilter.map((id) => tags.find((t) => t.id === id)?.name ?? id);
  const nsfwCount = useMemo(() => {
    let list = media;
    if (selectedLibraryId) list = list.filter((m) => m.libraryId === selectedLibraryId);
    return list.filter((m) => m.restricted).length;
  }, [media, selectedLibraryId]);

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <Button appearance="outline" size="small" icon={<ArrowLeft20Regular />} onClick={goUp}>
          返回上级
        </Button>
        <Button appearance="subtle" size="small" icon={<Home20Regular />} onClick={goHome}>
          回到主页
        </Button>
        <Text size={300}>共 {items.length} 项</Text>
        {selectedTagNames.map((name) => (
          <Badge key={name} appearance="tint" color="brand">
            {name}
          </Badge>
        ))}
        {tagFilter.length > 0 && (
          <Button size="small" appearance="subtle" onClick={() => dispatch(clearTagFilter())}>
            清除标签筛选
          </Button>
        )}
        {!showNSFW && nsfwCount > 0 && (
          <Badge appearance="tint" color="danger">
            已隐藏 {nsfwCount} 条 NSFW
          </Badge>
        )}
      </div>

      {libraries.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>还没有库，点击左上角「新建库」选择一个文件夹开始管理你的媒体</Text>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>没有找到匹配的媒体</Text>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <VideoCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}