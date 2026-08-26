import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Switch,
  Text,
} from '@fluentui/react-components';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { hydrate } from '../store/dataSlice';
import { setOnlyNSFW, setRememberNSFW, setSettingsOpen, setShowNSFW } from '../store/uiSlice';

export function SettingsDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.settingsOpen);
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const onlyNSFW = useAppSelector((s) => s.ui.onlyNSFW);
  const rememberNSFW = useAppSelector((s) => s.ui.rememberNSFW);
  const [notice, setNotice] = useState('');

  const handleMigrateData = async () => {
    const p = await window.electronAPI.pickFolder();
    if (!p) return;
    const res = await window.electronAPI.migrateData(p);
    if (res.ok) {
      const data = await window.electronAPI.loadData();
      dispatch(hydrate(data));
      setNotice(`数据文件已迁移到：${p}`);
    } else {
      setNotice(`迁移失败：${res.error ?? '未知错误'}`);
    }
  };

  const handleClearCache = async () => {
    const res = await window.electronAPI.clearCache();
    setNotice(res.ok ? '缩略图缓存已清除' : `清除失败：${res.error ?? '未知错误'}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          dispatch(setSettingsOpen(false));
          setNotice('');
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>设置</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="限制内容">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text size={300}>显示 NSFW 内容</Text>
                    <Switch
                      checked={showNSFW}
                      onChange={(_, data) => {
                        dispatch(setShowNSFW(!!data.checked));
                        if (!data.checked) dispatch(setOnlyNSFW(false));
                      }}
                      label="显示"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text size={300}>只显示 NSFW 内容</Text>
                    <Switch
                      checked={onlyNSFW}
                      onChange={(_, data) => {
                        if (data.checked) {
                          dispatch(setShowNSFW(true));
                          dispatch(setOnlyNSFW(true));
                        } else {
                          dispatch(setOnlyNSFW(false));
                        }
                      }}
                      label="显示"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text size={300}>记住我的选择</Text>
                    <Switch
                      checked={rememberNSFW}
                      onChange={(_, data) => dispatch(setRememberNSFW(!!data.checked))}
                      label="确定"
                    />
                  </div>
                </div>
              </Field>
              <Field label="缓存管理">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text size={300}>全部软件数据</Text>
                    <Button size="small" onClick={() => void handleMigrateData()}>
                      迁移数据文件
                    </Button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text size={300}>缩略图缓存</Text>
                    <Button size="small" onClick={() => void handleClearCache()}>
                      清除缓存文件
                    </Button>
                  </div>
                </div>
              </Field>
              {notice && (
                <Text size={200} style={{ color: '#107c10' }}>
                  {notice}
                </Text>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => dispatch(setSettingsOpen(false))}>
              关闭
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}