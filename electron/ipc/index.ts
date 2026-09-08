/** IPC 注册入口：按领域拆分的各个注册函数在此汇总，main.ts 只需调用一次 */

import { registerAppIpc } from './appIpc';
import { registerFileIpc } from './fileIpc';
import { registerLibraryIpc } from './libraryIpc';
import { registerSeriesIpc } from './seriesIpc';

export function registerIpc(): void {
  registerAppIpc();
  registerLibraryIpc();
  registerSeriesIpc();
  registerFileIpc();
}
