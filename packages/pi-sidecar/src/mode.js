/**
 * Helios Pi mode resolution (Slice J).
 * Explicit HELIOS_PI_MODE always wins; unset → live when auth env present, else mock.
 */

const LIVE_AUTH_ENVS = [
  'HELIOS_PI_API_KEY',
  'CFMAX_API_KEY',
  'XPA_RELAY_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'XAI_API_KEY',
];

export function hasLiveAuth(env = process.env) {
  return LIVE_AUTH_ENVS.some((name) => Boolean(env[name] && String(env[name]).trim()));
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'mock' | 'live'}
 */
export function resolvePiMode(env = process.env) {
  const raw = env.HELIOS_PI_MODE;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return hasLiveAuth(env) ? 'live' : 'mock';
  }
  const mode = String(raw).trim();
  if (mode === 'mock' || mode === 'live') {
    return mode;
  }
  throw new Error(`unknown HELIOS_PI_MODE=${mode}; use mock or live`);
}

/** Alias used by health / startup logging. */
export function effectivePiMode(env = process.env) {
  return resolvePiMode(env);
}

export function modeWasExplicit(env = process.env) {
  const raw = env.HELIOS_PI_MODE;
  return !(raw === undefined || raw === null || String(raw).trim() === '');
}
