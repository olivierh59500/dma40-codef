/*
 * Faithful DMA40 quadrant renderer adapted from the existing CODEF port.
 * Source: demos/codef/chonchon/demo.classic.js
 */
(function () {
'use strict';
const {boot, Layer, palette, indexAt, u16, s16, u32, put16, put32, mod} = window.CODEFDemo;

class ChonchonClock {
  constructor(background, font, path, ys, wave, message, stars, index) {
    Object.assign(this, {background, font, path, ys, wave, message, stars, tick: 0, logoPhase: 0, logoYPhase: 0, logoY: 0, scrollPhase: 0, messageCursor: 0, counter: 0});
    this.ring = [new Uint8Array(3432), new Uint8Array(3432)]; this.write = [2808, 2808]; this.read = [0, 0]; this.screen = new Uint8Array(32000);
    this.starBase = Array.from({length: 100}, (_, i) => u32(index, i * 6) - 0x1b018 - 0x1cc88);
    this.starCursor = Array.from({length: 100}, (_, i) => u16(index, i * 6 + 4));
    this.step(); this.step(); this.tick = 0;
  }
  logoRow(row) {
    const at = this.logoPhase + row * 6;
    return {x: Math.floor(u16(this.path, at) / 8) * 16, phase: Math.floor(u32(this.path, at + 2) / 72), y: this.logoY + row};
  }
  step() {
    const c = this; c.tick++; c.screen.set(c.background); c.logoPhase += 12;
    if (s16(c.path, c.logoPhase + 63 * 6) < 0) c.logoPhase = 0;
    c.logoYPhase++;
    if (c.logoYPhase * 2 >= c.ys.length || s16(c.ys, c.logoYPhase * 2) < 0) c.logoYPhase = 0;
    c.logoY = Math.floor(u16(c.ys, c.logoYPhase * 2) / 160);
    for (let i = 0; i < 100; i++) {
      let p = c.starBase[i] + c.starCursor[i] + 6;
      if (p + 6 > c.stars.length || u16(c.stars, p) === 0) { c.starCursor[i] = 0; p = c.starBase[i]; } else c.starCursor[i] += 6;
      const off = u16(c.stars, p);
      if (off + 4 <= c.screen.length) put32(c.screen, off, u32(c.screen, off) | u32(c.stars, p + 2));
    }
    const bank = (c.tick - 1) % 2;
    if (bank === 0 && c.counter === 0) {
      if (c.messageCursor + 2 > c.message.length || s16(c.message, c.messageCursor) < 0) c.messageCursor = 0;
      const off = u16(c.message, c.messageCursor); c.write[0] = (c.write[0] + 312) % 3432;
      if (off + 312 <= c.font.length) c.ring[0].set(c.font.subarray(off, off + 312), c.write[0]);
    }
    if (bank === 1 && --c.counter < 0) {
      c.counter = 1;
      if (c.messageCursor + 2 > c.message.length || s16(c.message, c.messageCursor) < 0) c.messageCursor = 0;
      const off = s16(c.message, c.messageCursor); c.messageCursor += 2; c.write[1] = (c.write[1] + 312) % 3432;
      const packed = 0x18369 - 0xce2a + off;
      if (packed >= 0 && packed + 312 <= c.font.length) for (let row = 0; row < 26; row++) {
        const src = packed + row * 12, dst = c.write[1] + row * 6;
        for (let plane = 0; plane < 3; plane++) c.ring[1][mod(dst - 155 + plane * 2, 3432)] = c.font[src + plane];
        for (let j = 0; j < 6; j++) c.ring[1][(dst + j) % 3432] = c.font[src + 3 + j];
        for (let plane = 0; plane < 3; plane++) c.ring[1][(dst + 156 + plane * 2) % 3432] = c.font[src + 9 + plane];
      }
    }
    c.scrollPhase += 2;
    if (c.scrollPhase * 2 >= c.wave.length || s16(c.wave, c.scrollPhase * 2) < 0) c.scrollPhase = 0;
    c.read[bank] = (c.read[bank] + 156) % 3432;
    for (let col = 0; col < 18; col++) {
      let p = c.scrollPhase + col * 2;
      if (p >= c.wave.length / 2 || s16(c.wave, p * 2) < 0) p = 0;
      let p2 = p + 1; if (p2 >= c.wave.length / 2 || s16(c.wave, p2 * 2) < 0) p2 = 0;
      const y1 = Math.floor(u16(c.wave, p * 2) / 160), y2 = Math.floor(u16(c.wave, p2 * 2) / 160);
      for (let row = 0; row < 26; row++) {
        const r = (c.read[bank] + col * 156 + row * 6) % 3432;
        for (let plane = 0; plane < 3; plane++) {
          const a = (y1 + row) * 160 + (col + 1) * 8 + plane * 2, b = (y2 + row) * 160 + (col + 1) * 8 + plane * 2 + 1;
          if (a >= 0 && a < 32000) c.screen[a] = c.ring[bank][r + plane * 2];
          if (b >= 0 && b < 32000) c.screen[b] = c.ring[bank][r + plane * 2 + 1];
        }
      }
    }
  }
}

async function createScene({assets, screen, sound}) {
  const resources = await Promise.all(['background.bin', 'font-source.bin', 'logo-path.bin', 'logo-y.bin', 'scroll-y.bin', 'message.bin', 'star-paths.bin', 'star-index.bin'].map(n => assets.bytes(n)));
  const clock = new ChonchonClock(...resources);
  const [logo, pal, raster, curve, meter] = await Promise.all([assets.image('logo-bank.png'), assets.bytes('palette.bin'), assets.bytes('raster.bin'), assets.bytes('volume-curve.bin'), assets.bytes('meter-raw.bin')]);
  const stage = new Layer(), colors = palette(pal), rasters = palette(raster);
  clock.logoAway = false;
  const sharedColors = window.DMA40PanelExchange.colors(pal);
  const sharedLogo = window.DMA40PanelExchange.bakeIndexed(logo, sharedColors);
  return {
    clock,
    exchange: {
      setAway(away) { clock.logoAway = away; },
      draw(context, originX, originY, scaleX, scaleY) {
        for (let row = 0; row < 63; row++) {
          const point = clock.logoRow(row);
          context.drawImage(sharedLogo, 0, row * 17 + point.phase, 96, 1,
            originX + point.x * scaleX, originY + point.y * scaleY, 96 * scaleX, Math.max(1, scaleY));
        }
      }
    },
    update() {
      clock.step(); const regs = sound.registers();
      for (let ch = 0; ch < 3; ch++) {
        const height = curve[regs[8 + ch] & 15], x = [96, 144, 176][ch], width = ch === 1 ? 32 : 48;
        if (!height) continue;
        for (let row = 0; row <= height && row < 52; row++) for (let dx = 0; dx < width; dx++) {
          const p = (147 + row) * 160 + ((x + dx) >> 4) * 8 + 6, q = x - 96 + dx;
          if (u16(meter, row * 160 + (q >> 4) * 8) >> (15 - q % 16) & 1) put16(clock.screen, p, u16(clock.screen, p) | 1 << (15 - (x + dx) % 16));
        }
      }
      stage.planar(clock.screen);
      if (!clock.logoAway) for (let row = 0; row < 63; row++) { const p = clock.logoRow(row); stage.blit(logo, p.x, p.y, 0, row * 17 + p.phase, 96, 1); }
    },
    render() { const p = stage.pixels(); screen.paint((x, y, at) => { const i = indexAt(p, at); return i >= 8 && y >= 144 ? rasters[(y - 144) >> 1] : colors[i]; }); }
  };
}

Object.assign(window.DMA40PanelFactories ||= {}, {chonchon: createScene});
})();
