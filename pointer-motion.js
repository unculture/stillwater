// Exact critically damped spring: continuous position and velocity on press/release.
function advancePress(pressure, velocity, held, dt) {
  const target = held ? 1 : 0;
  const omega = 9;
  const offset = pressure - target;
  const c = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return {
    pressure: target + (offset + c * dt) * decay,
    velocity: (velocity - omega * c * dt) * decay,
  };
}
globalThis.advancePress = advancePress;
