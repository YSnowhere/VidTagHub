import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Slider,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { previewUrl } from '../services/format';

interface Props {
  open: boolean;
  imagePath: string;
  aspectRatio: number;
  onClose: () => void;
  onSaved: (filePath: string) => void;
}

const VIEW_WIDTH = 560;
const MAX_OUTPUT = 1600;

const useStyles = makeStyles({
  viewport: {
    position: 'relative',
    overflow: 'hidden',
    margin: '0 auto',
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
  },
  img: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    pointerEvents: 'none',
  },
  zoomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalS,
    display: 'block',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalS,
    display: 'block',
  },
});

export function CropImageDialog({ open, imagePath, aspectRatio, onClose, onSaved }: Props) {
  const styles = useStyles();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  const viewH = VIEW_WIDTH / aspectRatio;

  const clampPan = useCallback(
    (next: { x: number; y: number }, z: number): { x: number; y: number } => {
      const fitScale = Math.max(VIEW_WIDTH / imgSize.w, viewH / imgSize.h);
      const dw = imgSize.w * fitScale * z;
      const dh = imgSize.h * fitScale * z;
      const maxX = Math.max(0, (dw - VIEW_WIDTH) / 2);
      const maxY = Math.max(0, (dh - viewH) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, next.x)),
        y: Math.max(-maxY, Math.min(maxY, next.y)),
      };
    },
    [imgSize, viewH]
  );

  useEffect(() => {
    if (!open) {
      loadedImgRef.current = null;
      setLoaded(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setDrag(null);
      setSaving(false);
      setError('');
      return;
    }
    const img = new Image();
    img.onload = () => {
      loadedImgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setLoaded(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setError('');
    };
    img.onerror = () => setError('无法加载图片，请重试');
    img.src = previewUrl(imagePath);
  }, [open, imagePath]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!loaded) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextZoom = Math.max(1, Math.min(4, zoom * factor));
      setZoom(nextZoom);
      setPan(clampPan(pan, nextZoom));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loaded, zoom, pan, clampPan]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!loaded) return;
    e.preventDefault();
    setDrag({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const next = clampPan(
      { x: drag.panX + (e.clientX - drag.startX), y: drag.panY + (e.clientY - drag.startY) },
      zoom
    );
    setPan(next);
  };

  const onMouseUp = () => setDrag(null);

  const handleSave = () => {
    const img = loadedImgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !loaded || imgSize.w === 0) return;
    setSaving(true);
    setError('');
    try {
      const fitScale = Math.max(VIEW_WIDTH / imgSize.w, viewH / imgSize.h);
      const scale = fitScale * zoom;
      const dw = imgSize.w * scale;
      const dh = imgSize.h * scale;
      const left = VIEW_WIDTH / 2 + pan.x - dw / 2;
      const top = viewH / 2 + pan.y - dh / 2;

      const sx = Math.max(0, -left / scale);
      const sy = Math.max(0, -top / scale);
      const sw = Math.min(VIEW_WIDTH / scale, imgSize.w - sx);
      const sh = Math.min(viewH / scale, imgSize.h - sy);

      const outScale = Math.min(1, MAX_OUTPUT / Math.max(sw, sh));
      canvas.width = Math.max(1, Math.round(sw * outScale));
      canvas.height = Math.max(1, Math.round(sh * outScale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建画布');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      void window.electronAPI
        .saveCrop(dataUrl)
        .then((res) => {
          if (res.ok && res.filePath) {
            onSaved(res.filePath);
            onClose();
          } else {
            setError(res.error ?? '保存裁剪图片失败');
          }
        })
        .finally(() => setSaving(false));
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  };

  const fitScale = loaded ? Math.max(VIEW_WIDTH / imgSize.w, viewH / imgSize.h) : 1;
  const displayW = loaded ? imgSize.w * fitScale * zoom : 0;
  const displayH = loaded ? imgSize.h * fitScale * zoom : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>裁剪封面</DialogTitle>
          <DialogContent>
            <div
              ref={viewportRef}
              className={styles.viewport}
              style={{ width: VIEW_WIDTH, height: viewH }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {loaded && (
                <img
                  ref={imgRef}
                  className={styles.img}
                  src={previewUrl(imagePath)}
                  alt=""
                  draggable={false}
                  style={{
                    width: displayW,
                    height: displayH,
                    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                  }}
                />
              )}
              {!loaded && !error && (
                <Text size={300} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  正在加载图片…
                </Text>
              )}
            </div>

            <div className={styles.zoomRow}>
              <Text size={200}>缩放</Text>
              <Slider
                value={zoom}
                min={1}
                max={4}
                step={0.1}
                disabled={!loaded}
                onChange={(_, data) => {
                  setZoom(data.value);
                  setPan(clampPan(pan, data.value));
                }}
                style={{ flex: 1 }}
              />
              <Text size={200} style={{ minWidth: '40px', textAlign: 'right' }}>
                {zoom.toFixed(1)}x
              </Text>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {error && (
              <Text size={200} className={styles.error}>
                {error}
              </Text>
            )}
            <Text size={200} className={styles.hint}>
              拖动画面调整位置，滚动滚轮或拖动滑块缩放，裁剪结果将按 {aspectRatio.toFixed(2)}:1 的比例保存为封面。
            </Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button appearance="primary" disabled={!loaded || saving} onClick={handleSave}>
              {saving ? '正在保存…' : '确认裁剪'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}