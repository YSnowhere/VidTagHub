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
import { seriesTreeMembers } from '../services/series';
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
    minHeight: 0,
    overflow: 'auto',
    position: 'relative',
  },
  pageWrap: {
    margin: 'auto',
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
  pageWrapFit: {
    margin: 'auto',
    flexShrink: 0,
    lineHeight: 0,
  },
  pageImgFit: {
    width: '100%',
    height: '100%',
    userSelect: 'none',
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  scrollItem: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
  },
  scrollImg: {
    display: 'block',
    margin: '0 auto',
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
  const allSeries = useAppSelector((s) => s.data.series);
  const media = useAppSelector((s) => s.data.media);
  const hydrated = useAppSelector((s) => s.ui.hydrated);
  const styles = useStyles();

  const [mode, setMode] = useState<ReaderMode>('page');
  const [currentPage, setCurrentPage] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const lastWheelRef = useRef(0);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const pages = useMemo<MediaItem[]>(
    () =>
      series
        ? seriesTreeMembers(series, allSeries, media).filter((m) => m.type === 'image')
        : [],
    [series, allSeries, media]
  );

  const preloadCount = 3;
  const preloadedRef = useRef<{ index: number; img: HTMLImageElement }[]>([]);

  useEffect(() => {
    preloadedRef.current = [];
  }, [seriesId]);

  useEffect(() => {
    if (mode !== 'page') return;
    const loaded = new Set(preloadedRef.current.map((p) => p.index));
    for (let i = currentPage + 1; i <= currentPage + preloadCount && i < pages.length; i++) {
      if (loaded.has(i)) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = mediaUrl(pages[i].filePath);
      preloadedRef.current.push({ index: i, img });
    }
  }, [mode, currentPage, pages]);

  useEffect(() => {
    setCurrentPage(0);
    setMode('page');
    setUiVisible(true);
    setZoom(1);
  }, [seriesId]);

  useEffect(() => {
    if (!hydrated || !seriesId) return;
    if (series) return;
    if (window.__comicReaderMode) {
      window.close();
    } else {
      dispatch(clearComicReader());
    }
  }, [seriesId, series, hydrated, dispatch]);

  useEffect(() => {
    setNaturalSize(null);
    const el = canvasRef.current;
    if (el) el.scrollTop = 0;
  }, [currentPage]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const compute = () => {
      if (!naturalSize) return;
      const rect = el.getBoundingClientRect();
      setFitScale(Math.min(1, rect.width / naturalSize.w, rect.height / naturalSize.h));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalSize]);

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
        if (window.__comicReaderMode) window.close();
        else dispatch(clearComicReader());
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
  }, [seriesId, currentPage, mode, pages.length, dispatch]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || mode !== 'page') return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom((z) => Math.min(8, Math.max(0.2, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
        return;
      }
      if (zoom > 1.001) return;
      const now = Date.now();
      if (now - lastWheelRef.current < 350) return;
      lastWheelRef.current = now;
      if (e.deltaY > 0) goNext();
      else if (e.deltaY < 0) goPrev();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mode, zoom, currentPage, pages.length]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || mode !== 'scroll') return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(8, Math.max(0.2, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (mode !== 'page' || zoom > 1.001) return;
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

  // 放大后直接用鼠标左键拖拽平移画面
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (zoom <= 1.001) return;
    const el = e.currentTarget;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    };
    suppressClickRef.current = false;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    const el = e.currentTarget;
    el.scrollLeft = d.scrollLeft - dx;
    el.scrollTop = d.scrollTop - dy;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (d.moved) suppressClickRef.current = true;
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  if (!seriesId || !series) return null;

  const current = pages[currentPage];
  const dispW = naturalSize ? Math.round(naturalSize.w * fitScale * zoom) : undefined;
  const dispH = naturalSize ? Math.round(naturalSize.h * fitScale * zoom) : undefined;
  const scrollZoomStyle =
    zoom > 1.001 ? { width: `${zoom * 100}%`, maxWidth: 'none' } : { width: 'auto', maxWidth: `${zoom * 100}%` };

  return (
    <div className={styles.overlay}>
      <div className={`${styles.toolbar} ${uiVisible ? '' : styles.toolbarHidden}`}>
        <Button
          icon={<Dismiss20Regular />}
          size="small"
          appearance="subtle"
          title="关闭 (Esc)"
          onClick={() => {
            if (window.__comicReaderMode) window.close();
            else dispatch(clearComicReader());
          }}
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
        <div
          className={styles.canvas}
          ref={canvasRef}
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {current &&
            (naturalSize ? (
              <div className={styles.pageWrapFit} style={{ width: dispW, height: dispH }}>
                <img
                  key={current.id}
                  className={styles.pageImgFit}
                  src={mediaUrl(current.filePath)}
                  alt={current.fileName}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : (
              <div className={styles.pageWrap}>
                <img
                  key={current.id}
                  className={styles.pageImg}
                  src={mediaUrl(current.filePath)}
                  alt={current.fileName}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  onLoad={(e) =>
                    setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                  }
                />
              </div>
            ))}
        </div>
      ) : (
        <div
          className={styles.scrollArea}
          ref={scrollAreaRef}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {pages.map((m, i) => (
            <div key={m.id} className={styles.scrollItem}>
              <img
                ref={(el) => {
                  imgRefs.current[i] = el;
                }}
                className={styles.scrollImg}
                style={scrollZoomStyle}
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