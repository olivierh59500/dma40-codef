(function (root) {
  'use strict';

  // This is the cube controller already used by demos/codef/leonardintrodx.
  const VERTICES = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const FACES = [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]];
  const SOURCE_COLORS = ['#fff0ff','#ffe0ff','#ffd0ff','#ffc0ff','#ffb0ff','#ffa0ff'];
  const MATERIAL_ORDER = [4,0,3,1,2,5];
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  const oscillator = (seconds, amplitude, rate) => amplitude * Math.sin((seconds * 85 * rate) % (Math.PI * 2));

  function position(seconds) {
    return {
      x: oscillator(seconds, 60, .0323) + oscillator(seconds, 60, .02),
      y: oscillator(seconds, 50, .0321) + oscillator(seconds, 50, .0257),
      z: 300 + oscillator(seconds, 50, .0357) + oscillator(seconds, 50, .0279)
    };
  }

  const vector = (x = 0, y = 0, z = 0) => ({x, y, z});
  const copyVector = point => vector(point.x, point.y, point.z);

  function createDeformation(size) {
    const controller = {
      size, tick:0, step:0, timer:0, pos:0, pulse:0, swingX:0, swingZ:0,
      swingAmplitude:1, bounceVelocity:0, bouncePosition:0, rotation:vector(), handoff:null
    };
    controller.transformed = sampleDeformation(controller);
    return controller;
  }

  function rotateXYZ(point, angles) {
    const sx=Math.sin(angles.x),cx=Math.cos(angles.x),sy=Math.sin(angles.y),cy=Math.cos(angles.y),sz=Math.sin(angles.z),cz=Math.cos(angles.z);
    const y=point.y*cx-point.z*sx,z=point.y*sx+point.z*cx;
    const x=point.x*cy+z*sy,turnedZ=-point.x*sy+z*cy;
    return vector(x*cz-y*sz,x*sz+y*cz,turnedZ);
  }

  // DMA40 feeds the DCK jelly deformation into Leonard's original controller.
  function sampleDeformation(controller) {
    const size=controller.size,sizeScale=size/80,seconds=controller.pos*3;
    let extraScale=1,extraOffsetY=0,twist=0;
    if(controller.step===2)extraScale=1+.2*Math.sin(controller.pulse);
    else if(controller.step===4)extraOffsetY=controller.bouncePosition*50;
    else if(controller.step===1)twist=Math.sin(controller.timer*.01)*.5;
    const squash=1+.15*Math.sin(seconds*2),stretch=1+.15*Math.cos(seconds*2);
    const sin25=Math.sin(seconds*2.5),cos25=Math.cos(seconds*2.5),secondary=sin25+.5*Math.sin(seconds*5);
    const deformationScale=controller.step===2?1+.3*Math.sin(controller.pulse*2):1;
    return VERTICES.map(([vx,vy,vz])=>{
      const ox=vx*size,oy=vy*size,oz=vz*size;
      let point=vector(ox*extraScale,oy*extraScale,oz*extraScale),reference=copyVector(point);
      const key=ox*(.01/sizeScale)+oy*(.02/sizeScale)+oz*(.03/sizeScale);
      const influence=.5+.5*Math.hypot(reference.x,reference.y,reference.z)/size;
      const amount=25*deformationScale*sizeScale;
      point.x+=(.4*Math.sin(seconds+key*5)+.2*Math.sin(seconds*2.1+key*3))*amount*influence;
      point.y+=(.4*Math.cos(seconds*1.3+key*7)+.2*Math.cos(seconds*1.7+key*4))*amount*influence;
      point.z+=(.3*Math.sin(seconds*.7+key*3)+.15*Math.cos(seconds*1.9+key*6))*amount*influence;
      point.x*=squash;point.y*=stretch;point.z*=1/(squash*stretch*.5+.5);
      const ripple=Math.sin(seconds*4+Math.hypot(reference.x,reference.y,reference.z)/size*10)*5*sizeScale;
      point.x+=ripple*oy/size;point.y+=ripple*ox/size;
      if(twist){const angle=twist*oy/size,sine=Math.sin(angle),cosine=Math.cos(angle),x=point.x*cosine-point.z*sine;point.z=point.x*sine+point.z*cosine;point.x=x;}
      point=rotateXYZ(point,controller.rotation);
      point.x+=secondary*8*sizeScale;point.y+=(cos25*8+extraOffsetY)*sizeScale;point.z+=Math.sin(seconds*3.7)*4*sizeScale;
      return point;
    });
  }

  function smooth(value){const amount=clamp(value,0,1);return amount*amount*(3-2*amount);}

  function advanceDeformation(controller) {
    const previous=controller.transformed.map(copyVector);
    controller.tick++;controller.pos+=.014;controller.timer++;
    let changed=false;
    if(controller.timer>=300){
      controller.timer=0;controller.step=(controller.step+1)%5;changed=true;
      if(controller.step===4){controller.bounceVelocity=.08;controller.bouncePosition=0;}
      else if(controller.step===3){controller.swingX=controller.rotation.x;controller.swingZ=controller.rotation.z;controller.swingAmplitude=1;}
      else if(controller.step===2)controller.pulse=Math.atan2(controller.rotation.y,controller.rotation.x);
    }
    if(controller.step===2)controller.pulse+=.05;
    else if(controller.step===3){const value=Math.sin(controller.timer*.03)*controller.swingAmplitude;controller.rotation.x=controller.swingX+value*.8;controller.rotation.z=controller.swingZ+value*.4;controller.swingAmplitude*=.998;}
    else if(controller.step===4){controller.bounceVelocity-=.001;controller.bouncePosition+=controller.bounceVelocity;if(controller.bouncePosition<-.3){controller.bouncePosition=-.3;controller.bounceVelocity=Math.abs(controller.bounceVelocity)*.85;}}
    let current=sampleDeformation(controller);
    if(changed)controller.handoff={elapsed:0,duration:45,previous,offsets:previous.map((point,index)=>vector(point.x-current[index].x,point.y-current[index].y,point.z-current[index].z))};
    if(controller.handoff){
      const weight=1-smooth(controller.handoff.elapsed/controller.handoff.duration);
      current=current.map((point,index)=>vector(point.x+controller.handoff.offsets[index].x*weight,point.y+controller.handoff.offsets[index].y*weight,point.z+controller.handoff.offsets[index].z*weight));
      controller.handoff.elapsed++;
      if(controller.handoff.elapsed>controller.handoff.duration)controller.handoff=null;
    }
    controller.transformed=current;
  }

  let deformation = createDeformation(30);

  function deformationAt(seconds, size) {
    const target=Math.max(0,Math.floor(seconds*60+1e-8));
    if(deformation.size!==size||target<deformation.tick)deformation=createDeformation(size);
    while(deformation.tick<target)advanceDeformation(deformation);
    return deformation.transformed;
  }

  function draw(context, seconds, options = {}) {
    const centerX = options.centerX ?? 320;
    const centerY = options.centerY ?? 215;
    const focal = options.focal ?? 346.4101615;
    const halfSize = options.halfSize ?? 30;
    const offsetX = options.offsetX ?? 0;
    const offsetY = options.offsetY ?? 0;
    const path = options.path === false ? {x: 0, y: 0, z: options.depth ?? 300} : position(seconds);
    const angle = seconds * Math.PI / 2;
    const sx = Math.sin(-angle), cx = Math.cos(-angle);
    const sy = Math.sin(angle * 1.1), cy = Math.cos(angle * 1.1);
    const sourceVertices=options.deform?deformationAt(seconds,halfSize):VERTICES.map(source=>vector(source[0]*halfSize,source[1]*halfSize,source[2]*halfSize));
    const points = sourceVertices.map(source => {
      const px = source.x, py = source.y, pz = source.z;
      const x = cy * px + sy * sx * py + sy * cx * pz;
      const y = cx * py - sx * pz;
      const z = -sy * px + cy * sx * py + cy * cx * pz;
      const depth = path.z + z;
      return {x:centerX + offsetX + (path.x + x) * focal / depth, y:centerY + offsetY - (path.y - y) * focal / depth, depth};
    });
    const faces = FACES.map((indices, index) => ({indices, color:SOURCE_COLORS[MATERIAL_ORDER[index]], depth:indices.reduce((sum, at) => sum + points[at].depth, 0) / 4}));
    faces.sort((first, second) => second.depth - first.depth);
    context.save();
    for (const face of faces) {
      const polygon = face.indices.map(index => points[index]);
      const area = polygon.reduce((sum, point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0);
      if (area >= 0) continue;
      context.beginPath();
      polygon.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.closePath();
      context.fillStyle = face.color;
      context.fill();
    }
    context.restore();
  }

  root.DMA40LeonardCube = Object.freeze({draw, position});
})(typeof globalThis !== 'undefined' ? globalThis : this);
