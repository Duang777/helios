import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasLiveAuth, resolvePiMode, modeWasExplicit } from './mode.js';

test('resolvePiMode defaults to mock without auth', () => {
  assert.equal(resolvePiMode({}), 'mock');
  assert.equal(hasLiveAuth({}), false);
});

test('resolvePiMode defaults to live when CFMAX key present', () => {
  assert.equal(resolvePiMode({ CFMAX_API_KEY: 'sk-test' }), 'live');
  assert.equal(hasLiveAuth({ ANTHROPIC_API_KEY: 'x' }), true);
});

test('explicit mock wins over auth', () => {
  assert.equal(resolvePiMode({ HELIOS_PI_MODE: 'mock', CFMAX_API_KEY: 'sk' }), 'mock');
  assert.equal(modeWasExplicit({ HELIOS_PI_MODE: 'mock' }), true);
});

test('explicit live wins without auth (caller may still fail later)', () => {
  assert.equal(resolvePiMode({ HELIOS_PI_MODE: 'live' }), 'live');
});

test('unknown mode throws', () => {
  assert.throws(() => resolvePiMode({ HELIOS_PI_MODE: 'fake' }), /unknown HELIOS_PI_MODE/);
});

test('blank HELIOS_PI_MODE treated as unset', () => {
  assert.equal(resolvePiMode({ HELIOS_PI_MODE: '  ', CFMAX_API_KEY: 'k' }), 'live');
  assert.equal(modeWasExplicit({ HELIOS_PI_MODE: '' }), false);
});
