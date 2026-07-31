import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { compileDraft, extractYAML, buildCompilePrompt, normalizeHeliosDraft } from './compile.js';
import { runAIStep } from './aiStep.js';
import { createServer } from './server.js';

before(() => {
  process.env.HELIOS_PI_MODE = 'mock';
});

test('extractYAML reads fenced block', () => {
  const yaml = extractYAML('here\n```yaml\napiVersion: helios/v1\nkind: Workflow\n```\n');
  assert.match(yaml, /apiVersion: helios\/v1/);
});

test('normalizeHeliosDraft strips cli@version and converts command/args', () => {
  const raw = `kind: Workflow
id: sync.lead.to.po
version: 1
steps:
  - id: get_lead
    cli: demo-crm@1.0.0
    command: leads
    args: ["get", "L-123"]
    mode: dry-run
  - id: approve_write
    type: approval
    prompt: "go"
`;
  const out = normalizeHeliosDraft(raw);
  assert.match(out, /apiVersion: helios\/v1/);
  assert.match(out, /cli: demo-crm\s*$/m);
  assert.doesNotMatch(out, /cli: demo-crm@/);
  assert.match(out, /uses: cli/);
  assert.match(out, /argv: \["leads", "get", "L-123"\]/);
  assert.match(out, /uses: approval/);
  assert.doesNotMatch(out, /^\s*type: approval/m);
  assert.doesNotMatch(out, /^\s*mode: dry-run/m);
});

test('buildCompilePrompt includes schema contract and anti-patterns', () => {
  const prompt = buildCompilePrompt({
    intent: 'x',
    clis: [{ name: 'demo-crm', version: '1', commands: [{ path: ['leads', 'get'] }] }],
  });
  assert.match(prompt, /FORBIDDEN/);
  assert.match(prompt, /cli: name@version/);
  assert.match(prompt, /uses: cli/);
  assert.match(prompt, /example\.lead-sync/);
});

test('mock compiles lead sync intent', async () => {
  const out = await compileDraft({
    intent: '把线索同步成采购单，写前要审批',
    clis: [
      { name: 'demo-crm', version: '1.0.0', commands: [{ path: ['leads', 'get'], sideEffect: 'read' }] },
      { name: 'demo-erp', version: '1.0.0', commands: [{ path: ['po', 'create'], sideEffect: 'write' }] },
    ],
  });
  assert.match(out.yaml, /id: demo\.lead-sync/);
  assert.match(out.yaml, /uses: approval/);
  assert.equal(out.mode, 'mock');
});

test('mock compiles feishu daily brief intent', async () => {
  const out = await compileDraft({
    intent: '把今日飞书日程做成简报并发到群里',
    clis: [{ name: 'helios-lark', version: '0.2.0', commands: [{ path: ['calendar', '+agenda'] }] }],
  });
  assert.match(out.yaml, /id: feishu\.daily-brief/);
  assert.match(out.yaml, /calendar/);
});

test('mock does not silently map unrelated intent to lead-sync', async () => {
  const out = await compileDraft({
    intent: 'summarize quarterly weather',
    clis: [
      { name: 'demo-crm', version: '1.0.0', commands: [{ path: ['leads', 'get'] }] },
      { name: 'demo-erp', version: '1.0.0', commands: [{ path: ['po', 'create'] }] },
    ],
  });
  assert.match(out.yaml, /compiled\.unmatched/);
});

test('mock repairs broken draft', async () => {
  const broken = await compileDraft({ intent: '__broken__', clis: [] });
  assert.match(broken.yaml, /broken\.draft/);
  const fixed = await compileDraft({
    intent: '__broken__',
    clis: [
      { name: 'demo-crm', version: '1.0.0', commands: [{ path: ['leads', 'get'] }] },
      { name: 'demo-erp', version: '1.0.0', commands: [{ path: ['po', 'create'] }] },
    ],
    previousYAML: broken.yaml,
    previousErrors: ['apiVersion must be helios/v1'],
  });
  assert.match(fixed.yaml, /apiVersion: helios\/v1/);
  assert.doesNotMatch(fixed.yaml, /broken\.draft/);
});

test('buildCompilePrompt includes previousYAML for live repair', () => {
  const prompt = buildCompilePrompt({
    intent: 'fix',
    clis: [{ name: 'demo-crm', version: '1', commands: [{ path: ['leads', 'get'] }] }],
    previousYAML: 'kind: Workflow\nid: broken.draft\n',
    previousErrors: ['apiVersion must be helios/v1'],
    hints: { preferCli: true },
  });
  assert.match(prompt, /Previous YAML to repair/);
  assert.match(prompt, /broken\.draft/);
  assert.match(prompt, /apiVersion must be helios\/v1/);
  assert.match(prompt, /preferCli/);
});

test('mock ai-step maps lead to poDraft with id', async () => {
  const out = await runAIStep({
    prompt: 'Map CRM lead JSON to ERP poDraft',
    input: { lead: { data: { id: 'L-1', company: 'Acme', amount: 42 } } },
    outputSchema: { required: ['poDraft'] },
  });
  assert.equal(out.json.poDraft.vendor, 'Acme');
  assert.equal(out.json.poDraft.amount, 42);
  assert.equal(out.json.poDraft.sourceLeadId, 'L-1');
  assert.equal(out.model, 'mock/deterministic');
});

test('http health and compile', async () => {
  process.env.HELIOS_PI_MODE = 'mock';
  const server = createServer({ mode: 'mock' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
    assert.equal(health.status, 'ok');
    assert.equal(health.mode, 'mock');
    assert.equal(health.authConfigured, true);

    const res = await fetch(`http://127.0.0.1:${port}/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        intent: '把线索同步成采购单',
        clis: [
          { name: 'demo-crm', version: '1.0.0', commands: [{ path: ['leads', 'get'] }] },
          { name: 'demo-erp', version: '1.0.0', commands: [{ path: ['po', 'create'] }] },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.yaml, /demo\.lead-sync/);
    assert.equal(body.mode, 'mock');

    const bad = await fetch(`http://127.0.0.1:${port}/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(bad.status, 422);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
