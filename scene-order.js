// A shuffled deck visits every scene before starting another pass.
class SceneOrder {
  constructor(count, current = 0, random = Math.random) {
    this.count = count;
    this.random = random;
    this.remaining = this.shuffle(Array.from({ length: count }, (_, i) => i).filter(i => i !== current));
  }
  shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  visit(index) { this.remaining = this.remaining.filter(item => item !== index); }
  next(current) {
    if (!this.remaining.length) {
      this.remaining = this.shuffle(Array.from({ length: this.count }, (_, i) => i));
      if (this.count > 1 && this.remaining[0] === current) [this.remaining[0], this.remaining[1]] = [this.remaining[1], this.remaining[0]];
    }
    return this.remaining.shift();
  }
}
globalThis.SceneOrder = SceneOrder;
