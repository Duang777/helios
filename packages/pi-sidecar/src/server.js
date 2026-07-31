import http from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAIStep } from './aiStep.js';
import { compileDraft, extractYAML } from './compile.js';
import { detectConfiguredProviderEnv, parseModelSpec } from './piSession.js';

function readJSON(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    const limit = 2 * 1024 * 1024;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(raw);
}

function healthPayload() {
  const mode = process.env.HELIOS_PI_MODE || 'mock';
  const auth = detectConfiguredProviderEnv();
  const modelSpec = process.env.HELIOS_PI_MODEL || '';
  const parsed = parseModelSpec(modelSpec);
  return {
    status: 'ok',
    service: 'helios-pi-sidecar',
    mode,
    authConfigured:
      mode === 'mock'
        ? true
        : auth.length > 0 || Boolean(process.env.HELIOS_PI_API_KEY || process.env.CFMAX_API_KEY),
    provider: parsed.provider || undefined,
    model: modelSpec || undefined,
  };
}

/**
 * @param {{ mode?: string }} [opts]
 */
export function createServer(opts = {}) {
  if (opts.mode) {
    process.env.HELIOS_PI_MODE = opts.mode;
  }

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        send(res, 204, {});
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
        send(res, 200, healthPayload());
        return;
      }

      if (req.method === 'POST' && url.pathname === '/compile') {
        const body = await readJSON(req);
        if (!body.intent || typeof body.intent !== 'string') {
          send(res, 422, { error: { code: 'VALIDATION_FAILED', message: 'intent is required' } });
          return;
        }
        try {
          const draft = await compileDraft(body);
          const yaml = extractYAML(draft.yaml) || draft.yaml;
          send(res, 200, { ...draft, yaml });
        } catch (err) {
          const msg = err.message || String(err);
          const upstream = /Pi |unreachable|403|blocked|api key/i.test(msg);
          send(res, upstream ? 502 : 500, { error: { code: 'COMPILE_FAILED', message: msg } });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/ai-step') {
        const body = await readJSON(req);
        try {
          const out = await runAIStep(body);
          send(res, 200, out);
        } catch (err) {
          const msg = err.message || String(err);
          const validation = /required|prompt|parse JSON|missing required/i.test(msg);
          const upstream = /Pi |unreachable|403|blocked|api key|No Pi models/i.test(msg);
          send(res, validation ? 422 : upstream ? 502 : 500, {
            error: { code: 'AI_STEP_FAILED', message: msg },
          });
        }
        return;
      }

      send(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
    } catch (err) {
      send(res, err.status || 500, {
        error: { code: 'REQUEST_FAILED', message: err.message || String(err) },
      });
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.HELIOS_PI_PORT || process.env.PORT || 8091);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(
      `Helios pi-sidecar listening on http://127.0.0.1:${port} (mode=${process.env.HELIOS_PI_MODE || 'mock'})`,
    );
  });
}
