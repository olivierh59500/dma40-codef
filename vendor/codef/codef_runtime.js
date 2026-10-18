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
const PLANAR_PAIRS = (() => {
  const result = new Uint32Array(65536);
  for (let first = 0; first < 256; first++) for (let second = 0; second < 256; second++) {
    let packed = 0;
    for (let pixel = 0; pixel < 8; pixel++) packed |= ((first >> (7 - pixel) & 1) | (second >> (7 - pixel) & 1) << 1) << (pixel * 4);
    result[first << 8 | second] = packed >>> 0;
  }
  return result;
})();

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
    this.commit();
  }
  commit() { this.codef.contex.putImageData(this.upload, 0, 0); this.data = null; }
}

function indexedPixels(image) {
  if (image instanceof IndexedLayer) return image.data;
  if (!image.indexedData) {
    const result = new Uint8Array(image.width * image.height);
    const alpha = new Uint8Array(result.length);
    let opaque = true, binaryAlpha = true;
    for (let index = 0, at = 0; index < result.length; index++, at += 4) {
      result[index] = Math.round(image.data[at] / 17);
      alpha[index] = image.data[at + 3];
      if (alpha[index] !== 255) opaque = false;
      if (alpha[index] !== 0 && alpha[index] !== 255) binaryAlpha = false;
    }
    image.indexedData = result;
    image.indexedAlpha = alpha;
    image.indexedOpaque = opaque;
    image.indexedBinaryAlpha = binaryAlpha;
    if (binaryAlpha && !opaque) {
      image.indexedRuns = Array.from({length: image.height}, (_, row) => {
        const runs = [];
        const start = row * image.width, end = start + image.width;
        for (let pixel = start; pixel < end;) {
          while (pixel < end && alpha[pixel] === 0) pixel++;
          const left = pixel - start;
          while (pixel < end && alpha[pixel] === 255) pixel++;
          if (pixel > start + left) runs.push(left, pixel - start);
        }
        return runs;
      });
    }
  }
  return image.indexedData;
}

function indexedAlpha(image) {
  if (image instanceof IndexedLayer) return image.alpha;
  indexedPixels(image);
  return image.indexedAlpha;
}

// IndexedLayer keeps Atari bitplane pixels in CPU memory. The four-panel
// composition can therefore update and recolor its native screens without a
// synchronous Canvas getImageData readback on every frame.
class IndexedLayer {
  constructor(width = 320, height = 200) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    this.alpha = new Uint8Array(width * height);
    this.planeWords = new Uint16Array(8);
    this.opaque = false;
  }
  clear() { this.data.fill(0); this.alpha.fill(0); this.opaque = false; }
  fill(value = 0) { this.data.fill(value); this.alpha.fill(255); this.opaque = true; }
  rect(x, y, width, height, value = 0) {
    x = Math.trunc(x); y = Math.trunc(y); width = Math.trunc(width); height = Math.trunc(height);
    const left = Math.max(0, x), top = Math.max(0, y), right = Math.min(this.width, x + width), bottom = Math.min(this.height, y + height);
    for (let row = top; row < bottom; row++) {
      this.data.fill(value, row * this.width + left, row * this.width + right);
      this.alpha.fill(255, row * this.width + left, row * this.width + right);
    }
    if (left === 0 && top === 0 && right === this.width && bottom === this.height) this.opaque = true;
  }
  blit(image, x = 0, y = 0, sourceX = 0, sourceY = 0, width = image.width, height = image.height) {
    x = Math.trunc(x); y = Math.trunc(y); sourceX = Math.trunc(sourceX); sourceY = Math.trunc(sourceY); width = Math.trunc(width); height = Math.trunc(height);
    const source = indexedPixels(image), sourceAlpha = indexedAlpha(image), sourceWidth = image.width, sourceHeight = image.height;
    const sourceOpaque = image instanceof IndexedLayer ? image.opaque : image.indexedOpaque;
    if (x < 0) { sourceX -= x; width += x; x = 0; }
    if (y < 0) { sourceY -= y; height += y; y = 0; }
    if (sourceX < 0) { x -= sourceX; width += sourceX; sourceX = 0; }
    if (sourceY < 0) { y -= sourceY; height += sourceY; sourceY = 0; }
    width = Math.min(width, this.width - x, sourceWidth - sourceX);
    height = Math.min(height, this.height - y, sourceHeight - sourceY);
    if (width <= 0 || height <= 0) return;
    if (!(image instanceof IndexedLayer) && image.indexedRuns && width >= 32) {
      const sourceRight = sourceX + width;
      for (let row = 0; row < height; row++) {
        const sourceTop = (sourceY + row) * sourceWidth;
        const destinationTop = (y + row) * this.width + x;
        const runs = image.indexedRuns[sourceY + row];
        for (let run = 0; run < runs.length; run += 2) {
          const left = Math.max(sourceX, runs[run]), right = Math.min(sourceRight, runs[run + 1]);
          if (right <= left) continue;
          const destination = destinationTop + left - sourceX;
          this.data.set(source.subarray(sourceTop + left, sourceTop + right), destination);
          this.alpha.fill(255, destination, destination + right - left);
        }
      }
      return;
    }
    for (let row = 0; row < height; row++) {
      const from = (sourceY + row) * sourceWidth + sourceX;
      const to = (y + row) * this.width + x;
      if (sourceOpaque) {
        this.data.set(source.subarray(from, from + width), to);
        this.alpha.fill(255, to, to + width);
        continue;
      }
      for (let column = 0; column < width; column++) {
        const sourcePixel = from + column, destinationPixel = to + column, sourceOpacity = sourceAlpha[sourcePixel];
        if (sourceOpacity === 0) continue;
        if (sourceOpacity === 255 || this.alpha[destinationPixel] === 0) {
          this.data[destinationPixel] = source[sourcePixel];
          this.alpha[destinationPixel] = sourceOpacity;
          continue;
        }
        const destinationOpacity = this.alpha[destinationPixel];
        const inverse = 255 - sourceOpacity;
        const outputOpacity = sourceOpacity + destinationOpacity * inverse / 255;
        this.data[destinationPixel] = Math.round((source[sourcePixel] * sourceOpacity + this.data[destinationPixel] * destinationOpacity * inverse / 255) / outputOpacity);
        this.alpha[destinationPixel] = Math.round(outputOpacity);
      }
    }
    if (sourceOpaque && x === 0 && y === 0 && width === this.width && height === this.height) this.opaque = true;
  }
  copy(image, x = 0, y = 0, sourceX = 0, sourceY = 0, width = image.width, height = image.height) {
    const destinationX = Math.trunc(x), destinationY = Math.trunc(y);
    const left = Math.max(0, destinationX), top = Math.max(0, destinationY);
    const right = Math.min(this.width, destinationX + Math.max(0, Math.trunc(width)));
    const bottom = Math.min(this.height, destinationY + Math.max(0, Math.trunc(height)));
    for (let row = top; row < bottom; row++) {
      this.data.fill(0, row * this.width + left, row * this.width + right);
      this.alpha.fill(0, row * this.width + left, row * this.width + right);
    }
    if (right > left && bottom > top) this.opaque = false;
    this.blit(image, x, y, sourceX, sourceY, width, height);
  }
  pixels() { return this.data; }
  indices(values, transparent = false) {
    this.data.set(values.subarray ? values.subarray(0, this.data.length) : values);
    if (!transparent) { this.alpha.fill(255); this.opaque = true; return; }
    this.opaque = true;
    for (let index = 0; index < this.data.length; index++) {
      this.alpha[index] = this.data[index] ? 255 : 0;
      if (!this.alpha[index]) this.opaque = false;
    }
  }
  planar(bytes, planes = 4, stride = this.width / 16 * planes * 2) {
    if (planes === 4) {
      for (let y = 0; y < this.height; y++) for (let group = 0; group < this.width / 16; group++) {
        const source = y * stride + group * 8;
        const destination = y * this.width + group * 16;
        for (let half = 0; half < 2; half++) {
          let packed = PLANAR_PAIRS[bytes[source + half] << 8 | bytes[source + 2 + half]] |
            PLANAR_PAIRS[bytes[source + 4 + half] << 8 | bytes[source + 6 + half]] << 2;
          const output = destination + half * 8;
          for (let pixel = 0; pixel < 8; pixel++, packed >>>= 4) this.data[output + pixel] = packed & 15;
        }
      }
      this.alpha.fill(255);
      this.opaque = true;
      return;
    }
    const words = this.planeWords;
    for (let y = 0; y < this.height; y++) for (let group = 0; group < this.width / 16; group++) {
      const source = y * stride + group * planes * 2;
      for (let plane = 0; plane < planes; plane++) words[plane] = u16(bytes, source + plane * 2);
      const destination = y * this.width + group * 16;
      for (let bit = 0; bit < 16; bit++) {
        let value = 0;
        for (let plane = 0; plane < planes; plane++) value |= (words[plane] >> (15 - bit) & 1) << plane;
        this.data[destination + bit] = value;
      }
    }
    this.alpha.fill(255);
    this.opaque = true;
  }
}

// PixelPresenter uploads one packed RGBA frame through WebGL. This avoids the
// slow putImageData path used by several Android Chromium builds while keeping
// an exact nearest-neighbor copy of the authored indexed pixels.
class PixelPresenter {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl = this.canvas.getContext('webgl', {alpha:false, antialias:false, depth:false, preserveDrawingBuffer:true});
    if (!this.gl) {
      this.context = this.canvas.getContext('2d');
      this.image = this.context.createImageData(width, height);
      this.rgba = new Uint32Array(this.image.data.buffer);
      return;
    }
    const gl = this.gl;
    const shader = (type, source) => {
      const result = gl.createShader(type);
      gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
      return result;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 u;varying vec2 v;void main(){v=u;gl_Position=vec4(p,0.0,1.0);}'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=texture2D(t,v);}'));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const vertices = new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0]);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p'), uv = gl.getAttribLocation(program, 'u');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.uniform1i(gl.getUniformLocation(program, 't'), 0); gl.viewport(0, 0, width, height);
  }
  draw(pixels) {
    this.drawRegions([{x:0,y:0,width:this.width,height:this.height,pixels}]);
  }
  drawRegions(regions) {
    if (!this.gl) {
      for(const region of regions)for(let row=0;row<region.height;row++){
        const source=row*region.width,destination=(region.y+row)*this.width+region.x;
        this.rgba.set(region.pixels.subarray(source,source+region.width),destination);
      }
      this.context.putImageData(this.image, 0, 0); return;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    for(const region of regions){
      region.bytes ||= new Uint8Array(region.pixels.buffer,region.pixels.byteOffset,region.pixels.byteLength);
      gl.texSubImage2D(gl.TEXTURE_2D,0,region.x,region.y,region.width,region.height,gl.RGBA,gl.UNSIGNED_BYTE,region.bytes);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

Object.assign(window.CODEFDemo ||= {}, {clamp, mod, word, u16, s16, u32, s32, put16, put32, stColor, palette, words, indexAt, indexedPixels, Assets, Layer, IndexedLayer, PixelPresenter, SliceStream, Soundtrack, boot});
})();
