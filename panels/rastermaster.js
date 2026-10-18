/*
 * Faithful DMA40 quadrant renderer adapted from the existing CODEF port.
 * Source: demos/codef/jinx-rastermaster/demo.classic.js
 */
(function () {
'use strict';
const {boot, IndexedLayer, SliceStream, palette, stColor, indexedPixels, indexAt, u16, s32, clamp} = window.CODEFDemo;

class RasterClock {
  constructor(blue, black, positions, small, wide, rolling) {
    Object.assign(this, {blue, black, positions, small, wide, rolling, blueBackground: true, thin: Array.from({length: 8}, (_, i) => (i + 1) * 5), widePosition: [0, 80, 160], wideVelocity: [4, 4, 4], rollPosition: 0, rollVelocity: 2, rollOffset: 0});
    this.pixels = new Uint16Array(202);
  }
  step() {
    const r = this, base = r.blueBackground ? r.blue : r.black;
    for (let i = 0; i < 201; i++) r.pixels[i] = u16(base, i * 2);
    const copy = (at, data) => { for (let i = 0; i < data.length / 2; i++) r.pixels[at / 2 + i] = u16(data, i * 2); };
    r.thin.forEach((index, i) => {
      if (r.positions[index] === -1) index = 0;
      const at = r.positions[index]; copy(at, r.small.subarray(0, 22)); copy(380 - at, r.small.subarray(22)); r.thin[i] = index + 1;
    });
    for (let i = 0; i < 3; i++) {
      if (r.widePosition[i] === 0) r.wideVelocity[i] = 4;
      if (r.widePosition[i] === 352) r.wideVelocity[i] = -4;
      r.widePosition[i] += r.wideVelocity[i]; copy(r.widePosition[i], r.wide);
    }
    if (r.rollPosition === 0) { r.rollVelocity = 2; r.rollOffset = 0; }
    if (r.rollPosition === 310) { r.rollVelocity = -2; r.rollOffset = 8; }
    r.rollPosition += r.rollVelocity; copy(r.rollPosition, r.rolling.subarray(r.rollOffset, r.rollOffset + 88));
    r.rollOffset += r.rollVelocity;
    if (r.rollOffset === 8) r.rollOffset = 0; else if (r.rollOffset === 0) r.rollOffset = 8;
    r.pixels[45] = r.pixels[46] = 0x777;
  }
}
async function createScene({assets, screen, sound}) {
  const [top, from, dma, large, small, title, logoWave, fromWave, scrollWave, mainMessage, smallMessage, blue, black, positions, thin, wide, rolling, materials, pal, titlePal] = await Promise.all([
    ...['top-bank.png', 'from-bank.png', 'dma.png', 'font-main.png', 'font-small.png', 'title.png'].map(n => assets.image(n)),
    ...['logo-wave.bin', 'from-wave.bin', 'scroll-wave.bin', 'message-main.bin', 'message-small.bin', 'raster-blue.bin', 'raster-black.bin', 'raster-positions.bin', 'raster-small.bin', 'raster-wide.bin', 'raster-rolling.bin', 'raster-materials.bin', 'palette.bin', 'title-palette.bin'].map(n => assets.bytes(n))
  ]);
  const longs = b => Array.from({length: b.length / 4}, (_, i) => s32(b, i * 4));
  const logo = longs(logoWave), fold = longs(fromWave), scroll = longs(scrollWave);
  const rasters = new RasterClock(blue, black, longs(positions), thin, wide, rolling);
  const state = {tick: 0, track: 2, jinxAway: false}, stage = new IndexedLayer(), smallMask = new IndexedLayer(), largeMask = new IndexedLayer(), colors = palette(pal), mat = palette(materials), titleColors = palette(titlePal), titlePixels = indexedPixels(title);
  const renderLookup = new Uint32Array(200 * 64);
  for (let y = 0; y < 200; y++) for (let key = 0; key < 64; key++) {
    let index = key & 15;
    if (y >= 93) index = index - index % 2 + (key & 16 ? 1 : 0);
    if (y >= 101) index = index - (index >> 1) % 2 * 2 + (key & 32 ? 2 : 0);
    if (index === 2) renderLookup[y * 64 + key] = mat[200 + y];
    else if (index === 3) renderLookup[y * 64 + key] = mat[y];
    else if (y >= 93 && index === 1) renderLookup[y * 64 + key] = 0xffcccccc;
    else if (index !== 0) renderLookup[y * 64 + key] = colors[index];
  }
  const sharedColors = window.DMA40PanelExchange.colors(pal), sharedInk = Array.from({length:30}, () => null);
  sharedColors[1] = stColor(0x666);
  const sharedLogo = window.DMA40PanelExchange.bake(256, 30, (x, row) => {
    const at = ((row * 16 + 1) * top.width + x) * 4;
    if (!top.data[at + 3]) return 0;
    const index = indexAt(top.data, at);
    let paint = sharedColors[index] || 0;
    if (index === 2 || index === 3) paint = stColor(u16(materials, (row + (index === 2 ? 200 : 0)) * 2));
    if (paint) {
      if (!sharedInk[row]) sharedInk[row] = {min:x,max:x+1};
      else { sharedInk[row].min = Math.min(sharedInk[row].min, x); sharedInk[row].max = Math.max(sharedInk[row].max, x + 1); }
    }
    return paint;
  });
  colors[1] = stColor(0x666);
  const stream = new SliceStream(Array.from(mainMessage, c => ({glyph: clamp(c - 32, 0, 59)})), 40);
  const select = n => { state.track = n; return sound.select(`music-${n + 1}.ym`); };
  const scene = {
    state, rasters, started: false,
    exchange: {
      setAway(away) { state.jinxAway = away; },
      draw(context, originX, originY, scaleX, scaleY) {
        const positions = [];
        let left = Infinity, right = -Infinity;
        for (let row = 0; row < 30; row++) {
          const offset = logo[state.tick % 1542 + row];
          const phase = clamp(Math.trunc((offset + 160) / 320), 0, 15);
          let x = phase - Math.trunc((offset - phase * 320) / 8) * 16;
          if (row) { while (x - positions[row - 1] > 320) x -= 640; while (x - positions[row - 1] < -320) x += 640; }
          positions.push(x);
          if (sharedInk[row]) { left = Math.min(left, x + sharedInk[row].min); right = Math.max(right, x + sharedInk[row].max); }
        }
        const center = (left + right - 320) / 2;
        const localLeft = left - center, localRight = right - center;
        const screenLeft = originX + localLeft * scaleX, screenRight = originX + localRight * scaleX;
        const screenTop = originY, screenBottom = originY + 30 * scaleY;
        originX += Math.max(0, -screenLeft) - Math.max(0, screenRight - context.canvas.width);
        originY += Math.max(0, -screenTop) - Math.max(0, screenBottom - context.canvas.height);
        for (let row = 0; row < 30; row++) context.drawImage(sharedLogo, 0, row, 256, 1,
          originX + (positions[row] - center) * scaleX, originY + row * scaleY, 256 * scaleX, Math.max(1, scaleY));
      }
    },
    start() { scene.started = true; },
    key(code) {
      if (code === 'Enter' || code === 'Space') scene.start();
      else if (/^F([1-9]|10)$/.test(code)) select(Number(code.slice(1)) - 1).catch(console.error);
      else if (code === 'KeyH' || code === 'Insert') rasters.blueBackground = !rasters.blueBackground;
    },
    click(x) { if (!scene.started) scene.start(); else if (x < 160) rasters.blueBackground = !rasters.blueBackground; else select((state.track + 1) % 10).catch(console.error); },
    update() {
      if (!scene.started) return;
      state.tick++; stream.step(); rasters.step(); stage.fill(); smallMask.clear(); largeMask.clear();
      for (let row = 0; row < 30; row++) {
        const offset = logo[state.tick % 1542 + row], phase = Math.floor(offset / 320), x = Math.trunc((offset - phase * 320) / 8) * 16;
        if (!state.jinxAway) stage.blit(top, 0, row, x, row * 16 + phase + 1, 320, 1);
        stage.blit(from, 96, 30 + row, 0, fold[(state.tick - 1) % 60 * 30 + row] / 64 + 1, 128, 1);
      }
      stage.blit(dma, 32, 62);
      for (let lane = 0; lane < 13; lane++) {
        let tick = state.tick; if (tick >= 3476) tick = 2200 + (tick - 3476) % 1276;
        const off = scroll[tick + lane * 2], x = Math.trunc(off / 264) - off % 264 * 8, first = Math.max(0, Math.trunc(-x / 8) - 2);
        for (let i = first; i < Math.min(264, first + 44, smallMessage.length); i++) {
          const glyph = clamp(smallMessage[i] - 32, 0, 127);
          smallMask.blit(small, x + i * 8, 93 + lane * 10, glyph % 16 * 8, Math.floor(glyph / 16) * 7, 8, 7);
        }
      }
      stream.draw(largeMask, large, null, {columns: 10, glyphHeight: 32, y: 168});
      const regs = sound.registers();
      for (let bank = 0; bank < 2; bank++) for (let col = 0; col < 3; col++) {
        const ch = bank ? 2 - col : col, h = (regs[8 + ch] & 15) * 4 + 1;
        largeMask.rect(64 + bank * 128 + col * 32, 166 - h, 16, h, 15);
      }
    },
    render(commit = true) {
      if (!scene.started) {
        for (let pixel = 0; pixel < titlePixels.length; pixel++) screen.rgba[pixel] = titleColors[titlePixels[pixel]];
        if(commit)screen.commit(); return;
      }
      const p = stage.pixels(), sm = smallMask.pixels(), lm = largeMask.pixels();
      const output = screen.rgba;
      for (let y = 0; y < 200; y++) {
        const start = y * 320, end = start + 320, lookup = y * 64;
        const rasterColor = stColor(rasters.pixels[y]);
        for (let pixel = start; pixel < end; pixel++) {
          const color = renderLookup[lookup + p[pixel] + (sm[pixel] ? 16 : 0) + (lm[pixel] ? 32 : 0)];
          output[pixel] = color || rasterColor;
        }
      }
      if(commit)screen.commit();
    }
  };
  return scene;
}

Object.assign(window.DMA40PanelFactories ||= {}, {rastermaster: createScene});
})();
