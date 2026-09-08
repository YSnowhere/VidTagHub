/** 主区域容器：媒体网格 / 标签浏览两个视图的切换 */

import { useAppSelector } from '../../store/hooks';
import { TagBrowser } from '../TagBrowser';
import { MediaGrid } from './MediaGrid';

export function MainArea() {
  const view = useAppSelector((s) => s.ui.view);

  if (view === 'tags') {
    return <TagBrowser />;
  }
  return <MediaGrid />;
}
