import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../pointer-motion.js';

test('press and release start gently and settle at the intended force', () => {
  const first = globalThis.advancePress(0, 0, true, 1 / 60);
  assert.ok(first.pressure > 0 && first.pressure < 0.015);
  let state = { pressure: 0, velocity: 0 };
  for (let i = 0; i < 120; i++) state = globalThis.advancePress(state.pressure, state.velocity, true, 1 / 60);
  assert.ok(state.pressure > 0.9999);
  const released = globalThis.advancePress(state.pressure, state.velocity, false, 1 / 60);
  assert.ok(state.pressure - released.pressure < 0.015);
  for (let i = 0; i < 120; i++) state = globalThis.advancePress(state.pressure, state.velocity, false, 1 / 60);
  assert.ok(state.pressure < 0.0001);
});

test('force depends on elapsed time, not the screen refresh rate', () => {
  const simulate = fps => {
    let state = { pressure: 0, velocity: 0 };
    for (let i = 0; i < fps; i++) state = globalThis.advancePress(state.pressure, state.velocity, true, 1 / fps);
    return state;
  };
  const slow = simulate(30), fast = simulate(144);
  assert.ok(Math.abs(slow.pressure - fast.pressure) < 1e-10);
  assert.ok(Math.abs(slow.velocity - fast.velocity) < 1e-10);
});
