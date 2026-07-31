import { randomUUID } from 'node:crypto';
import { FAKE_PNG } from './png.js';

/**
 * @typedef {{ id: string, url: string, page?: import('playwright').Page, browser?: import('playwright').Browser }} Session
 * @typedef {{ resolve: ((v: any) => void) | null, settled: any, reason: string, sessionId?: string, startShot?: string }} HelpEntry
 */

export function createOperator(mode = 'fake') {
  /** @type {Map<string, Session>} */
  const sessions = new Map();
  /** @type {Map<string, HelpEntry>} */
  const helpPending = new Map();

  async function open(url) {
    if (!url || typeof url !== 'string') {
      throw Object.assign(new Error('url is required'), { status: 400 });
    }
    const id = randomUUID();
    if (mode === 'playwright') {
      let chromium;
      try {
        ({ chromium } = await import('playwright'));
      } catch {
        throw Object.assign(new Error('playwright not installed; use HELIOS_GUI_MODE=fake or npm i playwright'), {
          status: 500,
        });
      }
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      sessions.set(id, { id, url, page, browser });
    } else {
      sessions.set(id, { id, url });
    }
    return { sessionId: id };
  }

  function get(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) throw Object.assign(new Error('unknown sessionId'), { status: 404 });
    return s;
  }

  async function click(sessionId, selector) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      await s.page.click(selector, { timeout: 10000 });
    }
    return { ok: true };
  }

  async function fill(sessionId, selector, text) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      await s.page.fill(selector, String(text ?? ''), { timeout: 10000 });
    }
    return { ok: true };
  }

  /** Alias of fill — playwright-cli uses both `type` and `fill`. */
  async function type(sessionId, selector, text) {
    return fill(sessionId, selector, text);
  }

  async function goto(sessionId, url) {
    const s = get(sessionId);
    if (!url || typeof url !== 'string') {
      throw Object.assign(new Error('url is required'), { status: 400 });
    }
    if (mode === 'playwright' && s.page) {
      await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    s.url = url;
    return { ok: true };
  }

  async function press(sessionId, key, selector) {
    const s = get(sessionId);
    if (!key) throw Object.assign(new Error('key is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      if (selector) {
        await s.page.locator(selector).press(String(key), { timeout: 10000 });
      } else {
        await s.page.keyboard.press(String(key));
      }
    }
    return { ok: true };
  }

  async function hover(sessionId, selector) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      await s.page.hover(selector, { timeout: 10000 });
    }
    return { ok: true };
  }

  async function select(sessionId, selector, value) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      await s.page.selectOption(selector, String(value ?? ''), { timeout: 10000 });
    }
    return { ok: true };
  }

  async function check(sessionId, selector) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      await s.page.check(selector, { timeout: 10000 });
    }
    return { ok: true };
  }

  async function uncheck(sessionId, selector) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      await s.page.uncheck(selector, { timeout: 10000 });
    }
    return { ok: true };
  }

  async function extract(sessionId, selector) {
    const s = get(sessionId);
    if (!selector) throw Object.assign(new Error('selector is required'), { status: 400 });
    if (mode === 'playwright' && s.page) {
      const text = await s.page.locator(selector).innerText({ timeout: 10000 });
      return { text };
    }
    return { text: `fake:${selector}` };
  }

  async function screenshot(sessionId) {
    const s = get(sessionId);
    let buf = FAKE_PNG;
    if (mode === 'playwright' && s.page) {
      buf = await s.page.screenshot({ type: 'png', fullPage: true });
    }
    return {
      screenshotBase64: Buffer.from(buf).toString('base64'),
      contentType: 'image/png',
    };
  }

  /**
   * Run a playwright-cli-shaped step list. Always closes the session afterwards.
   * @param {{ steps: Array<Record<string, any>> }} body
   */
  async function run({ steps } = {}) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw Object.assign(new Error('steps must be a non-empty array'), { status: 400 });
    }
    let sessionId = null;
    const results = [];
    let lastShot = null;
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] || {};
        const op = String(step.op || step.action || '').trim();
        if (!op) {
          throw Object.assign(new Error(`steps[${i}]: op is required`), { status: 400 });
        }
        switch (op) {
          case 'open': {
            const opened = await open(step.url);
            sessionId = opened.sessionId;
            results.push({ op, sessionId });
            break;
          }
          case 'goto': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: goto requires an open session`), { status: 400 });
            await goto(sessionId, step.url);
            results.push({ op, url: step.url });
            break;
          }
          case 'click': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: click requires an open session`), { status: 400 });
            await click(sessionId, step.selector);
            results.push({ op, selector: step.selector });
            break;
          }
          case 'fill':
          case 'type': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: fill requires an open session`), { status: 400 });
            const text = step.text ?? step.value ?? '';
            await fill(sessionId, step.selector, text);
            results.push({ op: 'fill', selector: step.selector });
            break;
          }
          case 'press': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: press requires an open session`), { status: 400 });
            await press(sessionId, step.key, step.selector);
            results.push({ op, key: step.key });
            break;
          }
          case 'hover': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: hover requires an open session`), { status: 400 });
            await hover(sessionId, step.selector);
            results.push({ op, selector: step.selector });
            break;
          }
          case 'select': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: select requires an open session`), { status: 400 });
            await select(sessionId, step.selector, step.value ?? step.text);
            results.push({ op, selector: step.selector });
            break;
          }
          case 'check': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: check requires an open session`), { status: 400 });
            await check(sessionId, step.selector);
            results.push({ op, selector: step.selector });
            break;
          }
          case 'uncheck': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: uncheck requires an open session`), { status: 400 });
            await uncheck(sessionId, step.selector);
            results.push({ op, selector: step.selector });
            break;
          }
          case 'extract': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: extract requires an open session`), { status: 400 });
            const out = await extract(sessionId, step.selector);
            results.push({ op, selector: step.selector, text: out.text });
            break;
          }
          case 'screenshot': {
            if (!sessionId) throw Object.assign(new Error(`steps[${i}]: screenshot requires an open session`), { status: 400 });
            lastShot = await screenshot(sessionId);
            results.push({ op });
            break;
          }
          case 'close': {
            if (sessionId) {
              await close(sessionId);
              sessionId = null;
            }
            results.push({ op });
            break;
          }
          default:
            throw Object.assign(
              new Error(
                `steps[${i}]: unsupported op ${JSON.stringify(op)} (open|goto|click|fill|type|press|hover|select|check|uncheck|extract|screenshot|close)`,
              ),
              { status: 400 },
            );
        }
      }
      if (!lastShot && sessionId) {
        lastShot = await screenshot(sessionId);
      }
      if (!lastShot) {
        lastShot = {
          screenshotBase64: Buffer.from(FAKE_PNG).toString('base64'),
          contentType: 'image/png',
        };
      }
      return {
        ok: true,
        mode,
        results,
        ...lastShot,
      };
    } finally {
      if (sessionId) {
        await close(sessionId).catch(() => {});
      }
    }
  }

  async function close(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return;
    sessions.delete(sessionId);
    if (s.browser) {
      await s.browser.close().catch(() => {});
    }
  }

  async function screenshotAndConfirm({ url, selector }) {
    const { sessionId } = await open(url);
    try {
      if (selector) {
        await click(sessionId, selector);
      }
      const shot = await screenshot(sessionId);
      return {
        ok: true,
        mode,
        sessionId,
        ...shot,
      };
    } finally {
      await close(sessionId);
    }
  }

  async function humanHelp({ reason, timeoutMs, helpId: existingId } = {}) {
    let id = existingId;
    if (!id) {
      id = randomUUID();
      helpPending.set(id, { resolve: null, settled: null, reason: reason || '' });
    }
    const entry = helpPending.get(id);
    if (!entry) {
      throw Object.assign(new Error('unknown helpId'), { status: 404 });
    }
    if (entry.settled) {
      return { ...entry.settled, helpId: id, mode, reason: reason || entry.reason || '' };
    }

    const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : 120000;
    const done = new Promise((resolve) => {
      entry.resolve = resolve;
    });
    const timer = setTimeout(() => {
      if (helpPending.has(id) && !entry.settled) {
        const timed = {
          ok: false,
          helpId: id,
          timedOut: true,
          reason: reason || entry.reason || 'human_help timed out',
        };
        entry.settled = timed;
        helpPending.delete(id);
        entry.resolve(timed);
      }
    }, timeout);

    const result = await done;
    clearTimeout(timer);
    return { ...result, helpId: id, mode, reason: reason || entry.reason || '' };
  }

  /**
   * Start a blocking human_help ticket. Optional url opens a Playwright/fake session for the viewer.
   */
  async function startHumanHelp({ reason, url, sessionId: existingSession } = {}) {
    const id = randomUUID();
    let sessionId = existingSession;
    if (url && typeof url === 'string' && url.trim()) {
      const opened = await open(url.trim());
      sessionId = opened.sessionId;
    } else if (!sessionId) {
      // Placeholder session so viewer can still show a fake/blank shot.
      sessionId = randomUUID();
      sessions.set(sessionId, { id: sessionId, url: 'about:blank' });
    }

    let startShot = '';
    try {
      const shot = await screenshot(sessionId);
      startShot = shot.screenshotBase64;
    } catch {
      startShot = Buffer.from(FAKE_PNG).toString('base64');
    }

    helpPending.set(id, {
      resolve: null,
      settled: null,
      reason: reason || '',
      sessionId,
      startShot,
    });

    const handoffMode = mode === 'playwright' ? 'playwright-handoff' : mode;
    return {
      helpId: id,
      status: 'waiting',
      reason: reason || '',
      mode: handoffMode,
      sessionId,
      viewerPath: `/v1/human_help/${id}/viewer`,
    };
  }

  function getHelp(helpId) {
    const entry = helpPending.get(helpId);
    if (!entry) throw Object.assign(new Error('unknown helpId'), { status: 404 });
    return entry;
  }

  async function helpScreenshot(helpId) {
    const entry = getHelp(helpId);
    if (!entry.sessionId) {
      return {
        screenshotBase64: entry.startShot || Buffer.from(FAKE_PNG).toString('base64'),
        contentType: 'image/png',
      };
    }
    try {
      return await screenshot(entry.sessionId);
    } catch {
      return {
        screenshotBase64: entry.startShot || Buffer.from(FAKE_PNG).toString('base64'),
        contentType: 'image/png',
      };
    }
  }

  async function resolveHumanHelp({ helpId, ok = true, note } = {}) {
    const entry = helpPending.get(helpId);
    if (!entry) {
      throw Object.assign(new Error('unknown helpId'), { status: 404 });
    }
    let endShot = '';
    if (entry.sessionId) {
      try {
        const shot = await screenshot(entry.sessionId);
        endShot = shot.screenshotBase64;
      } catch {
        /* ignore */
      }
      await close(entry.sessionId);
    }
    const payload = {
      ok: Boolean(ok),
      helpId,
      note: note || '',
      resolved: true,
      screenshotBase64: endShot || entry.startShot || '',
    };
    entry.settled = payload;
    helpPending.delete(helpId);
    if (typeof entry.resolve === 'function') {
      entry.resolve(payload);
    }
    return { ok: true, helpId };
  }

  function viewerHTML(helpId, reason) {
    const safeReason = String(reason || 'Human help required')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Helios human_help</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f4f4f1; color: #1a1a1a; }
    header { padding: 1rem 1.25rem; border-bottom: 1px solid #ddd; background: #fff; }
    h1 { font-size: 1.1rem; margin: 0 0 .35rem; }
    p { margin: 0; color: #555; font-size: .95rem; }
    main { padding: 1rem 1.25rem 5rem; }
    img { max-width: 100%; border: 1px solid #ccc; background: #fff; }
    .actions { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: .75rem;
      padding: .85rem 1.25rem; background: #fff; border-top: 1px solid #ddd; }
    button { font: inherit; padding: .55rem 1rem; border: 1px solid #222; background: #222; color: #fff; cursor: pointer; }
    button.secondary { background: #fff; color: #222; }
    .status { margin-top: .75rem; font-size: .85rem; color: #666; }
  </style>
</head>
<body>
  <header>
    <h1>Helios · 人工协助</h1>
    <p>${safeReason}</p>
  </header>
  <main>
    <img id="shot" alt="session screenshot"/>
    <p class="status" id="status">刷新截图中…</p>
  </main>
  <div class="actions">
    <button type="button" id="done">已处理</button>
    <button type="button" class="secondary" id="abort">放弃</button>
  </div>
  <script>
    const helpId = ${JSON.stringify(helpId)};
    const shot = document.getElementById('shot');
    const status = document.getElementById('status');
    async function refresh() {
      try {
        const r = await fetch('/v1/human_help/' + helpId + '/shot');
        if (!r.ok) throw new Error('shot ' + r.status);
        const j = await r.json();
        shot.src = 'data:image/png;base64,' + j.screenshotBase64;
        status.textContent = '更新于 ' + new Date().toLocaleTimeString();
      } catch (e) {
        status.textContent = '截图不可用: ' + e.message;
      }
    }
    async function resolve(ok) {
      status.textContent = ok ? '提交完成…' : '提交放弃…';
      const r = await fetch('/v1/human_help/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ helpId, ok, note: ok ? 'viewer done' : 'viewer abort' }),
      });
      if (!r.ok) {
        status.textContent = 'resolve failed: ' + r.status;
        return;
      }
      status.textContent = ok ? '已完成，可关闭此页' : '已放弃，可关闭此页';
      document.getElementById('done').disabled = true;
      document.getElementById('abort').disabled = true;
    }
    document.getElementById('done').onclick = () => resolve(true);
    document.getElementById('abort').onclick = () => resolve(false);
    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`;
  }

  return {
    mode,
    open,
    goto,
    click,
    fill,
    type,
    press,
    hover,
    select,
    check,
    uncheck,
    extract,
    screenshot,
    close,
    run,
    screenshotAndConfirm,
    humanHelp,
    startHumanHelp,
    resolveHumanHelp,
    getHelp,
    helpScreenshot,
    viewerHTML,
  };
}
