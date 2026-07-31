/**
 * Helios compile assist.
 * Default mode is deterministic mock (no live Pi) so Slice C is testable offline.
 * Set HELIOS_PI_MODE=live later to route through a real Pi session.
 */

const LEAD_SYNC_YAML = `apiVersion: helios/v1
kind: Workflow
id: demo.lead-sync
version: 1
description: Sync a CRM lead into an ERP purchase order
params:
  lead_id:
    type: string
    required: true
requires:
  clis:
    - name: demo-crm
      version: ">=1.0.0"
    - name: demo-erp
      version: ">=1.0.0"
steps:
  - id: fetch_lead
    uses: cli
    cli: demo-crm
    sideEffect: read
    argv: ["leads", "get", "--id", "\${params.lead_id}", "--output", "json"]
    out: lead

  - id: create_po_dry
    uses: cli
    needs: [fetch_lead]
    cli: demo-erp
    sideEffect: read
    argv: ["po", "create", "--from-json", "\${lead.data}", "--dry-run", "--output", "json"]
    out: dry

  - id: approve
    uses: approval
    needs: [create_po_dry]
    prompt: "Create PO for lead \${params.lead_id}?"

  - id: create_po
    uses: cli
    needs: [approve]
    cli: demo-erp
    sideEffect: write
    argv: ["po", "create", "--from-json", "\${lead.data}", "--output", "json"]
    out: po
`;

const FEISHU_DOCTOR_YAML = `apiVersion: helios/v1
kind: Workflow
id: feishu.doctor
version: 1
description: Run Feishu CLI doctor
params: {}
requires:
  clis:
    - name: helios-lark
      version: ">=0.1.0"
steps:
  - id: doctor
    uses: cli
    cli: helios-lark
    sideEffect: read
    argv: ["doctor"]
    out: result
`;

const BROKEN_YAML = `kind: Workflow
id: broken.draft
version: 1
steps:
  - id: noop
    uses: cli
    cli: demo-crm
    argv: ["leads", "get", "--id", "L-1", "--output", "json"]
`;

export function extractYAML(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const fence = text.match(/```(?:ya?ml)?\s*([\s\S]*?)```/i);
  if (fence) {
    return fence[1].trim() + '\n';
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('apiVersion:') || trimmed.startsWith('kind:')) {
    return trimmed.endsWith('\n') ? trimmed : trimmed + '\n';
  }
  return '';
}

function hasCLI(clis, name) {
  return (clis || []).some((c) => c.name === name);
}

function draftFromIntent(intent, clis) {
  const text = (intent || '').toLowerCase();

  // Explicit broken draft for repair-loop tests.
  if (text.includes('__broken__') || text.includes('故意坏')) {
    return BROKEN_YAML;
  }

  if (
    (text.includes('lead') || text.includes('线索') || text.includes('采购') || text.includes('crm') || text.includes('erp')) &&
    hasCLI(clis, 'demo-crm') &&
    hasCLI(clis, 'demo-erp')
  ) {
    return LEAD_SYNC_YAML;
  }

  if (
    (text.includes('feishu') || text.includes('飞书') || text.includes('lark') || text.includes('doctor')) &&
    hasCLI(clis, 'helios-lark')
  ) {
    return FEISHU_DOCTOR_YAML;
  }

  // No silent lead-sync fallback for arbitrary intent (quality bar: mock must prove intent match).
  return `apiVersion: helios/v1
kind: Workflow
id: compiled.unmatched
version: 1
description: "No mock template matched intent; register CLIs or refine intent (线索/飞书/…)"
params: {}
steps:
  - id: unmatched
    uses: approval
    prompt: "Unmatched intent — refine or use live compile"
`;
}

function repairYAML(previousYAML, errors) {
  const joined = (errors || []).join('\n');
  let yaml = previousYAML || BROKEN_YAML;

  if (joined.includes('apiVersion') || !/^apiVersion:/m.test(yaml)) {
    if (!/^apiVersion:/m.test(yaml)) {
      yaml = `apiVersion: helios/v1\n${yaml}`;
    }
  }
  if (joined.includes('kind') && !/^kind:/m.test(yaml)) {
    yaml = yaml.replace(/^(apiVersion:.*\n)/, '$1kind: Workflow\n');
    if (!/^kind:/m.test(yaml)) {
      yaml = `kind: Workflow\n${yaml}`;
    }
  }
  // If still the intentionally broken fixture, upgrade to lead-sync.
  if (yaml.includes('broken.draft') || yaml.trim() === BROKEN_YAML.trim()) {
    return LEAD_SYNC_YAML;
  }
  return yaml.endsWith('\n') ? yaml : yaml + '\n';
}

/**
 * @param {{ intent: string, clis?: any[], previousYAML?: string, previousErrors?: string[], hints?: Record<string, unknown> }} req
 */
export async function compileDraft(req) {
  const mode = process.env.HELIOS_PI_MODE || 'mock';
  if (mode === 'live') {
    const { runPiPrompt } = await import('./piSession.js');
    const system = [
      'You are Helios compile assist.',
      'Output exactly one fenced YAML code block for a helios/v1 Workflow.',
      'Only use registered CLI commands provided by the user.',
      'Prefer read/dry-run then approval before write side effects.',
      'Do not invent CLIs. Do not wrap the YAML in commentary outside the fence.',
    ].join(' ');
    const user = buildCompilePrompt(req);
    const out = await runPiPrompt(system, user, { model: req.model || req.hints?.model });
    const yaml = extractYAML(out.text) || out.text;
    if (!yaml.trim()) {
      throw new Error('live Pi compile produced no YAML');
    }
    return {
      yaml: yaml.endsWith('\n') ? yaml : yaml + '\n',
      mode: 'live',
      model: out.model,
      rawTraceId: out.rawTraceId,
    };
  }
  if (mode !== 'mock') {
    throw new Error(`unknown HELIOS_PI_MODE=${mode}; use mock or live`);
  }

  const errors = req.previousErrors || [];
  let yaml;
  if (errors.length > 0 && req.previousYAML) {
    yaml = repairYAML(req.previousYAML, errors);
  } else {
    yaml = draftFromIntent(req.intent, req.clis);
  }

  return {
    yaml,
    mode: 'mock',
    rawTraceId: `mock_${Date.now().toString(16)}`,
  };
}

export function buildCompilePrompt(req) {
  const cliSummary = (req.clis || []).map((cli) => {
    const cmds = (cli.commands || [])
      .map((c) => `${(c.path || []).join(' ')} [${c.sideEffect || 'none'}]`)
      .join('; ');
    return `- ${cli.name}@${cli.version || '?'}: ${cmds}`;
  });
  const hints = req.hints && Object.keys(req.hints).length ? `Hints JSON:\n${JSON.stringify(req.hints, null, 2)}` : '';
  const prevErrors = req.previousErrors?.length
    ? `Previous validation errors:\n${req.previousErrors.join('\n')}`
    : '';
  const prevYAML = req.previousYAML
    ? `Previous YAML to repair (keep structure; fix errors):\n\`\`\`yaml\n${req.previousYAML.trim()}\n\`\`\``
    : '';
  return [
    'You are Helios compile assist. Output exactly one helios/v1 Workflow YAML fence.',
    'Only use registered CLIs below. Prefer dry-run then approval before write.',
    'Registered CLIs:',
    ...(cliSummary.length ? cliSummary : ['(none registered)']),
    '',
    'Example shape (adapt; do not invent CLIs):',
    '```yaml',
    'apiVersion: helios/v1',
    'kind: Workflow',
    'id: example.workflow',
    'version: 1',
    'params: {}',
    'steps: []',
    '```',
    '',
    `Intent: ${req.intent}`,
    hints,
    prevErrors,
    prevYAML,
  ]
    .filter(Boolean)
    .join('\n');
}
