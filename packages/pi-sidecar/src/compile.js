/**
 * Helios compile assist.
 * mock: deterministic templates; live: Pi + schema-hardened prompt + normalize.
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

const FEISHU_DAILY_BRIEF_YAML = `apiVersion: helios/v1
kind: Workflow
id: feishu.daily-brief
version: 1
description: Feishu daily agenda brief to chat after approval
params:
  chat_id:
    type: string
    required: true
  note:
    type: string
    required: true
requires:
  clis:
    - name: helios-lark
      version: ">=0.2.0"
steps:
  - id: auth
    uses: cli
    cli: helios-lark
    sideEffect: read
    argv: ["auth", "status"]
    out: auth

  - id: agenda
    uses: cli
    needs: [auth]
    cli: helios-lark
    sideEffect: read
    argv: ["calendar", "+agenda"]
    out: agenda

  - id: dry_run
    uses: cli
    needs: [agenda]
    cli: helios-lark
    sideEffect: read
    argv: ["im", "+messages-send", "--chat-id", "\${params.chat_id}", "--text", "\${params.note}", "--dry-run"]
    out: dry

  - id: approve_send
    uses: approval
    needs: [dry_run]
    prompt: "Send Feishu daily brief to \${params.chat_id}?"

  - id: send
    uses: cli
    needs: [approve_send]
    cli: helios-lark
    sideEffect: write
    argv: ["im", "+messages-send", "--chat-id", "\${params.chat_id}", "--text", "\${params.note}"]
    out: sent
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

const SCHEMA_CONTRACT = `Helios Workflow YAML contract (STRICT):
- Top-level REQUIRED: apiVersion: helios/v1, kind: Workflow, id, version (>=1), steps (non-empty)
- CLI step REQUIRED fields: id, uses: cli, cli: <registered-name>, argv: [string,...], sideEffect: read|write|none
- Approval step: id, uses: approval, prompt: "..."
- Optional: needs: [stepId], out: name, when: expr, params, requires.clis
- Expression refs look like \${params.x} or \${lead.data} (keep literal dollar-brace in YAML)
FORBIDDEN (never emit):
- cli: name@version   → use cli: name only; put version under requires.clis
- command: / args:    → use argv: ["cmd", "sub", ...]
- type: approval      → use uses: approval
- mode: dry-run|write → use sideEffect + put --dry-run inside argv when needed
- dependsOn           → use needs
`;

const EXAMPLE_WORKFLOW = `apiVersion: helios/v1
kind: Workflow
id: example.lead-sync
version: 1
params:
  lead_id:
    type: string
    required: true
requires:
  clis:
    - name: demo-crm
      version: ">=1.0.0"
steps:
  - id: fetch
    uses: cli
    cli: demo-crm
    sideEffect: read
    argv: ["leads", "get", "--id", "\${params.lead_id}", "--output", "json"]
    out: lead
  - id: approve
    uses: approval
    needs: [fetch]
    prompt: "Continue?"
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

/**
 * Deterministic fixes for common live-model mistakes (Slice N).
 * @param {string} yaml
 */
export function normalizeHeliosDraft(yaml) {
  if (!yaml || typeof yaml !== 'string') {
    return '';
  }
  let out = yaml.replace(/\r\n/g, '\n').trim();
  if (!out) return '';

  if (!/^apiVersion:\s*/m.test(out)) {
    out = `apiVersion: helios/v1\n${out}`;
  }
  if (!/^kind:\s*/m.test(out)) {
    out = out.replace(/^(apiVersion:.*\n)/, '$1kind: Workflow\n');
  }

  // cli: demo-crm@1.0.0 → cli: demo-crm
  out = out.replace(/^(\s*cli:\s*)["']?([A-Za-z0-9._-]+)@[^"'\s]+["']?\s*$/gm, '$1$2');

  // type: approval → uses: approval
  out = out.replace(/^(\s*)type:\s*approval\s*$/gm, '$1uses: approval');

  // dependsOn: → needs:
  out = out.replace(/^(\s*)dependsOn:\s*/gm, '$1needs: ');

  // Drop pseudo mode lines (sideEffect+argv carry semantics)
  out = out.replace(/^\s*mode:\s*(dry-run|write|read)\s*$/gm, '');

  // Convert command:/args: blocks into uses/argv when uses/argv missing in the same step chunk.
  out = convertCommandArgsSteps(out);

  return out.endsWith('\n') ? out : `${out}\n`;
}

/**
 * Very small step-chunk rewriter: within each "- id:" block, if command+args present and no argv/uses:cli.
 */
function convertCommandArgsSteps(yaml) {
  const lines = yaml.split('\n');
  const chunks = [];
  let cur = [];
  for (const line of lines) {
    if (/^\s*-\s+id:\s*/.test(line) && cur.length) {
      chunks.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) chunks.push(cur);

  // First chunk may be header before any step
  if (chunks.length <= 1 && !chunks[0]?.some((l) => /^\s*-\s+id:\s*/.test(l))) {
    return yaml;
  }

  const header = [];
  const steps = [];
  for (const chunk of chunks) {
    if (chunk.some((l) => /^\s*-\s+id:\s*/.test(l))) {
      steps.push(chunk);
    } else {
      header.push(...chunk);
    }
  }

  const fixedSteps = steps.map((chunk) => rewriteStepChunk(chunk));
  return [...header, ...fixedSteps.flat()].join('\n');
}

function rewriteStepChunk(lines) {
  const text = lines.join('\n');
  const hasArgv = /^\s*argv:\s*/m.test(text);
  const hasUsesCli = /^\s*uses:\s*cli\s*$/m.test(text);
  const cmdMatch = text.match(/^\s*command:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!cmdMatch || hasArgv) {
    return lines;
  }

  // Collect args list (simple JSON-like or YAML inline)
  let args = [];
  const argsInline = text.match(/^\s*args:\s*\[(.*)\]\s*$/m);
  if (argsInline) {
    args = argsInline[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  const indentMatch = lines.find((l) => /^\s*-\s+id:/.test(l))?.match(/^(\s*)-/) || ['', '  '];
  const ind = `${indentMatch[1]}  `;
  const out = [];
  let skippedArgs = false;
  let skippedCommand = false;
  let inserted = false;
  for (const line of lines) {
    if (/^\s*command:\s*/.test(line)) {
      skippedCommand = true;
      continue;
    }
    if (/^\s*args:\s*/.test(line)) {
      skippedArgs = true;
      continue;
    }
    out.push(line);
    if (!inserted && /^\s*-\s+id:\s*/.test(line)) {
      if (!hasUsesCli) {
        out.push(`${ind}uses: cli`);
      }
      const argv = [cmdMatch[1], ...args];
      out.push(`${ind}argv: [${argv.map((a) => JSON.stringify(a)).join(', ')}]`);
      if (!/^\s*sideEffect:\s*/m.test(text)) {
        const dry = /^\s*mode:\s*dry-run/m.test(text) || argv.includes('--dry-run');
        out.push(`${ind}sideEffect: ${dry ? 'read' : 'write'}`);
      }
      inserted = true;
    }
  }
  if (!skippedCommand && !skippedArgs) {
    return lines;
  }
  return out;
}

function hasCLI(clis, name) {
  return (clis || []).some((c) => c.name === name);
}

function draftFromIntent(intent, clis) {
  const text = (intent || '').toLowerCase();

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
    hasCLI(clis, 'helios-lark') &&
    (text.includes('daily-brief') ||
      text.includes('daily brief') ||
      text.includes('日程简报') ||
      text.includes('每日简报') ||
      (text.includes('日程') && (text.includes('发') || text.includes('消息') || text.includes('简报'))))
  ) {
    return FEISHU_DAILY_BRIEF_YAML;
  }

  if (
    (text.includes('feishu') || text.includes('飞书') || text.includes('lark') || text.includes('doctor')) &&
    hasCLI(clis, 'helios-lark')
  ) {
    return FEISHU_DOCTOR_YAML;
  }

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
  let yaml = normalizeHeliosDraft(previousYAML || BROKEN_YAML);

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
  if (yaml.includes('broken.draft') || yaml.trim() === BROKEN_YAML.trim()) {
    return LEAD_SYNC_YAML;
  }
  return yaml.endsWith('\n') ? yaml : yaml + '\n';
}

/**
 * @param {{ intent: string, clis?: any[], previousYAML?: string, previousErrors?: string[], hints?: Record<string, unknown> }} req
 */
export async function compileDraft(req) {
  const { resolvePiMode } = await import('./mode.js');
  const mode = resolvePiMode();
  if (mode === 'live') {
    const { runPiPrompt } = await import('./piSession.js');
    const system = [
      'You are Helios compile assist.',
      'Output exactly one fenced YAML code block for a helios/v1 Workflow.',
      SCHEMA_CONTRACT,
      'Only use registered CLI names from the user message.',
      'Prefer read/dry-run argv then uses: approval before write sideEffect.',
      'Do not invent CLIs. No commentary outside the YAML fence.',
    ].join('\n');
    const user = buildCompilePrompt(req);
    const out = await runPiPrompt(system, user, { model: req.model || req.hints?.model });
    const raw = extractYAML(out.text) || out.text;
    if (!raw.trim()) {
      throw new Error('live Pi compile produced no YAML');
    }
    const yaml = normalizeHeliosDraft(raw);
    return {
      yaml,
      mode: 'live',
      model: out.model,
      rawTraceId: out.rawTraceId,
    };
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
    ? `Previous validation errors (fix these precisely):\n${req.previousErrors.join('\n')}`
    : '';
  const prevYAML = req.previousYAML
    ? `Previous YAML to repair (keep intent; fix to Helios contract):\n\`\`\`yaml\n${req.previousYAML.trim()}\n\`\`\``
    : '';
  return [
    'Compile the Intent into ONE helios/v1 Workflow YAML fence.',
    SCHEMA_CONTRACT,
    'Registered CLIs (only these cli: names are legal):',
    ...(cliSummary.length ? cliSummary : ['(none registered)']),
    '',
    'Canonical example:',
    '```yaml',
    EXAMPLE_WORKFLOW.trim(),
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
