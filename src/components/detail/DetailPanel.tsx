/** 右侧详情面板容器：根据当前选中项渲染媒体详情或系列详情 */

import { Text } from '@fluentui/react-components';
import { useAppSelector } from '../../store/hooks';
import { MediaDetail } from './MediaDetail';
import { SeriesDetail } from './SeriesDetail';
import { useDetailStyles } from './styles';

export function DetailPanel() {
  const selectedMediaId = useAppSelector((s) => s.ui.selectedMediaId);
  const selectedSeriesId = useAppSelector((s) => s.ui.selectedSeriesId);
  const item = useAppSelector((s) => s.data.media.find((m) => m.id === selectedMediaId));
  const series = useAppSelector((s) => s.data.series.find((x) => x.id === selectedSeriesId));
  const styles = useDetailStyles();

  if (!item && !series) {
    return (
      <div className={styles.empty}>
        <Text size={300}>选择媒体以查看详情</Text>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {item ? (
        <MediaDetail item={item} />
      ) : (
        <SeriesDetail series={series!} />
      )}
    </div>
  );
}
