(() => {
  'use strict';
  const canvas = document.querySelector('#world');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = selector => document.querySelector(selector);
  const TAU = Math.PI * 2;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sound = new window.StillwaterAudio();
  const scenes = window.STILLWATER_SCENES;
  const artwork = new window.ShapeArtwork();
  const sceneOrder = new window.SceneOrder(scenes.length);
  const sceneLayers = new Map([[0, 1]]);
  let sceneRequest = 0, switchPending = false, galleryReady = false;
  const palettes = [
    { name: 'SEA GLASS', bg: '#112d2e', ink: '#e7ede0', muted: '#9aafa6', accent: '#bad7b7', panel: 'rgba(24,48,47,.76)', colors: [[171,214,180], [108,175,174], [123,163,195], [205,209,154]] },
    { name: 'AFTERGLOW', bg: '#302735', ink: '#f0e4dd', muted: '#b6a2b4', accent: '#e4b8b1', panel: 'rgba(49,39,54,.76)', colors: [[229,178,170], [179,142,192], [138,148,202], [225,201,179]] },
    { name: 'GOLDEN HOUR', bg: '#302f26', ink: '#eee8d8', muted: '#b3ad98', accent: '#dfcca0', panel: 'rgba(48,47,36,.76)', colors: [[233,205,157], [202,163,129], [154,178,146], [224,190,151]] },
  ];
  const captions = ['THE QUIET BETWEEN WAVES', 'A SLOW KIND OF BLOOM', 'EVERYTHING FINDS ITS ORBIT'];
  const state = { scene: 0, palette: 0, pace: 0.35, paused: reducedMotion.matches, breath: false, hiddenUI: false, time: 0, realTime: 0, seed: 0, targetSeed: 0, breathTime: 0, wander: false, wanderTime: 0, wanderInterval: 45, ringVariation: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false, down: false, press: 0, pressVelocity: 0, strength: 0, lastRipple: 0, travel: 0 };
  const weights = [1, 0, 0];
  const ripples = [];
  const motes = Array.from({ length: 85 }, () => ({ x: Math.random(), y: Math.random(), phase: Math.random() * TAU, size: Math.random() * 1.1 + 0.25, speed: Math.random() * 0.6 + 0.2 }));
  const source = window.STILLWATER_RINGS;
  const ringCount = source.length * 2 - 1;
  const vertices = source[0].length;
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const lower = Math.floor(i / 2);
    const upper = Math.min(source.length - 1, Math.ceil(i / 2));
    return source[lower].map((point, j) => ({ x: (point[0] + source[upper][j][0]) / 2, y: (point[1] + source[upper][j][1]) / 2 }));
  });
  let width = 0, height = 0, centerX = 0, centerY = 0, radius = 0, dpr = 1;
  let lastFrame = 0, frameId = 0, toastTimer = 0, soundBusy = false, sceneDirty = true;
  let currentBg = hex(palettes[0].bg);
  let currentColors = palettes[0].colors.map(color => [...color]);

  function hex(value) { return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16)); }
  function rgb(color, alpha = 1) { return `rgba(${color.map(Math.round).join(',')},${alpha})`; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function blend(a, b, t) { return a.map((value, i) => mix(value, b[i], t)); }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mobile = width <= 760;
    centerX = width * (mobile ? 0.52 : 0.635);
    centerY = mobile ? Math.max(315, height * 0.515) : height * 0.455;
    radius = mobile ? Math.min(width * 0.43, (height - 280) * 0.49) : Math.min(width * 0.275, height * 0.345);
    if (mobile && height < 650) {
      centerY = height * 0.54;
      radius = Math.min(width * 0.4, (height - 390) * 0.48);
    }
    if (width > height && height < 550) {
      centerX = width * 0.67;
      centerY = height * 0.44;
      radius = Math.min(width * 0.25, height * 0.29);
    }
    radius = Math.max(radius, 80);
    $('#breath-guide').style.left = `${centerX}px`;
    $('#breath-guide').style.top = `${centerY}px`;
    sceneDirty = true;
    requestFrame();
  }

  function drawBackground() {
    ctx.fillStyle = rgb(currentBg);
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 2.1);
    glow.addColorStop(0, rgb(currentColors[0], 0.064));
    glow.addColorStop(0.45, rgb(currentColors[1], 0.035));
    glow.addColorStop(1, rgb(currentColors[1], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    const shade = ctx.createRadialGradient(width * 0.5, height * 0.45, width * 0.2, width * 0.5, height * 0.45, width * 0.8);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,.2)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
  }

  function drawMotes() {
    for (const mote of motes) {
      const x = ((mote.x * width + Math.sin(state.time * 0.06 + mote.phase) * 16) + width) % width;
      const y = ((mote.y * height - state.time * mote.speed * 0.55) % height + height) % height;
      const opacity = 0.08 + (Math.sin(state.time * 0.3 + mote.phase) + 1) * 0.1;
      ctx.fillStyle = rgb(currentColors[0], opacity);
      ctx.beginPath();
      ctx.arc(x, y, mote.size, 0, TAU);
      ctx.fill();
    }
  }

  function createPath(points) {
    ctx.beginPath();
    const last = points[points.length - 1];
    ctx.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
    for (let j = 0; j < points.length; j++) {
      const p = points[j], next = points[(j + 1) % points.length];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    }
    ctx.closePath();
  }

  function drawRings() {
    const t = state.time;
    const breathPhase = state.breathTime % 12;
    const breathing = state.breath ? (breathPhase < 4 ? Math.sin(breathPhase / 4 * Math.PI / 2) : breathPhase < 6 ? 1 : (1 + Math.cos((breathPhase - 6) / 6 * Math.PI)) / 2) : (Math.sin(t * 0.25) + 1) * 0.25;
    const scale = radius * (0.96 + breathing * 0.055);
    const rotation = -0.22 + Math.sin(t * 0.055) * 0.15 + state.seed * 0.4;
    const cosRot = Math.cos(rotation), sinRot = Math.sin(rotation);
    const points = new Array(vertices);
    const localPointer = { x: (pointer.sx - centerX) / scale, y: (pointer.sy - centerY) / scale };
    for (let i = 0; i < rings.length; i++) {
      const ratio = i / (rings.length - 1);
      const ring = rings[i];
      const orbitRotation = ratio * Math.PI * 0.7 + t * 0.04;
      const orbitCos = Math.cos(orbitRotation), orbitSin = Math.sin(orbitRotation);
      for (let j = 0; j < vertices; j++) {
        const base = ring[j];
        const theta = Math.atan2(base.y, base.x);
        const originalRadius = Math.hypot(base.x, base.y);
        const r = (originalRadius - 0.4) * 1.18 + 0.29;
        const wave = 0.025 * Math.sin(theta * 3 + t * 0.26 + ratio * 4 + state.seed) + 0.014 * Math.cos(theta * 5 - t * 0.18 + ratio * 5);
        const bend = theta + Math.sin(t * 0.12 + ratio * 2.8) * 0.08;
        const tideX = Math.cos(bend) * (r + wave) * 1.075;
        const tideY = Math.sin(bend) * (r + wave) * 0.91;
        const petal = 1 + 0.14 * Math.cos(theta * 5 + t * 0.08 + ratio * 2.2);
        const bloomX = Math.cos(bend + ratio * 0.16) * (r + wave) * petal;
        const bloomY = Math.sin(bend + ratio * 0.16) * (r + wave) * petal;
        const orbitX = Math.cos(theta + t * 0.045) * (r + wave) * 1.1;
        const orbitY = Math.sin(theta + t * 0.045) * (r + wave) * (0.34 + 0.15 * Math.sin(ratio * Math.PI));
        let x = tideX * weights[0] + bloomX * weights[1] + (orbitX * orbitCos - orbitY * orbitSin) * weights[2];
        let y = tideY * weights[0] + bloomY * weights[1] + (orbitX * orbitSin + orbitY * orbitCos) * weights[2];
        const rotatedX = x * cosRot - y * sinRot;
        y = x * sinRot + y * cosRot;
        x = rotatedX;
        if (pointer.strength > 0.001) {
          const dx = localPointer.x - x, dy = localPointer.y - y;
          const distance = dx * dx + dy * dy;
          const influence = Math.exp(-distance * mix(3.5, 1.5, pointer.press)) * pointer.strength;
          const attraction = mix(-0.15, 0.4, pointer.press);
          x += (dx * attraction - dy * 0.09) * influence;
          y += (dy * attraction + dx * 0.09) * influence;
        }
        x = centerX + x * scale;
        y = centerY + y * scale;
        for (const ripple of ripples) {
          const dx = x - ripple.x * width, dy = y - ripple.y * height;
          const distance = Math.hypot(dx, dy) || 1;
          const age = state.realTime - ripple.born;
          const front = age * 105;
          const envelope = Math.exp(-Math.pow((distance - front) / 48, 2)) * Math.exp(-age * 0.65);
          const push = Math.sin((distance - front) * 0.05) * envelope * ripple.force;
          x += dx / distance * push;
          y += dy / distance * push;
        }
        points[j] = { x, y };
      }
      const c1 = blend(currentColors[0], currentColors[3], ratio * 0.75);
      const c2 = blend(currentColors[1], currentColors[2], ratio);
      const opacity = 0.42 + Math.sin(ratio * Math.PI) * 0.23;
      const gradient = ctx.createLinearGradient(centerX - scale, centerY - scale, centerX + scale * 0.8, centerY + scale);
      gradient.addColorStop(0, rgb(c1, opacity + 0.13));
      gradient.addColorStop(0.48, rgb(currentColors[1], opacity * 0.65));
      gradient.addColorStop(1, rgb(c2, opacity));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width <= 760 ? 0.65 : 0.8;
      createPath(points);
      ctx.stroke();
      if (i % 15 === 0) {
        ctx.strokeStyle = rgb(c1, 0.022);
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
    // Fine lights trace the same current, without obscuring the line artwork.
    for (let i = 0; i < 8; i++) {
      const angle = t * (0.035 + i * 0.001) + i * 2.399;
      const r = scale * (0.37 + (i % 5) * 0.13);
      const x = centerX + Math.cos(angle + rotation) * r * 1.04;
      const y = centerY + Math.sin(angle + rotation) * r * 0.9;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 5);
      gradient.addColorStop(0, rgb(currentColors[0], 0.55));
      gradient.addColorStop(0.2, rgb(currentColors[0], 0.2));
      gradient.addColorStop(1, rgb(currentColors[0], 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
  }

  function drawRipples() {
    for (const ripple of ripples) {
      const age = state.realTime - ripple.born;
      const opacity = Math.max(0, 0.17 * (1 - age / 3));
      if (opacity <= 0) continue;
      ctx.strokeStyle = rgb(currentColors[0], opacity);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(ripple.x * width, ripple.y * height, 8 + age * 105, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgb(currentColors[0], opacity * 0.3);
      ctx.beginPath();
      ctx.arc(ripple.x * width, ripple.y * height, 4 + age * 89, 0, TAU);
      ctx.stroke();
    }
  }

  function updateBreath() {
    if (!state.breath) return;
    const phase = state.breathTime % 12;
    const label = phase < 4 ? 'breathe in' : phase < 6 ? 'be still' : 'breathe out';
    const count = Math.ceil(phase < 4 ? 4 - phase : phase < 6 ? 6 - phase : 12 - phase);
    $('#breath-word').textContent = label;
    $('#breath-count').textContent = String(count);
  }

  function frame(now) {
    frameId = 0;
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05);
    lastFrame = now;
    const moving = !state.paused;
    if (moving) {
      state.time += dt * (0.12 + state.pace * 1.8);
      state.realTime += dt;
      state.breathTime += dt;
    }
    const lerp = 1 - Math.exp(-dt * 3);
    state.seed = mix(state.seed, state.targetSeed, lerp * 0.35);
    weights.forEach((weight, i) => { weights[i] = mix(weight, i === state.ringVariation ? 1 : 0, lerp); });
    for (const [index, opacity] of sceneLayers) {
      const next = mix(opacity, index === state.scene ? 1 : 0, 1 - Math.exp(-dt * 1.6));
      if (next < 0.001 && index !== state.scene) sceneLayers.delete(index);
      else sceneLayers.set(index, next);
    }
    const palette = palettes[state.palette];
    currentBg = blend(currentBg, hex(palette.bg), lerp * 0.45);
    currentColors = currentColors.map((color, i) => blend(color, palette.colors[i], lerp * 0.45));
    pointer.sx = mix(pointer.sx, pointer.x, lerp * 1.6);
    pointer.sy = mix(pointer.sy, pointer.y, lerp * 1.6);
    pointer.strength = mix(pointer.strength, pointer.active ? 1 : 0, lerp);
    const press = window.advancePress(pointer.press, pointer.pressVelocity, pointer.down, dt);
    pointer.press = press.pressure;
    pointer.pressVelocity = press.velocity;
    while (ripples.length && state.realTime - ripples[0].born > 5) ripples.shift();
    if (pointer.down && moving && state.realTime - pointer.lastRipple > 0.75) {
      addRipple(pointer.x, pointer.y, 12);
      sound.gesture(pointer.x / width, pointer.y / height);
    }
    drawBackground();
    drawMotes();
    drawArtwork();
    drawRipples();
    updateBreath();
    updateWander(dt, moving);
    if (!document.hidden && (moving || sceneDirty)) requestFrame();
    sceneDirty = false;
  }

  function requestFrame() {
    if (!frameId && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function drawArtwork() {
    let ringOpacity = 0;
    for (const [index, opacity] of sceneLayers) {
      if (scenes[index].kind === 'rings') { ringOpacity += opacity; continue; }
      ctx.save();
      ctx.globalAlpha = opacity * 0.82;
      artwork.draw(ctx, scenes[index], { x: centerX, y: centerY, radius, width, height, colors: currentColors, time: state.time, realTime: state.realTime, seed: state.seed, pointer, ripples });
      ctx.restore();
    }
    if (ringOpacity > 0.001) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ringOpacity);
      drawRings();
      ctx.restore();
    }
  }

  function updateWander(dt, moving) {
    if (!state.wander) return;
    if (moving && !pointer.down && !document.querySelector('dialog[open]') && !switchPending) state.wanderTime += dt;
    const remaining = Math.max(0, Math.ceil(state.wanderInterval - state.wanderTime));
    const label = state.paused ? 'paused' : `${remaining}s`;
    if ($('#wander-countdown').textContent !== label) $('#wander-countdown').textContent = label;
    if (state.wanderTime >= state.wanderInterval) { state.wanderTime = 0; randomScene(); }
  }

  function toggleWander() {
    state.wander = !state.wander;
    state.wanderTime = 0;
    $('#wander-toggle').setAttribute('aria-pressed', String(state.wander));
    $('#wander-label').textContent = state.wander ? 'Wandering' : 'Let it wander';
    $('.controls').classList.toggle('wander-active', state.wander);
    $('#wander-countdown').textContent = '';
    if (state.wander) {
      if (state.paused) { state.paused = false; syncPause(); }
      toast(`A new shape every ${state.wanderInterval} seconds. No repeats until the whole collection passes.`);
      randomScene();
    }
    animateChange();
  }

  function randomScene() { return selectScene(sceneOrder.next(state.scene)); }

  function animateChange() {
    // Controls remain usable while motion is paused.
    sceneDirty = true;
    if (state.paused) {
      weights.forEach((_, i) => { weights[i] = i === state.ringVariation ? 1 : 0; });
      sceneLayers.clear();
      sceneLayers.set(state.scene, 1);
      currentBg = hex(palettes[state.palette].bg);
      currentColors = palettes[state.palette].colors.map(color => [...color]);
      state.seed = state.targetSeed;
    }
    requestFrame();
  }

  function addRipple(x, y, force = 28) {
    if (state.paused) return;
    ripples.push({ x: x / width, y: y / height, born: state.realTime, force });
    if (ripples.length > 12) ripples.shift();
    pointer.lastRipple = state.realTime;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
  }

  async function selectScene(index) {
    if (!scenes[index]) return false;
    const request = ++sceneRequest;
    switchPending = true;
    $('#shape-picker').setAttribute('aria-busy', 'true');
    try {
      await artwork.load(scenes[index]);
    } catch {
      if (request === sceneRequest) { toast('That shape could not load. Try another from the gallery.'); switchPending = false; $('#shape-picker').removeAttribute('aria-busy'); }
      return false;
    }
    if (request !== sceneRequest) return false;
    switchPending = false;
    $('#shape-picker').removeAttribute('aria-busy');
    state.scene = index;
    state.wanderTime = 0;
    sceneOrder.visit(index);
    if (scenes[index].kind === 'rings') state.ringVariation = scenes[index].variation;
    sound.scene = scenes[index].variation ?? 0;
    if (!sceneLayers.has(index)) sceneLayers.set(index, 0);
    artwork.trim([...sceneLayers.keys()].map(i => scenes[i].id));
    document.querySelectorAll('[data-scene]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.scene) === index));
    });
    $('#scene-number').textContent = String(index + 1).padStart(2, '0');
    $('#scene-caption').textContent = captions[index] || scenes[index].name.toUpperCase();
    $('#shape-label').textContent = scenes[index].name;
    $('#shape-picker').title = `${scenes[index].name} · Explore all ${scenes.length} scenes`;
    $('#shape-credit').href = scenes[index].source;
    animateChange();
    save();
    return true;
  }

  function selectPalette(index) {
    state.palette = index;
    const palette = palettes[index];
    for (const key of ['bg', 'ink', 'muted', 'accent', 'panel']) document.documentElement.style.setProperty(`--${key}`, palette[key]);
    $('meta[name="theme-color"]').content = palette.bg;
    document.querySelectorAll('[data-palette]').forEach((button, i) => {
      button.classList.toggle('selected', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
    $('#palette-label').textContent = palette.name;
    animateChange();
    save();
  }

  function togglePause() {
    state.paused = !state.paused;
    syncPause();
    lastFrame = 0;
    animateChange();
  }

  function syncPause() {
    for (const id of ['#pause', '#mobile-pause']) {
      const button = $(id);
      button.setAttribute('aria-pressed', String(state.paused));
      button.setAttribute('aria-label', state.paused ? 'Resume motion' : 'Pause motion');
      button.title = `${state.paused ? 'Resume' : 'Pause'} motion (Space)`;
      button.querySelector('svg').innerHTML = state.paused ? '<path d="m9 5 10 7-10 7Z"/>' : '<path d="M9 6v12M15 6v12"/>';
    }
    document.body.classList.toggle('paused', state.paused);
  }

  function toggleBreath() {
    state.breath = !state.breath;
    state.breathTime = 0;
    if (state.breath && state.paused) { state.paused = false; syncPause(); }
    $('#breath-toggle').setAttribute('aria-pressed', String(state.breath));
    $('#breath-label').textContent = state.breath ? 'Back to wandering' : 'Take a breath';
    $('#breath-guide').classList.toggle('visible', state.breath);
    $('#breath-guide').setAttribute('aria-hidden', String(!state.breath));
    if (state.breath) toast('Breathe in for 4. Rest for 2. Breathe out for 6.');
    animateChange();
  }

  async function toggleSound() {
    if (soundBusy) return;
    soundBusy = true;
    try {
      const enabled = await sound.toggle();
      syncSound();
      if (enabled) toast('A soft soundtrack, composed as you wander.');
    } catch {
      toast('Sound could not start. Try the sound button again.');
    } finally { soundBusy = false; }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('Full screen is not available in this browser.');
    } catch { toast('Full screen is not available in this view.'); }
  }

  function hideUI() {
    state.hiddenUI = !state.hiddenUI;
    document.body.classList.toggle('immersive', state.hiddenUI);
    document.querySelectorAll('.ui').forEach(element => { element.inert = state.hiddenUI; });
    if (state.hiddenUI) $('#show-ui').focus();
    else canvas.focus({ preventScroll: true });
  }

  function save() {
    try { localStorage.setItem('stillwater-preferences', JSON.stringify({ scene: state.scene, shape: scenes[state.scene].id, palette: state.palette, pace: state.pace, volume: sound.volume, soundscape: sound.soundscape, musicLevel: sound.musicLevel, natureLevel: sound.natureLevel, wanderInterval: state.wanderInterval })); } catch { /* Private browsing can disable storage. */ }
  }

  function updatePace() {
    const value = Number($('#motion').value);
    state.pace = value / 100;
    const label = value < 20 ? 'almost still' : value < 55 ? 'unhurried' : value < 80 ? 'flowing' : 'playful';
    $('#pace-label').textContent = label;
    $('#motion').setAttribute('aria-valuetext', label);
    $('#motion').style.background = `linear-gradient(to right,var(--accent) ${value}%,var(--line) ${value}%)`;
    save();
  }

  function openGallery() {
    if (!galleryReady) {
      const fragment = document.createDocumentFragment();
      scenes.forEach((scene, index) => {
        const button = document.createElement('button');
        button.className = 'shape-card';
        button.dataset.scene = index;
        button.setAttribute('aria-pressed', String(index === state.scene));
        button.setAttribute('aria-label', scene.name);
        const image = document.createElement('img');
        image.src = scene.thumb || scene.art;
        image.alt = '';
        image.loading = 'lazy';
        const label = document.createElement('span');
        label.textContent = scene.name;
        button.append(image, label);
        if (index < 3) { const badge = document.createElement('small'); badge.textContent = 'ORIGINAL'; button.append(badge); }
        button.addEventListener('click', async () => { if (await selectScene(index)) $('#shape-dialog').close(); });
        fragment.append(button);
      });
      $('#shape-gallery').append(fragment);
      $('#collection-description').textContent = `${scenes.length} scenes, including the original three. Find one you love, or leave the next discovery to chance.`;
      galleryReady = true;
    }
    $('#shape-dialog').showModal();
  }

  function syncSound() {
    const style = window.STILLWATER_SOUNDSCAPES.find(item => item.id === sound.soundscape);
    $('#sound-toggle').setAttribute('aria-pressed', String(sound.enabled));
    $('#sound-label').textContent = sound.enabled ? style.name : 'Sound off';
    $('#sound-toggle').title = `${sound.enabled ? 'Mute' : 'Play'} ${style.name} (M)`;
    $('#sound-dialog-toggle').textContent = sound.enabled ? 'Turn sound off' : 'Turn sound on ↗';
    $('#soundscape-note').textContent = sound.soundscape === 'stillwater' ? 'The original floating chords. Choose another place for nature sounds.' : 'Music and surroundings are synthesized in your browser.';
    document.querySelectorAll('[data-soundscape]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.soundscape === sound.soundscape)));
    const sliders = [['#music-mix', sound.musicLevel], ['#nature-mix', sound.natureLevel], ['#sound-volume', sound.volume], ['#volume', sound.volume]];
    for (const [selector, value] of sliders) {
      const input = $(selector);
      input.value = Math.round(value * 100);
      input.style.background = `linear-gradient(to right,var(--accent) ${value * 100}%,var(--line) ${value * 100}%)`;
      const output = $(`${selector}-value`);
      if (output) output.textContent = `${Math.round(value * 100)}%`;
    }
    $('#nature-mix').disabled = sound.soundscape === 'stillwater';
  }

  function buildSoundscapes() {
    for (const style of window.STILLWATER_SOUNDSCAPES) {
      const button = document.createElement('button');
      button.className = 'soundscape-card';
      button.dataset.soundscape = style.id;
      button.setAttribute('aria-pressed', String(style.id === sound.soundscape));
      button.innerHTML = `<span class="soundscape-symbol" aria-hidden="true">${style.symbol}</span><span class="soundscape-text"><strong>${style.name}</strong><small>${style.detail}</small></span><span class="soundscape-selected" aria-hidden="true"></span>`;
      button.addEventListener('click', () => { sound.setSoundscape(style.id); syncSound(); save(); });
      $('#soundscape-list').append(button);
    }
  }

  canvas.addEventListener('pointermove', event => {
    if (!event.isPrimary) return;
    pointer.travel += Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!pointer.active) { pointer.sx = pointer.x; pointer.sy = pointer.y; }
    pointer.active = true;
    const cursor = $('#cursor');
    cursor.style.left = `${pointer.x}px`;
    cursor.style.top = `${pointer.y}px`;
    cursor.classList.add('active');
    if (pointer.travel > 75) { sound.gesture(pointer.x / width, pointer.y / height); pointer.travel = 0; }
    if (!state.paused) requestFrame();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!pointer.active) { pointer.sx = pointer.x; pointer.sy = pointer.y; }
    pointer.active = pointer.down = true;
    canvas.setPointerCapture(event.pointerId);
    $('#cursor').classList.add('held');
    addRipple(pointer.x, pointer.y);
    sound.gesture(pointer.x / width, pointer.y / height, true);
    if (state.paused) toast('Motion is paused. Press Space to let it flow.');
  });
  function release(event) {
    pointer.down = false;
    $('#cursor').classList.remove('held');
    if (event.pointerType === 'touch') pointer.active = false;
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerleave', () => {
    if (!pointer.down) pointer.active = false;
    $('#cursor').classList.remove('active');
  });
  window.addEventListener('blur', () => { pointer.down = false; pointer.active = false; $('#cursor').classList.remove('active', 'held'); });
  $('#shape-picker').addEventListener('click', openGallery);
  $('#shape-close').addEventListener('click', () => $('#shape-dialog').close());
  $('#shape-search').addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.shape-card').forEach(button => {
      button.hidden = !scenes[Number(button.dataset.scene)].name.toLowerCase().includes(query);
      if (!button.hidden) visible++;
    });
    $('#no-shapes').hidden = visible > 0;
  });
  $('#previous-shape').addEventListener('click', () => selectScene((state.scene + scenes.length - 1) % scenes.length));
  $('#next-shape').addEventListener('click', () => selectScene((state.scene + 1) % scenes.length));
  $('#gallery-shuffle').addEventListener('click', async () => { if (await randomScene()) $('#shape-dialog').close(); });
  $('#wander-toggle').addEventListener('click', toggleWander);
  $('#wander-interval').addEventListener('change', event => { state.wanderInterval = Number(event.target.value); state.wanderTime = 0; save(); });
  document.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => selectPalette(Number(button.dataset.palette))));
  $('#sound-toggle').addEventListener('click', toggleSound);
  $('#soundscape-toggle').addEventListener('click', () => $('#sound-dialog').showModal());
  $('#sound-close').addEventListener('click', () => $('#sound-dialog').close());
  $('#sound-dialog-toggle').addEventListener('click', toggleSound);
  $('#pause').addEventListener('click', togglePause);
  $('#mobile-pause').addEventListener('click', togglePause);
  $('#breath-toggle').addEventListener('click', toggleBreath);
  $('#fullscreen').addEventListener('click', toggleFullscreen);
  $('#show-ui').addEventListener('click', hideUI);
  $('#shuffle').addEventListener('click', randomScene);
  $('#motion').addEventListener('input', updatePace);
  $('#volume').addEventListener('input', event => {
    sound.setVolume(Number(event.target.value) / 100);
    syncSound();
    save();
  });
  $('#sound-volume').addEventListener('input', event => { sound.setVolume(Number(event.target.value) / 100); syncSound(); save(); });
  for (const selector of ['#music-mix', '#nature-mix']) $(selector).addEventListener('input', () => {
    sound.setMix(Number($('#music-mix').value) / 100, Number($('#nature-mix').value) / 100);
    syncSound();
    save();
  });
  $('#help-toggle').addEventListener('click', () => $('#help-dialog').showModal());
  $('#help-close').addEventListener('click', () => $('#help-dialog').close());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  }));
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && event.target.matches('button, a')) return;
    if (key === ' ') { event.preventDefault(); togglePause(); }
    else if (key === 'm') toggleSound();
    else if (key === 'b') toggleBreath();
    else if (key === 'h') hideUI();
    else if (key === 'f') toggleFullscreen();
    else if (key === 'r') $('#shuffle').click();
    else if (key === 'w') toggleWander();
    else if (['1', '2', '3'].includes(key)) selectScene(Number(key) - 1);
    else if (key === '?') $('#help-dialog').showModal();
    else if (key === 'escape' && state.hiddenUI) hideUI();
  });
  document.addEventListener('fullscreenchange', () => $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'));
  document.addEventListener('visibilitychange', () => {
    sound.visibility();
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; pointer.down = false; }
    else { lastFrame = 0; animateChange(); }
  });
  reducedMotion.addEventListener('change', event => { state.paused = event.matches; syncPause(); animateChange(); });
  window.addEventListener('resize', resize);

  try {
    const saved = JSON.parse(localStorage.getItem('stillwater-preferences'));
    if (saved) {
      const savedScene = saved.shape ? scenes.findIndex(scene => scene.id === saved.shape) : saved.scene;
      if (Number.isInteger(savedScene) && savedScene >= 0 && savedScene < scenes.length) selectScene(savedScene);
      if (Number.isInteger(saved.palette) && saved.palette >= 0 && saved.palette < 3) selectPalette(saved.palette);
      if (Number.isFinite(saved.pace)) $('#motion').value = Math.max(0, Math.min(100, saved.pace * 100));
      if (Number.isFinite(saved.volume)) { sound.volume = Math.max(0, Math.min(1, saved.volume)); $('#volume').value = sound.volume * 100; }
      if (window.STILLWATER_SOUNDSCAPES.some(item => item.id === saved.soundscape)) sound.setSoundscape(saved.soundscape);
      if (Number.isFinite(saved.musicLevel)) sound.musicLevel = Math.max(0, Math.min(1, saved.musicLevel));
      if (Number.isFinite(saved.natureLevel)) sound.natureLevel = Math.max(0, Math.min(1, saved.natureLevel));
      if ([20, 45, 90].includes(saved.wanderInterval)) { state.wanderInterval = saved.wanderInterval; $('#wander-interval').value = saved.wanderInterval; }
    }
  } catch { /* Default to the quiet first scene. */ }
  updatePace();
  buildSoundscapes();
  syncSound();
  syncPause();
  resize();
  if (reducedMotion.matches) toast('Motion starts paused to follow your preference.');
})();
