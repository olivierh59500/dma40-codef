/*
 * Faithful DMA40 quadrant renderer adapted from the existing CODEF port.
 * Source: demos/codef/lockbuster3/demo.classic.js
 */
(function () {
'use strict';
const {boot, IndexedLayer, palette, stColor, indexAt, u16, s16, u32, word} = window.CODEFDemo;

class PanelClock {
  constructor(data) { Object.assign(this, {order: Array.from({length: data.length / 4}, (_, i) => u32(data, i * 4)), cursor: 0, direction: 1, cycle: 5, stepN: 0, offset: 0, base: 0, mode: 0, down: false, peak: false, draw: false, commit: false}); }
  step() {
    const c = this; c.draw = c.commit = false; const entry = c.order[c.cursor];
    switch (entry) {
      case 250: c.direction = 1; c.cursor = 1; c.cycle = 5; c.stepN = c.offset = c.base = 0; c.down = c.peak = false; return;
      case 253: c.mode ^= 1; c.direction = -1; c.cursor--; c.offset = c.base = 25600; c.stepN = 0; c.down = false; return;
      case 254: c.cursor += c.direction; c.offset = c.base = 51200; c.stepN = 0; c.down = false; return;
      case 255: c.cursor += c.direction; c.mode ^= 1; c.offset = c.mode * 25600; c.base = c.offset; c.stepN = 0; c.down = false; return;
    }
    const x = Math.floor(entry % 6400 / 32), y = Math.floor(entry / 6400), local = c.offset % 25600;
    c.pose = {cell: y * 5 + x, bank: Math.floor(c.offset / 25600), frame: Math.floor(local / 6400) * 5 + Math.floor(local % 6400 / 32)}; c.draw = true;
    if (c.peak) { c.peak = false; c.commit = true; c.cursor += c.direction; return; }
    if (c.down) {
      if (--c.stepN === 0) { c.cycle = 5; c.down = false; return; }
      if (--c.cycle === 0) { c.cycle = 5; c.offset -= 6240; } c.offset -= 32; return;
    }
    if (++c.stepN === 20) { c.cycle = 5; c.down = c.peak = true; return; }
    if (--c.cycle === 0) { c.cycle = 5; c.offset += 6240; } c.offset += 32;
  }
}
class Lockbuster3Scroll {
  constructor(message) {
    let bank = 0; this.message = message;
    this.fonts = Array.from(message, r => { if (r === 5) bank = 1; else if (r === 6) bank = 0; return bank; });
    this.columns = [0, 1].map(row => Array.from({length: 40}, (_, slot) => ({initial: true, row, slot})));
    this.glyph = this.column = this.row = this.changes = 0; this.remaining = message.length;
  }
  step() {
    const c = this, wanted = c.fonts[c.glyph];
    if (wanted !== c.row) { c.row = wanted; if (!wanted) c.remaining = c.message.length - c.glyph; c.changes++; return; }
    const r = c.message[c.glyph], glyph = r === 32 ? 3 : (r - 32) & 255;
    c.columns[c.row].shift(); c.columns[c.row].push({font: wanted, glyph, column: c.column});
    if (++c.column === 4) {
      c.column = 0; c.glyph++; if (!c.row) c.remaining--;
      if (c.glyph === c.message.length) { c.glyph = 0; c.remaining = c.message.length; }
      else if (c.row === 1 && c.fonts[c.glyph] === 0) c.remaining = c.message.length - c.glyph;
    }
  }
}
async function createScene({assets, screen, sound}) {
  const [art, panels, letters, fonts, motion, order, message, pal, raster] = await Promise.all([
    assets.image('artwork.png'), Promise.all(Array.from({length: 3}, (_, i) => assets.image(`panels-${i}.png`))),
    Promise.all(['d', 'm', 'a'].map(c => assets.image(`letter-${c}.png`))), Promise.all([0, 1].map(i => assets.image(`font-${i}.png`))),
    assets.bytes('motion.bin'), assets.bytes('panel-order.bin'), assets.bytes('message.bin'), assets.bytes('palette.bin'), assets.bytes('rasters.bin')
  ]);
  const state = {tick: 0, front: 1, letters: Array.from({length: 3}, (_, i) => Array.from({length: 8}, (_, j) => s16(motion, i * 16 + j * 2))), history: [[], []], away: [false, false, false]};
  const colors = palette(pal), sharedColors = window.DMA40PanelExchange.colors(pal);
  const sharedLetters = letters.map(letter => window.DMA40PanelExchange.bakeIndexed(letter, sharedColors));
  const background = new IndexedLayer(320, 240); background.fill();
  for (let y = 0; y < 5; y++) background.blit(art, 0, y * 40, 0, 35, 320, 40);
  const buffers = [new IndexedLayer(320, 240), new IndexedLayer(320, 240)], text = new IndexedLayer(320, 240), initial = new IndexedLayer(320, 40), initialPixels = new Uint8Array(320 * 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 320; x++) initialPixels[y * 320 + x] = (indexAt(art.data, ((y + 35) * 320 + x) * 4) & 1) * 15;
  initial.indices(initialPixels);
  const panel = new PanelClock(order), clock = new Lockbuster3Scroll(message), rasters = [];
  for (let i = 0; i + 3 < raster.length; i += 2) { if (!u16(raster, i)) break; rasters.push(stColor(u16(raster, i + 2))); }
  function stepLetters() {
    for (const w of state.letters) {
      w[0] = word(w[0] + w[2]); w[1] = word(w[1] + w[3]); w[2] = word(w[2] + w[4]); w[3] = word(w[3] + w[5]);
      if (w[2] === w[6] || w[2] === -w[6]) w[4] = -w[4]; if (w[3] === w[7] || w[3] === -w[7]) w[5] = -w[5];
    }
  }
  function drawLetters(target) { state.letters.forEach((w, i) => { if (!state.away[i]) buffers[target].blit(letters[i], w[0], w[1]); state.history[target][i] = {x: w[0] & ~15, y: w[1]}; }); }
  for (let i = 0; i < 2; i++) { buffers[i].blit(background); stepLetters(); drawLetters(i); }
  function drawText() {
    text.clear();
    clock.columns.forEach((columns, row) => columns.forEach((c, slot) => {
      if (c.initial) text.blit(initial, slot * 8, 160 + row * 20, c.slot * 8, c.row * 20, 8, 20);
      else text.blit(fonts[c.font], slot * 8, 160 + row * 20, c.glyph % 16 * 32 + c.column * 8, Math.floor(c.glyph / 16) * 20, 8, 20);
    }));
  }
  drawText();
  return {
    state, panel, clock,
    exchange: {
      setAway(index, away) { state.away[index] = away; },
      draw(context, index, originX, originY, scaleX, scaleY) {
        const position = state.letters[index];
        context.save(); context.imageSmoothingEnabled = true;
        context.drawImage(sharedLetters[index], originX + position[0] * scaleX, originY + position[1] * scaleY,
          sharedLetters[index].width * scaleX, sharedLetters[index].height * scaleY);
        context.restore();
      }
    },
    update() {
      state.tick++; const target = 1 - state.front;
      state.history[target].forEach(r => buffers[target].copy(background, r.x, r.y, r.x, r.y, 64, 35));
      panel.step();
      if (panel.draw) {
        const p = panel.pose, x = p.cell % 5 * 64, y = Math.floor(p.cell / 5) * 40;
        buffers[target].blit(panels[p.bank], x, y, p.frame % 5 * 64, Math.floor(p.frame / 5) * 40, 64, 40);
        if (panel.commit) background.blit(panels[panel.base / 25600], x, y, 4 * 64, 3 * 40, 64, 40);
      }
      stepLetters(); drawLetters(target); clock.step(); drawText();
      const regs = sound.registers();
      for (let i = 0; i < 3; i++) {
        const v = regs[8 + i] & 15, x = (v >= 10 ? v - 10 : v) * 32, y = v >= 10 ? 100 : 75;
        buffers[target].blit(art, 80 + i * 64, 210, x, y, 32, 25);
      }
      state.front = target;
    },
    render(commit = true) {
      const pixels = buffers[state.front].pixels(), textPixels = text.pixels(), output = screen.rgba;
      for (let y = 0; y < 240; y++) {
        const start = y * 320, end = start + 320;
        const hasText = y >= 160 && y < 200;
        const hasRaster = y >= 159 && y < 159 + rasters.length;
        const rasterColor = hasRaster ? rasters[y - 159] : 0;
        if (!hasText && !hasRaster) {
          for (let pixel = start; pixel < end; pixel++) output[pixel] = colors[pixels[pixel]];
        } else if (hasText && hasRaster) {
          for (let pixel = start; pixel < end; pixel++) {
            const index = pixels[pixel] - pixels[pixel] % 2 + (textPixels[pixel] >= 8 ? 1 : 0);
            output[pixel] = index === 12 || index === 14 ? rasterColor : colors[index];
          }
        } else if (hasText) {
          for (let pixel = start; pixel < end; pixel++) {
            const index = pixels[pixel] - pixels[pixel] % 2 + (textPixels[pixel] >= 8 ? 1 : 0);
            output[pixel] = colors[index];
          }
        } else {
          for (let pixel = start; pixel < end; pixel++) {
            const index = pixels[pixel];
            output[pixel] = index === 12 || index === 14 ? rasterColor : colors[index];
          }
        }
      }
      if(commit)screen.commit();
    }
  };
}

Object.assign(window.DMA40PanelFactories ||= {}, {lockbuster: createScene});
})();
