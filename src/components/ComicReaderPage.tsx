import { useEffect } from 'react';
import { ComicReader } from './ComicReader';
import { useAppDispatch } from '../store/hooks';
import { hydrate } from '../store/dataSlice';
import { setComicReaderSeries, setHydrated } from '../store/uiSlice';

export function ComicReaderPage() {
  const dispatch = useAppDispatch();
  const seriesId = new URLSearchParams(window.location.search).get('series') ?? null;

  useEffect(() => {
    window.__comicReaderMode = true;
    return () => {
      window.__comicReaderMode = false;
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    void window.electronAPI.loadData().then((data) => {
      dispatch(hydrate(data));
      dispatch(setHydrated(true));
      if (!seriesId || !data.series.some((s) => s.id === seriesId)) {
        window.close();
        return;
      }
      dispatch(setComicReaderSeries(seriesId));
    });
  }, [dispatch, seriesId]);

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onComicReaderNavigate((id) => dispatch(setComicReaderSeries(id)));
  }, [dispatch]);

  return <ComicReader />;
}