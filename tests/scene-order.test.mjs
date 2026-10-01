import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../scene-order.js';

test('every scene appears once per pass, with no immediate repeat across passes', () => {
  let seed = 7;
  const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  const order = new globalThis.SceneOrder(56, 0, random);
  let current = 0;
  const first = [current];
  for (let i = 0; i < 55; i++) first.push(current = order.next(current));
  assert.equal(new Set(first).size, 56);
  for (let pass = 0; pass < 20; pass++) {
    const previous = current;
    const values = Array.from({ length: 56 }, () => current = order.next(current));
    assert.notEqual(values[0], previous);
    assert.equal(new Set(values).size, 56);
    assert.ok(values.every(value => value >= 0 && value < 56));
  }
});

test('manual selection removes that scene from the current shuffle pass', () => {
  const order = new globalThis.SceneOrder(8, 0, () => 0.4);
  order.visit(5);
  let current = 5;
  const remaining = Array.from({ length: 6 }, () => current = order.next(current));
  assert.equal(new Set(remaining).size, 6);
  assert.ok(!remaining.includes(5));
  assert.ok(!remaining.includes(0));
});
