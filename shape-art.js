/* A small canvas mesh bends SVG artwork while preserving its masks and clipping. */
class ShapeArtwork {
  constructor() {
    this.cache = new Map();
    this.divisions = 16;
  }

  async load(scene) {
    if (scene.kind === 'rings') return;
    if (this.cache.has(scene.id)) return this.cache.get(scene.id).ready;
    const entry = { image: new Image(), canvas: document.createElement('canvas'), colorKey: '', used: performance.now() };
    entry.canvas.width = entry.canvas.height = 1024;
    entry.context = entry.canvas.getContext('2d');
    entry.ready = new Promise((resolve, reject) => {
      entry.image.onload = () => { entry.loaded = true; resolve(); };
      entry.image.onerror = () => { this.cache.delete(scene.id); reject(new Error(`Unable to load ${scene.name}`)); };
    });
    this.cache.set(scene.id, entry);
    entry.image.src = scene.art;
    return entry.ready;
  }

  trim(keep) {
    const unused = [...this.cache.entries()].filter(([id, entry]) => !keep.includes(id) && entry.loaded).sort((a, b) => a[1].used - b[1].used);
    while (this.cache.size > 6 && unused.length) {
      const [id, entry] = unused.shift();
      entry.canvas.width = entry.canvas.height = 1;
      entry.image.src = '';
      this.cache.delete(id);
    }
  }

  texture(scene, colors) {
    const entry = this.cache.get(scene.id);
    if (!entry?.loaded) return null;
    entry.used = performance.now();
    const key = colors.flat().map(value => Math.round(value / 4)).join(',');
    if (entry.colorKey !== key) {
      const ctx = entry.context;
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.globalCompositeOperation = 'source-over';
      const ratio = entry.image.naturalWidth / entry.image.naturalHeight;
      const w = ratio >= 1 ? 920 : 920 * ratio;
      const h = ratio >= 1 ? 920 / ratio : 920;
      ctx.drawImage(entry.image, (1024 - w) / 2, (1024 - h) / 2, w, h);
      ctx.globalCompositeOperation = 'source-in';
      const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
      gradient.addColorStop(0, `rgb(${colors[0].map(Math.round)})`);
      gradient.addColorStop(0.52, `rgb(${colors[1].map(Math.round)})`);
      gradient.addColorStop(1, `rgb(${colors[2].map(Math.round)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.globalCompositeOperation = 'source-over';
      entry.colorKey = key;
    }
    return entry.canvas;
  }

  draw(ctx, scene, frame) {
    const texture = this.texture(scene, frame.colors);
    if (!texture) return;
    const n = this.divisions;
    const points = [];
    const size = frame.radius * 2.1;
    const breathing = 1 + Math.sin(frame.time * 0.22) * 0.015;
    const angle = Math.sin(frame.time * 0.045 + frame.seed) * 0.045;
    const c = Math.cos(angle), s = Math.sin(angle);
    const mouseX = (frame.pointer.sx - frame.x) / (size / 2);
    const mouseY = (frame.pointer.sy - frame.y) / (size / 2);
    for (let row = 0; row <= n; row++) {
      for (let col = 0; col <= n; col++) {
        const u = col / n, v = row / n;
        let x = (u * 2 - 1) * breathing, y = (v * 2 - 1) * breathing;
        x += Math.sin(y * 4 + frame.time * 0.25 + frame.seed) * 0.025;
        y += Math.cos(x * 4 - frame.time * 0.18 + frame.seed) * 0.018;
        const rx = x * c - y * s;
        y = x * s + y * c;
        x = rx;
        const dx = mouseX - x, dy = mouseY - y;
        const pull = Math.exp(-(dx * dx + dy * dy) * (3.5 - 2 * frame.pointer.press)) * frame.pointer.strength;
        const strength = -0.15 + 0.55 * frame.pointer.press;
        x += (dx * strength - dy * 0.09) * pull;
        y += (dy * strength + dx * 0.09) * pull;
        x = frame.x + x * size / 2;
        y = frame.y + y * size / 2;
        for (const ripple of frame.ripples) {
          const dx = x - ripple.x * frame.width, dy = y - ripple.y * frame.height;
          const distance = Math.hypot(dx, dy) || 1;
          const age = frame.realTime - ripple.born;
          const delta = distance - age * 105;
          const push = Math.sin(delta * 0.05) * Math.exp(-Math.pow(delta / 48, 2) - age * 0.65) * ripple.force;
          x += dx / distance * push;
          y += dy / distance * push;
        }
        points.push({ x, y, u: u * 1024, v: v * 1024 });
      }
    }
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const a = points[row * (n + 1) + col];
        const b = points[row * (n + 1) + col + 1];
        const c = points[(row + 1) * (n + 1) + col];
        const d = points[(row + 1) * (n + 1) + col + 1];
        this.triangle(ctx, texture, a, b, c, a.u, a.v, 1024 / n);
        this.triangle(ctx, texture, d, c, b, a.u, a.v, 1024 / n);
      }
    }
  }

  triangle(ctx, texture, p0, p1, p2, sx, sy, size) {
    const determinant = p0.u * (p1.v - p2.v) + p1.u * (p2.v - p0.v) + p2.u * (p0.v - p1.v);
    const a = (p0.x * (p1.v - p2.v) + p1.x * (p2.v - p0.v) + p2.x * (p0.v - p1.v)) / determinant;
    const b = (p0.y * (p1.v - p2.v) + p1.y * (p2.v - p0.v) + p2.y * (p0.v - p1.v)) / determinant;
    const c = (p0.x * (p2.u - p1.u) + p1.x * (p0.u - p2.u) + p2.x * (p1.u - p0.u)) / determinant;
    const d = (p0.y * (p2.u - p1.u) + p1.y * (p0.u - p2.u) + p2.y * (p1.u - p0.u)) / determinant;
    const e = p0.x - a * p0.u - c * p0.v;
    const f = p0.y - b * p0.u - d * p0.v;
    ctx.save();
    // A tiny overlap prevents hairline cracks between adjacent triangles.
    const mx = (p0.x + p1.x + p2.x) / 3, my = (p0.y + p1.y + p2.y) / 3;
    ctx.beginPath();
    for (const [i, p] of [p0, p1, p2].entries()) {
      const dx = p.x - mx, dy = p.y - my, distance = Math.hypot(dx, dy) || 1;
      const x = p.x + dx / distance * 0.35, y = p.y + dy / distance * 0.35;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(texture, sx, sy, size, size, sx, sy, size, size);
    ctx.restore();
  }
}
window.ShapeArtwork = ShapeArtwork;
