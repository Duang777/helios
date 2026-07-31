/**
 * Live Pi session helpers for Helios.
 * Sources:
 * - https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
 * - packages/coding-agent/docs/providers.md (API keys / auth.json)
 *
 * Security: sessions use noTools: "all" so compile/ai cannot bash the host.
 */

import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
} from '@earendil-works/pi-coding-agent';

const PROVIDER_ENV = [
  ['anthropic', 'ANTHROPIC_API_KEY'],
  ['openai', 'OPENAI_API_KEY'],
  ['google', 'GEMINI_API_KEY'],
  ['openrouter', 'OPENROUTER_API_KEY'],
  ['deepseek', 'DEEPSEEK_API_KEY'],
  ['groq', 'GROQ_API_KEY'],
  ['mistral', 'MISTRAL_API_KEY'],
  ['xai', 'XAI_API_KEY'],
];

let sharedRuntimePromise;

export async function getModelRuntime() {
  if (!sharedRuntimePromise) {
    sharedRuntimePromise = (async () => {
      const runtime = await ModelRuntime.create();
      // Explicit Helios overrides (never log values).
      const provider = process.env.HELIOS_PI_PROVIDER || '';
      const key = process.env.HELIOS_PI_API_KEY || process.env.CFMAX_API_KEY || process.env.XPA_RELAY_API_KEY || '';
      if (provider && key && typeof runtime.setRuntimeApiKey === 'function') {
        runtime.setRuntimeApiKey(provider, key);
      } else if (key && typeof runtime.setRuntimeApiKey === 'function') {
        runtime.setRuntimeApiKey(process.env.HELIOS_PI_PROVIDER || 'cfmax', key);
      }
      return runtime;
    })();
  }
  return sharedRuntimePromise;
}

export function detectConfiguredProviderEnv() {
  const found = [];
  for (const [provider, envName] of PROVIDER_ENV) {
    if (process.env[envName]) found.push({ provider, envName });
  }
  if (process.env.HELIOS_PI_API_KEY && process.env.HELIOS_PI_PROVIDER) {
    found.push({ provider: process.env.HELIOS_PI_PROVIDER, envName: 'HELIOS_PI_API_KEY' });
  }
  return found;
}

function parseModelSpec(spec) {
  // "anthropic/claude-sonnet-4-5" or "claude-sonnet-4-5"
  if (!spec) return { provider: process.env.HELIOS_PI_PROVIDER || 'anthropic', id: process.env.HELIOS_PI_MODEL_ID || '' };
  if (spec.includes('/')) {
    const [provider, ...rest] = spec.split('/');
    return { provider, id: rest.join('/') };
  }
  return { provider: process.env.HELIOS_PI_PROVIDER || 'anthropic', id: spec };
}

export { parseModelSpec };

export async function resolveModel(runtime, modelOverride) {
  const spec = modelOverride || process.env.HELIOS_PI_MODEL || '';
  const { provider, id } = parseModelSpec(spec);

  if (id && typeof runtime.getModel === 'function') {
    const model = runtime.getModel(provider, id);
    if (model) return model;
  }

  // Prefer a configured-auth provider's first chatty model.
  const models = typeof runtime.getModels === 'function' ? runtime.getModels() : [];
  const list = Array.isArray(models) ? models : [];
  const preferredProviders = [provider, 'anthropic', 'openai', 'openrouter', 'google'].filter(Boolean);

  for (const p of preferredProviders) {
    const hit = list.find((m) => m.provider === p && Array.isArray(m.input) && m.input.includes('text'));
    if (hit) return hit;
  }

  const any = list.find((m) => Array.isArray(m.input) && m.input.includes('text'));
  if (any) return any;

  const authHint = detectConfiguredProviderEnv().map((x) => x.envName).join(', ') || 'none';
  throw new Error(
    `No Pi models available (auth env: ${authHint}). ` +
      'Set ANTHROPIC_API_KEY (or OPENAI_API_KEY / OPENROUTER_API_KEY), or run Pi login into ~/.pi/agent/auth.json. ' +
      'See packages/pi-sidecar/README.md',
  );
}

export function extractAssistantText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      const parts = msg.content
        .filter((c) => c && (c.type === 'text' || typeof c.text === 'string'))
        .map((c) => c.text || '')
        .filter(Boolean);
      if (parts.length) return parts.join('\n');
    }
    if (typeof msg.text === 'string') return msg.text;
  }
  return '';
}

/**
 * Run a single-turn Pi prompt with tools disabled.
 * @param {string} system
 * @param {string} user
 * @param {{ model?: string }} [opts]
 */
export async function runPiPrompt(system, user, opts = {}) {
  const runtime = await getModelRuntime();
  if (typeof runtime.hasConfiguredAuth === 'function' && !runtime.hasConfiguredAuth()) {
    const envs = detectConfiguredProviderEnv();
    if (envs.length === 0) {
      // Still try — some providers resolve lazily from env inside getAuth.
    }
  }

  const model = await resolveModel(runtime, opts.model);
  const { session, modelFallbackMessage } = await createAgentSession({
    model,
    modelRuntime: runtime,
    sessionManager: SessionManager.inMemory(),
    noTools: 'all',
    thinkingLevel: 'off',
  });

  try {
    if (modelFallbackMessage) {
      console.warn('[helios-pi]', modelFallbackMessage);
    }

    if (system && session.agent?.state) {
      const prev = session.agent.state.systemPrompt || '';
      session.agent.state.systemPrompt = prev ? `${prev}\n\n${system}` : system;
    }

    await session.prompt(user);
    const text = extractAssistantText(session.messages || session.agent?.state?.messages || []);
    if (!text.trim()) {
      // Surface Pi error stopReason when present
      const last = [...(session.messages || [])].reverse().find((m) => m?.role === 'assistant');
      const detail = last?.errorMessage || last?.stopReason || 'empty assistant text';
      throw new Error(`Pi returned empty assistant text (${detail})`);
    }
    return {
      text,
      model: `${model.provider}/${model.id}`,
      rawTraceId: `pi_${session.sessionId || Date.now().toString(16)}`,
    };
  } finally {
    session.dispose?.();
  }
}
