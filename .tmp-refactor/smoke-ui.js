/* 渲染层冒烟测试：通过真实点击驱动重构后的详情面板 / 主区域网格 / 标签管理页。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const APP = path.join(ROOT, '..');
const electronExe = require(path.join(APP, 'node_modules', 'electron'));
const PORT = 9225;
const SRC_LIB = 'D:\\视图文件\\漫画';
const LIB = path.join(ROOT, 'ui-lib');
const DATA = path.join(ROOT, 'ui-data');
const UD = path.join(ROOT, 'ui-ud');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resetFixture() {
  for (const p of [LIB, DATA, UD]) if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  fs.mkdirSync(UD, { recursive: true });
  fs.cpSync(SRC_LIB, LIB, { recursive: true });
  const enc = 'utf8';
  fs.writeFileSync(
    path.join(DATA, 'vision-libraries.json'),
    JSON.stringify({ libraries: [{ id: 'fap1WmPES1ty-97Zz61-z', name: '漫画', path: LIB, nsfw: false, collapsed: false }] }),
    enc
  );
  fs.writeFileSync(path.join(UD, 'data-location.json'), JSON.stringify({ dir: DATA }), enc);
}

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
  throw new Error('timeout waiting for ' + label);
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

const HELPERS = `
  window.__q = (text, tag) => [...document.querySelectorAll(tag || 'div,span,button,p')]
    .filter((el) => el.textContent.trim() === text);
  window.__click = (text, tag) => {
    const els = window.__q(text, tag);
    const el = els[els.length - 1];
    if (!el) return 'not found: ' + text;
    const target = el.closest('button') || el;
    target.click();
    return 'clicked: ' + text;
  };
  window.__setInput = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  window.__body = () => document.body.innerText.replace(/\\s+/g, ' ').slice(0, 400);
  window.__has = (text) => document.body.innerText.includes(text);
`;

(async () => {
  const out = { steps: [], errors: [] };
  resetFixture();
  const child = spawn(electronExe, ['.', `--user-data-dir=${UD}`, `--remote-debugging-port=${PORT}`], {
    cwd: APP,
    stdio: 'ignore',
  });
  try {
    const main = await waitForTarget((t) => t.type === 'page' && !t.url.includes('page='), 30000, 'main');
    const cdp = await connect(main);
    await cdp.eval(HELPERS);
    await sleep(2500);

    // 1) 点击系列卡片 → 右侧出现系列详情
    out.steps.push(await cdp.eval(`window.__click('压缩文件')`));
    await sleep(800);
    out.seriesDetail = await cdp.eval(`({ hasSeriesDetail: window.__has('系列详情'), hasComicButton: window.__has('漫画阅读') })`);

    // 2) 展开系列 → 网格出现子系列卡片
    out.steps.push(await cdp.eval(`window.__click('展开', 'button')`));
    await sleep(1200);
    out.grid = await cdp.eval(`({ body: window.__body().slice(0, 160), has01: window.__has('01'), has02: window.__has('02') })`);

    // 3) 进入 01 系列 → 切换为图片模式 → 出现媒体卡片
    out.steps.push(await cdp.eval(`window.__click('01')`));
    await sleep(900);
    out.leafDetail = await cdp.eval(`({ hasSeriesDetail: window.__has('系列详情'), hasComicButton: window.__has('漫画阅读') })`);
    out.steps.push(await cdp.eval(`window.__click('切换为图片模式', 'button')`));
    await sleep(2000);
    out.imageMode = await cdp.eval(`({ hasImageMode: window.__has('图片模式'), cardCount: document.querySelectorAll('img').length })`);

    // 4) 点开一个媒体 → 媒体详情
    out.steps.push(await cdp.eval(`(() => { const imgs = [...document.querySelectorAll('img')]; const card = imgs[0] ? imgs[0].closest('div[class]') : null; if (!card) return 'no card'; card.click(); return 'clicked media card'; })()`));
    await sleep(900);
    out.mediaDetail = await cdp.eval(`({ hasDetail: window.__has('详情'), hasDelete: window.__has('彻底删除'), hasName: window.__has('名称') })`);

    // 5) 多选模式 → 工具栏按钮
    out.steps.push(await cdp.eval(`window.__click('多选', 'button')`));
    await sleep(600);
    out.steps.push(await cdp.eval(`window.__click('全选', 'button')`));
    await sleep(600);
    out.selection = await cdp.eval(`({ hasMerge: window.__has('合并为系列'), hasTag: window.__has('加标签'), hasRemove: window.__has('从系列移除'), hasExit: window.__has('退出多选') })`);

    // 6) 标签管理窗口：新增分类 + 标签 + 删除分类
    await cdp.eval('window.electronAPI.openTagManager()');
    const tagWin = await waitForTarget((t) => t.type === 'page' && t.url.includes('page=tagmanager'), 20000, 'tagmanager');
    const tagCdp = await connect(tagWin);
    await tagCdp.eval(HELPERS);
    await sleep(2000);
    out.tagManager = {};
    out.tagManager.initial = await tagCdp.eval(`window.__body().slice(0, 80)`);
    out.steps.push(await tagCdp.eval(`(() => { const inputs = [...document.querySelectorAll('input')]; const cat = inputs.find((i) => i.placeholder === '分类名称'); if (!cat) return 'no category input'; window.__setInput(cat, '冒烟分类'); return 'typed category'; })()`));
    await sleep(400);
    out.steps.push(await tagCdp.eval(`(() => { const row = [...document.querySelectorAll('div')].find((d) => d.textContent.includes('新增分类')); const btn = row ? row.querySelector('button') : null; if (!btn) return 'no add button'; btn.click(); return 'clicked add category'; })()`));
    await sleep(900);
    out.tagManager.afterCategory = await tagCdp.eval(`({ hasCategory: window.__has('冒烟分类') })`);
    out.steps.push(await tagCdp.eval(`window.__click('冒烟分类')`));
    await sleep(800);
    out.steps.push(await tagCdp.eval(`(() => { const inputs = [...document.querySelectorAll('input')]; const t = inputs.find((i) => (i.placeholder || '').includes('添加标签')); if (!t) return 'no tag input'; window.__setInput(t, '冒烟标签'); return 'typed tag'; })()`));
    await sleep(400);
    out.steps.push(await tagCdp.eval(`window.__click('添加', 'button')`));
    await sleep(900);
    out.tagManager.afterTag = await tagCdp.eval(`({ hasTag: window.__has('冒烟标签'), body: window.__body().slice(0, 160) })`);
    // 删除分类（走确认对话框）
    out.steps.push(await tagCdp.eval(`(() => { const row = [...document.querySelectorAll('div')].find((d) => d.className.includes('treeItem') && d.textContent.includes('冒烟分类')); const btn = row ? row.querySelector('button') : null; if (!btn) return 'no delete button'; btn.click(); return 'clicked delete category'; })()`));
    await sleep(900);
    out.tagManager.confirmDialog = await tagCdp.eval(`({ hasDialog: window.__has('删除分类'), hasWarn: window.__has('一并删除') })`);
    out.steps.push(await tagCdp.eval(`window.__click('确认删除', 'button')`));
    await sleep(900);
    out.tagManager.afterDelete = await tagCdp.eval(`({ stillHasCategory: window.__has('冒烟分类') })`);

    out.errors.push(...cdp.errors.slice(0, 8), ...tagCdp.errors.slice(0, 8));
  } catch (err) {
    out.fatal = String(err && err.stack ? err.stack : err);
  } finally {
    fs.writeFileSync(path.join(ROOT, 'ui-result.json'), JSON.stringify(out, null, 2), 'utf-8');
    console.log(JSON.stringify(out, null, 2));
    child.kill();
    await sleep(500);
    process.exitCode = 0;
  }
})();
