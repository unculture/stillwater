/* Locally synthesized music and surroundings. Nothing plays before a sound gesture. */
const SOUNDSCAPES = [
  { id: 'stillwater', name: 'Stillwater', detail: 'The original floating chords', symbol: '≈', interval: 9, instrument: 'glass', pad: 0.038, melody: 0.029, chords: [[48,55,60,64,67,74],[45,52,57,60,64,71],[41,48,53,57,60,67],[43,50,55,59,62,69]], scale: [60,62,64,67,69,72,74,76,79] },
  { id: 'stream', name: 'Woodland stream', detail: 'Running water, little pools, soft strings', symbol: '≋', interval: 11, instrument: 'glass', pad: 0.025, melody: 0.023, chords: [[50,57,62,66,69,73],[47,54,59,62,66,69],[43,50,55,59,62,66],[45,52,57,61,64,69]], scale: [62,64,66,69,71,74,76,78,81] },
  { id: 'rainforest', name: 'Rainforest', detail: 'Soft rain, distant birds, warm wooden notes', symbol: '♧', interval: 13, instrument: 'wood', pad: 0.018, melody: 0.035, chords: [[45,52,57,60,64,67],[48,55,60,64,67,71],[41,48,53,57,60,64],[43,50,55,59,62,67]], scale: [57,60,62,64,67,69,72,74,76] },
  { id: 'library', name: 'Quiet library', detail: 'Felt piano, warm room tone, turning pages', symbol: '▤', interval: 12, instrument: 'felt', pad: 0.014, melody: 0.048, chords: [[48,55,59,62,64,67],[45,52,55,59,60,64],[41,48,52,55,57,60],[43,50,54,57,59,62]], scale: [60,62,64,67,69,72,74,76,79] },
  { id: 'desert', name: 'Desert wind', detail: 'Slow dunes of air, deep chords, distant chimes', symbol: '∿', interval: 16, instrument: 'bell', pad: 0.028, melody: 0.018, chords: [[38,45,50,57,62,64],[41,48,53,60,65,67],[36,43,48,55,60,62],[43,50,55,62,67,69]], scale: [50,53,55,57,60,62,65,67,69] },
];

class StillwaterAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.volume = 0.55;
    this.musicLevel = 0.85;
    this.natureLevel = 0.65;
    this.soundscape = 'stillwater';
    this.scene = 0;
    this.step = 0;
    this.lastNote = -Infinity;
    this.layers = new Set();
    this.noiseBuffers = new Map();
  }

  async init() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('This browser does not support ambient audio.');
    const context = this.context = new AudioContext();
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.compressor = context.createDynamicsCompressor();
    Object.assign(this.compressor.threshold, { value: -20 });
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.02;
    this.compressor.release.value = 0.6;
    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);
    this.music = context.createGain();
    this.nature = context.createGain();
    this.music.gain.value = this.musicLevel;
    this.nature.gain.value = this.natureLevel;
    this.music.connect(this.master);
    this.nature.connect(this.master);
    this.dry = context.createGain();
    this.dry.gain.value = 0.65;
    this.dry.connect(this.music);
    this.reverb = context.createConvolver();
    const length = Math.floor(context.sampleRate * 5.5);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        smooth = (smooth + (Math.random() * 2 - 1) * 0.3) / 1.3;
        data[i] = smooth * Math.pow(1 - i / length, 2.7);
      }
    }
    this.reverb.buffer = impulse;
    const wet = context.createGain();
    wet.gain.value = 0.75;
    this.reverb.connect(wet);
    wet.connect(this.music);
  }

  ramp(param, value, seconds = 0.5) {
    const now = this.context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.setTargetAtTime(value, now, seconds);
  }

  async toggle() {
    await this.init();
    await this.context.resume();
    clearTimeout(this.suspendTimer);
    this.enabled = !this.enabled;
    this.setLevel();
    if (this.enabled) this.activate();
    else { this.stopClock(); this.retire(this.activeLayer, 0.3); this.activeLayer = null; }
    return this.enabled;
  }

  setLevel() {
    if (this.context) this.ramp(this.master.gain, this.enabled && !document.hidden ? this.volume * 0.6 : 0);
  }
  setVolume(value) { this.volume = value; this.setLevel(); }
  setMix(music, nature) {
    this.musicLevel = music;
    this.natureLevel = nature;
    if (this.context) { this.ramp(this.music.gain, music); this.ramp(this.nature.gain, nature); }
  }
  setSoundscape(id) {
    if (!SOUNDSCAPES.some(item => item.id === id) || id === this.soundscape) return;
    this.soundscape = id;
    if (this.enabled && !document.hidden) this.activate();
  }

  activate() {
    this.retire(this.activeLayer);
    const context = this.context;
    const layer = {
      style: SOUNDSCAPES.find(item => item.id === this.soundscape),
      music: context.createGain(), nature: context.createGain(),
      nodes: new Set(), sources: new Set(), voices: new Set(), step: 0,
      nextChord: context.currentTime, nextEvent: context.currentTime + 0.6,
    };
    layer.music.gain.value = layer.nature.gain.value = 0;
    layer.music.connect(this.dry);
    layer.music.connect(this.reverb);
    layer.nature.connect(this.nature);
    this.layers.add(layer);
    this.activeLayer = layer;
    this.ramp(layer.music.gain, 1, 0.85);
    this.ramp(layer.nature.gain, 1, 1.1);
    this.makeSurroundings(layer);
    this.stopClock();
    this.tick();
    this.timer = setInterval(() => this.tick(), 200);
  }

  retire(layer, fade = 0.8) {
    if (!layer || layer.retiring) return;
    layer.retiring = true;
    this.ramp(layer.music.gain, 0, fade);
    this.ramp(layer.nature.gain, 0, fade);
    layer.cleanupTimer = setTimeout(() => this.dispose(layer), fade * 6000);
  }

  dispose(layer) {
    clearTimeout(layer.cleanupTimer);
    for (const source of layer.sources) { try { source.stop(); } catch { /* Source already ended. */ } }
    for (const node of layer.nodes) node.disconnect();
    layer.music.disconnect();
    layer.nature.disconnect();
    layer.nodes.clear();
    layer.sources.clear();
    layer.voices.clear();
    this.layers.delete(layer);
  }

  own(layer, ...nodes) { nodes.forEach(node => layer.nodes.add(node)); }
  startSource(layer, source, start, end) {
    layer.sources.add(source);
    source.start(start);
    if (end !== undefined) source.stop(end);
  }

  tone(layer, midi, start, duration, strength, pan = 0, pad = false) {
    const context = this.context;
    if (!context || layer.voices.size > 42 || layer.retiring) return;
    const envelope = context.createGain();
    envelope.gain.value = 0;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = pad ? 1100 : layer.style.instrument === 'wood' ? 1800 : 2600;
    filter.Q.value = 0.3;
    envelope.connect(filter);
    filter.connect(panner);
    panner.connect(layer.music);
    const style = layer.style.instrument;
    const attack = pad ? 2.8 : style === 'felt' ? 0.018 : style === 'wood' ? 0.012 : 0.055;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(strength, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const nodes = [envelope, panner, filter];
    const partials = pad ? [[1, 0.5, -3], [1, 0.5, 3]] : style === 'felt' ? [[1, 1, 0], [2, 0.14, 0], [3, 0.025, 0]] : style === 'wood' ? [[1, 1, 0], [3, 0.09, 0]] : style === 'bell' ? [[1, 1, 0], [2, 0.08, 1]] : [[1, 1, 0]];
    const oscillators = [];
    for (const [multiple, level, detune] of partials) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * multiple;
      oscillator.detune.value = detune;
      gain.gain.value = level * (pad ? 2 : 1);
      oscillator.connect(gain);
      gain.connect(envelope);
      nodes.push(oscillator, gain);
      oscillators.push(oscillator);
      this.startSource(layer, oscillator, start, start + duration + 0.1);
    }
    this.own(layer, ...nodes);
    layer.voices.add(envelope);
    oscillators[0].onended = () => {
      nodes.forEach(node => { node.disconnect(); layer.nodes.delete(node); });
      oscillators.forEach(node => layer.sources.delete(node));
      layer.voices.delete(envelope);
    };
  }

  playChord(layer) {
    const now = this.context.currentTime;
    const style = layer.style;
    const chord = style.chords[layer.step % style.chords.length];
    chord.slice(0, 5).forEach((note, i) => this.tone(layer, note, now + i * 0.18, style.interval + 5, style.pad, (i - 2) * 0.24, true));
    const notes = style.id === 'library' ? [2, 4, 3, 5, 4] : style.id === 'desert' ? [3, 4] : [2, 4, 3];
    notes.forEach((index, i) => this.tone(layer, chord[index] + (style.id === 'desert' ? 0 : 12), now + 2 + i * (style.id === 'library' ? 1.7 : 2.2), style.instrument === 'wood' ? 2.6 : 7, style.melody, Math.sin(layer.step + i) * 0.6));
    layer.step++;
  }

  noise(kind) {
    if (this.noiseBuffers.has(kind)) return this.noiseBuffers.get(kind);
    const length = this.context.sampleRate * 12;
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let brown = 0, slow = 0, medium = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + white * 0.025) / 1.025;
        slow = slow * 0.995 + white * 0.005;
        medium = medium * 0.94 + white * 0.06;
        data[i] = kind === 'brown' ? brown * 3.5 : kind === 'pink' ? (slow * 5 + medium * 2 + white * 0.12) * 0.6 : white * 0.6;
      }
      // Smooth the loop seam without periodic silence.
      const seam = Math.floor(this.context.sampleRate * 0.12);
      for (let i = 0; i < seam; i++) {
        const t = i / seam;
        data[length - seam + i] = data[length - seam + i] * (1 - t) + data[i] * t;
      }
    }
    this.noiseBuffers.set(kind, buffer);
    return buffer;
  }

  bed(layer, kind, gainValue, low, high, rate, movement) {
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = this.noise(kind);
    source.loop = true;
    source.loopStart = 0.12;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass'; highpass.frequency.value = low; highpass.Q.value = 0.3;
    const lowpass = ctx.createBiquadFilter();
    lowpass.frequency.value = high; lowpass.Q.value = 0.45;
    const gain = ctx.createGain(); gain.gain.value = gainValue;
    source.connect(highpass); highpass.connect(lowpass); lowpass.connect(gain); gain.connect(layer.nature);
    const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
    const depth = ctx.createGain(); depth.gain.value = movement;
    lfo.connect(depth); depth.connect(gain.gain);
    this.own(layer, source, highpass, lowpass, gain, lfo, depth);
    this.startSource(layer, source, ctx.currentTime);
    this.startSource(layer, lfo, ctx.currentTime);
  }

  makeSurroundings(layer) {
    switch (layer.style.id) {
      case 'stream':
        this.bed(layer, 'pink', 0.29, 180, 4200, 0.09, 0.045);
        this.bed(layer, 'brown', 0.19, 60, 700, 0.16, 0.035);
        break;
      case 'rainforest':
        this.bed(layer, 'pink', 0.20, 450, 6200, 0.05, 0.035);
        this.bed(layer, 'brown', 0.10, 80, 1000, 0.075, 0.02);
        break;
      case 'library':
        this.bed(layer, 'brown', 0.075, 50, 420, 0.035, 0.012);
        break;
      case 'desert':
        this.bed(layer, 'brown', 0.42, 45, 950, 0.036, 0.18);
        this.bed(layer, 'pink', 0.095, 300, 2200, 0.061, 0.055);
        break;
    }
  }

  natureTone(layer, start, duration, startHz, endHz, strength, pan, warble = 0) {
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain(); gain.gain.value = 0;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    oscillator.frequency.setValueAtTime(startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(strength, start + duration * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain); gain.connect(panner); panner.connect(layer.nature);
    const nodes = [oscillator, gain, panner];
    const sources = [oscillator];
    if (warble) {
      const lfo = ctx.createOscillator(); lfo.frequency.value = warble;
      const depth = ctx.createGain(); depth.gain.value = 75;
      lfo.connect(depth); depth.connect(oscillator.frequency);
      nodes.push(lfo, depth); sources.push(lfo);
      this.startSource(layer, lfo, start, start + duration + 0.05);
    }
    this.own(layer, ...nodes);
    this.startSource(layer, oscillator, start, start + duration + 0.05);
    oscillator.onended = () => {
      nodes.forEach(node => { node.disconnect(); layer.nodes.delete(node); });
      sources.forEach(source => layer.sources.delete(source));
    };
  }

  rustle(layer) {
    const ctx = this.context, now = ctx.currentTime;
    const source = ctx.createBufferSource(); source.buffer = this.noise('white');
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1600; filter.Q.value = 0.5;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.2 - 0.6;
    source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(layer.nature);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.13);
    gain.gain.linearRampToValueAtTime(0.008, now + 0.3);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.43);
    gain.gain.linearRampToValueAtTime(0, now + 0.8);
    this.own(layer, source, filter, gain, pan);
    this.startSource(layer, source, now, now + 0.9);
    source.onended = () => { [source, filter, gain, pan].forEach(node => { node.disconnect(); layer.nodes.delete(node); }); layer.sources.delete(source); };
  }

  natureEvent(layer) {
    const now = this.context.currentTime;
    const pan = Math.random() * 1.5 - 0.75;
    switch (layer.style.id) {
      case 'stream': {
        const base = 300 + Math.random() * 700;
        this.natureTone(layer, now, 0.12 + Math.random() * 0.2, base, base * 0.35, 0.018 + Math.random() * 0.025, pan);
        return 0.3 + Math.random() * 0.8;
      }
      case 'rainforest': {
        const base = 1500 + Math.random() * 900;
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) this.natureTone(layer, now + i * 0.25, 0.17 + Math.random() * 0.17, base, base * (1.08 + Math.random() * 0.25), 0.018, pan, 19);
        return 5 + Math.random() * 8;
      }
      case 'library': this.rustle(layer); return 12 + Math.random() * 16;
      case 'desert':
        this.natureTone(layer, now, 4.5, 330, 330, 0.015, pan);
        this.natureTone(layer, now + 0.8, 4, 495, 495, 0.009, -pan);
        return 15 + Math.random() * 14;
      default: return 60;
    }
  }

  tick() {
    if (!this.enabled || document.hidden || !this.activeLayer) return;
    const layer = this.activeLayer, now = this.context.currentTime;
    if (now >= layer.nextChord) { this.playChord(layer); layer.nextChord = now + layer.style.interval; }
    if (now >= layer.nextEvent) layer.nextEvent = now + this.natureEvent(layer);
  }

  gesture(x, y, force = false) {
    if (!this.enabled || !this.activeLayer || document.hidden) return;
    const now = this.context.currentTime;
    if (now - this.lastNote < (force ? 0.18 : 0.9)) return;
    this.lastNote = now;
    const layer = this.activeLayer;
    const scale = layer.style.scale;
    const index = Math.max(0, Math.min(scale.length - 1, Math.floor(x * scale.length)));
    this.tone(layer, scale[index] - (this.scene === 2 ? 12 : 0), now, layer.style.instrument === 'wood' ? 2.8 : 5.5, force ? 0.075 : 0.033, (x - 0.5) * 1.4);
  }

  stopClock() { clearInterval(this.timer); this.timer = null; }
  visibility() {
    if (!this.context) return;
    clearTimeout(this.suspendTimer);
    this.setLevel();
    if (document.hidden) {
      this.stopClock();
      this.retire(this.activeLayer, 0.3);
      this.activeLayer = null;
      this.suspendTimer = setTimeout(() => { if (document.hidden) this.context.suspend(); }, 2000);
    } else if (this.enabled) {
      this.context.resume().then(() => { if (this.enabled && !document.hidden) this.activate(); }).catch(() => {});
    }
  }
}
window.STILLWATER_SOUNDSCAPES = SOUNDSCAPES;
window.StillwaterAudio = StillwaterAudio;
