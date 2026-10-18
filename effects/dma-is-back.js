(function (root) {
  'use strict';

  const WIDTH = 640;
  const HEIGHT = 400;
  const SURFACE_WIDTH = 1280;
  const ROW_HEIGHT = 3;
  const SOURCE_ROWS = 36;
  const MESSAGE = '          WELCOME TO THE "DMA-IS-BACK" DEMO BY BILIZIR, WRITTEN IN GOLANG + EBITEN.     GREETINGS TO ALL DEMOSCENE LOVERS AND ATARI ST FANS!     LET\'S WRAP...          ';
  const CUBE_VERTICES = [[-80,-80,-80],[80,-80,-80],[80,80,-80],[-80,80,-80],[-80,-80,80],[80,-80,80],[80,80,80],[-80,80,80]];
  const CUBE_FACES = [[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]];
  const CUBE_COLORS = ['#e0a0c0','#e0a0c0','#e060c0','#e060c0','#e0e0e0','#e0e0e0'];

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function compileCurve(definition) {
    const extent = definition.extent || 360;
    const limit = extent - definition.step;
    const values = [];
    for (let position = 0; position < limit; position += definition.step) {
      const angle = position * Math.PI / 180;
      let sum = 0;
      for (const term of definition.terms || []) {
        let amplitude = term.amplitude;
        if (term.attack && position < term.attack) amplitude *= position / term.attack;
        else if (term.release && position > extent - term.release) amplitude *= (extent - position) / term.release;
        if (term.alternate && values.length % 2 === 1) amplitude = -amplitude;
        const phase = angle * term.frequency + (term.phase || 0);
        sum += amplitude * (term.cosine ? Math.cos(phase) : Math.sin(phase));
      }
      values.push(sum);
    }
    const result = [];
    let drift = 0, previous = 0;
    for (const value of values) {
      const rounded = -Math.floor(value - drift);
      result.push(rounded - previous);
      previous = rounded;
      drift += (definition.drift || 0) / values.length;
    }
    return result;
  }

  function makeWave() {
    const curves = [
      {step:2.25,terms:[]},
      {step:.20,drift:140,terms:[{amplitude:100,frequency:1}]},
      {step:.25,drift:175,terms:[{amplitude:110,frequency:1}]},
      {step:.30,drift:210,terms:[{amplitude:120,frequency:1}]},
      {step:.12,drift:175,terms:[{amplitude:100,frequency:1},{amplitude:25,frequency:10}]},
      {step:.16,drift:210,terms:[{amplitude:110,frequency:1},{amplitude:27.5,frequency:9}]},
      {step:.20,drift:245,terms:[{amplitude:120,frequency:1},{amplitude:30,frequency:8}]},
      {step:.18,extent:720,terms:[{amplitude:90,frequency:1},{amplitude:12,frequency:3,alternate:true,attack:160,release:160}]}
    ].map(compileCurve);
    const order = [1,1,4,1,1,2,3,2,1,5,2,1,7];
    const wave = [];
    let position = 0;
    for (const index of order) for (const delta of curves[index]) { position += delta; wave.push(position); }
    return wave;
  }

  function cumulativeAt(values, index) {
    let cycles = Math.trunc(index / values.length);
    let position = index % values.length;
    if (position < 0) { position += values.length; cycles--; }
    return cycles * values.at(-1) + values[position];
  }

  function fillCumulative(values, start, count) {
    const output = new Int32Array(count);
    for (let index = 0; index < count; index++) output[index] = cumulativeAt(values, start + index);
    return output;
  }

  function glyphWidth(character) {
    if ("!',.:;I".includes(character)) return 16;
    if (' "()-<=>'.includes(character)) return 32;
    return 48;
  }

  function create(images) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
    const surface = document.createElement('canvas');
    surface.width = SURFACE_WIDTH; surface.height = SOURCE_ROWS * ROW_HEIGHT;
    const surfaceContext = surface.getContext('2d'); surfaceContext.imageSmoothingEnabled = false;
    const glyphs = Array.from(MESSAGE, character => ({character, width:glyphWidth(character)}));
    const positions = [];
    let position = 0;
    for (const glyph of glyphs) { position += glyph.width * 3; positions.push(position); }
    const panel = {tick:0,away:false,canvas,context,surface,surfaceContext,glyphs,positions,wave:makeWave(),displayedLetter:-1};
    panel.cube = createCube();
    return panel;
  }

  function vector(x = 0, y = 0, z = 0) { return {x, y, z}; }
  function copyVector(point) { return vector(point.x, point.y, point.z); }

  function createCube() {
    const cube = {
      step:0, timer:0, pos:0, pulse:0, swingX:0, swingZ:0, swingAmplitude:1,
      bounceVelocity:0, bouncePosition:0, rotation:vector(), handoff:null,
      transformed:CUBE_VERTICES.map(([x,y,z]) => vector(x,y,z))
    };
    cube.transformed = sampleCube(cube);
    return cube;
  }

  function rotateXYZ(point, angles) {
    const sx=Math.sin(angles.x),cx=Math.cos(angles.x),sy=Math.sin(angles.y),cy=Math.cos(angles.y),sz=Math.sin(angles.z),cz=Math.cos(angles.z);
    const y=point.y*cx-point.z*sx,z=point.y*sx+point.z*cx;
    const x=point.x*cy+z*sy,turnedZ=-point.x*sy+z*cy;
    return vector(x*cz-y*sz,x*sz+y*cz,turnedZ);
  }

  // This is the fixed 60 Hz DCK DMA jelly-cube controller and deformation stack.
  function sampleCube(cube) {
    const seconds=cube.pos*3;
    let extraScale=1,extraOffsetY=0,twist=0;
    if(cube.step===2)extraScale=1+.2*Math.sin(cube.pulse);
    else if(cube.step===4)extraOffsetY=cube.bouncePosition*50;
    else if(cube.step===1)twist=Math.sin(cube.timer*.01)*.5;
    const squash=1+.15*Math.sin(seconds*2),stretch=1+.15*Math.cos(seconds*2);
    const sin25=Math.sin(seconds*2.5),cos25=Math.cos(seconds*2.5);
    const secondary=sin25+.5*Math.sin(seconds*5);
    const deformationScale=cube.step===2?1+.3*Math.sin(cube.pulse*2):1;
    return CUBE_VERTICES.map(([ox,oy,oz])=>{
      let point=vector(ox*extraScale,oy*extraScale,oz*extraScale);
      const reference=copyVector(point);
      const key=ox*.01+oy*.02+oz*.03;
      const influence=.5+.5*Math.hypot(reference.x,reference.y,reference.z)/80;
      const amount=25*deformationScale;
      point.x+=(.4*Math.sin(seconds+key*5)+.2*Math.sin(seconds*2.1+key*3))*amount*influence;
      point.y+=(.4*Math.cos(seconds*1.3+key*7)+.2*Math.cos(seconds*1.7+key*4))*amount*influence;
      point.z+=(.3*Math.sin(seconds*.7+key*3)+.15*Math.cos(seconds*1.9+key*6))*amount*influence;
      point.x*=squash;point.y*=stretch;point.z*=1/(squash*stretch*.5+.5);
      const ripple=Math.sin(seconds*4+Math.hypot(reference.x,reference.y,reference.z)/80*10)*5;
      point.x+=ripple*oy/80;point.y+=ripple*ox/80;
      if(twist){const angle=twist*oy/80,sine=Math.sin(angle),cosine=Math.cos(angle),x=point.x*cosine-point.z*sine;point.z=point.x*sine+point.z*cosine;point.x=x;}
      point=rotateXYZ(point,cube.rotation);
      point.x+=secondary*8;point.y+=cos25*8+extraOffsetY;point.z+=Math.sin(seconds*3.7)*4;
      return point;
    });
  }

  function smooth(value){const amount=clamp(value,0,1);return amount*amount*(3-2*amount);}

  function advanceCube(cube) {
    const previous=cube.transformed.map(copyVector);
    cube.pos+=.014;
    cube.timer++;
    let changed=false;
    if(cube.timer>=300){
      cube.timer=0;cube.step=(cube.step+1)%5;changed=true;
      if(cube.step===4){cube.bounceVelocity=.08;cube.bouncePosition=0;}
      else if(cube.step===3){cube.swingX=cube.rotation.x;cube.swingZ=cube.rotation.z;cube.swingAmplitude=1;}
      else if(cube.step===2)cube.pulse=Math.atan2(cube.rotation.y,cube.rotation.x);
    }
    const speed=.05,timer=cube.timer;
    if(cube.step===0){cube.rotation.x+=speed;cube.rotation.y+=speed;cube.rotation.z-=speed;}
    else if(cube.step===1){const value=Math.sin(timer*.02);cube.rotation.x+=speed*(1+value);cube.rotation.y+=speed*(1.5-value*.5);cube.rotation.z-=speed*(.5+value*.5);}
    else if(cube.step===2){cube.pulse+=.05;const value=1+.3*Math.sin(cube.pulse);cube.rotation.x+=speed*value;cube.rotation.y+=speed*.7*value;cube.rotation.z-=speed*.3;}
    else if(cube.step===3){const value=Math.sin(timer*.03)*cube.swingAmplitude;cube.rotation.x=cube.swingX+value*.8;cube.rotation.y+=speed*.5;cube.rotation.z=cube.swingZ+value*.4;cube.swingAmplitude*=.998;}
    else {cube.bounceVelocity-=.001;cube.bouncePosition+=cube.bounceVelocity;if(cube.bouncePosition<-.3){cube.bouncePosition=-.3;cube.bounceVelocity=Math.abs(cube.bounceVelocity)*.85;}cube.rotation.x+=speed*.3;cube.rotation.y+=speed*(1+Math.max(0,cube.bouncePosition));cube.rotation.z+=speed*.1;}
    let current=sampleCube(cube);
    if(changed)cube.handoff={previous,offsets:previous.map((point,index)=>vector(point.x-current[index].x,point.y-current[index].y,point.z-current[index].z)),start:0,duration:45};
    if(cube.handoff){
      const weight=1-smooth(cube.handoff.start/cube.handoff.duration);
      current=current.map((point,index)=>vector(point.x+cube.handoff.offsets[index].x*weight,point.y+cube.handoff.offsets[index].y*weight,point.z+cube.handoff.offsets[index].z*weight));
      cube.handoff.start++;
      if(cube.handoff.start>cube.handoff.duration)cube.handoff=null;
    }
    cube.transformed=current;
  }

  function drawCube(context, panel, centerX = 320, centerY = 200, outputScale = 1) {
    const projected=panel.cube.transformed.map(point=>{
      const amount=2000/(2300+point.z);
      return {x:centerX+point.x*amount*outputScale,y:centerY+point.y*amount*outputScale,z:point.z};
    });
    const faces=CUBE_FACES.map((indices,index)=>({indices,color:CUBE_COLORS[index],depth:indices.reduce((sum,at)=>sum+panel.cube.transformed[at].z,0)/4}));
    faces.sort((first,second)=>first.depth-second.depth);
    context.save();
    for(const face of faces){
      const polygon=face.indices.map(index=>projected[index]);
      const center=polygon.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4}),{x:0,y:0});
      context.beginPath();
      polygon.forEach((point,index)=>{const x=center.x+(point.x-center.x)*1.005,y=center.y+(point.y-center.y)*1.005;index?context.lineTo(x,y):context.moveTo(x,y);});
      context.closePath();context.fillStyle=face.color;context.fill();
    }
    context.restore();
  }

  function cursorPosition(panel, index) {
    if (index <= 0) return 0;
    return panel.positions[Math.min(index, panel.positions.length) - 1];
  }

  function prepareSurface(panel, images, letter) {
    if (panel.displayedLetter === letter) return;
    panel.displayedLetter = letter;
    const context = panel.surfaceContext;
    context.clearRect(0, 0, panel.surface.width, panel.surface.height);
    let x = 0, index = letter;
    while (x < SURFACE_WIDTH) {
      const glyph = panel.glyphs[index % panel.glyphs.length];
      const code = clamp(glyph.character.charCodeAt(0), 32, 90) - 32;
      context.drawImage(images.dmaFont, code % 10 * 48, Math.floor(code / 10) * 36, glyph.width, 36,
        x, 0, glyph.width * 3, 108);
      x += glyph.width * 3;
      index++;
    }
  }

  function drawScanline(panel, images) {
    const context = panel.context;
    context.fillStyle = '#000060';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    const waves = fillCumulative(panel.wave, panel.tick * 10, Math.ceil(HEIGHT / ROW_HEIGHT));
    let decal = Infinity;
    for (let row = 0; row < 36; row++) decal = Math.min(decal, waves[row]);
    decal = Math.max(0, decal);
    let letter = 0;
    while (letter < panel.positions.length - 1 && panel.positions[letter] <= decal) letter++;
    const origin = cursorPosition(panel, letter);
    const bounce = Math.floor(18 * Math.abs(Math.sin(panel.tick * .1)));
    prepareSurface(panel, images, letter);
    for (let top = 0; top < HEIGHT; top += 3) {
      const height = Math.min(3, HEIGHT - top);
      const row = Math.floor(top / ROW_HEIGHT);
      const raw = waves[row] - origin;
      const sourceY = ((row + bounce) % SOURCE_ROWS) * ROW_HEIGHT;
      if (raw < 0) {
        const width = WIDTH + raw;
        if (width > 0) context.drawImage(panel.surface, 0, sourceY, width, height, -raw, top, width, height);
        continue;
      }
      const sourceX = raw % SURFACE_WIDTH;
      if (sourceX >= SURFACE_WIDTH - WIDTH) {
        const first = SURFACE_WIDTH - sourceX;
        context.drawImage(panel.surface, sourceX, sourceY, first, height, 0, top, first, height);
        context.drawImage(panel.surface, 0, sourceY, WIDTH - first, height, first, top, WIDTH - first, height);
      } else context.drawImage(panel.surface, sourceX, sourceY, WIDTH, height, 0, top, WIDTH, height);
    }
  }

  function drawLogoGrid(panel, images) {
    const phase = panel.tick * .014;
    const modulation = Math.cos(phase - .1);
    const centerX = 320 + 160 * Math.cos(phase * 4 - modulation);
    const centerY = 200 - (HEIGHT / 2.7) * Math.sin(phase * 2.3 - modulation);
    const originX = centerX - 640, originY = centerY - 400;
    for (let row = 0; row < 4; row++) for (let column = 0; column < 2; column++) {
      panel.context.drawImage(images.dmaBack, originX + column * 640, originY + row * 200);
    }
  }

  function update(panel) {
    panel.tick++;
    advanceCube(panel.cube);
  }

  function draw(panel, images) {
    drawScanline(panel, images);
    drawLogoGrid(panel, images);
    if (!panel.away) drawCube(panel.context, panel);
  }

  root.DMA40DMAIsBack = Object.freeze({create,update,draw,drawCube});
})(typeof globalThis !== 'undefined' ? globalThis : this);
