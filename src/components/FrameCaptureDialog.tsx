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
import { CheckmarkCircle20Regular } from '@fluentui/react-icons';
import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateMedia } from '../store/dataSlice';
import { mediaUrl } from '../services/format';
import type { MediaItem } from '../types';

interface Props {
  item: MediaItem;
  open: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  video: {
    width: '100%',
    maxHeight: '320px',
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    outline: 'none',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
  time: {
    minWidth: '90px',
    textAlign: 'center',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalS,
  },
});

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FrameCaptureDialog({ item, open, onClose }: Props) {
  const dispatch = useAppDispatch();
  const libraries = useAppSelector((s) => s.data.libraries);
  const styles = useStyles();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [time, setTime] = useState(0);
  const [maxTime, setMaxTime] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const lib = libraries.find((l) => l.id === item.libraryId);

  const handleSeek = (value: number) => {
    const v = videoRef.current;
    setTime(value);
    if (v) v.currentTime = value;
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !lib) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('视频尚未加载完成，请稍候再试');
      return;
    }
    setSaving(true);
    setError('');
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建画布');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const res = await window.electronAPI.saveFrame(dataUrl, lib.path, item.fileName);
      if (res.ok && res.filePath) {
        dispatch(updateMedia({ id: item.id, patch: { coverPath: res.filePath } }));
        onClose();
      } else {
        setError(res.error ?? '保存封面失败');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          setError('');
          onClose();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>从视频截取封面</DialogTitle>
          <DialogContent>
            <video
              ref={videoRef}
              className={styles.video}
              src={mediaUrl(item.filePath)}
              preload="auto"
              controls={false}
              playsInline
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (isFinite(d) && d > 0) setMaxTime(d);
              }}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            />
            <div className={styles.bar}>
              <Slider
                value={Math.min(time, maxTime)}
                min={0}
                max={maxTime}
                step={1}
                onChange={(_, data) => handleSeek(data.value)}
                style={{ flex: 1 }}
              />
              <Text size={200} className={styles.time}>
                {formatTime(time)} / {formatTime(maxTime)}
              </Text>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {error && (
              <Text size={200} className={styles.error}>
                {error}
              </Text>
            )}
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 8 }}>
              拖动进度条定位到想要的画面，然后点击「截取此帧」作为封面。
            </Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              appearance="primary"
              icon={<CheckmarkCircle20Regular />}
              disabled={saving}
              onClick={() => void handleCapture()}
            >
              {saving ? '正在保存…' : '截取此帧'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}