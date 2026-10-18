(function () {
'use strict';
/* Shared CODEF presentation, indexed ST graphics and PAL clock. */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mod = (x, n) => ((x % n) + n) % n;
const word = x => (x << 16) >> 16;
const u16 = (b, at = 0) => (b[at] << 8) | b[at + 1];
const s16 = (b, at = 0) => word(u16(b, at));
const u32 = (b, at = 0) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const s32 = (b, at = 0) => u32(b, at) | 0;
function put16(b, at, v) { b[at] = v >>> 8; b[at + 1] = v; }
function put32(b, at, v) { b[at] = v >>> 24; b[at + 1] = v >>> 16; b[at + 2] = v >>> 8; b[at + 3] = v; }
const stColor = w => (0xff000000 | ((w & 7) * 34 << 16) | ((w >> 4 & 7) * 34 << 8) | (w >> 8 & 7) * 34) >>> 0;
const palette = b => Array.from({length: b.length / 2}, (_, i) => stColor(u16(b, i * 2)));
const words = b => Array.from({length: b.length / 2}, (_, i) => u16(b, i * 2));
const indexAt = (p, at) => Math.round(p[at] / 17);

class Assets {
  constructor(base = './assets/') { this.base = base; this.cache = new Map(); }
  async bytes(name) {
    const key = `bytes:${name}`;
    if (!this.cache.has(key)) this.cache.set(key, (async () => {
      if (window.CODEF_ASSETS?.[name]) return Uint8Array.from(atob(window.CODEF_ASSETS[name]), c => c.charCodeAt(0));
      const r = await fetch(this.base + name);
      if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    })());
    return this.cache.get(key);
  }
  async text(name) { return new TextDecoder('latin1').decode(await this.bytes(name)); }
  async json(name) { return JSON.parse(await this.text(name)); }
  async image(name) {
    const key = `image:${name}`;
    if (!this.cache.has(key)) this.cache.set(key, new Promise((resolve, reject) => {
      const url = window.CODEF_ASSETS?.[name] ? `data:image/png;base64,${window.CODEF_ASSETS[name]}` : this.base + name;
      const source = new window.image(url);
      source.img.onload = () => {
        const layer = new Layer(source.img.width, source.img.height);
        source.draw(layer.codef, 0, 0);
        resolve({source, width: source.img.width, height: source.img.height, data: layer.pixels()});
      };
      source.img.onerror = () => reject(new Error(`Image not found: ${name}`));
    }));
    return this.cache.get(key);
  }
}

class Layer {
  constructor(width = 320, height = 200, destination) {
    this.width = width; this.height = height;
    this.codef = new window.canvas(width, height, destination);
    this.codef.canvas.removeAttribute('id');
    this.codef.contex.imageSmoothingEnabled = false;
    this.source = this.codef;
    this.data = null;
    this.upload = this.codef.contex.createImageData(width, height);
    this.rgba = new Uint32Array(this.upload.data.buffer);
  }
  clear() { this.codef.clear(); this.data = null; }
  fill(value = 0) { this.codef.fill(`rgb(${value * 17},0,0)`); this.data = null; }
  rect(x, y, w, h, value = 0) {
    this.codef.contex.fillStyle = `rgb(${value * 17},0,0)`;
    this.codef.contex.fillRect(x, y, w, h); this.data = null;
  }
  blit(im, x = 0, y = 0, sx = 0, sy = 0, w = im.width, h = im.height) {
    im.source.drawPart(this.codef, x, y, sx, sy, w, h);
    this.data = null;
  }
  copy(im, x = 0, y = 0, sx = 0, sy = 0, w = im.width, h = im.height) {
    this.codef.contex.clearRect(x, y, w, h);
    this.blit(im, x, y, sx, sy, w, h);
  }
  pixels() { return this.data ??= this.codef.contex.getImageData(0, 0, this.width, this.height).data; }
  indices(values, transparent = false) {
    for (let i = 0; i < values.length; i++) this.rgba[i] = (!transparent || values[i] ? 0xff000000 : 0) | values[i] * 17;
    this.codef.contex.putImageData(this.upload, 0, 0); this.data = null;
  }
  planar(bytes, planes = 4, stride = this.width / 16 * planes * 2) {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let v = 0;
      const at = y * stride + (x >> 4) * planes * 2;
      for (let p = 0; p < planes; p++) v |= (u16(bytes, at + p * 2) >> (15 - x % 16) & 1) << p;
      this.rgba[y * this.width + x] = 0xff000000 | v * 17;
    }
    this.codef.contex.putImageData(this.upload, 0, 0); this.data = null;
  }
  paint(fn) {
    for (let y = 0, i = 0; y < this.height; y++) for (let x = 0; x < this.width; x++, i++) this.rgba[i] = fn(x, y, i * 4, i);
    this.codef.contex.putImageData(this.upload, 0, 0); this.data = null;
  }
}

// Eight-pixel transport used by the native fonts. Controls consume no slice.
class SliceStream {
  constructor(tokens, capacity, {loopStart = 0} = {}) {
    this.tokens = tokens; this.capacity = capacity; this.loopStart = loopStart;
    this.slices = Array.from({length: capacity}, () => ({glyph: -1, slice: 0}));
    this.cursor = 0; this.slice = 0;
  }
  step(onControl = () => {}) {
    for (let guard = 0; guard <= this.tokens.length; guard++) {
      if (this.cursor >= this.tokens.length) this.cursor = this.loopStart;
      const t = this.tokens[this.cursor];
      if (t.control) { onControl(t.control); this.cursor++; continue; }
      this.slices.shift(); this.slices.push({glyph: t.glyph, slice: this.slice});
      this.slice++;
      if (this.slice * 8 >= (t.width ?? 32)) { this.cursor++; this.slice = 0; }
      return;
    }
    throw new Error('Le message ne contient aucune tranche graphique.');
  }
  draw(layer, atlas, position, {columns = 96, glyphWidth = 32, glyphHeight = 16, x = 0, y = 0} = {}) {
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slices[i];
      if (s.glyph < 0) continue;
      const p = position ? position(i) : {x: x + i * 8, y};
      layer.blit(atlas, p.x, p.y, s.glyph % columns * glyphWidth + s.slice * 8, Math.floor(s.glyph / columns) * glyphHeight, 8, glyphHeight);
    }
  }
}

function binaryString(bytes) {
  let result = '';
  for (let at = 0; at < bytes.length; at += 8192) result += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return result;
}

class Soundtrack {
  constructor(assets) { this.assets = assets; this.tick = 0; this.muted = true; this.running = false; this.generation = 0; }
  async select(file) {
    const generation = ++this.generation;
    const bytes = await this.assets.bytes(file);
    const data = new window.dataType(); data.data = binaryString(bytes);
    const song = new window.YmSong(new window.LHa().unpack(data));
    if (!song.supported || !song.length) throw new Error(`Unsupported YM music: ${file}`);
    if (generation !== this.generation) return;
    this.binary = data.data; this.song = song; this.file = file; this.tick = 0;
    if (this.player) {
      data.pos = 0;
      this.player.loader.player.load(data);
      this.player.loader.player.reset();
      await this.sync();
    }
  }
  registers() {
    if (!this.song) return new Uint8Array(16);
    let frame = Math.floor(this.tick * this.song.rate / 50);
    if (frame >= this.song.length) frame = this.song.restart + mod(frame - this.song.length, this.song.length - this.song.restart);
    return Uint8Array.from(this.song.frames[frame], c => c.charCodeAt(0));
  }
  async enable() {
    this.muted = false;
    if (!this.player) {
      this.player = new window.music('YM');
      const data = new window.dataType(); data.data = this.binary;
      this.player.loader.player.load(data); this.player.loader.player.reset();
      this.player.loader.player.frame = Math.min(this.song.length - 1, Math.floor(this.tick * this.song.rate / 50));
    }
    await this.sync();
  }
  async sync() {
    if (!this.player) return;
    const context = window.CODEF_AUDIO_CONTEXT;
    if (this.muted || !this.running) await context.suspend(); else await context.resume();
  }
  async toggle() { if (this.muted) await this.enable(); else { this.muted = true; await this.sync(); } }
}

async function boot(config, createScene) {
  const assets = new Assets(document.body.dataset.assets ?? './assets/');
  const screen = new Layer(config.width ?? 320, config.height ?? 200, 'screen');
  screen.codef.canvas.setAttribute('aria-label', config.title);
  const sound = new Soundtrack(assets);
  const input = {keys: new Set(), x: 160, y: 100, moved: false, dx: 0};
  const status = document.querySelector('#status');
  let scene, paused = false, failed = false, accumulator = 0, previous = 0, tick = 0;
  const fail = error => { failed = true; status.textContent = `Error: ${error.message}`; console.error(error); };
  try {
    await sound.select(config.music ?? 'music.ym');
    scene = await createScene({assets, screen, sound, input});
  } catch (error) { fail(error); return; }
  status.textContent = config.controls;
  const update = () => {
    scene.update?.();
    if (scene.started !== false) sound.tick++;
    input.dx = 0; tick++;
  };
  const render = () => scene.render();
  const parameters = new URLSearchParams(location.search);
  if (parameters.has('start')) scene.start?.();
  const initialTick = clamp(Number(parameters.get('tick')) || 0, 0, 100000);
  for (let i = 0; i < initialTick; i++) update();
  render();
  paused = parameters.has('paused');
  const audioButton = document.querySelector('#sound');
  const refreshAudioLabel = () => { audioButton.textContent = sound.muted ? 'Enable sound' : 'Mute sound'; audioButton.setAttribute('aria-pressed', String(!sound.muted)); };
  const setRunning = () => { sound.running = !paused && !document.hidden && scene.started !== false; sound.sync().catch(fail); };
  function pause(value) { paused = value; accumulator = 0; document.querySelector('#pause').textContent = paused ? 'Resume' : 'Pause'; setRunning(); }
  document.querySelector('#pause').onclick = () => pause(!paused);
  audioButton.onclick = async () => { try { setRunning(); await sound.toggle(); refreshAudioLabel(); } catch (e) { fail(e); } };
  document.querySelector('#fullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('#screen').requestFullscreen(); } catch (e) { status.textContent = e.message; }
  };
  window.addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    input.keys.add(e.code);
    if (/^(Arrow|F\d)/.test(e.code) || ['Space', 'Enter'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyM') { sound.toggle().then(refreshAudioLabel).catch(fail); }
    else if (e.code === 'KeyP' || e.code === 'Escape' || (e.code === 'Space' && scene.started !== false)) pause(!paused);
    else { scene.key?.(e.code); setRunning(); }
  });
  window.addEventListener('keyup', e => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  const canvas = screen.codef.canvas;
  canvas.addEventListener('pointermove', e => {
    const bounds = canvas.getBoundingClientRect();
    const x = clamp((e.clientX - bounds.left) * screen.width / bounds.width, 0, screen.width - 1);
    input.dx += input.moved ? Math.round(x) - input.x : 0;
    input.x = Math.round(x); input.y = Math.round((e.clientY - bounds.top) * screen.height / bounds.height); input.moved = true;
    scene.pointer?.(input.x, input.y, e.pointerType);
  });
  canvas.addEventListener('pointerleave', () => { input.moved = false; });
  canvas.addEventListener('pointerdown', e => {
    const bounds = canvas.getBoundingClientRect();
    const x = (e.clientX - bounds.left) * screen.width / bounds.width;
    const y = (e.clientY - bounds.top) * screen.height / bounds.height;
    scene.click?.(x, y, e.pointerType); setRunning();
  });
  document.addEventListener('visibilitychange', () => { previous = 0; accumulator = 0; setRunning(); });
  // A deterministic interface supports complete-scene browser checks and capture.
  window.demo = {scene, screen, sound, input, get tick() { return tick; }, get paused() { return paused; },
    pause, advance(count = 1) { for (let i = 0; i < count; i++) update(); render(); },
    render, ready: true, config};
  function loop(now) {
    if (failed) return;
    if (!previous) previous = now;
    if (!paused && !document.hidden) {
      accumulator += Math.min(250, now - previous);
      while (accumulator >= 20) { update(); accumulator -= 20; }
      render();
    }
    previous = now;
    window.requestAnimFrame(loop);
  }
  setRunning(); refreshAudioLabel();
  window.requestAnimFrame(loop);
}

Object.assign(window.CODEFDemo ||= {}, {clamp, mod, word, u16, s16, u32, s32, put16, put32, stColor, palette, words, indexAt, Assets, Layer, SliceStream, Soundtrack, boot});
})();
