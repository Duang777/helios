import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOperator } from './operator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '..', 'fixture', 'confirm.html');

function readJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const isHTML = typeof body === 'string' && (body.startsWith('<!') || body.startsWith('<'));
  res.writeHead(status, {
    'content-type': isHTML ? 'text/html; charset=utf-8' : 'application/json',
  });
  res.end(raw);
}

export function createServer(opts = {}) {
  const mode = opts.mode || process.env.HELIOS_GUI_MODE || 'playwright';
  const op = createOperator(mode);
  const port = Number(opts.port || process.env.HELIOS_GUI_PORT || 8792);
  const baseURL = (opts.baseURL || `http://127.0.0.1:${port}`).replace(/\/$/, '');

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        return send(res, 200, { status: 'ok', service: 'helios-gui-operator', mode: op.mode });
      }
      if (req.method === 'GET' && url.pathname === '/fixture/confirm.html') {
        return send(res, 200, readFileSync(FIXTURE, 'utf8'));
      }

      const viewerMatch = url.pathname.match(/^\/v1\/human_help\/([^/]+)\/viewer$/);
      if (req.method === 'GET' && viewerMatch) {
        const helpId = viewerMatch[1];
        const entry = op.getHelp(helpId);
        return send(res, 200, op.viewerHTML(helpId, entry.reason));
      }
      const shotMatch = url.pathname.match(/^\/v1\/human_help\/([^/]+)\/shot$/);
      if (req.method === 'GET' && shotMatch) {
        const out = await op.helpScreenshot(shotMatch[1]);
        return send(res, 200, out);
      }

      if (req.method !== 'POST') {
        return send(res, 404, { error: 'not found' });
      }

      const body = await readJSON(req);

      if (url.pathname === '/v1/actions/screenshot_and_confirm') {
        const out = await op.screenshotAndConfirm(body);
        return send(res, 200, out);
      }
      if (url.pathname === '/v1/open') {
        return send(res, 200, await op.open(body.url));
      }
      if (url.pathname === '/v1/click') {
        return send(res, 200, await op.click(body.sessionId, body.selector));
      }
      if (url.pathname === '/v1/type') {
        return send(res, 200, await op.type(body.sessionId, body.selector, body.text));
      }
      if (url.pathname === '/v1/extract') {
        return send(res, 200, await op.extract(body.sessionId, body.selector));
      }
      if (url.pathname === '/v1/screenshot') {
        return send(res, 200, await op.screenshot(body.sessionId));
      }
      if (url.pathname === '/v1/human_help/start') {
        const out = await op.startHumanHelp(body);
        const host = req.headers.host || new URL(baseURL).host;
        out.viewerUrl = `http://${host}${out.viewerPath}`;
        return send(res, 200, out);
      }
      if (url.pathname === '/v1/human_help') {
        const out = await op.humanHelp(body);
        return send(res, 200, out);
      }
      if (url.pathname === '/v1/human_help/resolve') {
        return send(res, 200, await op.resolveHumanHelp(body));
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      const status = e.status || 500;
      send(res, status, { error: e.message || String(e) });
    }
  });

  return { server, op, baseURL, port };
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.HELIOS_GUI_PORT || 8792);
  const { server, op, baseURL } = createServer({ port });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[helios-gui-operator] mode=${op.mode} ${baseURL}`);
  });
}
