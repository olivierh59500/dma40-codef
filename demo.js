(function () {
  'use strict';

  const timeline = window.DMA40Timeline;
  const WIDTH = 640;
  const HEIGHT = 400;
  const IMAGE_PATHS = {
    logo: 'assets/intro/logo.png',
    ball: 'assets/intro/ball.png',
    bars: 'assets/intro/bars.png',
    chrome: 'assets/intro/chrome.png',
    grey: 'assets/intro/font-grey.png',
    union: 'assets/intro/union-font.png',
    four: 'media/four-screens.png',
    circular: 'media/circular-lens.png',
    elon: 'assets/city/elon-comic.png',
    portrait: 'assets/portrait/portrait.jpg',
    dmaBack: 'assets/parts/dma/back.png',
    dmaFont: 'assets/parts/dma/font.png',
    spoonBalls: 'assets/parts/spoon/balls.png',
    nonameFont: 'assets/parts/spoon/noname-font.png'
  };

  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load ${path}`));
      image.src = path;
    });
  }

  async function createQuadPanels(images) {
    const runtime = window.CODEFDemo;
    const factories = window.DMA40PanelFactories;
    const bundles = window.DMA40PanelAssets;
    if (!runtime || !factories || !bundles) throw new Error('The faithful CODEF panel runtime is unavailable');

    const previousAssets = window.CODEF_ASSETS;
    window.CODEF_ASSETS = bundles.shared;
    const visualSound = new runtime.Soundtrack(new runtime.Assets());
    await visualSound.select('music.ym');

    const specifications = [
      ['lockbuster', 320, 240],
      ['rastermaster', 320, 200],
      ['chonchon', 320, 200]
    ];
    const panels = {};
    for (const [name, width, height] of specifications) {
      window.CODEF_ASSETS = bundles[name];
      const screen = new runtime.Layer(width, height);
      const scene = await factories[name]({assets: new runtime.Assets(), screen, sound: visualSound});
      if (scene.start) scene.start();
      panels[name] = {scene, screen, width, height};
    }
    window.CODEF_ASSETS = previousAssets;
    const quad = {tick: 0, visualSound, panels, images, dma: window.DMA40DMAIsBack.create(images),presenter:new runtime.PixelPresenter(WIDTH,HEIGHT)};
    quad.panelRegions = [
      {x:0,y:0,width:320,height:240,pixels:panels.lockbuster.screen.rgba},
      {x:320,y:0,width:320,height:200,pixels:panels.rastermaster.screen.rgba},
      {x:320,y:200,width:320,height:200,pixels:panels.chonchon.screen.rgba}
    ];
    quad.visitors = createVisitors();
    return quad;
  }

  function bezierPoint(curve, amount) {
    const inverse = 1 - amount;
    return {
      x: inverse ** 3 * curve.from.x + 3 * inverse ** 2 * amount * curve.first.x + 3 * inverse * amount ** 2 * curve.second.x + amount ** 3 * curve.to.x,
      y: inverse ** 3 * curve.from.y + 3 * inverse ** 2 * amount * curve.first.y + 3 * inverse * amount ** 2 * curve.second.y + amount ** 3 * curve.to.y
    };
  }

  function createVisitors() {
    const origins = [{x:0,y:0},{x:320,y:0},{x:0,y:200},{x:320,y:200}];
    return [0,0,0,1,2,3].map((home, ordinal) => {
      const origin = origins[home];
      let from = {x:0,y:0};
      const curves = [home ^ 1, home ^ 3, home ^ 2, home].map(target => {
        const to = {x:origins[target].x-origin.x,y:origins[target].y-origin.y};
        const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),normal={x:-dy/length,y:dx/length};
        const middle={x:origin.x+160+(from.x+to.x)/2,y:origin.y+100+(from.y+to.y)/2};
        if((320-middle.x)*normal.x+(200-middle.y)*normal.y<0){normal.x=-normal.x;normal.y=-normal.y;}
        const bend=24+(ordinal%3)*12;
        const curve={from:{...from},first:{x:from.x+dx/3+normal.x*bend,y:from.y+dy/3+normal.y*bend},second:{x:from.x+dx*2/3+normal.x*bend,y:from.y+dy*2/3+normal.y*bend},to};
        from=to;return curve;
      });
      return {home,ordinal,first:4+ordinal*.55,curves,active:false,departure:0,offset:{x:0,y:0}};
    });
  }

  function updateVisitors(quad, seconds) {
    for(const visitor of quad.visitors){
      visitor.active=false;
      if(seconds>=visitor.first){const cycle=Math.floor((seconds-visitor.first)/34);visitor.departure=visitor.first+cycle*34;visitor.active=seconds-visitor.departure<24;}
      if(visitor.active){const local=clamp(seconds-visitor.departure,0,24),leg=Math.min(3,Math.floor(local/6)),amount=smooth((local-leg*6)/4.4);visitor.offset=bezierPoint(visitor.curves[leg],amount);}else visitor.offset={x:0,y:0};
      if(visitor.ordinal<3)quad.panels.lockbuster.scene.exchange.setAway(visitor.ordinal,visitor.active);
      else if(visitor.ordinal===3)quad.panels.rastermaster.scene.exchange.setAway(visitor.active);
      else if(visitor.ordinal===4)quad.panels.chonchon.scene.exchange.setAway(visitor.active);
      else quad.dma.away=visitor.active;
    }
  }

  function drawVisitors(quad, ctx) {
    const origins=[{x:0,y:0},{x:320,y:0},{x:0,y:200},{x:320,y:200}];
    for(const visitor of quad.visitors){
      if(!visitor.active)continue;
      const origin=origins[visitor.home],x=origin.x+visitor.offset.x,y=origin.y+visitor.offset.y;
      if(visitor.ordinal<3)quad.panels.lockbuster.scene.exchange.draw(ctx,visitor.ordinal,x,y,1,200/240);
      else if(visitor.ordinal===3)quad.panels.rastermaster.scene.exchange.draw(ctx,x,y,1,1);
      else if(visitor.ordinal===4)quad.panels.chonchon.scene.exchange.draw(ctx,x,y,1,1);
      else window.DMA40DMAIsBack.drawCube(ctx, quad.dma, x + 160, y + 100, .5);
    }
  }

  function presentQuadPanels(quad){
    quad.presenter.drawRegions(quad.panelRegions);
  }

  function syncQuad(quad, seconds) {
    const target = Math.max(0, Math.floor(seconds * 50 + 1e-7));
    if (target < quad.tick) return false;
    while (quad.tick < target) {
      updateVisitors(quad, (quad.tick + 1) / 50);
      quad.visualSound.tick = quad.tick;
      quad.panels.lockbuster.scene.update();
      quad.panels.rastermaster.scene.update();
      quad.panels.chonchon.scene.update();
      const dmaTarget = Math.floor((quad.tick + 1) * 60 / 50);
      while (quad.dma.tick < dmaTarget) window.DMA40DMAIsBack.update(quad.dma);
      quad.tick++;
    }
    updateVisitors(quad, target / 50);
    quad.panels.lockbuster.scene.render(false);
    quad.panels.rastermaster.scene.render(false);
    quad.panels.chonchon.scene.render(false);
    presentQuadPanels(quad);
    window.DMA40DMAIsBack.draw(quad.dma, quad.images);
    return true;
  }

  async function createApp(images) {
    const surface = new window.canvas(WIDTH, HEIGHT, 'screen');
    const ctx = surface.contex;
    ctx.imageSmoothingEnabled = false;
    surface.canvas.setAttribute('aria-label', 'DMA40 CODEF browser production');
    const audio = new Audio('assets/audio/dma40.webm');
    audio.preload = 'auto';
    const state = {
      tick: 0,
      paused: false,
      sound: false,
      previous: 0,
      accumulator: 0,
      completed: false,
      images,
      surface,
      ctx,
      audio
    };

    state.quad = await createQuadPanels(images);
    state.spoon = window.DMA40Spoon.create();
    state.city = window.DMA40City.create(images);
    state.noname = window.DMA40Noname.create(images);
    state.jelly = window.DMA40Jelly.create(images);
    state.cityIncoming = document.createElement('canvas');
    state.cityIncoming.width = WIDTH;
    state.cityIncoming.height = HEIGHT;

    const query = new URLSearchParams(location.search);
    const sceneName = query.get('scene');
    const selectedScene = sceneName && timeline.SCENES.find(scene => scene.key === sceneName);
    const initial = selectedScene ? selectedScene.start_seconds : Number(query.get('time')) || 0;
    state.tick = Math.round(timeline.clampTime(initial) * timeline.FPS);
    state.paused = query.has('paused');

    bindControls(state);
    render(state);
    refreshUI(state);
    window.dma40 = {
      ready: true,
      state,
      get time() { return state.tick / timeline.FPS; },
      renderAt(seconds) { seek(state, seconds); return snapshot(state); },
      advance(frames = 1) { state.tick = Math.min(Math.round(timeline.DURATION * timeline.FPS), state.tick + Math.max(0, frames | 0)); render(state); refreshUI(state); return snapshot(state); },
      snapshot() { return snapshot(state); },
      pause(value = true) { setPaused(state, value); }
    };
    window.demo = window.dma40;
    window.requestAnimFrame(now => loop(state, now));
    return state;
  }

  function snapshot(state) {
    const seconds = state.tick / timeline.FPS;
    const scene = timeline.sceneAt(seconds);
    const chapter = timeline.chapterAt(seconds);
    return {tick: state.tick, seconds, scene: scene?.key || 'complete', chapter: chapter?.title || 'Complete', paused: state.paused, sound: state.sound};
  }

  function bindControls(state) {
    const sound = document.querySelector('#sound');
    const pause = document.querySelector('#pause');
    const skip = document.querySelector('#skip');
    const restart = document.querySelector('#restart');
    const fullscreen = document.querySelector('#fullscreen');
    sound.onclick = async () => {
      state.sound = !state.sound;
      if (state.sound) {
        state.audio.currentTime = Math.min(timeline.DURATION, state.tick / timeline.FPS);
        try { await state.audio.play(); } catch (error) { state.sound = false; document.querySelector('#status').textContent = error.message; }
      } else state.audio.pause();
      refreshUI(state);
    };
    pause.onclick = () => setPaused(state, !state.paused);
    skip.onclick = () => skipScene(state);
    restart.onclick = () => restartApp(state);
    fullscreen.onclick = async () => {
      const target = document.querySelector('#screen');
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await target.requestFullscreen(); } catch (error) { document.querySelector('#status').textContent = error.message; }
    };
    window.addEventListener('keydown', event => {
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName)) return;
      if (['Space', 'KeyP', 'KeyM', 'KeyR', 'Escape'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Space') skipScene(state);
      else if (event.code === 'KeyP' || event.code === 'Escape') setPaused(state, !state.paused);
      else if (event.code === 'KeyM') sound.click();
      else if (event.code === 'KeyR') restartApp(state);
    });
    state.surface.canvas.addEventListener('dblclick', () => skipScene(state));
    document.addEventListener('visibilitychange', () => {
      state.previous = 0;
      if (document.hidden) state.audio.pause(); else syncAudio(state, true);
    });
  }

  function seek(state, seconds) {
    state.tick = Math.round(timeline.clampTime(seconds) * timeline.FPS);
    state.completed = state.tick >= Math.round(timeline.DURATION * timeline.FPS);
    if (state.sound) {
      state.audio.currentTime = Math.min(timeline.DURATION, state.tick / timeline.FPS);
      if (!state.paused && !state.completed) state.audio.play().catch(() => {});
    }
    render(state);
    refreshUI(state);
  }

  function skipScene(state) {
    const next = timeline.nextSceneTime(state.tick / timeline.FPS);
    if (next === 0 && state.tick > 0) restartApp(state); else seek(state, next);
  }

  function restartApp(state) {
    state.audio.pause();
    const target = new URL(location.href);
    target.search = '';
    location.assign(target.href);
  }

  function setPaused(state, value) {
    state.paused = Boolean(value);
    state.accumulator = 0;
    if (state.paused) state.audio.pause(); else syncAudio(state, true);
    refreshUI(state);
  }

  function syncAudio(state, force = false) {
    if (!state.sound || state.paused || state.completed || document.hidden) return;
    const seconds = state.tick / timeline.FPS;
    if (force || Math.abs(state.audio.currentTime - seconds) > .14) state.audio.currentTime = Math.min(timeline.DURATION, seconds);
    if (state.audio.paused) state.audio.play().catch(() => {});
  }

  function refreshUI(state) {
    const snap = snapshot(state);
    const time = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
    document.querySelector('#status').textContent = `${snap.chapter} · ${time(snap.seconds)} / ${time(timeline.DURATION)}`;
    document.querySelector('#pause').textContent = state.paused ? 'Resume' : 'Pause';
    document.querySelector('#sound').textContent = state.sound ? 'Mute sound' : 'Enable sound';
    document.querySelector('#sound').setAttribute('aria-pressed', String(state.sound));
  }

  function loop(state, now) {
    if (!state.previous) state.previous = now;
    if (!state.paused && !document.hidden && !state.completed) {
      state.accumulator += Math.min(250, now - state.previous);
      let advanced = false;
      while (state.accumulator >= 1000 / timeline.FPS) {
        state.tick++;
        advanced = true;
        state.accumulator -= 1000 / timeline.FPS;
        if (state.tick >= Math.round(timeline.DURATION * timeline.FPS)) {
          state.tick = Math.round(timeline.DURATION * timeline.FPS);
          state.completed = true;
          state.audio.pause();
          break;
        }
      }
      if (advanced) {
        if (state.tick % 25 === 0) { syncAudio(state); refreshUI(state); }
        render(state);
      }
    }
    state.previous = now;
    window.requestAnimFrame(next => loop(state, next));
  }

  function render(state) {
    const seconds = state.tick / timeline.FPS;
    const scene = timeline.sceneAt(seconds) || timeline.SCENES[timeline.SCENES.length - 1];
    const local = seconds - scene.start_seconds;
    const ctx = state.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    switch (scene.key) {
      case 'opening': drawOpening(state, local); break;
      case 'four-loader': drawLoader(state, local, 'FOUR DMA SCREENS'); break;
      case 'four': drawFour(state, local); break;
      case 'four-fade': drawFour(state, 32); fadeBlack(ctx, local / 2); break;
      case 'spoon-loader': drawLoader(state, local, 'THERE IS NO SPOON'); break;
      case 'vectorballs':
      case 'spoon':
      case 'flight':
      case 'matrix':
      case 'secrets':
      case 'pacmen':
      case 'circle': window.DMA40Spoon.draw(state.spoon, ctx, state.images, seconds - 75.66); break;
      case 'city': {
        const cityTime = seconds - 169.54;
        if (cityTime >= 39) window.DMA40Noname.draw(state.noname, state.cityIncoming.getContext('2d'), state.images, 0);
        window.DMA40City.draw(state.city, ctx, state.images, cityTime, state.cityIncoming);
        break;
      }
      case 'noname':
      case 'handoff': window.DMA40Noname.draw(state.noname, ctx, state.images, seconds - 211.54); break;
      case 'jelly':
      case 'flock':
      case 'greeting':
      case 'pi': window.DMA40Jelly.draw(state.jelly, ctx, state.images, seconds - 253.54 + 3.8); break;
      default: window.DMA40Jelly.draw(state.jelly, ctx, state.images, 77.04); break;
    }
    ctx.restore();
  }

  function fill(ctx, color = '#000') { ctx.fillStyle = color; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
  function fadeBlack(ctx, amount) { ctx.fillStyle = rgba(0, 0, 0, clamp(amount)); ctx.fillRect(0, 0, WIDTH, HEIGHT); }
  function drawBitmapText(ctx, image, text, x, y, scale = 1) {
    for (const char of text.toUpperCase()) {
      const index = Math.max(0, Math.min(59, char.charCodeAt(0) - 32));
      ctx.drawImage(image, index % 10 * 16, Math.floor(index / 10) * 16, 16, 16, Math.round(x), Math.round(y), 16 * scale, 16 * scale);
      x += 16 * scale;
    }
  }

  function drawOpeningLogo(state, seconds) {
    const age = seconds - 1.5;
    if (age < 0) return;
    const ctx = state.ctx;
    const image = state.images.logo;
    const alpha = smooth(age / .7);
    const entrance = (1 - smooth(age / 1.4)) * -240;
    const clock = age * 85;
    const globalY = 13 * Math.sin(clock * .0342) + 13 * Math.sin(clock * .0443);
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let row = 0; row < 17; row++) {
      const sourceY = row * image.height / 17;
      const sourceHeight = (row + 1) * image.height / 17 - sourceY;
      const x = 105 + 30 * Math.sin(age * .64) + 10 * Math.sin(clock * .0342 + row * .2736) + 10 * Math.sin(clock * .0143 + row * .1144);
      const y = 22 + row * 182 / 17 + entrance + globalY;
      ctx.drawImage(image, 0, sourceY, image.width, sourceHeight, x, y, 430, 182 / 17 + 1);
    }
    ctx.restore();
  }

  function drawOpeningBobs(state, seconds) {
    if (seconds < 4) return;
    const ctx = state.ctx;
    for (let group = 0; group < 3; group++) for (let index = 0; index < 20; index++) {
      const age = seconds - (4 + (group * 20 + index) * .13);
      if (age < 0) continue;
      const clock = seconds * 85;
      const phase = group * 2.1;
      let x = 320 + 139 * Math.sin(clock * .0242 + index * .1254 + phase) + 139 * Math.sin(clock * .0193 + index * .253 - phase);
      let y = 218 + 29 * Math.sin(clock * .0242 + index * .1145 + phase) + 29 * Math.sin(clock * .0203 + index * .223 + phase * .7);
      x = clamp(x, 16, 624);
      y = clamp(y, 150, 281);
      x = mix(group & 1 ? WIDTH + 32 : -32, x, smooth(age / .7));
      ctx.save();
      ctx.globalAlpha *= smooth(age / .45);
      ctx.drawImage(state.images.ball, Math.round(x - 11), Math.round(y - 11), 22, 22);
      ctx.restore();
    }
  }

  function rasterProjection(x, y, seconds) {
    return {
      x: x - 64 + 12 * Math.sin(y * .04 + seconds * 1.1),
      y: 114 + y * 1.15 + 48 * Math.sin(x * .009 + seconds * .35) + 24 * Math.sin(y * .035 - seconds * .5)
    };
  }

  function drawOpeningRasters(state, seconds) {
    if (seconds < 9) return;
    const offsets = window.DMA40CopperOffsets;
    if (!offsets) return;
    const ctx = state.ctx;
    const ticks = Math.floor((seconds - 9) * 50) + 1;
    const phaseA = ticks * 3 & 1023;
    const phaseB = ticks * -5 & 1023;
    ctx.save();
    ctx.globalAlpha *= 98 / 255 * smooth((seconds - 9) / 1.5);
    for (let index = 0; index < 232; index++) {
      const sourceY = index * 2 % 20;
      const sourceX = ((offsets[(phaseA + index * 7) & 1023] + offsets[(phaseB + index * 10) & 1023] + 60) >> 1);
      const top = rasterProjection(sourceX + 23, index * 2, seconds);
      const bottom = rasterProjection(sourceX + 23, 464, seconds);
      const dx = bottom.x - top.x;
      const dy = bottom.y - top.y;
      const length = Math.hypot(dx, dy);
      if (length < 1 || Math.min(top.y, bottom.y) > HEIGHT + 80) continue;
      ctx.save();
      ctx.translate(top.x, top.y);
      ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
      ctx.drawImage(state.images.bars, 0, sourceY, 46, 2, -23, 0, 46, length);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawChromeScroll(state, seconds) {
    const ctx = state.ctx;
    const text = 'WELCOME TO THE DMA40 MEGADEMO!';
    const widths = [3,1,2,3,3,3,3,1,1,1,3,2,1,2,1,2,3,2,2,2,2,2,2,2,2,2,1,1,3,2,3,2,3,3,2,2,2,2,2,2,2,1,2,2,2,3,2,3,2,3,2,2,2,2,3,3,3,2,2];
    let x = WIDTH - (seconds - 14) * 192;
    for (const char of text) {
      const index = Math.max(0, Math.min(58, char.charCodeAt(0) - 32));
      const width = widths[index] * 32;
      if (x + width >= 0 && x < WIDTH) ctx.drawImage(state.images.chrome, index * 96, 0, width, 80, Math.round(x), 310, width, 80);
      x += width;
    }
    const caption = 'CREATIVITY CODING PLEASURE';
    drawBitmapText(ctx, state.images.grey, caption, (WIDTH - caption.length * 8) / 2, 290, .5);
  }

  function drawOpening(state, t) {
    const ctx = state.ctx;
    fill(ctx);
    drawOpeningRasters(state, t);
    drawOpeningBobs(state, t);
    window.DMA40LeonardCube.draw(ctx, t, {centerX:320, centerY:215, focal:346.4101615, halfSize:30, deform:true});
    drawOpeningLogo(state, t);
    if (t >= 14) drawChromeScroll(state, t);
    if (t > 30.66) fadeBlack(ctx, smooth((t - 30.66) / 1));
  }

  function drawLoader(state, t, destination) {
    const ctx = state.ctx;
    fill(ctx);
    const tick = Math.floor(t * 50 + 1e-7);
    if (tick < 60) return;
    const title = destination.includes('FOUR') ? 'FOUR DEMOS' : 'THERE IS NO SPOON';
    let lines = [
      '', '', 'DMA40 MEGADEMO', '40 YEARS OF DMA', '', title, '',
      'CODE, PIXELS, MUSIC', 'AND FRIENDSHIP', '', 'IN MEMORY OF FRIENDS',
      'WHO HAVE LEFT US', '', 'YOU ARE PART OF DMA', '', 'PLEASE WAIT WHILE',
      'PREPARING THE SCREEN', '', '', '', '', '', ''
    ];
    if (title === 'FOUR DEMOS') lines = [
      '', '', 'DMA40 MEGADEMO', '40 YEARS OF DMA', '', title, '',
      'LOCKBUSTER 3', 'JINX RASTER MASTER', 'CHONCHON', 'DMA IS BACK', '',
      '4 SCREENS TOGETHER', '', 'IN MEMORY OF FRIENDS', 'WHO HAVE LEFT US', '',
      'PLEASE WAIT WHILE', 'PREPARING THE SCREEN', '', '', '', '', ''
    ];
    lines = lines.map(line => {
      const clipped = line.slice(0, 20);
      const left = Math.floor((20 - clipped.length) / 2);
      return ' '.repeat(left) + clipped + ' '.repeat(20 - clipped.length - left);
    });
    const sourceTime = (tick - 60) * 168;
    const paperX = 64;
    const paperY = 60;
    const paperScale = 5 / 6;
    const baseX = 154;
    const baseY = 374 - (lines.length - 1) * 16;
    let order = 0;
    for (let column = 0; column < 20; column++) for (let reverseRow = 0; reverseRow < lines.length; reverseRow++, order++) {
      const row = lines.length - 1 - reverseRow;
      const char = lines[row][column];
      if (char === ' ') continue;
      const progress = clamp((sourceTime - order * 30) / 50);
      if (progress <= 0) continue;
      const finalY = baseY + row * 16;
      const y = mix(500, finalY, progress) - 8;
      const x = baseX + column * 16;
      const index = clamp(char.charCodeAt(0) - 32, 0, 59);
      ctx.drawImage(state.images.union, index % 10 * 16, Math.floor(index / 10) * 16, 16, 16,
        (paperX + x) * paperScale, (paperY + y) * paperScale, 16 * paperScale, 16 * paperScale);
    }
    if (tick >= 230) fadeBlack(ctx, smooth((tick - 230) / 20));
  }

  function drawFour(state, t) {
    const ctx = state.ctx;
    fill(ctx);
    if (!syncQuad(state.quad, t)) {
      ctx.drawImage(state.images.four, 0, 0, WIDTH, HEIGHT);
      return;
    }
    ctx.drawImage(state.quad.presenter.canvas, 0, 0, 320, 240, 0, 0, 320, 200);
    ctx.drawImage(state.quad.presenter.canvas, 320, 0, 320, 200, 320, 0, 320, 200);
    ctx.drawImage(state.quad.presenter.canvas, 320, 200, 320, 200, 0, 200, 320, 200);
    ctx.drawImage(state.quad.dma.canvas, 0, 0, 640, 400, 320, 200, 320, 200);
    drawVisitors(state.quad, ctx);
  }

  async function main() {
    const status = document.querySelector('#status');
    try {
      const entries = await Promise.all(Object.entries(IMAGE_PATHS).map(async ([name, path]) => [name, await loadImage(path)]));
      await createApp(Object.fromEntries(entries));
    } catch (error) {
      status.textContent = `Unable to start DMA40: ${error.message}`;
      console.error(error);
    }
  }

  main();
})();
