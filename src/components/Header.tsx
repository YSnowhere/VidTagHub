import {
  Button,
  Checkbox,
  Divider,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowUpload20Regular,
  Dismiss20Regular,
  Options20Regular,
  Search20Regular,
  Settings20Regular,
  Tag20Regular,
} from '@fluentui/react-icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setSearch,
  setLibraryDialogOpen,
  setSettingsOpen,
  setSearchField,
  setSearchMode,
  setSearchSubEpisodes,
  setSelectedLibrary,
  setView,
} from '../store/uiSlice';
import { addMediaFromScan } from '../store/dataSlice';
import { store } from '../store';
import { useState } from 'react';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    background: tokens.colorNeutralBackground1,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    flex: 1,
    minWidth: 0,
  },
  search: {
    width: '380px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  searchOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
  },
});

export function Header() {
  const dispatch = useAppDispatch();
  const search = useAppSelector((s) => s.ui.search);
  const searchFields = useAppSelector((s) => s.ui.searchFields);
  const searchMode = useAppSelector((s) => s.ui.searchMode);
  const searchSubEpisodes = useAppSelector((s) => s.ui.searchSubEpisodes);
  const selectedLibraryId = useAppSelector((s) => s.ui.selectedLibraryId);
  const libraryName = useAppSelector(
    (s) => s.data.libraries.find((l) => l.id === selectedLibraryId)?.name ?? '全部'
  );
  const [importing, setImporting] = useState(false);

  const styles = useStyles();

  const handleImport = async () => {
    const state = store.getState();
    const libId = selectedLibraryId ?? state.data.libraries[0]?.id;
    const lib = state.data.libraries.find((l) => l.id === libId);
    if (!lib) {
      dispatch(setLibraryDialogOpen(true));
      return;
    }
    const files = await window.electronAPI.pickFiles();
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      await window.electronAPI.ensureFolder(lib.path);
      await window.electronAPI.importFiles(files, lib.path);
      const scan = await window.electronAPI.scanLibrary(lib.path);
      dispatch(addMediaFromScan({ libraryId: lib.id, files: scan }));
      if (selectedLibraryId !== lib.id) dispatch(setSelectedLibrary(lib.id));
      dispatch(setView('media'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.left}>
        <Text size={500} weight="semibold">
          VidTagHub
        </Text>
        <Input
          className={styles.search}
          contentBefore={<Search20Regular />}
          placeholder={`在「${libraryName}」中搜索…`}
          value={search}
          onChange={(_, data) => dispatch(setSearch(data.value))}
        />
        {search && (
          <Tooltip content="清除搜索" relationship="label">
            <Button
              icon={<Dismiss20Regular />}
              size="small"
              appearance="subtle"
              onClick={() => dispatch(setSearch(''))}
            />
          </Tooltip>
        )}
        <Popover>
          <PopoverTrigger disableButtonEnhancement>
            <Button icon={<Options20Regular />} size="small" title="搜索方式" />
          </PopoverTrigger>
          <PopoverSurface>
            <div className={styles.searchOptions}>
              <Text weight="semibold" size={300}>
                搜索方式
              </Text>
              <Checkbox
                label="按文件名"
                checked={searchFields.name}
                onChange={(_, data) => dispatch(setSearchField({ field: 'name', value: !!data.checked }))}
              />
              <Checkbox
                label="按标签"
                checked={searchFields.tags}
                onChange={(_, data) => dispatch(setSearchField({ field: 'tags', value: !!data.checked }))}
              />
              <Checkbox
                label="按简介"
                checked={searchFields.description}
                onChange={(_, data) =>
                  dispatch(setSearchField({ field: 'description', value: !!data.checked }))
                }
              />
              <Checkbox
                label="搜索细分剧集（直接搜索源文件）"
                checked={searchSubEpisodes}
                onChange={(_, data) => dispatch(setSearchSubEpisodes(!!data.checked))}
              />
              <Divider />
              <Text weight="semibold" size={300}>
                多词匹配方式
              </Text>
              <RadioGroup
                value={searchMode}
                onChange={(_, data) => dispatch(setSearchMode(data.value as 'and' | 'or'))}
              >
                <Radio value="and" label="取交集（需同时满足所有关键词）" />
                <Radio value="or" label="取并集（满足任一关键词即可）" />
              </RadioGroup>
              <Divider />
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                搜索词用空格分隔，可同时搜索多个关键词
              </Text>
            </div>
          </PopoverSurface>
        </Popover>
      </div>
      <div className={styles.right}>
        <Button
          icon={<ArrowUpload20Regular />}
          appearance="primary"
          disabled={importing}
          onClick={() => void handleImport()}
        >
          {importing ? '正在导入…' : '添加文件'}
        </Button>
        <Button icon={<Tag20Regular />} onClick={() => void window.electronAPI.openTagManager()}>
          标签管理
        </Button>
        <Button icon={<Settings20Regular />} onClick={() => dispatch(setSettingsOpen(true))}>
          设置
        </Button>
      </div>
    </div>
  );
}