(function (root) {
  'use strict';

  const WIDTH = 640;
  const HEIGHT = 400;
  const STAR_COUNT = 2200;
  const STAR_RADIUS = 800;
  const TWO_PI = Math.PI * 2;
  const SETTLE_AT = 40;
  const GRAY_STYLES = Array.from({length: 256}, (_, level) => `rgb(${level},${level},${level})`);

  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const mix = (from, to, amount) => from + (to - from) * amount;
  const smooth = (from, to, value) => {
    const amount = clamp((value - from) / (to - from));
    return amount * amount * (3 - 2 * amount);
  };
  const vec = (x = 0, y = 0, z = 0) => ({x, y, z});
  const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
  const scale = (point, amount) => vec(point.x * amount, point.y * amount, point.z * amount);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

  function hash(value) {
    let number = value >>> 0;
    number ^= number >>> 16;
    number = Math.imul(number, 0x7feb352d) >>> 0;
    number ^= number >>> 15;
    number = Math.imul(number, 0x846ca68b) >>> 0;
    return (number ^ number >>> 16) >>> 0;
  }

  const noise = value => hash(value) / 4294967296;
  const wrap = (value, period) => value - period * Math.floor((value + period / 2) / period);

  function rotation(angles) {
    const sx = Math.sin(angles.x), cx = Math.cos(angles.x);
    const sy = Math.sin(angles.y), cy = Math.cos(angles.y);
    const sz = Math.sin(angles.z), cz = Math.cos(angles.z);
    return [
      cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
      sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
      -sy, cy * sx, cy * cx
    ];
  }

  function rotate(matrix, point) {
    return vec(
      matrix[0] * point.x + matrix[1] * point.y + matrix[2] * point.z,
      matrix[3] * point.x + matrix[4] * point.y + matrix[5] * point.z,
      matrix[6] * point.x + matrix[7] * point.y + matrix[8] * point.z
    );
  }

  function harmonic(terms, seconds) {
    return terms.reduce((sum, term) => sum + term[0] * Math.sin(seconds * term[1] + (term[2] || 0)), 0);
  }

  function flightAt(seconds) {
    const position = vec(
      harmonic([[420,.62],[130,1.11,.3]], seconds),
      harmonic([[300,.77],[80,.43,1.2]], seconds),
      harmonic([[580,.82],[170,1.37,.7]], seconds)
    );
    const angles = vec(
      harmonic([[.85,.39],[.3,.91]], seconds),
      harmonic([[2,.31],[.4,.67,.4]], seconds),
      harmonic([[.5,.43],[.2,.97]], seconds)
    );
    return {position, rotation: rotation(angles)};
  }

  function relativeInto(view, x, y, z, output) {
    const relativeX = wrap(x - view.position.x, STAR_RADIUS * 2);
    const relativeY = wrap(y - view.position.y, STAR_RADIUS * 2);
    const relativeZ = wrap(z - view.position.z, STAR_RADIUS * 2);
    const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY + relativeZ * relativeZ);
    const fade = 1 - smooth(STAR_RADIUS * .76, STAR_RADIUS * .98, distance);
    const matrix = view.rotation;
    output.point.x = matrix[0] * relativeX + matrix[1] * relativeY + matrix[2] * relativeZ;
    output.point.y = matrix[3] * relativeX + matrix[4] * relativeY + matrix[5] * relativeZ;
    output.point.z = matrix[6] * relativeX + matrix[7] * relativeY + matrix[8] * relativeZ;
    output.fade = fade;
    return output;
  }

  function projectInto(point, output) {
    if (point.z < 12) return false;
    const amount = 360 / point.z;
    output.x = 320 + point.x * amount;
    output.y = 200 + point.y * amount;
    output.z = point.z;
    return true;
  }

  function drawStars(effect, ctx, seconds, alpha = 1) {
    const view = flightAt(seconds);
    const previousView = flightAt(Math.max(0, seconds - .02));
    const current = effect.currentStar;
    const previous = effect.previousStar;
    const point = effect.projectedStar;
    const old = effect.previousProjectedStar;
    const stars = effect.stars;
    ctx.save();
    for (let index = 0; index < STAR_COUNT; index++) {
      const offset = index * 3;
      relativeInto(view, stars[offset], stars[offset + 1], stars[offset + 2], current);
      if (current.fade <= 0) continue;
      if (!projectInto(current.point, point) || point.x < 0 || point.x >= WIDTH || point.y < 0 || point.y >= HEIGHT) continue;
      const size = Math.max(.5, 3 - point.z / STAR_RADIUS * 2.5);
      const brightness = (1 - point.z / STAR_RADIUS * .7) * current.fade * alpha;
      if (point.z < STAR_RADIUS * .3) {
        relativeInto(previousView, stars[offset], stars[offset + 1], stars[offset + 2], previous);
        if (projectInto(previous.point, old) && previous.fade > 0 && Math.hypot(point.x - old.x, point.y - old.y) < 24) {
          ctx.strokeStyle = `rgba(${128 * brightness | 0},${128 * brightness | 0},${128 * brightness | 0},${.5 * alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(old.x, old.y); ctx.lineTo(point.x, point.y); ctx.stroke();
        }
      }
      const level = clamp(brightness) * 255 | 0;
      ctx.fillStyle = GRAY_STYLES[level];
      ctx.fillRect(point.x, point.y, size, size);
    }
    ctx.restore();
  }

  function elasticOut(value) {
    const amount = clamp(value);
    if (amount === 0 || amount === 1) return amount;
    return 2 ** (-10 * amount) * Math.sin((10 * amount - .75) * TWO_PI / 3) + 1;
  }

  const elasticIn = value => 1 - elasticOut(1 - clamp(value));

  function delayPatterns() {
    const serpentine = new Array(160);
    const columns = new Array(160);
    const spiral = new Array(160);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 20; x++) {
      const index = y * 20 + x;
      serpentine[index] = y % 2 === 0 ? index : y * 20 + 19 - x;
    }
    for (let y = 0; y < 8; y++) for (let pair = 0; pair < 10; pair++) {
      columns[y * 20 + pair * 2] = pair * 16 + y;
      columns[y * 20 + pair * 2 + 1] = pair * 16 + 15 - y;
    }
    let left = 0, top = 0, right = 19, bottom = 7, step = 0;
    while (left <= right && top <= bottom) {
      for (let x = left; x <= right; x++) spiral[top * 20 + x] = step++;
      top++;
      for (let y = top; y <= bottom; y++) spiral[y * 20 + right] = step++;
      right--;
      if (top <= bottom) { for (let x = right; x >= left; x--) spiral[bottom * 20 + x] = step++; bottom--; }
      if (left <= right) { for (let y = bottom; y >= top; y--) spiral[y * 20 + left] = step++; left++; }
    }
    spiral[70] = 138;
    return {serpentine, columns, spiral};
  }

  function pageText() {
    const pages = [
      ['', 'ALDO   BILIZIR', 'CHONCHON CIGALE COCO', 'CORWIN   DWORKIN', 'GRUMPY   JINX', 'LARCOCIEL LOCKBUSTER', 'MAD   MAD GILLOU', 'METALIKE PDM TWISTER'],
      ['', '', 'TO ALL DEMOSCENE', 'ENTHUSIASTS', 'AND YOU !', '', '', ''],
      ['', '', 'RENDEZ-VOUS', 'TOUS LES MERCREDIS', 'A 17H30', 'POUR REGARDER', 'LATEAM', '']
    ];
    return pages.map(lines => lines.map(line => {
      const left = Math.floor((20 - line.length) / 2);
      return ' '.repeat(left) + line + ' '.repeat(20 - line.length - left);
    }).join(''));
  }

  function pageState(effect, seconds) {
    const milliseconds = seconds * 1000;
    const segments = [
      {page:0,start:0,exit:8680,end:12860,enter:effect.patterns.serpentine,leave:effect.patterns.columns},
      {page:1,start:12860,exit:21540,end:25720,enter:effect.patterns.spiral,leave:effect.patterns.serpentine},
      {page:2,start:25720,exit:Infinity,end:Infinity,enter:effect.patterns.columns,leave:null}
    ];
    return segments.find(segment => milliseconds < segment.end) || segments.at(-1);
  }

  function drawFontGlyph(ctx, image, character, centerX, centerY, amount, alpha, baseAlpha) {
    if (character === ' ' || amount <= 0) return;
    const index = clamp(character.charCodeAt(0) - 32, 0, 59);
    const size = 32 * amount;
    ctx.globalAlpha = baseAlpha * alpha;
    ctx.drawImage(image, index % 10 * 32, Math.floor(index / 10) * 32, 32, 32, centerX - size / 2, centerY - size / 2, size, size);
  }

  function drawPages(effect, ctx, images, seconds, alpha = 1) {
    const state = pageState(effect, seconds);
    const milliseconds = seconds * 1000;
    const text = effect.pages[state.page];
    const exiting = milliseconds >= state.exit;
    const poses = effect.poses;
    const posePool = effect.posePool;
    for (let index = 0; index < text.length; index++) {
      const targetX = 16 + index % 20 * 32;
      const targetY = 86 + Math.floor(index / 20) * 32;
      let amount;
      if (!exiting) amount = elasticOut((milliseconds - state.start - state.enter[index] * 20) / 2000);
      else amount = 1 - elasticIn((milliseconds - state.exit - state.leave[index] * 20) / 1000);
      const pose = posePool[index];
      pose.character = text[index];
      pose.x = mix(320, targetX, amount);
      pose.y = mix(240, targetY, amount);
      pose.z = mix(1e-9, 1, amount);
      poses[index] = pose;
    }
    poses.sort((a, b) => a.z - b.z);
    const baseAlpha = ctx.globalAlpha;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const pose of poses) drawFontGlyph(ctx, images.nonameFont, pose.character, pose.x, pose.y, pose.z, alpha, baseAlpha);
    const headings = ['MEMBERS OF DMA', 'GREETINGS', ''];
    const heading = headings[state.page];
    if (heading) {
      let headingAlpha = smooth(0, 1, seconds - state.start / 1000);
      if (exiting) headingAlpha *= 1 - smooth(0, .5, seconds - state.exit / 1000);
      let x = (WIDTH - heading.length * 16) / 2 + 8;
      for (const character of heading) { drawFontGlyph(ctx, images.nonameFont, character, x, 84, .5, alpha * headingAlpha, baseAlpha); x += 16; }
    }
    ctx.restore();
  }

  function compileLogoWave() {
    const sections = [
      {samples:389,terms:[[20,7/180*Math.PI,0,false],[30,3/180*Math.PI,0,true]]},
      {samples:120,terms:[[4,72/180*Math.PI,0,false]]},
      {samples:68,terms:[[40,8/180*Math.PI,0,false]]},
      {samples:389,terms:[[20,7/180*Math.PI,0,false],[30,3/180*Math.PI,0,true]]},
      {samples:36,terms:[[4,72/180*Math.PI,0,false]]},
      {samples:189,terms:[[30,8/180*Math.PI,0,false]]}
    ];
    const result=[];
    for(const section of sections)for(let index=0;index<section.samples;index++)result.push(section.terms.reduce((sum,term)=>sum+term[0]*(term[3]?Math.cos(index*term[1]+term[2]):Math.sin(index*term[1]+term[2])),0));
    return result;
  }

  function prepareLogo(effect, images) {
    const width=180,height=Math.round(width*images.logo.height/images.logo.width),margin=64,padding=32;
    const source=document.createElement('canvas');source.width=width+2*padding+2*margin;source.height=height;
    source.getContext('2d').drawImage(images.logo,margin+padding,0,width,height);
    const rows=document.createElement('canvas');rows.width=width+2*padding;rows.height=height;
    effect.logo={width,height,margin,padding,source,rows,rowsContext:rows.getContext('2d'),table:compileLogoWave()};
  }

  function drawWarpedLogo(effect,ctx,images,seconds,alpha=1){
    const logo=effect.logo,age=seconds-SETTLE_AT;
    const strength=age>=0?1-smooth(.5,1.5,age):1;
    const travel=age>=0?smooth(.5,1.5,age):0;
    const flatMix=age>=0?smooth(1.1,1.5,age):0;
    const tick=Math.floor(seconds*60+1e-7),gain=.5*strength;
    const rows=logo.rowsContext;rows.clearRect(0,0,logo.rows.width,logo.rows.height);
    for(let row=0;row<logo.height;row++){
      const sample=logo.table[(tick+row)%logo.table.length]+64;
      const offset=64+(sample-64)*gain;
      rows.drawImage(logo.source,offset,row,logo.rows.width,1,0,row,logo.rows.width,1);
    }
    const warpedWidth=180+(400-180)*travel,warpedCenterY=2+logo.height/2+(150-2-logo.height/2)*travel;
    ctx.save();ctx.globalAlpha*=alpha*(1-flatMix);
    const outputScale=warpedWidth/180;
    for(let column=0;column<logo.rows.width;column+=8){
      const verticalGain=.22*strength,offset=35*verticalGain+Math.cos(tick*.1+column/8*.1)*35*verticalGain;
      ctx.drawImage(logo.rows,column,0,Math.min(8,logo.rows.width-column),logo.height,
        320-warpedWidth/2+(column-logo.padding)*outputScale,warpedCenterY-logo.height*outputScale/2+offset*outputScale,Math.min(8,logo.rows.width-column)*outputScale,logo.height*outputScale);
    }
    ctx.restore();
    if(flatMix>0){ctx.save();ctx.globalAlpha*=alpha*flatMix;const height=warpedWidth*images.logo.height/images.logo.width;ctx.drawImage(images.logo,320-warpedWidth/2,warpedCenterY-height/2,warpedWidth,height);ctx.restore();}
  }

  function drawEqualizer(effect,ctx,seconds,alpha=1){
    let gradient=effect.equalizerGradients.get(ctx);if(!gradient){gradient=ctx.createLinearGradient(0,327,0,400);gradient.addColorStop(0,'#ffff00');gradient.addColorStop(1,'#ff0000');effect.equalizerGradients.set(ctx,gradient);}ctx.fillStyle=gradient;ctx.save();ctx.globalAlpha*=alpha;
    const frame=clamp(Math.floor(seconds*50+1e-7),0,2000);
    for(let column=0;column<80;column++){
      const level=(effect.equalizer[frame*80+column]||0)*72/255;
      ctx.fillRect(column*8,399-level,7,level);
    }
    ctx.restore();
  }

  function create(images){
    const stars=new Float64Array(STAR_COUNT*3);for(let index=0;index<STAR_COUNT;index++){const offset=index*3;stars[offset]=(noise(index*3+14001)-.5)*2*STAR_RADIUS;stars[offset+1]=(noise(index*3+14002)-.5)*2*STAR_RADIUS;stars[offset+2]=(noise(index*3+14003)-.5)*2*STAR_RADIUS;}
    const equalizer=Uint8Array.from(atob(root.DMA40Equalizer||''),character=>character.charCodeAt(0));
    const point=()=>({point:vec(),fade:0});
    const posePool=Array.from({length:160},(_,index)=>({index,character:' ',x:0,y:0,z:0}));
    const effect={stars,currentStar:point(),previousStar:point(),projectedStar:vec(),previousProjectedStar:vec(),patterns:delayPatterns(),pages:pageText(),posePool,poses:posePool.slice(),equalizer,equalizerGradients:new WeakMap()};prepareLogo(effect,images);return effect;
  }

  function draw(effect,ctx,images,seconds){
    const age=seconds-SETTLE_AT;
    ctx.fillStyle='#000';ctx.fillRect(0,0,WIDTH,HEIGHT);
    let backgroundAlpha=1;if(age>=0)backgroundAlpha=1-smooth(0,.5,age);
    if(backgroundAlpha>0){drawStars(effect,ctx,Math.min(seconds,SETTLE_AT),backgroundAlpha);drawEqualizer(effect,ctx,seconds,backgroundAlpha);drawPages(effect,ctx,images,Math.min(seconds,SETTLE_AT),backgroundAlpha);}
    drawWarpedLogo(effect,ctx,images,seconds,1);
  }

  root.DMA40Noname=Object.freeze({create,draw});
})(typeof globalThis!=='undefined'?globalThis:this);
