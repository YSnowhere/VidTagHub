import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import {
  ArrowLeft20Regular,
  ArrowRight20Regular,
  BookOpen20Regular,
  Dismiss20Regular,
  ReadingModeMobile20Regular,
} from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearComicReader } from '../store/uiSlice';
import { mediaUrl } from '../services/format';
import { seriesMembers } from '../services/series';
import { displayName } from '../services/format';
import type { MediaItem } from '../types';

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    background: tokens.colorNeutralBackground2,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    background: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
    transition: 'opacity 0.15s ease, transform 0.15s ease',
  },
  toolbarHidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  title: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  spacer: {
    flex: 1,
  },
  pageText: {
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  canvas: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  pageWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  pageImg: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    userSelect: 'none',
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  },
  scrollItem: {
    display: 'flex',
    justifyContent: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
  },
  scrollImg: {
    maxWidth: '100%',
    height: 'auto',
    userSelect: 'none',
    borderRadius: tokens.borderRadiusSmall,
  },
});

type ReaderMode = 'page' | 'scroll';

export function ComicReader() {
  const dispatch = useAppDispatch();
  const seriesId = useAppSelector((s) => s.ui.comicReaderSeriesId);
  const series = useAppSelector((s) => s.data.series.find((x) => x.id === seriesId));
  const media = useAppSelector((s) => s.data.media);
  const styles = useStyles();

  const [mode, setMode] = useState<ReaderMode>('page');
  const [currentPage, setCurrentPage] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const lastWheelRef = useRef(0);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const pages = useMemo<MediaItem[]>(
    () =>
      series
        ? seriesMembers(series, media).filter((m) => m.type === 'image')
        : [],
    [series, media]
  );

  useEffect(() => {
    setCurrentPage(0);
    setMode('page');
    setUiVisible(true);
  }, [seriesId]);

  useEffect(() => {
    if (seriesId && !series) dispatch(clearComicReader());
  }, [seriesId, series, dispatch]);

  const scrollToPage = (i: number) => {
    if (mode === 'scroll') {
      imgRefs.current[i]?.scrollIntoView({ block: 'start' });
    } else {
      setCurrentPage(i);
    }
  };

  const goPrev = () => {
    if (currentPage > 0) scrollToPage(currentPage - 1);
  };

  const goNext = () => {
    if (currentPage < pages.length - 1) scrollToPage(currentPage + 1);
  };

  const toggleUi = () => setUiVisible((v) => !v);

  useEffect(() => {
    if (!seriesId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch(clearComicReader());
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        e.key === ' '
      ) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seriesId, currentPage, mode, pages.length]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'page') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (x < w * 0.3) {
      goPrev();
    } else if (x > w * 0.7) {
      goNext();
    } else {
      toggleUi();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mode !== 'page') return;
    const now = Date.now();
    if (now - lastWheelRef.current < 350) return;
    lastWheelRef.current = now;
    if (e.deltaY > 0) {
      goNext();
    } else if (e.deltaY < 0) {
      goPrev();
    }
  };

  const handleScroll = () => {
    if (mode !== 'scroll') return;
    const container = scrollAreaRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    let best = 0;
    let bestDist = Infinity;
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(el.getBoundingClientRect().top - cRect.top);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setCurrentPage(best);
  };

  if (!seriesId || !series) return null;

  const current = pages[currentPage];

  return (
    <div className={styles.overlay}>
      <div className={`${styles.toolbar} ${uiVisible ? '' : styles.toolbarHidden}`}>
        <Button
          icon={<Dismiss20Regular />}
          size="small"
          appearance="subtle"
          title="关闭 (Esc)"
          onClick={() => dispatch(clearComicReader())}
        />
        <Text className={styles.title} size={300} weight="semibold" title={series.title}>
          {series.title}
        </Text>
        <div className={styles.spacer} />
        <Text className={styles.pageText} size={300}>
          {pages.length > 0 ? `第 ${currentPage + 1} / ${pages.length} 页` : '暂无图片'}
        </Text>
        <Button
          icon={<ArrowLeft20Regular />}
          size="small"
          appearance="outline"
          disabled={currentPage <= 0}
          onClick={goPrev}
          title="上一页"
        />
        <Button
          icon={<ArrowRight20Regular />}
          size="small"
          appearance="outline"
          disabled={currentPage >= pages.length - 1}
          onClick={goNext}
          title="下一页"
        />
        <Button
          icon={mode === 'page' ? <ReadingModeMobile20Regular /> : <BookOpen20Regular />}
          size="small"
          appearance="outline"
          onClick={() => setMode(mode === 'page' ? 'scroll' : 'page')}
        >
          {mode === 'page' ? '滚动' : '单页'}
        </Button>
      </div>

      {mode === 'page' ? (
        <div className={styles.canvas} onClick={handleCanvasClick} onWheel={handleWheel}>
          {current && (
            <div className={styles.pageWrap}>
              <img
                key={current.id}
                className={styles.pageImg}
                src={mediaUrl(current.filePath)}
                alt={current.fileName}
                draggable={false}
                loading="eager"
                decoding="async"
              />
            </div>
          )}
        </div>
      ) : (
        <div className={styles.scrollArea} ref={scrollAreaRef} onScroll={handleScroll}>
          {pages.map((m, i) => (
            <div key={m.id} className={styles.scrollItem}>
              <img
                ref={(el) => {
                  imgRefs.current[i] = el;
                }}
                className={styles.scrollImg}
                src={mediaUrl(m.filePath)}
                alt={m.fileName}
                title={displayName(m.fileName)}
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}