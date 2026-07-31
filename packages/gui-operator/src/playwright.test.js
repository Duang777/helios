import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperator } from './operator.js';
import { createServer } from './server.js';

test('playwright screenshot_and_confirm captures real png', async (t) => {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    t.skip('playwright package missing');
    return;
  }
  try {
    const b = await chromium.launch({ headless: true });
    await b.close();
  } catch (e) {
    t.skip(`chromium unavailable: ${e.message}`);
    return;
  }

  const { server } = createServer({ mode: 'fake' }); // only for fixture host
  // Use a dedicated playwright operator against fixture served by fake server
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const fixture = `http://127.0.0.1:${port}/fixture/confirm.html`;
  try {
    const op = createOperator('playwright');
    const out = await op.screenshotAndConfirm({ url: fixture, selector: 'button#confirm' });
    assert.equal(out.ok, true);
    assert.equal(out.mode, 'playwright');
    const bytes = Buffer.from(out.screenshotBase64, 'base64');
    assert.ok(bytes.length > 500, `expected real screenshot, got ${bytes.length} bytes`);
    assert.equal(bytes[0], 0x89);
    assert.equal(bytes[1], 0x50);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
