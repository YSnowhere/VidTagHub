import { makeStyles, tokens } from '@fluentui/react-components';
import { useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MainArea } from './components/MainArea';
import { DetailPanel } from './components/DetailPanel';
import { LibraryDialog } from './components/LibraryDialog';
import { TagManagerDialog } from './components/TagManagerDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { useAppDispatch } from './store/hooks';
import { hydrate } from './store/dataSlice';
import { setHydrated, setSelectedLibrary } from './store/uiSlice';

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

  useEffect(() => {
    if (!window.electronAPI) return;
    (async () => {
      const data = await window.electronAPI.loadData();
      dispatch(hydrate(data));
      if (data.libraries.length > 0) {
        dispatch(setSelectedLibrary(data.libraries[0].id));
      }
      dispatch(setHydrated(true));
    })();
  }, [dispatch]);

  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.body}>
        <Sidebar />
        <MainArea />
        <DetailPanel />
      </div>
      <LibraryDialog />
      <TagManagerDialog />
      <SettingsDialog />
    </div>
  );
}