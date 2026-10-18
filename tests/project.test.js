'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const timeline = require('../timeline.js');

const root = path.resolve(__dirname, '..');

function filesBelow(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  });
}

test('the complete recording timeline remains ordered and continuous', () => {
  assert.equal(timeline.FPS, 50);
  assert.equal(timeline.DURATION, 330.58);
  assert.equal(Math.round(timeline.DURATION * timeline.FPS), 16529);
  assert.equal(timeline.CHAPTERS.length, 52);
  assert.equal(timeline.CHAPTERS[0].start_seconds, 0);
  assert.equal(timeline.CHAPTERS.at(-1).end_seconds, timeline.DURATION);
  for (let index = 1; index < timeline.CHAPTERS.length; index++) {
    assert.equal(timeline.CHAPTERS[index - 1].end_seconds, timeline.CHAPTERS[index].start_seconds);
  }
});

test('major scenes cover the whole production and skip deterministically', () => {
  assert.equal(timeline.SCENES[0].key, 'opening');
  assert.equal(timeline.SCENES.at(-1).key, 'complete');
  assert.equal(timeline.sceneAt(185.04).key, 'city');
  assert.equal(timeline.sceneAt(211.54).key, 'noname');
  assert.equal(timeline.sceneAt(313.84).key, 'pi');
  assert.equal(timeline.nextSceneTime(180), 211.56);
  assert.equal(timeline.nextSceneTime(timeline.DURATION), 0);
});

test('every packaged asset matches the SHA-256 manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/manifest.json')));
  const actual = filesBelow(path.join(root, 'assets'))
    .filter(file => path.basename(file) !== 'manifest.json')
    .map(file => path.relative(path.join(root, 'assets'), file).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(manifest.files.map(entry => entry.file).sort(), actual);
  for (const entry of manifest.files) {
    const bytes = fs.readFileSync(path.join(root, 'assets', entry.file));
    assert.equal(bytes.length, entry.bytes, entry.file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
  }
});

test('the browser port uses source-derived effect engines and no presentation video', () => {
  const files = ['demo.js', 'effects/leonard-cube.js', 'effects/dma-is-back.js', 'effects/spoon.js', 'effects/city.js', 'effects/noname.js', 'effects/jelly.js'];
  const source = files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.match(source, /const BALL_COUNT = 1600/);
  assert.match(source, /const STAR_COUNT = 2200/);
  assert.match(source, /const FLOCK_COUNT = FLOCK_SIDE \* FLOCK_SIDE/);
  assert.match(source, /class VoxelRenderer/);
  assert.match(source, /DMA40Spoon\.draw/);
  assert.match(source, /DMA40City\.draw/);
  assert.match(source, /DMA40Noname\.draw/);
  assert.match(source, /DMA40Jelly\.draw/);
  assert.doesNotMatch(source, /<video|dma40-site\.webm|recordings\/dma40/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'demo.js'), 'utf8'), /getImageData/);
});

test('file-safe prepared data covers the portrait, copper, floor and equalizer', () => {
  const context = {};
  context.window = context;
  for (const file of ['assets/portrait/colors.js', 'assets/intro/copper-offsets.js', 'assets/parts/jelly/floor-data.js', 'assets/parts/spoon/equalizer-data.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  assert.equal(context.DMA40PortraitColors.length, 4096);
  for (const color of context.DMA40PortraitColors) {
    assert.match(color, /^#[0-9a-f]{6}$/);
  }
  assert.equal(context.DMA40CopperOffsets.length, 1024);
  assert.equal(Buffer.from(context.DMA40FloorColors, 'base64').length, 1032);
  assert.equal(Buffer.from(context.DMA40Equalizer, 'base64').length, 160080);
});

test('the three existing CODEF panels and DMA Is Back are composed as live quadrants', () => {
  for (const panel of ['lockbuster', 'rastermaster', 'chonchon']) {
    const source = fs.readFileSync(path.join(root, `panels/${panel}.js`), 'utf8');
    assert.match(source, new RegExp(`${panel}: createScene`));
  }
  const source = fs.readFileSync(path.join(root, 'demo.js'), 'utf8');
  assert.match(fs.readFileSync(path.join(root, 'effects/dma-is-back.js'), 'utf8'), /DMA40DMAIsBack/);
  assert.match(source, /createVisitors/);
  assert.match(source, /drawVisitors/);
});

test('traveling panel objects retain their indexed Atari ST palettes', () => {
  const sources = ['lockbuster', 'rastermaster', 'chonchon']
    .map(panel => fs.readFileSync(path.join(root, `panels/${panel}.js`), 'utf8'));
  for (const source of sources) assert.match(source, /DMA40PanelExchange/);
  assert.doesNotMatch(sources.join('\n'), /createLinearGradient/);
});

test('the standalone page and README reference packaged files', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const file of [
    'style.css',
    'timeline.js',
    'demo.js',
    'vendor/codef/codef_core.js',
    'vendor/codef/codef_runtime.js',
    'panels/exchange.js',
    'panels/lockbuster.js',
    'panels/rastermaster.js',
    'panels/chonchon.js',
    'effects/leonard-cube.js',
    'effects/dma-is-back.js',
    'effects/spoon.js',
    'effects/city.js',
    'effects/noname.js',
    'effects/jelly.js',
    'media/browser-opening.png',
    'media/browser-four.png',
    'media/browser-circle.png',
    'media/browser-elon.png'
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.ok(index.includes(file) || readme.includes(file), file);
  }
});
