/** 主区域样式：工具栏、网格、空状态 */

import { makeStyles, tokens } from '@fluentui/react-components';

export const useMainAreaStyles = makeStyles({
  root: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
    scrollbarGutter: 'stable',
    background: tokens.colorNeutralBackground2,
  },
  bar: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    flexWrap: 'wrap',
    background: tokens.colorNeutralBackground1,
    boxShadow: `0 1px 0 ${tokens.colorNeutralStroke2}`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingHorizontalL} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalXXL}`,
  },
  empty: {
    margin: 'auto',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalXXL,
  },
});
