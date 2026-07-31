import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperator } from './operator.js';
import { FAKE_PNG } from './png.js';
import { createServer } from './server.js';

test('fake screenshot_and_confirm returns png base64', async () => {
  const op = createOperator('fake');
  const out = await op.screenshotAndConfirm({
    url: 'http://example.invalid/confirm',
    selector: 'button#confirm',
  });
  assert.equal(out.ok, true);
  assert.equal(out.mode, 'fake');
  assert.equal(out.contentType, 'image/png');
  assert.equal(Buffer.from(out.screenshotBase64, 'base64').compare(FAKE_PNG), 0);
});

test('http health and screenshot_and_confirm', async () => {
  const { server } = createServer({ mode: 'fake' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
    assert.equal(health.status, 'ok');
    assert.equal(health.mode, 'fake');

    const fixture = await fetch(`http://127.0.0.1:${port}/fixture/confirm.html`);
    assert.equal(fixture.status, 200);
    assert.match(await fixture.text(), /Confirm purchase order/);

    const res = await fetch(`http://127.0.0.1:${port}/v1/actions/screenshot_and_confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `http://127.0.0.1:${port}/fixture/confirm.html`, selector: 'button#confirm' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.screenshotBase64.length > 20);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('human_help start wait resolve', async () => {
  const op = createOperator('fake');
  const started = await op.startHumanHelp({ reason: 'login' });
  assert.ok(started.helpId);
  assert.equal(started.status, 'waiting');
  assert.ok(started.viewerPath.includes(started.helpId));
  assert.ok(started.sessionId);

  const waiter = op.humanHelp({ helpId: started.helpId, timeoutMs: 2000 });
  const resolved = await op.resolveHumanHelp({ helpId: started.helpId, ok: true, note: 'done' });
  assert.equal(resolved.ok, true);
  const out = await waiter;
  assert.equal(out.ok, true);
  assert.equal(out.note, 'done');
});

test('human_help viewer html and shot', async () => {
  const { server, baseURL } = createServer({ mode: 'fake', port: 0, baseURL: 'http://127.0.0.1:0' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const root = `http://127.0.0.1:${port}`;
  try {
    // recreate with correct baseURL by calling start via HTTP on this server —
    // start embeds baseURL from createServer opts; fix by using path only for GET
    const start = await fetch(`${root}/v1/human_help/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'finish login', url: `${root}/fixture/confirm.html` }),
    }).then((r) => r.json());
    assert.ok(start.helpId);
    assert.ok(start.viewerUrl || start.viewerPath);

    const viewer = await fetch(`${root}/v1/human_help/${start.helpId}/viewer`);
    assert.equal(viewer.status, 200);
    const html = await viewer.text();
    assert.match(html, /人工协助/);
    assert.match(html, /finish login/);

    const shot = await fetch(`${root}/v1/human_help/${start.helpId}/shot`).then((r) => r.json());
    assert.ok(shot.screenshotBase64.length > 20);

    const resolve = await fetch(`${root}/v1/human_help/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ helpId: start.helpId, ok: true, note: 'ok' }),
    }).then((r) => r.json());
    assert.equal(resolve.ok, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
