/** 系列成员列表：子系列与直属媒体的列表项、移除按钮、添加媒体入口 */

import { Button, Text, tokens } from '@fluentui/react-components';
import {
  Add20Regular,
  Collections20Regular,
  Dismiss20Regular,
  Document20Regular,
  VideoClip20Regular,
} from '@fluentui/react-icons';
import { useAppDispatch } from '../../store/hooks';
import { removeSeriesMember, removeSubSeries } from '../../store/dataSlice';
import { setSelectedMedia, setSelectedSeries, setSeriesView, setView } from '../../store/uiSlice';
import { displayName, previewUrl } from '../../services/format';
import { moveMediaOutOfSeries, moveSubSeriesOut } from '../../services/seriesMove';
import { useDetailStyles } from './styles';
import type { MediaItem, Series } from '../../types';

export interface SeriesMemberListProps {
  series: Series;
  members: MediaItem[];
  subSeries: Series[];
  /** 点击「添加媒体」时切换选择模式 */
  onAddMedia: () => void;
}

export function SeriesMemberList({ series, members, subSeries, onAddMedia }: SeriesMemberListProps) {
  const dispatch = useAppDispatch();
  const styles = useDetailStyles();

  return (
    <>
      <Text size={200}>
        {members.length} 个媒体{subSeries.length > 0 ? ` · ${subSeries.length} 个子系列` : ''}
      </Text>
      <div className={styles.memberList}>
        {subSeries.map((sub) => (
          <div
            key={sub.id}
            className={styles.memberRow}
            onClick={() => {
              dispatch(setSelectedSeries(sub.id));
              dispatch(setSeriesView(sub.id));
              dispatch(setView('media'));
            }}
          >
            {sub.coverPath ? (
              <img className={styles.memberThumb} src={previewUrl(sub.coverPath)} alt="" draggable={false} loading="lazy" decoding="async" />
            ) : (
              <div className={styles.memberThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Collections20Regular />
              </div>
            )}
            <Text className={styles.memberName} size={200} title={sub.title}>
              {sub.title}
            </Text>
            <Button
              icon={<Dismiss20Regular />}
              size="small"
              appearance="subtle"
              title="从系列移除"
              onClick={(e) => {
                e.stopPropagation();
                if (series.folderPath) void moveSubSeriesOut(series.folderPath, sub, dispatch);
                dispatch(removeSubSeries({ id: series.id, seriesId: sub.id }));
              }}
            />
          </div>
        ))}
        {members.map((m) => {
          const thumb = m.coverPath
            ? previewUrl(m.coverPath)
            : m.type === 'image'
            ? previewUrl(m.filePath)
            : '';
          return (
            <div
              key={m.id}
              className={styles.memberRow}
              onClick={() => dispatch(setSelectedMedia(m.id))}
            >
              {thumb ? (
                <img className={styles.memberThumb} src={thumb} alt="" draggable={false} loading="lazy" decoding="async" />
              ) : (
                <div className={styles.memberThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.type === 'pdf' ? <Document20Regular /> : <VideoClip20Regular />}
                </div>
              )}
              <Text className={styles.memberName} size={200} title={m.fileName}>
                {displayName(m.fileName)}
              </Text>
              <Button
                icon={<Dismiss20Regular />}
                size="small"
                appearance="subtle"
                title="从系列移除"
                onClick={(e) => {
                  e.stopPropagation();
                  if (series.folderPath) void moveMediaOutOfSeries(series.folderPath, [m.id], dispatch);
                  dispatch(removeSeriesMember({ id: series.id, memberId: m.id }));
                }}
              />
            </div>
          );
        })}
      </div>
      <Button
        icon={<Add20Regular />}
        size="small"
        style={{ marginTop: tokens.spacingVerticalS }}
        onClick={onAddMedia}
      >
        添加媒体
      </Button>
    </>
  );
}
