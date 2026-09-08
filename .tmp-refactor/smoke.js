/* 重构冒烟测试：驱动真实 Electron 应用，覆盖主进程各 IPC 模块与漫画阅读器渲染。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const APP = path.join(ROOT, '..');
const electronExe = require(path.join(APP, 'node_modules', 'electron'));
const PORT = 9224;

const LIB = path.join(ROOT, 'real-lib');
const SERIES_DIR = path.join(LIB, '压缩文件', '01');
const SERIES_ID = 'DpTc3-X2ZBgMoyRlaoY8C';
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  try {
    return await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  } catch {
    return [];
  }
}

async function waitForTarget(pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = (await targets()).find(pred);
    if (hit) return hit;
    await sleep(250);
  }
  throw new Error('timeout waiting for target: ' + label);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      }
    });
  }
  send(method, params) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { evalError: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result?.value;
  }
}

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ws timeout')), 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ws error')); }, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  return cdp;
}

const READER_DIAG = `(() => {
  const imgs = [...document.querySelectorAll('img')];
  const scroller = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).overflow === 'auto');
  const r = scroller.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    pageText: (document.body.innerText.match(/第 \\d+ \\/ \\d+ 页/) || [''])[0],
    imgCount: imgs.length,
    loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    topElement: top ? top.tagName : null,
    scrollTop: Math.round(scroller.scrollTop),
  };
})()`;

(async () => {
  const out = { checks: {}, errors: [] };
  fs.writeFileSync(path.join(LIB, 'smoke-file.txt'), 'rename me', 'utf-8');
  fs.writeFileSync(path.join(ROOT, 'smoke-import.txt'), 'import me', 'utf-8');
  fs.copyFileSync(path.join(SERIES_DIR, '00001.webp'), path.join(ROOT, 'smoke-import.webp'));

  const child = spawn(electronExe, ['.', `--user-data-dir=${path.join(ROOT, 'ud')}`, `--remote-debugging-port=${PORT}`], {
    cwd: APP,
    stdio: 'ignore',
  });

  try {
    const main = await waitForTarget((t) => t.type === 'page' && !t.url.includes('page='), 30000, 'main');
    const mainCdp = await connect(main);
    await sleep(2500);
    out.checks.mainBody = await mainCdp.eval('document.body.innerText.replace(/\\s+/g," ").slice(0,120)');

    // 主进程各 IPC 模块
    out.checks.ipc = await mainCdp.eval(`(async () => {
      const api = window.electronAPI;
      const o = {};
      const data = await api.loadData();
      o.loadData = { libraries: data.libraries.length, series: data.series.length, media: data.media.length, tags: data.tags.length };
      const scan = await api.scanLibrary(${JSON.stringify(LIB)});
      o.scanLibrary = { media: scan.media.length, folders: scan.folders.length, sub: scan.folders[0] ? scan.folders[0].subFolders.length : 0 };
      const files = await api.listSeriesFolder(${JSON.stringify(SERIES_DIR)});
      o.listSeriesFolder = { count: files.length, first: files[0] ? files[0].fileName : null, type: files[0] ? files[0].type : null };
      const adopt = await api.adoptLibrary(${JSON.stringify(LIB)});
      o.adoptLibrary = adopt ? { id: adopt.libraryId, series: adopt.series.length, media: adopt.media.length } : null;

      const created = await api.createSeriesFolder(${JSON.stringify(LIB)}, '冒烟系列', [${JSON.stringify(path.join(ROOT, 'smoke-import.webp'))}]);
      o.createSeriesFolder = created.ok ? { title: created.title, moved: (created.moved || []).length } : created.error;
      const marked = await api.markSeriesFolder(created.folderPath, 'smoke-id');
      o.markSeriesFolder = marked.ok;
      const renamed = await api.renameSeriesFolder(created.folderPath, '冒烟系列改名');
      o.renameSeriesFolder = renamed.ok ? renamed.title : renamed.error;
      const folderNow = renamed.folderPath;
      const listedAfter = await api.listSeriesFolder(folderNow);
      o.listAfterImport = listedAfter.length;
      const movedOut = await api.moveSeriesMembersOut(folderNow, [listedAfter[0].filePath]);
      o.moveSeriesMembersOut = (movedOut.moved || []).length;
      const movedBack = await api.moveSeriesMembers(folderNow, [movedOut.moved[0].to]);
      o.moveSeriesMembers = (movedBack.moved || []).length;
      const moveInto = await api.moveSeriesFolderInto(folderNow, ${JSON.stringify(SERIES_DIR)});
      o.moveSeriesFolderInto = moveInto.ok ? { ok: true, title: moveInto.title } : moveInto;
      const moveOut = await api.moveSeriesFolderOut(moveInto.newFolderPath || folderNow, ${JSON.stringify(SERIES_DIR)});
      o.moveSeriesFolderOut = moveOut.ok;
      const dissolve = await api.dissolveSeriesFolder(moveOut.newFolderPath || folderNow);
      o.dissolveSeriesFolder = dissolve.ok ? { moved: (dissolve.moved || []).length } : dissolve.error;
      const del = await api.deleteSeriesFolder(moveOut.newFolderPath || folderNow);
      o.deleteSeriesFolder = del.ok;
      const ensure = await api.ensureFolder(${JSON.stringify(path.join(LIB, '.smoke-tmp'))});
      o.ensureFolder = ensure.ok;

      const ren = await api.renameFile(${JSON.stringify(path.join(LIB, 'smoke-file.txt'))}, 'smoke-file-renamed.txt');
      o.renameFile = ren.ok ? ren.newPath.split('\\\\').pop() : ren.error;
      const delFile = await api.deleteFile(ren.newPath);
      o.deleteFile = delFile.ok;
      const imp = await api.importFiles([${JSON.stringify(path.join(ROOT, 'smoke-import-2.txt'))}], ${JSON.stringify(LIB)});
      o.importFiles = imp.length;
      const frame = await api.saveFrame(${JSON.stringify(PNG_1PX)}, ${JSON.stringify(ROOT)}, 'smoke-frame');
      o.saveFrame = frame.ok;
      const crop = await api.saveCrop(${JSON.stringify(PNG_1PX)});
      o.saveCrop = crop.ok;
      const cache = await api.clearCache();
      o.clearCache = cache.ok;
      const saved = await api.saveData(data);
      o.saveData = saved.ok;
      const again = await api.loadData();
      o.roundTrip = { series: again.series.length, media: again.media.length, libraries: again.libraries.length };
      const tagsSaved = await api.saveTags(data.categories, data.tags);
      o.saveTags = tagsSaved.ok;

      const migrated = await api.migrateData(${JSON.stringify(path.join(ROOT, 'migrated-data'))});
      o.migrateData = migrated.ok ? { ok: true } : migrated;
      const after = await api.loadData();
      o.afterMigrate = { libraries: after.libraries.length, series: after.series.length };
      return o;
    })()`);

    // 漫画阅读窗口（渲染 + 层级 + 滚动）
    await mainCdp.eval(`window.electronAPI.openComicReader(${JSON.stringify(SERIES_ID)})`);
    const reader = await waitForTarget((t) => t.type === 'page' && t.url.includes('page=comicreader'), 20000, 'reader');
    const readerCdp = await connect(reader);
    await sleep(6000);
    out.checks.reader = await readerCdp.eval(READER_DIAG);
    await readerCdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 500, y: 400, deltaX: 0, deltaY: 900, pointerType: 'mouse' });
    await sleep(1200);
    out.checks.readerAfterWheel = await readerCdp.eval(READER_DIAG);
    out.errors.push(...readerCdp.errors.slice(0, 5));

    // 标签管理窗口
    await mainCdp.eval('window.electronAPI.openTagManager()');
    const tagWin = await waitForTarget((t) => t.type === 'page' && t.url.includes('page=tagmanager'), 20000, 'tagmanager');
    const tagCdp = await connect(tagWin);
    await sleep(2500);
    out.checks.tagManagerBody = await tagCdp.eval('document.body.innerText.replace(/\\s+/g," ").slice(0,120)');
    out.errors.push(...tagCdp.errors.slice(0, 5));
    out.errors.push(...mainCdp.errors.slice(0, 5));
  } catch (err) {
    out.fatal = String(err && err.stack ? err.stack : err);
  } finally {
    console.log(JSON.stringify(out, null, 2));
    child.kill();
    await sleep(500);
    process.exit(0);
  }
})();
