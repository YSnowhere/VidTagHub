import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Switch,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Folder20Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateSettings } from '../store/dataSlice';
import { setSettingsOpen } from '../store/uiSlice';

const useStyles = makeStyles({
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  playerInput: {
    flex: 1,
  },
});

export function SettingsDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.settingsOpen);
  const playerPath = useAppSelector((s) => s.data.settings.playerPath);
  const showFileExt = useAppSelector((s) => s.data.settings.showFileExt);
  const styles = useStyles();

  const [path, setPath] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (open) {
      setPath(playerPath);
      setHint('');
    }
  }, [open, playerPath]);

  const browse = async () => {
    const p = await window.electronAPI.pickPlayer();
    if (p) setPath(p);
  };

  const detect = async () => {
    const p = await window.electronAPI.detectPlayer();
    if (p) {
      setPath(p);
      setHint(`已自动检测到播放器：${p}`);
    } else {
      setHint('未检测到 PotPlayer，请手动选择播放器程序');
    }
  };

  const handleSave = () => {
    dispatch(updateSettings({ playerPath: path.trim() }));
    dispatch(setSettingsOpen(false));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) dispatch(setSettingsOpen(false));
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>设置</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field
                label="外部播放器（PotPlayer）"
                hint="播放视频时将调用该程序，可点击「自动检测」或手动选择"
              >
                <div className={styles.row}>
                  <Input
                    className={styles.playerInput}
                    value={path}
                    placeholder="例如：C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe"
                    onChange={(_, d) => setPath(d.value)}
                  />
                  <Button icon={<Folder20Regular />} onClick={() => void browse()}>
                    浏览
                  </Button>
                  <Button onClick={() => void detect()}>自动检测</Button>
                </div>
              </Field>
              {hint && (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {hint}
                </Text>
              )}
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                未配置播放器时，将使用系统默认程序打开媒体文件。
              </Text>
              <Field label="文件名显示" hint="默认隐藏文件扩展名（如 .jpg、.mp4），可在卡片和详情中保持整洁">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text size={300}>显示文件扩展名</Text>
                  <Switch
                    checked={showFileExt}
                    onChange={(_, data) => dispatch(updateSettings({ showFileExt: !!data.checked }))}
                    label="显示"
                  />
                </div>
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => dispatch(setSettingsOpen(false))}>
              取消
            </Button>
            <Button appearance="primary" onClick={handleSave}>
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}