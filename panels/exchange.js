(function (root) {
  'use strict';

  const {indexAt, palette} = root.CODEFDemo;

  // Traveling objects retain their indexed Atari ST colors while palette index
  // zero becomes transparent, matching DMA40's native exchange.Bake helper.
  function colors(raw) {
    const result = palette(raw).slice(0, 16);
    result[0] = 0;
    return result;
  }

  function bake(width, height, sample) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(width, height);
    const pixels = new Uint32Array(image.data.buffer);
    for (let y = 0, at = 0; y < height; y++) {
      for (let x = 0; x < width; x++, at++) pixels[at] = sample(x, y) >>> 0;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  function bakeIndexed(source, sourceColors) {
    return bake(source.width, source.height, (x, y) => {
      const at = (y * source.width + x) * 4;
      if (!source.data[at + 3]) return 0;
      return sourceColors[indexAt(source.data, at)] || 0;
    });
  }

  root.DMA40PanelExchange = Object.freeze({colors, bake, bakeIndexed});
})(typeof globalThis !== 'undefined' ? globalThis : this);
