/**
 * AI step for Helios.
 * mock: deterministic JSON
 * live: Pi session with noTools:"all", JSON-only output
 */

function asObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

export function extractJSON(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Validate top-level required keys from a JSON Schema-like outputSchema. */
export function assertRequiredKeys(json, outputSchema) {
  const required = outputSchema?.required;
  if (!Array.isArray(required)) return;
  for (const key of required) {
    if (!(key in json)) {
      throw new Error(`missing required key ${key}`);
    }
  }
}

function mockAIStep(req) {
  const input = asObject(req.input);
  const prompt = (req.prompt || '').toLowerCase();
  const lead = asObject(input.lead?.data || input.lead || input);
  const leadId = lead.id || lead.lead_id || null;

  let json;
  if (prompt.includes('podraft') || prompt.includes('purchase') || prompt.includes('采购') || prompt.includes('map')) {
    json = {
      poDraft: {
        id: leadId,
        sourceLeadId: leadId,
        vendor: lead.company || lead.vendor || lead.title || 'Unknown Vendor',
        title: lead.title || lead.company || 'PO',
        amount: lead.amount ?? 0,
        currency: lead.currency || 'CNY',
        note: 'mapped by helios mock ai-step',
      },
    };
  } else if (prompt.includes('summar')) {
    json = {
      summary: `mock summary of ${Object.keys(lead).join(',') || 'empty input'}`,
    };
  } else {
    json = {
      result: {
        ok: true,
        echoPrompt: String(req.prompt || '').slice(0, 120),
        inputKeys: Object.keys(input),
      },
    };
  }

  assertRequiredKeys(json, req.outputSchema);

  return {
    json,
    mode: 'mock',
    model: 'mock/deterministic',
    rawTraceId: `ai_${Date.now().toString(16)}`,
  };
}

/**
 * @param {{ runId?: string, stepId?: string, prompt: string, input?: any, outputSchema?: any, model?: string }} req
 */
export async function runAIStep(req) {
  const mode = process.env.HELIOS_PI_MODE || 'mock';
  if (!req.prompt || typeof req.prompt !== 'string') {
    throw new Error('prompt is required');
  }

  if (mode === 'mock') {
    return mockAIStep(req);
  }
  if (mode !== 'live') {
    throw new Error(`unknown HELIOS_PI_MODE=${mode}; use mock or live`);
  }

  const { runPiPrompt } = await import('./piSession.js');
  const required = req.outputSchema?.required;
  const system = [
    'You are a Helios AI workflow step.',
    'Return ONLY a JSON object (optionally in a ```json fence).',
    'No tools are available. Do not invent CLI commands.',
    required?.length ? `Required top-level keys: ${required.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const user = [
    `Prompt: ${req.prompt}`,
    `Input JSON:\n${JSON.stringify(req.input ?? {}, null, 2)}`,
    req.outputSchema ? `Output schema hint:\n${JSON.stringify(req.outputSchema, null, 2)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await runPiPrompt(
        system,
        attempt === 0 ? user : `${user}\n\nPrevious output was invalid: ${lastErr}`,
        { model: req.model },
      );
      const json = extractJSON(out.text);
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('could not parse JSON from Pi response');
      }
      assertRequiredKeys(json, req.outputSchema);
      return {
        json,
        mode: 'live',
        model: out.model,
        rawTraceId: out.rawTraceId,
      };
    } catch (err) {
      lastErr = err.message || String(err);
    }
  }
  throw new Error(lastErr || 'ai-step failed');
}
