import {
  Button,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Dismiss20Regular,
  ZoomFit20Regular,
  ZoomIn20Regular,
  ZoomOut20Regular,
} from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import Viewer from 'react-viewer';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearComicReader } from '../store/uiSlice';
import { mediaUrl } from '../services/format';
import { seriesTreeMembers } from '../services/series';
import type { ImageDecorator } from 'react-viewer/lib/ViewerProps';
import { ComicScrollReader, type ComicScrollReaderHandle } from './ComicScrollReader';

const useStyles = makeStyles({
  background: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: tokens.colorNeutralBackground2,
  },
  toolbar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    background: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
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
});

type ReaderMode = 'scroll' | 'page';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

export function ComicReader() {
  const dispatch = useAppDispatch();
  const seriesId = useAppSelector((s) => s.ui.comicReaderSeriesId);
  const series = useAppSelector((s) => s.data.series.find((x) => x.id === seriesId));
  const allSeries = useAppSelector((s) => s.data.series);
  const media = useAppSelector((s) => s.data.media);
  const hydrated = useAppSelector((s) => s.ui.hydrated);
  const styles = useStyles();

  const [mode, setMode] = useState<ReaderMode>('scroll');
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [loadingPages, setLoadingPages] = useState(true);
  const scrollRef = useRef<ComicScrollReaderHandle>(null);

  // 漫画系列的成员不持久化，直接从系列文件夹读取图片页；无文件夹时退回状态成员
  const pages = useMemo<ImageDecorator[]>(() => {
    if (!series) return [];
    return seriesTreeMembers(series, allSeries, media)
      .filter((m) => m.type === 'image')
      .map((m) => ({ src: mediaUrl(m.filePath), alt: m.fileName }));
  }, [series, allSeries, media]);

  const [folderPages, setFolderPages] = useState<ImageDecorator[]>([]);
  useEffect(() => {
    setLoadingPages(true);
    if (!series) return;
    if (!series.folderPath) {
      setLoadingPages(false);
      return;
    }
    let cancelled = false;
    void window.electronAPI
      .listSeriesFolder(series.folderPath)
      .then((files) => {
        if (cancelled) return;
        if (files.some((f) => f.type === 'image')) {
          setFolderPages(
            files
              .filter((f) => f.type === 'image')
              .map((f) => ({ src: mediaUrl(f.filePath), alt: f.fileName }))
          );
        }
        setLoadingPages(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingPages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [series]);

  const effectivePages = folderPages.length > 0 ? folderPages : pages;

  useEffect(() => {
    setActiveIndex(0);
    setMode('scroll');
    setZoom(ZOOM_MIN);
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
    if (!seriesId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (window.__comicReaderMode) window.close();
        else dispatch(clearComicReader());
        return;
      }
      if (mode === 'scroll') {
        // 滚动模式：方向键 / 空格用于翻页（滚动到对应页）
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          scrollRef.current?.scrollToPage(activeIndex + 1, 'smooth');
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          scrollRef.current?.scrollToPage(activeIndex - 1, 'smooth');
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, effectivePages.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seriesId, dispatch, effectivePages.length, activeIndex, mode]);

  const handleClose = () => {
    if (window.__comicReaderMode) window.close();
    else dispatch(clearComicReader());
  };

  const handleZoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const handleZoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  const handleZoomFit = () => setZoom(ZOOM_MIN);

  if (!seriesId || !series) {
    return (
      <div className={styles.background} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner label="正在加载…" />
      </div>
    );
  }

  return (
    <>
      <div className={styles.background} />
      <div className={styles.toolbar}>
        <Button
          icon={<Dismiss20Regular />}
          size="small"
          appearance="subtle"
          title="关闭 (Esc)"
          onClick={handleClose}
        />
        <Text className={styles.title} size={300} weight="semibold" title={series.title}>
          {series.title}
        </Text>
        <div className={styles.spacer} />

        {mode === 'scroll' && (
          <>
            <Tooltip content="缩小" relationship="label">
              <Button
                icon={<ZoomOut20Regular />}
                size="small"
                appearance="subtle"
                onClick={handleZoomOut}
                disabled={zoom <= ZOOM_MIN}
              />
            </Tooltip>
            <Text className={styles.pageText} size={300}>
              {Math.round(zoom * 100)}%
            </Text>
            <Tooltip content="放大" relationship="label">
              <Button
                icon={<ZoomIn20Regular />}
                size="small"
                appearance="subtle"
                onClick={handleZoomIn}
                disabled={zoom >= ZOOM_MAX}
              />
            </Tooltip>
            <Tooltip content="宽度适配" relationship="label">
              <Button
                icon={<ZoomFit20Regular />}
                size="small"
                appearance="subtle"
                onClick={handleZoomFit}
                disabled={zoom <= ZOOM_MIN}
              />
            </Tooltip>
          </>
        )}

        <Button
          size="small"
          appearance="subtle"
          onClick={() => {
            if (mode === 'page') setMode('scroll');
            else setMode('page');
          }}
        >
          {mode === 'page' ? '滚动模式' : '单页模式'}
        </Button>

        <Text className={styles.pageText} size={300}>
          {loadingPages
            ? '正在加载…'
            : effectivePages.length > 0
            ? `第 ${activeIndex + 1} / ${effectivePages.length} 页`
            : '暂无图片'}
        </Text>
      </div>

      {mode === 'scroll' ? (
        <ComicScrollReader
          ref={scrollRef}
          pages={effectivePages}
          zoom={zoom}
          onZoomChange={setZoom}
          onActiveChange={setActiveIndex}
          initialIndex={activeIndex}
          minZoom={ZOOM_MIN}
          maxZoom={ZOOM_MAX}
        />
      ) : (
        <Viewer
          visible={true}
          onClose={handleClose}
          images={effectivePages}
          activeIndex={activeIndex}
          onChange={(_, index) => setActiveIndex(index)}
          zIndex={1001}
          drag
          zoomable
          rotatable
          scalable
          noClose
          downloadable={false}
          defaultScale={1}
          minScale={0.2}
          maxScale={8}
          loop={false}
          noImgDetails
          showTotal={false}
        />
      )}
    </>
  );
}