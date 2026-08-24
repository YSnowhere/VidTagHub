import { makeStyles, tokens } from '@fluentui/react-components';
import { useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MainArea } from './components/MainArea';
import { DetailPanel } from './components/DetailPanel';
import { LibraryDialog } from './components/LibraryDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { TagManagerPage } from './components/TagManagerPage';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { hydrate, hydrateTags } from './store/dataSlice';
import { setHydrated, setSelectedLibrary, setShowNSFW, setOnlyNSFW, setRememberNSFW } from './store/uiSlice';

const NSFW_STORAGE_KEY = 'nsfw-display-settings';

const useStyles = makeStyles({
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: tokens.colorNeutralBackground2,
  },
  body: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
});

export default function App() {
  const dispatch = useAppDispatch();
  const styles = useStyles();
  const showNSFW = useAppSelector((s) => s.ui.showNSFW);
  const onlyNSFW = useAppSelector((s) => s.ui.onlyNSFW);
  const rememberNSFW = useAppSelector((s) => s.ui.rememberNSFW);

  const isTagManager = new URLSearchParams(window.location.search).get('page') === 'tagmanager';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NSFW_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        showNSFW?: boolean;
        onlyNSFW?: boolean;
        rememberNSFW?: boolean;
      };
      dispatch(setRememberNSFW(!!saved.rememberNSFW));
      if (saved.rememberNSFW) {
        dispatch(setShowNSFW(!!saved.showNSFW));
        dispatch(setOnlyNSFW(!!saved.onlyNSFW));
      } else {
        dispatch(setShowNSFW(false));
        dispatch(setOnlyNSFW(false));
      }
    } catch {
      /* ignore */
    }
  }, [dispatch]);

  useEffect(() => {
    localStorage.setItem(NSFW_STORAGE_KEY, JSON.stringify({ showNSFW, onlyNSFW, rememberNSFW }));
  }, [showNSFW, onlyNSFW, rememberNSFW]);

  useEffect(() => {
    if (!window.electronAPI) return;
    (async () => {
      const data = await window.electronAPI.loadData();
      dispatch(hydrate(data));
      if (isTagManager) {
        dispatch(setHydrated(true));
        return;
      }
      if (data.libraries.length > 0) {
        dispatch(setSelectedLibrary(data.libraries[0].id));
      }
      dispatch(setHydrated(true));
    })();
  }, [dispatch, isTagManager]);

  useEffect(() => {
    if (isTagManager || !window.electronAPI) return;
    const handler = () => {
      void window.electronAPI.loadData().then((data) => {
        dispatch(hydrateTags({ categories: data.categories, tags: data.tags }));
      });
    };
    const off = window.electronAPI.onTagsChanged(handler);
    return off;
  }, [dispatch, isTagManager]);

  if (isTagManager) {
    return <TagManagerPage />;
  }

  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.body}>
        <Sidebar />
        <MainArea />
        <DetailPanel />
      </div>
      <LibraryDialog />
      <SettingsDialog />
    </div>
  );
}
