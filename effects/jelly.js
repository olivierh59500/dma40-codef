(function (root) {
  'use strict';

  const WIDTH = 640;
  const HEIGHT = 400;
  const TWO_PI = Math.PI * 2;
  const SPHERE_RADIUS = 250;
  const LOGO_AT = 1;
  const FLASH_AT = 4;
  const FLOOR_AT = 7;
  const PULLBACK_AT = 6.5;
  const SPHERE_AT = 9;
  const SPHERE_JELLY_AT = 11;
  const DROP_AT = 14;
  const ORBIT_AT = 18;
  const BOIDS_AT = 29;
  const FLOCK_GATHER_AT = 43;
  const PORTRAIT_AT = 48;
  const PORTRAIT_MOVE_AT = 52.2;
  const GREETING_AT = 54.6;
  const GREETING_SETTLED_AT = 62.1;
  const PI_AT = 64.1;
  const PI_CURSOR_AT = 64.8;
  const PI_CLICK_AT = 66.9;
  const PI_PAGE_AT = 67.2;
  const FLOCK_SIDE = 64;
  const FLOCK_COUNT = FLOCK_SIDE * FLOCK_SIDE;

  const PI_DIGITS = '3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989';
  const DECIPHER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const GREETING_ALPHABET = DECIPHER_ALPHABET + ":!?'";
  const PI_ALPHABET = DECIPHER_ALPHABET + '.';

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

  function hash(value) {
    let number = value >>> 0;
    number ^= number >>> 16;
    number = Math.imul(number, 0x7feb352d) >>> 0;
    number ^= number >>> 15;
    number = Math.imul(number, 0x846ca68b) >>> 0;
    return (number ^ number >>> 16) >>> 0;
  }

  const random = value => hash(value) / 4294967296;

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

  function orbitAngle(seconds) {
    const time = Math.max(0, seconds - ORBIT_AT);
    let travel = time - 1;
    if (time < 2) travel = time / 2 - 1 / Math.PI * Math.sin(Math.PI * time / 2);
    return travel * TWO_PI / 10;
  }

  function viewAt(seconds) {
    const open = smooth(PULLBACK_AT, SPHERE_AT, seconds);
    const angle = orbitAngle(seconds);
    const pitchAngle = (.29 + .10 * Math.sin(angle)) * open;
    const radius = 660 + 740 * open;
    const target = vec(0, -SPHERE_RADIUS - 110 + 55 * open, 0);
    const yaw = rotation(vec(0, angle, 0));
    const pitch = rotation(vec(pitchAngle, 0, 0));
    const distance = radius / Math.cos(pitchAngle);
    const worldVector = camera => {
      const inverse = (matrix, point) => vec(matrix[0]*point.x+matrix[3]*point.y+matrix[6]*point.z,matrix[1]*point.x+matrix[4]*point.y+matrix[7]*point.z,matrix[2]*point.x+matrix[5]*point.y+matrix[8]*point.z);
      return inverse(yaw, inverse(pitch, camera));
    };
    const right=worldVector(vec(1,0,0)),down=worldVector(vec(0,1,0)),forward=worldVector(vec(0,0,1));
    const shiftedTarget=add(target,scale(right,125*Math.sin(angle*2)));
    return {
      centerX: 320, centerY: 150 + 20 * open, focal: 650, near: 32, yaw, pitch, distance, angle,
      target:shiftedTarget,right,down,forward,eye:add(shiftedTarget,scale(forward,-distance)),
      point(world) { const point = rotate(pitch, rotate(yaw, sub(world, this.target))); point.z += distance; return point; }
    };
  }

  function project(view, world) {
    const point = view.point(world);
    if (point.z < view.near) return null;
    const amount = view.focal / point.z;
    return {x: view.centerX + point.x * amount, y: view.centerY + point.y * amount, z: point.z, scale: amount};
  }

  function makeBounceFrames() {
    const frames = [{height:110,compression:0}];
    const frequency = 100;
    const gravity = 360;
    const firstContact = Math.sqrt(220 / gravity);
    let compression = 0, velocity = 0, contacts = 0;
    for (let tick = 1; tick <= 2000; tick++) {
      const seconds = tick / frequency;
      let height;
      if (seconds < firstContact) height = 110 - .5 * gravity * seconds * seconds;
      else {
        const elapsed = seconds - firstContact;
        const wanted = Math.floor(elapsed / 1.8) + 1;
        if (wanted > contacts) { velocity += 11.8; contacts = wanted; }
        const phase = elapsed % 1.8;
        if (phase < .2) height = 0;
        else { const time = phase - .2, launch = gravity * 1.6 / 2; height = Math.max(0, launch * time - .5 * gravity * time * time); }
      }
      velocity += (-220 * compression - 7 * velocity) / frequency;
      compression += velocity / frequency;
      if (compression > .52) { compression = .52; velocity = Math.min(0, velocity); }
      else if (compression < -.28) { compression = -.28; velocity = Math.max(0, velocity); }
      frames.push({height,compression});
    }
    return frames;
  }

  function bounceAt(effect, seconds) {
    const index = clamp(Math.floor(Math.max(0, seconds) * 100 + 1e-7), 0, effect.bounce.length - 1);
    return effect.bounce[index];
  }

  function floorPalette() {
    const binary = atob(root.DMA40FloorColors || '');
    const colors = [];
    const decode = at => {
      const word = binary.charCodeAt(at) << 8 | binary.charCodeAt(at + 1);
      return {red:(word>>8&7)*34,green:(word>>4&7)*34,blue:(word&7)*34};
    };
    for (let at = 0; at + 3 < binary.length; at += 4) {
      let first = decode(at), second = decode(at + 2);
      const light = paint => 2126 * paint.red + 7152 * paint.green + 722 * paint.blue;
      if (light(first) > light(second)) [first, second] = [second, first];
      colors.push([first, second]);
    }
    return colors;
  }

  function floorClock(seconds, count) {
    const target = Math.floor(Math.max(0, seconds - FLOOR_AT) * 50 + 1e-7);
    let phase = 0, floorHold = 100, colorHold = 0, direction = 1, colorDirection = 1, cursor = 0;
    for (let tick = 0; tick < target; tick++) {
      floorHold--;
      if (floorHold < 0) { floorHold = 200; direction = -direction; }
      colorHold--;
      if (colorHold < 0) { colorHold = 400; colorDirection = -colorDirection; }
      phase = (phase + direction + 12) % 12;
      cursor = (cursor + colorDirection + count) % count;
    }
    return {phase: phase / 6, cursor};
  }

  // Second Reality drops and rebounds the floor at 70 Hz with integer motion.
  function makeFloorEntrance() {
    const poses=[{top:260,height:0}];
    let position=0,velocity=0;
    for(let index=0;index<2048;index++){
      velocity++;position+=velocity;
      if(position>48*16){position-=velocity;velocity=Math.trunc(-velocity*2/3);if(velocity>-4&&velocity<4)break;}
      const y=Math.trunc(position/16),top=130+Math.trunc(y/2),bottom=130+Math.trunc(y*3/2);
      poses.push({top:top*2,height:(bottom-top)*2});
    }
    return poses;
  }

  function floorOpen(effect, seconds) {
    const index=clamp(Math.floor(Math.max(0,seconds-FLOOR_AT)*70+1e-7),0,effect.floorEntrance.length-1);
    return effect.floorEntrance[index].height/effect.floorEntrance.at(-1).height;
  }

  function floorRows(effect, cursor) {
    const rows=new Array(34),count=effect.floorPalette.length;
    let source=cursor,acceleration=0,step=5;
    for(let row=0;row<34;row++){
      for(;;){acceleration+=step;if(acceleration>=25){acceleration-=25;step++;break;}source++;}
      source%=count;rows[row]=effect.floorPalette[source];source++;
    }
    return rows;
  }

  function drawFloor(effect, ctx, seconds, view) {
    if (seconds < FLOOR_AT) return;
    const open=floorOpen(effect,seconds);
    if(open<=0)return;
    const clock = floorClock(seconds, effect.floorPalette.length);
    const rows=floorRows(effect,clock.cursor),phase=clock.phase,sideways=4.5*Math.sin((seconds-FLOOR_AT)*1.2);
    const pixels=effect.floorPixels,eye=view.eye,right=view.right,down=view.down,forward=view.forward;
    pixels.fill(0);
    for(let y=0;y<HEIGHT;y++){
      const sourceY=160+(y+.5-160)/open,normalY=(sourceY-view.centerY)/view.focal;
      const row=clamp(Math.floor((y+.5-180)*34/220),0,33),pair=rows[row];
      const first=(0xff000000|(pair[0].blue<<16)|(pair[0].green<<8)|pair[0].red)>>>0;
      const second=(0xff000000|(pair[1].blue<<16)|(pair[1].green<<8)|pair[1].red)>>>0;
      for(let x=0;x<WIDTH;x++){
        const normalX=(x+.5-view.centerX)/view.focal;
        const directionX=right.x*normalX+down.x*normalY+forward.x;
        const directionY=right.y*normalX+down.y*normalY+forward.y;
        const directionZ=right.z*normalX+down.z*normalY+forward.z;
        if(Math.abs(directionY)<1e-12)continue;
        const distance=-eye.y/directionY;
        if(distance<view.near)continue;
        const worldX=eye.x+directionX*distance,worldZ=eye.z+directionZ*distance;
        if(worldX < -800 || worldX > 800 || worldZ < -800 || worldZ > 800)continue;
        const parity=(Math.floor(worldX/110+sideways)+Math.floor(worldZ/110+phase))&1;
        pixels[y*WIDTH+x]=parity?second:first;
      }
    }
    effect.floorContext.putImageData(effect.floorImage,0,0);
    ctx.drawImage(effect.floorCanvas,0,0);
  }

  function spherePoint(point, seconds, compression) {
    const gel = smooth(SPHERE_JELLY_AT, SPHERE_JELLY_AT + 1.5, seconds);
    const turn = rotation(vec(0, Math.max(0, seconds - SPHERE_AT) * .13, 0));
    let result = rotate(turn, point);
    const radius = Math.sqrt(result.x*result.x+result.y*result.y+result.z*result.z) / SPHERE_RADIUS;
    const wobble = gel * (2.8 + 50 * Math.abs(compression));
    result = vec(
      result.x + Math.sin(seconds*5.4+result.x*.006*1.1)*wobble*(.25+.75*radius),
      result.y + Math.sin(seconds*6.5+result.y*.007*1.5+1)*wobble*.4*(.25+.75*radius),
      result.z + Math.sin(seconds*4.2+result.z*.008*1.1+.7)*wobble*.7*(.25+.75*radius)
    );
    const vertical = 1 - compression, lateral = 1 / Math.sqrt(vertical);
    return vec(result.x*lateral,result.y*vertical,result.z*lateral);
  }

  function drawLogoWorld(effect,ctx,images,seconds,view,center,compression){
    const image=effect.glassLogo,formed=smooth(FLASH_AT,FLASH_AT+1.2,seconds),height=400*image.height/image.width;
    ctx.save();ctx.globalAlpha=.52+.25*formed;ctx.imageSmoothingEnabled=true;
    for(let row=0;row<96;row++){
      const y=(row/96-.5)*height;
      const wave=formed*(7*Math.sin(seconds*2.2+row*.17)+3*Math.sin(seconds*3.1-row*.09));
      const left=spherePoint(vec(-200+wave,y,0),seconds,compression),right=spherePoint(vec(200+wave,y,0),seconds,compression);
      const a=project(view,add(left,center)),b=project(view,add(right,center));if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),sourceY=row*image.height/96;
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));ctx.drawImage(image,0,sourceY,image.width,image.height/96,0,0,length,Math.max(1.2,length/400*height/96));ctx.restore();
    }
    ctx.restore();
  }

  function drawSphere(effect,ctx,images,seconds,view){
    const bounce=bounceAt(effect,seconds-DROP_AT),compression=bounce.compression;
    const center=vec(0,-bounce.height-SPHERE_RADIUS,0);
    const centerView=view.point(center).z;
    const rear=[],front=[];
    for(let index=0;index<effect.sphere.length;index++){
      const deformed=spherePoint(effect.sphere[index],seconds,compression),point=project(view,add(deformed,center));if(!point)continue;
      const stagger=(index*73%effect.sphere.length)/effect.sphere.length;
      let alpha=smooth(SPHERE_AT+stagger*.8,SPHERE_AT+stagger*.8+.5,seconds);
      alpha*=.3+.7*smooth(-30,30,centerView-point.z);if(alpha<=0)continue;
      const sample={...point,size:Math.max(1.1,2.9*point.scale),alpha};
      (point.z<centerView?front:rear).push(sample);
    }
    const drawDots=samples=>{for(const point of samples){ctx.fillStyle=`rgba(255,168,74,${point.alpha})`;ctx.fillRect(point.x-point.size/2,point.y-point.size/2,point.size,point.size);}};
    drawDots(rear);drawLogoWorld(effect,ctx,images,seconds,view,center,compression);drawDots(front);
    if(seconds>=DROP_AT){const contact=project(view,vec(0,-.2,0));if(contact){const radius=SPHERE_RADIUS*(.8+.25*compression)*view.focal/Math.max(view.near,view.point(vec(0,0,0)).z);ctx.save();ctx.globalAlpha=smooth(SPHERE_AT,DROP_AT,seconds)/(1+bounce.height*.009)*.12;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(contact.x,contact.y,radius,radius*.22,0,0,TWO_PI);ctx.fill();ctx.restore();}}
  }

  function drawStill(ctx,images,alpha=1,width=400,centerY=150){const height=width*images.logo.height/images.logo.width;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(images.logo,320-width/2,centerY-height/2,width,height);ctx.restore();}

  function drawWorld(effect,ctx,images,seconds){
    ctx.fillStyle='#000';ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(seconds<FLASH_AT){if(seconds>=LOGO_AT)drawStill(ctx,images,smooth(LOGO_AT,LOGO_AT+.9,seconds));return;}
    const view=viewAt(seconds);drawFloor(effect,ctx,seconds,view);drawSphere(effect,ctx,images,seconds,view);
    if(seconds<FLASH_AT+.3){ctx.fillStyle=`rgba(255,255,255,${1-smooth(FLASH_AT,FLASH_AT+.3,seconds)})`;ctx.fillRect(0,0,WIDTH,HEIGHT);}
  }

  function targetPoint(index) {
    return {x: WIDTH / 2 - 130 + (index % FLOCK_SIDE + .5) * 260 / FLOCK_SIDE, y: 10 + (Math.floor(index / FLOCK_SIDE) + .5) * 260 / FLOCK_SIDE};
  }

  function makeFlock() {
    const birds = new Array(FLOCK_COUNT);
    const forces = new Array(FLOCK_COUNT);
    for (let index = 0; index < FLOCK_COUNT; index++) {
      const x = (index % FLOCK_SIDE + .5) * WIDTH / FLOCK_SIDE;
      const y = (Math.floor(index / FLOCK_SIDE) + .5) * HEIGHT / FLOCK_SIDE;
      const angle = -.3 + .35 * Math.sin(x * .008) + .25 * Math.sin(y * .012) + (random(index + 53) - .5) * .25;
      const speed = 55 + 20 * random(index + 71);
      const uy = Math.sin(angle), baseX = Math.cos(angle);
      const depthAngle = (random(index + 311) - .5) * .8 + .25 * Math.sin(x * .01);
      const uz = Math.sin(depthAngle), plane = Math.cos(depthAngle), ux = baseX * plane, vy = uy * plane;
      birds[index] = {x,y,z:(random(index+312)-.5)*240,vx:ux*speed,vy:vy*speed,vz:uz*speed,ax:0,ay:0,az:0,ux,uy:vy,uz};
      forces[index] = [0,0,0];
    }
    return {birds,forces,buckets:Array.from({length:24*17},()=>new Int32Array(8)),counts:new Int32Array(24*17),tick:0};
  }

  function flockBucket(bird) {
    return {x:clamp(Math.trunc(bird.x+64)/32,0,23),y:clamp(Math.trunc(bird.y+64)/32,0,16)};
  }

  function wanderAt(index, age) {
    const time = age / 2, whole = Math.floor(time);
    const amount = smooth(0,1,time-whole);
    return (mix(random(index*37+whole*7919),random(index*37+(whole+1)*7919),amount))*2-1;
  }

  function flockSteering(flock, index, bird, age) {
    const bucket=flockBucket(bird),ids=new Int32Array(7),distances=new Float64Array(7);
    let count=0,worst=0,separateX=0,separateY=0,separateZ=0;
    const speedSquared=bird.vx*bird.vx+bird.vy*bird.vy+bird.vz*bird.vz;
    for(let yy=Math.max(0,bucket.y-1);yy<=Math.min(16,bucket.y+1);yy++)for(let xx=Math.max(0,bucket.x-1);xx<=Math.min(23,bucket.x+1);xx++){
      const cell=yy*24+xx,n=Math.min(8,flock.counts[cell]);if(!n)continue;
      let slot=(index+cell*3)%n;
      for(let sample=0;sample<Math.min(4,n);sample++){
        const otherIndex=flock.buckets[cell][slot];slot=(slot+1)%n;if(otherIndex===index)continue;
        const other=flock.birds[otherIndex],dx=other.x-bird.x,dy=other.y-bird.y,dz=other.z-bird.z,distance=dx*dx+dy*dy+dz*dz;
        if(distance<.01||distance>28*28)continue;
        if(distance<49){separateX-=dx/(distance+2);separateY-=dy/(distance+2);separateZ-=dz/(distance+2);}
        const heading=dx*bird.vx+dy*bird.vy+dz*bird.vz;if(heading<0&&heading*heading>speedSquared*distance*.5)continue;
        if(count<7){ids[count]=otherIndex;distances[count]=distance;count++;}else{if(distance>=distances[worst])continue;ids[worst]=otherIndex;distances[worst]=distance;}
        worst=0;for(let at=1;at<count;at++)if(distances[at]>distances[worst])worst=at;
      }
    }
    let fx=separateX*90,fy=separateY*90,fz=separateZ*90;
    if(count){let vx=0,vy=0,vz=0,px=0,py=0,pz=0;for(let at=0;at<count;at++){const other=flock.birds[ids[at]];vx+=other.vx;vy+=other.vy;vz+=other.vz;px+=other.x;py+=other.y;pz+=other.z;}fx+=(vx/count-bird.vx)*1.25+(px/count-bird.x)*.12;fy+=(vy/count-bird.vy)*1.25+(py/count-bird.y)*.12;fz+=(vz/count-bird.vz)*1.25+(pz/count-bird.z)*.12;}
    const wander=wanderAt(index,age)*12;fx+=-bird.uy*wander;fy+=bird.ux*wander;
    const climb=wanderAt(index+413,age)*16;fx-=bird.ux*bird.uz*climb;fy-=bird.uy*bird.uz*climb;fz+=(1-bird.uz*bird.uz)*climb;
    const lookX=(bird.x+bird.vx-320)/255,lookY=(bird.y+bird.vy-200)/155,lookZ=(bird.z+bird.vz)/155,outside=Math.max(0,lookX*lookX+lookY*lookY+lookZ*lookZ-.8);
    let wx=-lookX*outside*85,wy=-lookY*outside*85,wz=-lookZ*outside*85,forward=wx*bird.ux+wy*bird.uy+wz*bird.uz;
    if(forward<-10){const correction=-10-forward;wx+=bird.ux*correction;wy+=bird.uy*correction;wz+=bird.uz*correction;wz+=Math.sign(.1-bird.z)*Math.min(40,-forward*.4);}
    return[fx+wx,fy+wy,fz+wz];
  }

  function stepFlock(flock) {
    flock.counts.fill(0);
    for(let index=0;index<FLOCK_COUNT;index++){
      const bucket=flockBucket(flock.birds[index]),cell=bucket.y*24+bucket.x,count=flock.counts[cell]++;
      let slot=count;if(count>=8)slot=hash(index*977+Math.floor(flock.tick/8)*7919)%(count+1);if(slot<8)flock.buckets[cell][slot]=index;
    }
    const age=(flock.tick+1)/50,gather=smooth(FLOCK_GATHER_AT-BOIDS_AT,PORTRAIT_AT-BOIDS_AT-.6,age);
    for(let index=flock.tick&3;index<FLOCK_COUNT;index+=4){
      const bird=flock.birds[index],force=flockSteering(flock,index,bird,age),target=targetPoint(index);
      let fx=mix(force[0],(target.x-bird.x)*8-bird.vx*4,gather),fy=mix(force[1],(target.y-bird.y)*8-bird.vy*4,gather),fz=mix(force[2],-bird.z*8-bird.vz*4,gather);
      const limit=75+gather*400,length=Math.hypot(fx,fy,fz);if(length>limit){const amount=limit/length;fx*=amount;fy*=amount;fz*=amount;}flock.forces[index]=[fx,fy,fz];
    }
    for(let index=0;index<FLOCK_COUNT;index++){
      const bird=flock.birds[index],force=flock.forces[index];bird.ax+=(force[0]-bird.ax)*.18;bird.ay+=(force[1]-bird.ay)*.18;bird.az+=(force[2]-bird.az)*.18;bird.vx+=bird.ax/50;bird.vy+=bird.ay/50;bird.vz+=bird.az/50;
      const speed=Math.hypot(bird.vx,bird.vy,bird.vz);if(speed>1e-6){bird.ux=bird.vx/speed;bird.uy=bird.vy/speed;bird.uz=bird.vz/speed;const cruise=55+20*random(index+71),desired=Math.min(95+gather*185,speed+(cruise-speed)*.04*(1-gather));bird.vx=bird.ux*desired;bird.vy=bird.uy*desired;bird.vz=bird.uz*desired;}
      bird.x=clamp(bird.x+bird.vx/50,-64,704);bird.y=clamp(bird.y+bird.vy/50,-64,464);bird.z=clamp(bird.z+bird.vz/50,-260,260);
    }
    flock.tick++;
  }

  function syncFlock(effect, age) {
    const target=Math.max(0,Math.floor(age*50+1e-7));if(target<effect.flock.tick)effect.flock=makeFlock();while(effect.flock.tick<target)stepFlock(effect.flock);
  }

  function sourceBirdColor(index) {
    const x=(index%FLOCK_SIDE+.5)*WIDTH/FLOCK_SIDE,y=(Math.floor(index/FLOCK_SIDE)+.5)*HEIGHT/FLOCK_SIDE;
    const distance=Math.hypot(x-320,y-190);
    if(y<310&&distance<155)return{red:240,green:155,blue:58};
    const parity=(Math.floor(x/36)+Math.floor(y/28))&1;return parity?{red:38,green:184,blue:95}:{red:45,green:104,blue:190};
  }

  function drawBirds(effect,ctx,seconds){
    const age=seconds-BOIDS_AT,lock=smooth(PORTRAIT_AT-BOIDS_AT-1.35,PORTRAIT_AT-BOIDS_AT-.5,age),point=smooth(.1,1.1,age),alpha=smooth(0,.7,age)*(1-smooth(PORTRAIT_AT-.5,PORTRAIT_AT,seconds));
    const colorMix=smooth(1.8,5.8,age);if(alpha<=0)return;syncFlock(effect,age);
    for(let index=0;index<FLOCK_COUNT;index++){
      const bird=effect.flock.birds[index],perspective=700/(700+bird.z*(1-lock));
      let x=320+(bird.x-320)*perspective,y=200+(bird.y-200)*perspective;const targetPointAt=targetPoint(index);x+=(targetPointAt.x-x)*lock;y+=(targetPointAt.y-y)*lock;
      const width=((10*(1-point)+2.2*point)*(1-lock)+(260/FLOCK_SIDE+.1)*lock)*perspective,height=((6.25*(1-point)+1.5*point)*(1-lock)+(260/FLOCK_SIDE+.1)*lock)*perspective;
      const source=sourceBirdColor(index),target=effect.portraitColors[index]||'#ffffff',red=parseInt(target.slice(1,3),16),green=parseInt(target.slice(3,5),16),blue=parseInt(target.slice(5,7),16);
      ctx.fillStyle=`rgba(${mix(source.red,red,colorMix)|0},${mix(source.green,green,colorMix)|0},${mix(source.blue,blue,colorMix)|0},${alpha})`;ctx.fillRect(x-width/2,y-height/2,width,height);
    }
  }

  function portraitPose(seconds){
    const time=Math.max(0,seconds-PORTRAIT_AT),gravity=700,restitution=.70,portraitFloor=392,initialBottom=270,first=Math.sqrt(2*(portraitFloor-initialBottom)/gravity);
    let height=portraitFloor-initialBottom-gravity*time*time/2,compression=0;
    if(time>=first){let age=time-first,velocity=gravity*first*restitution;for(let bounce=0;bounce<6;bounce++){const flight=2*velocity/gravity,amplitude=.32*restitution**bounce;if(age<flight||bounce===5){height=Math.max(0,velocity*age-gravity*age*age/2);compression=amplitude*Math.exp(-age*8)*Math.cos(age*18);break;}age-=flight;velocity*=restitution;}}
    const settle=1-smooth(PORTRAIT_AT+3.4,PORTRAIT_MOVE_AT,seconds);compression*=settle;height=Math.max(0,height)*settle;
    const move=smooth(PORTRAIT_MOVE_AT,PORTRAIT_MOVE_AT+2,seconds),size=260-20*move;
    return{x:320+180*move,bottom:(portraitFloor-height)*(1-move)+320*move,size,sx:1/Math.sqrt(1-compression),sy:1-compression,wobble:compression*(1-move)};
  }

  function drawPortrait(ctx,images,seconds){
    const alpha=smooth(PORTRAIT_AT-.5,PORTRAIT_AT,seconds);if(alpha<=0)return;
    const pose=portraitPose(seconds),width=pose.size*pose.sx,height=pose.size*pose.sy;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(pose.x,pose.bottom);ctx.transform(1,pose.wobble*.08,pose.wobble*.05,1,0,0);ctx.drawImage(images.portrait,-width/2,-height,width,height);ctx.restore();
  }

  function drawBitmapGlyph(ctx,image,character,x,y,alpha=1,tint=false){if(character===' ')return;const index=clamp(character.charCodeAt(0)-32,0,59);ctx.save();ctx.globalAlpha*=alpha;if(tint)ctx.filter='sepia(1) saturate(3) hue-rotate(70deg)';ctx.drawImage(image,index%10*16,Math.floor(index/10)*16,16,16,x,y,16,16);ctx.restore();}

  function settleAfter(seed){return 2.4+random(seed*71+13)*4;}
  function decipher(alphabet,target,seed,age){if(age<0)return null;if(target===' ')return{character:' ',settled:true};const correct=alphabet.indexOf(target),deadline=settleAfter(seed);if(age>=deadline)return{character:target,settled:true};let step=Math.floor(age*25+1e-7);if(age>=2)step=50+Math.floor((age-2)*10+1e-7);let glyph=hash(seed*977+step*7919)%(alphabet.length-1);if(glyph>=correct)glyph++;return{character:alphabet[glyph],settled:false};}

  function drawGreeting(ctx,images,seconds){
    if(seconds<GREETING_AT)return;const lines=['BILIZIR FROM DMA','','IS THE AUDIENCE','LISTENING ?'];let index=0,top=144;
    for(let row=0;row<lines.length;row++){const line=lines[row],left=185-line.length*8;for(let column=0;column<line.length;column++){const letter=decipher(GREETING_ALPHABET,line[column],index+1000,seconds-GREETING_AT-index*.022);if(letter&&letter.character!==' ')drawBitmapGlyph(ctx,images.grey,letter.character,left+column*16,top+row*32,1,!letter.settled);index++;}}
  }

  const PI_STROKES=[0,0b011111110,0b001000100,0b001000100,0b001000100,0b001000100,0b010000100,0b010000110,0];
  function cubic(a,b,c,d,amount){const inverse=1-amount;return{x:inverse**3*a.x+3*inverse**2*amount*b.x+3*inverse*amount**2*c.x+amount**3*d.x,y:inverse**3*a.y+3*inverse**2*amount*b.y+3*inverse*amount**2*c.y+amount**3*d.y};}
  function drawCursor(ctx,x,y){ctx.fillStyle='#000';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+19);ctx.lineTo(x+6,y+14);ctx.lineTo(x+10,y+23);ctx.lineTo(x+14,y+21);ctx.lineTo(x+10,y+13);ctx.lineTo(x+14,y+13);ctx.closePath();ctx.fill();ctx.stroke();}
  function drawPi(effect,ctx,images,seconds){
    if(seconds<PI_AT)return;if(seconds>=PI_PAGE_AT){ctx.fillStyle='#000';ctx.fillRect(0,0,WIDTH,HEIGHT);const text=PI_DIGITS.slice(0,1000).padEnd(1000,' ');for(let index=0;index<1000;index++){const letter=decipher(PI_ALPHABET,text[index],4000+index,seconds-PI_PAGE_AT-index*.0025);if(letter&&letter.character!==' '){ctx.save();ctx.globalAlpha=letter.settled?1:.65;ctx.filter=letter.settled?'sepia(1) saturate(5) hue-rotate(70deg)':'sepia(1) saturate(3) hue-rotate(70deg)';drawBitmapGlyph(ctx,images.grey,letter.character,index%40*16,Math.floor(index/40)*16);ctx.restore();}}return;}
    const alpha=smooth(PI_AT,PI_AT+.4,seconds),pulse=.84+.16*Math.sin((seconds-PI_AT)*11);for(let row=0;row<PI_STROKES.length;row++)for(let column=0;column<9;column++)if(PI_STROKES[row]&(1<<(8-column))){const x=608+column*2,y=368+row*2;ctx.fillStyle=`rgba(8,80,30,${alpha*.37})`;ctx.fillRect(x-1,y-1,4,4);ctx.fillStyle=`rgba(90,255,135,${alpha*pulse})`;ctx.fillRect(x,y,2,2);}
    if(seconds>=PI_CURSOR_AT){const amount=smooth(PI_CURSOR_AT,PI_CLICK_AT,seconds),position=cubic({x:132,y:298},{x:260,y:336},{x:560,y:345},{x:616,y:371},amount),press=Math.sin(Math.PI*clamp((seconds-PI_CLICK_AT)/.2));drawCursor(ctx,position.x,position.y+press*1.5);}
    if(seconds>=PI_CLICK_AT){const amount=clamp((seconds-PI_CLICK_AT)/(PI_PAGE_AT-PI_CLICK_AT));ctx.strokeStyle=`rgba(100,255,150,${(1-amount)*.78})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(616,371,3+amount*12,0,TWO_PI);ctx.stroke();}
  }

  function drawOutro(effect,ctx,images,seconds){
    ctx.fillStyle='#000';ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(seconds>=PI_PAGE_AT){drawPi(effect,ctx,images,seconds);return;}
    const age=seconds-BOIDS_AT,baseAlpha=1-smooth(0,.7,age);if(baseAlpha>0){ctx.save();ctx.globalAlpha=baseAlpha;ctx.drawImage(effect.worldCanvas,0,0);ctx.restore();}
    drawBirds(effect,ctx,seconds);drawPortrait(ctx,images,seconds);drawGreeting(ctx,images,seconds);drawPi(effect,ctx,images,seconds);
  }

  function create(images){
    const sphere=Array.from({length:1024},(_,index)=>{const z=1-2*(index+.5)/1024,ring=Math.sqrt(Math.max(0,1-z*z)),azimuth=index*Math.PI*(3-Math.sqrt(5));return vec(SPHERE_RADIUS*ring*Math.cos(azimuth),SPHERE_RADIUS*ring*Math.sin(azimuth),SPHERE_RADIUS*z);});
    const worldCanvas=document.createElement('canvas');worldCanvas.width=WIDTH;worldCanvas.height=HEIGHT;
    const glassLogo=document.createElement('canvas');glassLogo.width=images.logo.width;glassLogo.height=images.logo.height;const glass=glassLogo.getContext('2d');glass.drawImage(images.logo,0,0);glass.globalCompositeOperation='source-in';glass.fillStyle='rgba(78,165,255,.92)';glass.fillRect(0,0,glassLogo.width,glassLogo.height);glass.globalCompositeOperation='source-over';
    const floorCanvas=document.createElement('canvas');floorCanvas.width=WIDTH;floorCanvas.height=HEIGHT;const floorContext=floorCanvas.getContext('2d'),floorImage=floorContext.createImageData(WIDTH,HEIGHT),floorPixels=new Uint32Array(floorImage.data.buffer);
    return{sphere,bounce:makeBounceFrames(),floorPalette:floorPalette(),floorEntrance:makeFloorEntrance(),floorCanvas,floorContext,floorImage,floorPixels,portraitColors:root.DMA40PortraitColors||[],worldCanvas,worldReady:false,glassLogo,flock:makeFlock()};
  }

  function draw(effect,ctx,images,seconds){
    if(seconds<BOIDS_AT){drawWorld(effect,ctx,images,seconds);return;}
    if(!effect.worldReady){drawWorld(effect,effect.worldCanvas.getContext('2d'),images,BOIDS_AT);effect.worldReady=true;}
    drawOutro(effect,ctx,images,seconds);
  }

  root.DMA40Jelly=Object.freeze({create,draw});
})(typeof globalThis!=='undefined'?globalThis:this);
