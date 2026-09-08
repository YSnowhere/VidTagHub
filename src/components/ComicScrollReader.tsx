import { makeStyles, tokens } from '@fluentui/react-components';
import type { ImageDecorator } from 'react-viewer/lib/ViewerProps';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

export interface ComicScrollReaderHandle {
  scrollToPage: (index: number, behavior?: ScrollBehavior) => void;
}

export interface ComicScrollReaderProps {
  /** 需要滚动的全部页 */
  pages: ImageDecorator[];
  /** 当前缩放，1 = 宽度适配 */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** 用户滚动到某页时回调（用于同步页码） */
  onActiveChange: (index: number) => void;
  /** 挂载后要定位到的初始页 */
  initialIndex?: number;
  minZoom?: number;
  maxZoom?: number;
}

const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM = 5;
/** 双击复位目标：100%（宽度适配） */
const FIT_ZOOM = 1;

const useStyles = makeStyles({
  root: {
    position: 'absolute',
    inset: 0,
    // 必须高于 ComicReader 的全屏背景遮罩（z-index: 1000），否则图片被遮住且收不到滚轮/指针事件；
    // 同时低于工具栏（z-index: 2000），与单页模式的 react-viewer（1001）保持一致
    zIndex: 1001,
    overflow: 'auto',
    background: tokens.colorNeutralBackground2,
    scrollbarWidth: 'none',
    userSelect: 'none',
    '&::-webkit-scrollbar': {
      width: 0,
      height: 0,
    },
  },
  column: {
    position: 'relative',
    margin: '0 auto',
  },
  figure: {
    margin: '0 0 10px',
    padding: 0,
    lineHeight: 0,
    fontSize: 0,
    background: tokens.colorNeutralBackground3,
  },
  img: {
    display: 'block',
    width: '100%',
    height: 'auto',
    userSelect: 'none',
  },
  spacer: {
    height: '40vh',
  },
});

export const ComicScrollReader = forwardRef<ComicScrollReaderHandle, ComicScrollReaderProps>(
  function ComicScrollReader(props, ref) {
    const {
      pages,
      zoom,
      onZoomChange,
      onActiveChange,
      initialIndex = 0,
      minZoom = DEFAULT_MIN_ZOOM,
      maxZoom = DEFAULT_MAX_ZOOM,
    } = props;
    const styles = useStyles();

    const scrollerRef = useRef<HTMLDivElement>(null);
    const figEls = useRef<(HTMLElement | null)[]>([]);
    const [areaWidth, setAreaWidth] = useState(0);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{
      id: number;
      x: number;
      y: number;
      scrollLeft: number;
      scrollTop: number;
      moved: boolean;
    } | null>(null);
    const rafRef = useRef<number | undefined>(undefined);
    const detectedRef = useRef(Math.max(0, Math.floor(initialIndex)));
    const zoomRef = useRef(zoom);
    const prevZoomRef = useRef(zoom);
    const onZoomChangeRef = useRef(onZoomChange);
    const onActiveChangeRef = useRef(onActiveChange);
    const anchorRef = useRef<{ x: number; y: number } | null>(null);
    const minZoomRef = useRef(minZoom);
    const maxZoomRef = useRef(maxZoom);

    zoomRef.current = zoom;
    onZoomChangeRef.current = onZoomChange;
    onActiveChangeRef.current = onActiveChange;
    minZoomRef.current = minZoom;
    maxZoomRef.current = maxZoom;

    if (figEls.current.length !== pages.length) {
      figEls.current = new Array(pages.length).fill(null);
    }

    const clampZoom = (z: number): number =>
      Math.max(minZoomRef.current, Math.min(maxZoomRef.current, z));

    const requestZoom = (next: number, x?: number, y?: number): void => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const target = clampZoom(next);
      if (Math.abs(target - zoomRef.current) < 1e-6) return;
      anchorRef.current = {
        x: x ?? scroller.clientWidth / 2,
        y: y ?? scroller.clientHeight / 2,
      };
      onZoomChangeRef.current(target);
    };

    const scheduleDetect = (): void => {
      if (rafRef.current !== undefined) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined;
        const scroller = scrollerRef.current;
        if (!scroller || figEls.current.length === 0) return;
        const center = scroller.scrollTop + scroller.clientHeight * 0.5;
        let lo = 0;
        let hi = figEls.current.length - 1;
        let ans = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const el = figEls.current[mid];
          if (el && el.offsetTop <= center) {
            ans = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (ans !== detectedRef.current) {
          detectedRef.current = ans;
          onActiveChangeRef.current(ans);
        }
      });
    };

    const scrollToPage = (index: number, behavior: ScrollBehavior = 'auto'): void => {
      const figElsNow = figEls.current;
      const scroller = scrollerRef.current;
      if (!scroller || figElsNow.length === 0) return;
      const target = Math.max(0, Math.min(figElsNow.length - 1, Math.floor(index)));
      const el = figElsNow[target];
      if (!el) return;
      el.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
    };

    useImperativeHandle(ref, () => ({ scrollToPage }), []);

    // 滚动视口宽度跟随容器
    useEffect(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const update = (): void => {
        setAreaWidth((prev) => {
          const next = scroller.clientWidth;
          return Math.abs(next - prev) > 0.5 ? next : prev;
        });
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(scroller);
      return () => ro.disconnect();
    }, []);

    // 缩放时按比例缩放滚动位置，保持阅读位置；无锚点时以视口中心为锚点
    useEffect(() => {
      const scroller = scrollerRef.current;
      const prev = prevZoomRef.current;
      prevZoomRef.current = zoom;
      if (!scroller || Math.abs(prev - zoom) < 1e-6) return;
      const ratio = zoom / prev;
      let scrollLeft = scroller.scrollLeft * ratio;
      let scrollTop = scroller.scrollTop * ratio;
      const anchor = anchorRef.current;
      anchorRef.current = null;
      if (anchor) {
        scrollLeft += anchor.x * (ratio - 1);
        scrollTop += anchor.y * (ratio - 1);
      } else {
        scrollLeft += (scroller.clientWidth / 2) * (ratio - 1);
        scrollTop += (scroller.clientHeight / 2) * (ratio - 1);
      }
      scroller.scrollLeft = scrollLeft;
      scroller.scrollTop = scrollTop;
      scheduleDetect();
    }, [zoom, scheduleDetect]);

    // 挂载后定位到初始页（等待布局稳定，最多重试若干次）
    useEffect(() => {
      if (initialIndex <= 0) return;
      const target = Math.max(0, Math.min(pages.length - 1, Math.floor(initialIndex)));
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        const el = figEls.current[target];
        if (el && el.offsetTop > 0) {
          scrollToPage(target, 'auto');
          window.clearInterval(timer);
          return;
        }
        if (attempts >= 15) window.clearInterval(timer);
      }, 250);
      return () => window.clearInterval(timer);
    }, []);

    // Ctrl/⌘ + 滚轮（含触控板捏合）缩放；普通滚轮保持原生纵向滚动
    useEffect(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const onWheel = (e: WheelEvent): void => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const rect = scroller.getBoundingClientRect();
        const factor = e.deltaY !== 0 ? Math.pow(1.25, -e.deltaY / 100) : 1;
        requestZoom(zoomRef.current * factor, e.clientX - rect.left, e.clientY - rect.top);
      };
      scroller.addEventListener('wheel', onWheel, { passive: false });
      return () => scroller.removeEventListener('wheel', onWheel);
    }, []);

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
      if (e.button !== 0) return;
      const scroller = scrollerRef.current;
      if (!scroller || zoomRef.current <= 1.001) return;
      scroller.setPointerCapture(e.pointerId);
      dragRef.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
        moved: false,
      };
      setDragging(true);
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current;
      const scroller = scrollerRef.current;
      if (!drag || !scroller || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      scroller.scrollLeft = drag.scrollLeft - dx;
      scroller.scrollTop = drag.scrollTop - dy;
    };

    const endDrag = (e: ReactPointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current;
      if (!drag || drag.id !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    };

    const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
      if (dragRef.current?.moved) return;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      requestZoom(zoomRef.current > FIT_ZOOM + 0.001 ? FIT_ZOOM : 2, e.clientX - rect.left, e.clientY - rect.top);
    };

    const columnWidth = areaWidth > 0 ? Math.max(1, Math.round(areaWidth * zoom)) : '100%';
    const cursor = zoom > 1.001 ? (dragging ? 'grabbing' : 'grab') : 'default';

    return (
      <div
        ref={scrollerRef}
        className={styles.root}
        style={{ cursor }}
        onScroll={scheduleDetect}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onDoubleClick={handleDoubleClick}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className={styles.column} style={{ width: columnWidth }}>
          {pages.map((page, index) => (
            <figure
              key={page.src}
              ref={(el) => {
                figEls.current[index] = el;
              }}
              className={styles.figure}
            >
              <img
                className={styles.img}
                src={page.src}
                alt={page.alt ?? ''}
                loading="lazy"
                decoding="async"
                draggable={false}
                onLoad={scheduleDetect}
              />
            </figure>
          ))}
          <div className={styles.spacer} />
        </div>
      </div>
    );
  }
);
