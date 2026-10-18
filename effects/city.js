(function (root) {
  'use strict';

  const WIDTH = 640;
  const HEIGHT = 400;
  const FORMED_AT = 4;
  const ASK_AT = 12;
  const REPLY_AT = 15.5;
  const BYE_AT = 19;
  const CLOSE_AT = 23;
  const LAUNCH_AT = 24;
  const OVERHEAD_AT = 32;
  const ROOFTOP_AT = 37;
  const PORTAL_AT = 39;
  const DURATION = 42;

  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const mix = (from, to, amount) => from + (to - from) * amount;
  const ease = (from, to, seconds) => {
    const amount = clamp((seconds - from) / (to - from));
    return amount * amount * (3 - 2 * amount);
  };
  const vec = (x = 0, y = 0, z = 0) => ({x, y, z});
  const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
  const scale = (point, amount) => vec(point.x * amount, point.y * amount, point.z * amount);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const unit = point => {
    const length = Math.sqrt(dot(point, point));
    return length ? scale(point, 1 / length) : vec();
  };
  const lerpVec = (a, b, amount) => add(a, scale(sub(b, a), amount));

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

  function random(value) {
    let number = (Math.imul(value >>> 0, 747796405) + 2891336453) >>> 0;
    number = Math.imul(((number >>> ((number >>> 28) + 4)) ^ number) >>> 0, 277803737) >>> 0;
    return (((number >>> 22) ^ number) >>> 0) / 4294967296;
  }

  function makePath(control, samplesPerSegment = 128) {
    const sampled = [];
    const segments = control.length - 1;
    const at = index => control[clamp(index, 0, control.length - 1)];
    for (let sample = 0; sample <= segments * samplesPerSegment; sample++) {
      const position = sample / samplesPerSegment;
      const segment = Math.min(Math.floor(position), segments - 1);
      const amount = position - segment;
      const a = at(segment - 1), b = at(segment), c = at(segment + 1), d = at(segment + 2);
      const curve = (a0, b0, c0, d0) => .5 * ((2 * b0) + (-a0 + c0) * amount + (2 * a0 - 5 * b0 + 4 * c0 - d0) * amount ** 2 + (-a0 + 3 * b0 - 3 * c0 + d0) * amount ** 3);
      sampled.push({x: curve(a.x, b.x, c.x, d.x), y: curve(a.y, b.y, c.y, d.y)});
    }
    const ends = [];
    const tangents = [];
    let length = 0;
    for (let index = 1; index < sampled.length; index++) {
      const dx = sampled[index].x - sampled[index - 1].x;
      const dy = sampled[index].y - sampled[index - 1].y;
      const segmentLength = Math.hypot(dx, dy);
      length += segmentLength;
      ends.push(length);
      tangents.push({x: dx / segmentLength, y: dy / segmentLength});
    }
    return {
      sampled, ends, tangents, length,
      at(distance) {
        const target = clamp(distance, 0, length);
        let low = 0, high = ends.length;
        while (low < high) {
          const middle = low + high >> 1;
          if (ends[middle] <= target) low = middle + 1; else high = middle;
        }
        if (low === ends.length) return {point: sampled.at(-1), tangent: tangents.at(-1)};
        const start = low ? ends[low - 1] : 0;
        const amount = (target - start) / (ends[low] - start);
        return {
          point: {x: mix(sampled[low].x, sampled[low + 1].x, amount), y: mix(sampled[low].y, sampled[low + 1].y, amount)},
          tangent: tangents[low]
        };
      }
    };
  }

  function makeRoute() {
    return makePath([
      {x:-570,y:280},{x:-380,y:280},{x:-280,y:280},{x:-245,y:240},{x:-245,y:110},{x:-205,y:70},
      {x:-60,y:70},{x:70,y:70},{x:110,y:25},{x:110,y:-150},{x:155,y:-195},{x:330,y:-195},
      {x:390,y:-250},{x:390,y:-420},{x:330,y:-475},{x:120,y:-475},{x:-80,y:-475},{x:-145,y:-415},
      {x:-145,y:-270},{x:-100,y:-225},{x:20,y:-225}
    ]);
  }

  function driveDistance(seconds) {
    const time = Math.max(0, Math.min(LAUNCH_AT, seconds) - FORMED_AT);
    if (time < 2) return 18 * time * time;
    if (time < 7) return 72 + 72 * (time - 2);
    if (time < 9) {
      const amount = (time - 7) / 2;
      return 432 + 72 * (time - 7) - 76 * (amount ** 3 - .5 * amount ** 4);
    }
    return 538 + 34 * (time - 9);
  }

  function bezier(a, b, c, d, amount) {
    const inverse = 1 - amount;
    return {
      x: inverse ** 3 * a.x + 3 * inverse ** 2 * amount * b.x + 3 * inverse * amount ** 2 * c.x + amount ** 3 * d.x,
      y: inverse ** 3 * a.y + 3 * inverse ** 2 * amount * b.y + 3 * inverse * amount ** 2 * c.y + amount ** 3 * d.y
    };
  }

  function routePose(route, seconds) {
    const distance = driveDistance(seconds);
    let sample = route.at(distance);
    const back = route.at(Math.max(0, distance - 2)).point;
    const ahead = route.at(distance + 2).point;
    let tangent = unit(vec(ahead.x - back.x, 0, ahead.y - back.y));
    const before = route.at(Math.max(0, distance - 3)).tangent;
    const after = route.at(distance + 3).tangent;
    const turn = Math.atan2(before.x * after.y - before.y * after.x, before.x * after.x + before.y * after.y);
    let pose = {position: vec(sample.point.x, 0, sample.point.y), angles: vec(0, Math.atan2(tangent.x, tangent.z), -.25 * turn), distance};
    if (seconds <= LAUNCH_AT) return pose;
    const liftSeconds = 2.5;
    const liftDistance = distance + 34 * Math.min(liftSeconds, seconds - LAUNCH_AT);
    sample = route.at(liftDistance);
    const liftBack = route.at(liftDistance - 2).point;
    const liftAhead = route.at(liftDistance + 2).point;
    tangent = unit(vec(liftAhead.x - liftBack.x, 0, liftAhead.y - liftBack.y));
    const altitude = -105 * ease(LAUNCH_AT, LAUNCH_AT + 3.5, seconds) - 115 * ease(LAUNCH_AT + 3.5, OVERHEAD_AT + 2, seconds);
    if (seconds < LAUNCH_AT + liftSeconds) return {position: vec(sample.point.x, altitude, sample.point.y), angles: vec(0, Math.atan2(tangent.x, tangent.z), 0), distance};
    const amount = Math.min(1, (seconds - LAUNCH_AT - liftSeconds) / (ROOFTOP_AT - LAUNCH_AT - liftSeconds));
    const a = sample.point;
    const b = {x: a.x + tangent.x * 260, y: a.y + tangent.z * 260};
    const c = {x: -220, y: 770};
    const d = {x: -80, y: 960};
    const point = bezier(a, b, c, d, amount);
    const previous = bezier(a, b, c, d, Math.max(0, amount - .002));
    const next = bezier(a, b, c, d, Math.min(1, amount + .002));
    pose = {
      position: vec(point.x, altitude, point.y),
      angles: vec(.23 * ease(LAUNCH_AT + liftSeconds, LAUNCH_AT + liftSeconds + 1, seconds) * (1 - ease(LAUNCH_AT + 5, OVERHEAD_AT, seconds)), Math.atan2(next.x - previous.x, next.y - previous.y), -.12 * Math.sin(amount * TWO_PI)),
      distance
    };
    if (seconds > ROOFTOP_AT - 2) {
      const escape = ease(ROOFTOP_AT - 2, PORTAL_AT, seconds);
      pose.position = add(pose.position, vec(-450 * escape, -110 * escape, 800 * escape));
    }
    return pose;
  }

  const TWO_PI = Math.PI * 2;

  function lookAt(eye, target, centerX) {
    const forward = unit(sub(target, eye));
    let right = unit(vec(forward.z, 0, -forward.x));
    if (dot(right, right) < .5) right = vec(1, 0, 0);
    return {eye, right, down: unit(cross(forward, right)), forward, centerX, centerY: 212, focal: 430, near: .25};
  }

  function cameraAt(route, seconds) {
    const car = routePose(route, seconds);
    const matrix = rotation(car.angles);
    const forward = rotate(matrix, vec(0, 0, 1));
    const right = rotate(matrix, vec(1, 0, 0));
    let eye = add(add(sub(car.position, scale(forward, 10)), scale(right, 4.5)), vec(0, -3.7, 0));
    let target = add(add(car.position, scale(forward, 3.4)), vec(0, -.9, 0));
    const center = 320 + 74 * ease(REPLY_AT - .4, REPLY_AT, seconds) * (1 - ease(CLOSE_AT, CLOSE_AT + .5, seconds));
    if (seconds > LAUNCH_AT) {
      const flight = ease(LAUNCH_AT, LAUNCH_AT + 1.5, seconds);
      eye = lerpVec(eye, add(add(sub(car.position, scale(forward, 15)), scale(right, 6)), vec(0, -5, 0)), flight);
      target = lerpVec(target, add(car.position, scale(forward, 2)), flight);
    }
    const overhead = ease(OVERHEAD_AT, ROOFTOP_AT, seconds);
    eye = lerpVec(eye, vec(0, -485, 899.99), overhead);
    target = lerpVec(target, vec(0, -28, 900), overhead);
    const view = lookAt(eye, target, mix(center, 320, overhead));
    if (overhead > 0) {
      const angle = Math.atan2(view.right.z, view.right.x) * (1 - overhead);
      const stableRight = vec(Math.cos(angle), 0, Math.sin(angle));
      view.down = unit(cross(view.forward, stableRight));
      view.right = unit(cross(view.down, view.forward));
    }
    return view;
  }

  function viewPoint(view, point) {
    const delta = sub(point, view.eye);
    return vec(dot(delta, view.right), dot(delta, view.down), dot(delta, view.forward));
  }

  function project(view, point) {
    if (point.z < view.near) return null;
    const amount = view.focal / point.z;
    return {x: view.centerX + point.x * amount, y: view.centerY + point.y * amount, z: point.z};
  }

  function color(red, green, blue, alpha = 255) { return {red, green, blue, alpha}; }

  function addFace(target, a, b, c, paint) {
    const normal = unit(cross(sub(b, a), sub(c, a)));
    target.push({a, b, c, paint, normal});
  }

  function addQuad(target, a, b, c, d, paint) {
    addFace(target, a, b, c, paint);
    addFace(target, a, c, d, paint);
  }

  function addBox(target, center, size, paint) {
    const half = scale(size, .5);
    const p = [
      vec(center.x-half.x,center.y-half.y,center.z-half.z),vec(center.x+half.x,center.y-half.y,center.z-half.z),
      vec(center.x+half.x,center.y+half.y,center.z-half.z),vec(center.x-half.x,center.y+half.y,center.z-half.z),
      vec(center.x-half.x,center.y-half.y,center.z+half.z),vec(center.x+half.x,center.y-half.y,center.z+half.z),
      vec(center.x+half.x,center.y+half.y,center.z+half.z),vec(center.x-half.x,center.y+half.y,center.z+half.z)
    ];
    for (const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]]) addQuad(target,p[face[0]],p[face[1]],p[face[2]],p[face[3]],paint);
  }

  function clearance(route, x, z) {
    let best = Infinity;
    for (let distance = 0; distance <= route.length; distance += 8) {
      const point = route.at(distance).point;
      best = Math.min(best, Math.hypot(x - point.x, z - point.y));
    }
    return best;
  }

  function makeDistrict(route) {
    const ground = [];
    addQuad(ground, vec(-1400,0,-1400), vec(1400,0,-1400), vec(1400,0,2100), vec(-1400,0,2100), color(19,31,45));
    const roads = [];
    // Extend the entrance behind the camera so the forming car starts on road.
    const start=route.at(0),approachPoint=(distance,side)=>vec(start.point.x+start.tangent.x*distance+start.tangent.y*side,-.025,start.point.y+start.tangent.y*distance-start.tangent.x*side);
    addQuad(roads,approachPoint(-100,-15),approachPoint(-100,15),approachPoint(0,15),approachPoint(0,-15),color(34,44,60));
    for (let distance = 0; distance < route.length; distance += 7) {
      const first = route.at(distance), second = route.at(distance + 7.2);
      const point = (sample, side, height) => vec(sample.point.x + sample.tangent.y * side, height, sample.point.y - sample.tangent.x * side);
      addQuad(roads, point(first,-15,-.025), point(first,15,-.025), point(second,15,-.025), point(second,-15,-.025), color(34,44,60));
      for (const side of [-14,14]) addQuad(roads, point(first,side-.14,-.045), point(first,side+.14,-.045), point(second,side+.14,-.045), point(second,side-.14,-.045), color(43,191,213));
      if (Math.floor(distance / 7) % 3 !== 0) addQuad(roads, point(first,-.13,-.05), point(first,.13,-.05), point(second,.13,-.05), point(second,-.13,-.05), color(208,205,147));
    }
    const buildings = [];
    for (let zi = -8; zi <= 18; zi++) for (let xi = -11; xi <= 11; xi++) {
      const id = (zi + 10) * 61 + xi + 20;
      const x = xi * 64 + 12 * random(id);
      const z = zi * 64 + 12 * random(id + 1);
      if (Math.abs(x) < 275 && Math.abs(z - 900) < 150 || clearance(route, x, z) < 43) continue;
      const width = 22 + random(id + 2) * 16;
      const depth = 23 + random(id + 3) * 13;
      const height = 12 + random(id + 4) * 62;
      const paint = color(40 + 45 * random(id + 5) | 0, 72 + 39 * random(id + 6) | 0, 111 + 50 * random(id + 7) | 0);
      const faces = [];
      addBox(faces, vec(x,-height/2,z), vec(width,height,depth), paint);
      addBox(faces, vec(x,-height-.4,z), vec(width+.5,.8,depth+.5), color(115,154,179));
      const windowFaces = [];
      for (let y = 5; y < height - 2; y += 8) {
        const pane = (id + Math.floor(y)) % 5 === 0 ? color(244,184,109) : color(114,202,218);
        addQuad(windowFaces,vec(x-width*.38,-y-1.3,z-depth/2-.025),vec(x-width*.38,-y,z-depth/2-.025),vec(x+width*.38,-y,z-depth/2-.025),vec(x+width*.38,-y-1.3,z-depth/2-.025),pane);
        addQuad(windowFaces,vec(x+width/2+.025,-y-1.3,z-depth*.38),vec(x+width/2+.025,-y,z-depth*.38),vec(x+width/2+.025,-y,z+depth*.38),vec(x+width/2+.025,-y-1.3,z+depth*.38),pane);
      }
      buildings.push({x,z,width,depth,height,center:vec(x,-height/2,z),radius:Math.sqrt(width*width+depth*depth+height*height)/2+1,faces,windowFaces});
    }
    return {ground, roads, buildings};
  }

  function makeCar() {
    const faces = [];
    const steel = color(174,183,190), bright = color(215,222,225), dark = color(24,29,34), glass = color(40,76,91,225);
    let previous = null;
    const stations = [[-2.15,.94,-.76],[-1.42,1.01,-.86],[-.55,1,-.89],[.63,.98,-.81],[1.52,.94,-.70],[2.16,.86,-.59]];
    for (let station = 0; station < stations.length; station++) {
      const [z,width,y] = stations[station];
      const ring = [vec(-width,-.33,z),vec(width,-.33,z),vec(width,y+.12,z),vec(width*.83,y,z),vec(-width*.83,y,z),vec(-width,y+.12,z)];
      if (previous) for (let index = 0; index < ring.length; index++) {
        const next = (index + 1) % ring.length;
        let paint = steel;
        if (index === 2 || index === 4) paint = bright;
        if (index === 0) paint = dark;
        addQuad(faces, previous[index], ring[index], ring[next], previous[next], paint);
      }
      if(previous)for(const side of [-1,1]){
        const previousX=side*(Math.abs(previous[0].x)+.008),currentX=side*(width+.008);
        addQuad(faces,vec(previousX,-.60,previous[0].z),vec(currentX,-.60,z),vec(currentX,-.54,z),vec(previousX,-.54,previous[0].z),dark);
      }else addQuad(faces,ring[0],ring[1],ring[2],ring[5],steel);
      previous = ring;
    }
    addQuad(faces,previous[1],previous[0],previous[5],previous[2],steel);
    addQuad(faces,vec(-.72,-1.26,-.69),vec(.72,-1.26,-.69),vec(.68,-1.24,.4),vec(-.68,-1.24,.4),bright);
    addQuad(faces,vec(-.84,-.79,1.13),vec(.84,-.79,1.13),vec(.68,-1.24,.4),vec(-.68,-1.24,.4),dark);
    addQuad(faces,vec(-.775,-.82,1.1),vec(.775,-.82,1.1),vec(.63,-1.205,.43),vec(-.63,-1.205,.43),glass);
    for (const side of [-1,1]) {
      addQuad(faces,vec(side*.91,-.85,-1.34),vec(side*.72,-1.26,-.69),vec(side*.68,-1.24,.4),vec(side*.84,-.79,1.13),steel);
      addQuad(faces,vec(side*.888,-.88,-1.19),vec(side*.745,-1.2,-.63),vec(side*.708,-1.185,.36),vec(side*.84,-.84,.99),glass);
      for(const z of [-1.10,.72])addQuad(faces,vec(side*1.012,-.79,z),vec(side*1.012,-.40,z),vec(side*1.012,-.40,z+.014),vec(side*1.012,-.79,z+.014),dark);
      addBox(faces,vec(side*1.015,-.71,-.84),vec(.015,.035,.16),dark);
    }
    addQuad(faces,vec(-.009,-1.269,-.67),vec(.009,-1.269,-.67),vec(.009,-1.249,.38),vec(-.009,-1.249,.38),dark);
    addBox(faces,vec(0,-.88,-.08),vec(1.38,.12,1.12),dark);
    addBox(faces,vec(-.37,-.99,.04),vec(.30,.31,.25),dark);
    addBox(faces,vec(-.37,-1.12,.07),vec(.22,.18,.22),color(229,169,127));
    const deck=(z,x)=>{const amount=(z+.72)/(-1.81+.72);return vec(x*(.74+.16*amount),-1.245+.45*amount,z);};
    addQuad(faces,deck(-.72,-1),deck(-.72,1),deck(-1.81,1),deck(-1.81,-1),dark);
    for(let index=0;index<7;index++){
      const z=-.80-index*.142,a=deck(z,-1),b=deck(z,1),c=deck(z-.085,1),d=deck(z-.085,-1);
      for(const point of [a,b,c,d])point.y-=.025;
      addQuad(faces,a,b,c,d,color(36,43,49));
      addQuad(faces,a,b,vec(b.x,b.y+.018,b.z),vec(a.x,a.y+.018,a.z),color(119,132,141));
    }
    addBox(faces,vec(0,-.56,2.17),vec(1.86,.27,.08),dark);
    addBox(faces,vec(0,-.35,2.14),vec(2,.19,.20),dark);
    for (const x of [-.70,-.39,.39,.70]) addQuad(faces,vec(x-.125,-.65,2.215),vec(x+.125,-.65,2.215),vec(x+.125,-.49,2.215),vec(x-.125,-.49,2.215),color(239,239,213));
    addBox(faces,vec(0,-.63,-2.17),vec(1.88,.29,.08),dark);
    addBox(faces,vec(0,-.35,-2.13),vec(2.04,.20,.20),dark);
    for (const side of [-1,1]) for (let lamp = 0; lamp < 3; lamp++) {
      const paints=[color(231,45,40),color(244,134,38),color(221,220,199)];
      const x=side*(.77-lamp*.205);
      addQuad(faces,vec(x-.09,-.72,-2.215),vec(x+.09,-.72,-2.215),vec(x+.09,-.54,-2.215),vec(x-.09,-.54,-2.215),paints[lamp]);
    }
    for(const side of [-1,1])addBox(faces,vec(side*.64,-.53,-2.43),vec(.28,.27,.46),color(73,84,94));
    for(const x of [-.89,.89])for(const [y,z,radius] of [[-.36,-1.3,.36],[-.335,1.34,.335]]){
      const firstFace=faces.length,center=vec(x,y,z);
      for(let segment=0;segment<12;segment++){
        const first=segment*Math.PI/6,second=(segment+1)*Math.PI/6;
        const point=(side,angle,r)=>vec(x+side,y+r*Math.cos(angle),z+r*Math.sin(angle));
        addQuad(faces,point(-.13,first,radius),point(.13,first,radius),point(.13,second,radius),point(-.13,second,radius),color(16,20,24));
        for(const side of [-.135,.135])addQuad(faces,point(side,first,.07),point(side,first,radius*.81),point(side,second,radius*.81),point(side,second,.07),segment%2===0?color(203,214,219):color(107,121,132));
      }
      for(let index=firstFace;index<faces.length;index++)faces[index].wheel={center,radius};
    }
    return faces;
  }

  function clipNear(points, near) {
    const output = [];
    let previous = points.at(-1);
    for (const current of points) {
      const inside = current.z >= near, previousInside = previous.z >= near;
      if (inside !== previousInside) {
        const amount = (near - previous.z) / (current.z - previous.z);
        const point = lerpVec(previous, current, amount);
        point.z = near;
        output.push(point);
      }
      if (inside) output.push(current);
      previous = current;
    }
    return output;
  }

  const LIGHT = unit(vec(-.35,-.8,-.5));

  function rollWheel(point,wheel,distance){
    const local=sub(point,wheel.center),angle=distance/wheel.radius,sine=Math.sin(angle),cosine=Math.cos(angle);
    return add(wheel.center,vec(local.x,local.y*cosine-local.z*sine,local.y*sine+local.z*cosine));
  }

  function queueFace(effect, view, face, transform, staticFace, opacity = 1) {
    let a = face.a, b = face.b, c = face.c;
    let worldNormal = face.normal;
    if (transform) {
      if(face.wheel){a=rollWheel(a,face.wheel,transform.distance);b=rollWheel(b,face.wheel,transform.distance);c=rollWheel(c,face.wheel,transform.distance);worldNormal=unit(cross(sub(b,a),sub(c,a)));}
      a = add(rotate(transform.rotation, a), transform.position);
      b = add(rotate(transform.rotation, b), transform.position);
      c = add(rotate(transform.rotation, c), transform.position);
      worldNormal = rotate(transform.rotation, worldNormal);
    }
    if (staticFace && dot(worldNormal, sub(a, view.eye)) >= 0) return;
    a = viewPoint(view,a); b = viewPoint(view,b); c = viewPoint(view,c);
    if (Math.max(a.z,b.z,c.z) < view.near || Math.min(a.z,b.z,c.z) > 1000) return;
    const left=view.centerX/view.focal,right=(WIDTH-view.centerX)/view.focal,top=view.centerY/view.focal,bottom=(HEIGHT-view.centerY)/view.focal;
    if(Math.min(a.x-a.z*right,b.x-b.z*right,c.x-c.z*right)>0||Math.max(a.x+a.z*left,b.x+b.z*left,c.x+c.z*left)<0||
      Math.min(a.y-a.z*bottom,b.y-b.z*bottom,c.y-c.z*bottom)>0||Math.max(a.y+a.z*top,b.y+b.z*top,c.y+c.z*top)<0)return;
    const polygon = clipNear([a,b,c],view.near);
    if (polygon.length < 3) return;
    const depth=(a.z+b.z+c.z)/3;
    const illumination=.57+.43*Math.max(0,dot(worldNormal,LIGHT));
    const fog=ease(170,950,depth)*.82;
    const paint={
      red:mix(face.paint.red*illumination,23,fog),
      green:mix(face.paint.green*illumination,50,fog),
      blue:mix(face.paint.blue*illumination,74,fog),
      alpha:face.paint.alpha*opacity
    };
    effect.faces.push({polygon,paint,depth});
  }

  function visible(view, center, radius) {
    const point=viewPoint(view,center);
    if(point.z+radius<view.near||point.z-radius>1000)return false;
    if(point.z<=radius+view.near)return true;
    const flat=project(view,point),margin=radius*view.focal/(point.z-radius);
    return flat.x+margin>=0&&flat.x-margin<=WIDTH&&flat.y+margin>=0&&flat.y-margin<=HEIGHT;
  }

  function drawQueued(effect,ctx,view){
    effect.faces.sort((a,b)=>b.depth-a.depth);
    ctx.save();
    for(const face of effect.faces){
      const projected=face.polygon.map(point=>project(view,point)).filter(Boolean);
      if(projected.length<3)continue;
      ctx.beginPath();projected.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();
      ctx.fillStyle=`rgba(${face.paint.red|0},${face.paint.green|0},${face.paint.blue|0},${clamp(face.paint.alpha/255)})`;ctx.fill();
    }
    ctx.restore();
  }

  function drawSky(ctx,view){
    const gradient=ctx.createLinearGradient(0,0,0,HEIGHT);
    const pitch=view.forward.y;
    gradient.addColorStop(0,`rgb(${6+pitch*8|0},${17+pitch*12|0},${36+pitch*16|0})`);
    gradient.addColorStop(.55,'rgb(31,75,103)');gradient.addColorStop(1,'rgb(53,83,102)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,HEIGHT);
  }

  function drawWorld(effect,ctx,seconds){
    const worldTime=Math.min(seconds,ROOFTOP_AT);
    const view=cameraAt(effect.route,worldTime),pose=routePose(effect.route,worldTime);
    drawSky(ctx,view);effect.faces.length=0;
    for(const face of effect.district.ground)queueFace(effect,view,face,null,true);
    drawQueued(effect,ctx,view);effect.faces.length=0;
    for(const face of effect.district.roads)queueFace(effect,view,face,null,true);
    drawQueued(effect,ctx,view);effect.faces.length=0;
    for(const building of effect.district.buildings){
      if(!visible(view,building.center,building.radius))continue;
      const distance=viewPoint(view,building.center).z;
      for(const face of building.faces)queueFace(effect,view,face,null,true);
      if(distance<=320)for(const face of building.windowFaces)queueFace(effect,view,face,null,true);
    }
    if(seconds>=FORMED_AT-.6){
      const transform={rotation:rotation(pose.angles),position:pose.position,distance:pose.distance};
      if(pose.position.y>=-25){
        const center=vec(pose.position.x,-.07,pose.position.z),flat=rotation(vec(0,pose.angles.y,0));
        for(let index=0;index<16;index++){
          const point=angle=>add(rotate(flat,vec(1.05*Math.cos(angle),0,2.3*Math.sin(angle))),center);
          const a=center,b=point(index*Math.PI/8),c=point((index+1)*Math.PI/8);
          effect.faces.push({polygon:[viewPoint(view,a),viewPoint(view,b),viewPoint(view,c)],paint:color(0,0,0,105),depth:(viewPoint(view,a).z+viewPoint(view,b).z+viewPoint(view,c).z)/3});
        }
      }
      const opacity=ease(FORMED_AT-.6,FORMED_AT,seconds);
      for(const face of effect.car)queueFace(effect,view,face,transform,false,opacity);
      if(seconds>=LAUNCH_AT-.7){
        for(const x of [-.64,.64]){
          const length=(2.8+.7*Math.sin(seconds*39+x))*ease(LAUNCH_AT-.7,LAUNCH_AT+.6,seconds);
          const world=point=>add(rotate(transform.rotation,point),pose.position);
          for(const axis of [0,1]){
            const a=axis?vec(x,-.67,-2.66):vec(x-.14,-.53,-2.66),b=axis?vec(x,-.39,-2.66):vec(x+.14,-.53,-2.66),c=vec(x,-.53,-2.66-length);
            const points=[world(a),world(b),world(c)].map(point=>viewPoint(view,point));
            effect.faces.push({polygon:points,paint:color(74,195,255,190),depth:points.reduce((sum,p)=>sum+p.z,0)/3});
          }
          for(const z of [-1.4,1.4]){
            const points=[vec(x-.13,-.28,z),vec(x+.13,-.28,z),vec(x,length*1.3,z-length*.3)].map(point=>viewPoint(view,world(point)));
            effect.faces.push({polygon:points,paint:color(153,226,255,170),depth:points.reduce((sum,p)=>sum+p.z,0)/3});
          }
        }
      }
    }
    drawQueued(effect,ctx,view);
    return {view,pose};
  }

  function drawBitmapText(ctx,image,text,x,y,scaleValue=.68,black=true){
    ctx.save();if(black)ctx.filter='brightness(0)';
    for(const line of text.split('\n')){let cursor=x;for(const character of line){const index=clamp(character.charCodeAt(0)-32,0,59);ctx.drawImage(image,index%10*16,Math.floor(index/10)*16,16,16,cursor,y,16*scaleValue,16*scaleValue);cursor+=16*scaleValue;}y+=20*scaleValue;}
    ctx.restore();
  }

  function rectangle(ctx,x,y,width,height,paint){ctx.fillStyle=`rgba(${paint.red},${paint.green},${paint.blue},${paint.alpha/255})`;ctx.fillRect(x,y,width,height);}

  function bubble(ctx,images,text,x,y,width,height,tailX,tailY){
    rectangle(ctx,x+3,y+4,width,height,color(0,0,0,190));rectangle(ctx,x,y,width,height,color(8,12,22));rectangle(ctx,x+3,y+3,width-6,height-6,color(255,250,225));
    const base=Math.max(x+18,Math.min(x+width-18,tailX));
    ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(base-9,y+height-2);ctx.lineTo(base+9,y+height-2);ctx.lineTo(tailX,tailY);ctx.fill();
    ctx.fillStyle='#fffae1';ctx.beginPath();ctx.moveTo(base-5,y+height-3);ctx.lineTo(base+5,y+height-3);ctx.lineTo(tailX,tailY-4);ctx.fill();
    drawBitmapText(ctx,images.grey,text,x+14,y+13,.68,true);
  }

  function drawDialogue(ctx,images,route,seconds,view,pose){
    if(seconds>=REPLY_AT-.3&&seconds<CLOSE_AT+.6){
      const open=ease(REPLY_AT-.3,REPLY_AT,seconds)*(1-ease(CLOSE_AT,CLOSE_AT+.6,seconds));
      const x=12-(1-open)*210,y=132;
      rectangle(ctx,x+4,y+4,176,232,color(0,0,0,200));rectangle(ctx,x,y,176,232,color(255,247,217));rectangle(ctx,x+4,y+4,168,224,color(44,75,114));rectangle(ctx,x+4,y+4,168,30,color(255,247,217));
      drawBitmapText(ctx,images.grey,'ELON',x+62,y+10,.65,true);
      ctx.save();ctx.translate(x+89,y+126);ctx.rotate(.018*Math.sin(seconds*3.7));ctx.drawImage(images.elon,-82,-75+2*Math.sin(seconds*7),164,150);ctx.restore();
      if(seconds<BYE_AT)bubble(ctx,images,'YES, OF COURSE,\nOLIVIER.',x+2,47,224,75,x+166,y+78);
    }
    const anchor=project(view,viewPoint(view,add(pose.position,vec(0,-1.6,0))));if(!anchor)return;
    if(seconds>=ASK_AT&&seconds<REPLY_AT)bubble(ctx,images,'ELON, DOES IT FLY?',300,49,309,53,anchor.x,anchor.y-8);
    if(seconds>=BYE_AT&&seconds<CLOSE_AT)bubble(ctx,images,'OK, THANKS ELON.\nSEE YOU SOON. BYE.',294,40,326,76,anchor.x,anchor.y-8);
  }

  function makePixelTargets(effect){
    const view=cameraAt(effect.route,FORMED_AT),pose=routePose(effect.route,FORMED_AT),transform={rotation:rotation(pose.angles),position:pose.position};
    const surfaces=[];let total=0;
    for(const face of effect.car){
      const points=[face.a,face.b,face.c].map(point=>viewPoint(view,add(rotate(transform.rotation,point),transform.position)));
      const flat=points.map(point=>project(view,point));if(flat.some(point=>!point))continue;
      const area=Math.abs((flat[1].x-flat[0].x)*(flat[2].y-flat[0].y)-(flat[1].y-flat[0].y)*(flat[2].x-flat[0].x))/2;if(area<.01)continue;
      total+=area;surfaces.push({points,flat,end:total,paint:face.paint});
    }
    const targets=[];const tile=8,columns=WIDTH/tile,rows=HEIGHT/tile;
    for(let index=0;index<columns*rows;index++){
      const wanted=random(index*7+1901)*total;let surface=surfaces.find(entry=>entry.end>=wanted)||surfaces.at(-1);
      const u=Math.sqrt(random(index*7+1902)),w=random(index*7+1903);
      const world=add(scale(surface.points[0],1-u),add(scale(surface.points[1],u*(1-w)),scale(surface.points[2],u*w)));
      const point=project(view,world);targets.push({x:point.x,y:point.y,lift:(random(index+412)-.5)*65});
    }
    return {targets,tile,columns,rows};
  }

  function drawPixelMorph(effect,ctx,images,seconds){
    if(seconds>.08&&seconds<FORMED_AT){
      const amount=ease(.12,FORMED_AT-.35,seconds),size=mix(effect.pixels.tile,1.3,amount),lift=Math.sin(amount*Math.PI);
      const source=images.circular;
      for(let index=0;index<effect.pixels.targets.length;index++){
        const sx=index%effect.pixels.columns*effect.pixels.tile,sy=Math.floor(index/effect.pixels.columns)*effect.pixels.tile;
        const target=effect.pixels.targets[index],x=mix(sx+effect.pixels.tile/2,target.x,amount),y=mix(sy+effect.pixels.tile/2,target.y,amount)-lift*target.lift;
        ctx.globalAlpha=1-ease(FORMED_AT-.35,FORMED_AT,seconds);ctx.drawImage(source,sx,sy,effect.pixels.tile,effect.pixels.tile,x-size/2,y-size/2,size,size);
      }
      ctx.globalAlpha=1;
    }
  }

  function drawRooftop(effect,ctx,images,seconds,incoming){
    if(seconds<ROOFTOP_AT)return;
    if(!effect.overhead){effect.overhead=document.createElement('canvas');effect.overhead.width=WIDTH;effect.overhead.height=HEIGHT;effect.overhead.getContext('2d').drawImage(ctx.canvas,0,0);}
    else ctx.drawImage(effect.overhead,0,0);
    const fade=ease(ROOFTOP_AT,PORTAL_AT+.5,seconds);ctx.fillStyle=`rgba(0,0,0,${fade*.93})`;ctx.fillRect(0,0,WIDTH,HEIGHT);
    const image=images.logo,height=470*image.height/image.width;ctx.save();ctx.globalAlpha=fade;ctx.drawImage(image,85,212-height/2,470,height);ctx.restore();
    if(seconds>=PORTAL_AT){
      const progress=ease(PORTAL_AT,DURATION,seconds);ctx.fillStyle=`rgba(0,0,0,${progress*.88})`;ctx.fillRect(0,0,WIDTH,HEIGHT);
      if(incoming){
        const portal=effect.portal,paint=portal.getContext('2d');paint.clearRect(0,0,WIDTH,HEIGHT);paint.globalCompositeOperation='source-over';paint.drawImage(incoming,0,0);
        paint.globalCompositeOperation='destination-in';const width=470+progress*780,portalHeight=width*image.height/image.width;paint.globalAlpha=ease(0,.2,progress);paint.drawImage(image,320-width/2,212-portalHeight/2,width,portalHeight);paint.globalAlpha=1;paint.globalCompositeOperation='source-over';ctx.drawImage(portal,0,0);
        if(progress>.72){ctx.save();ctx.globalAlpha=ease(.72,1,progress);ctx.drawImage(incoming,0,0);ctx.restore();}
      }
      ctx.save();ctx.globalAlpha=1-progress;ctx.drawImage(image,85-progress*320,212-height/2-progress*160,470+progress*640,height+progress*320);ctx.restore();
    }
  }

  function create(images){
    const route=makeRoute();const portal=document.createElement('canvas');portal.width=WIDTH;portal.height=HEIGHT;const effect={route,district:makeDistrict(route),car:makeCar(),faces:[],overhead:null,portal};effect.pixels=makePixelTargets(effect);return effect;
  }

  function draw(effect,ctx,images,seconds,incoming){
    seconds=clamp(seconds,0,DURATION);
    if(seconds<=.08){ctx.drawImage(images.circular,0,0,WIDTH,HEIGHT);return;}
    const scene=drawWorld(effect,ctx,seconds);drawPixelMorph(effect,ctx,images,seconds);drawDialogue(ctx,images,effect.route,seconds,scene.view,scene.pose);drawRooftop(effect,ctx,images,seconds,incoming);
  }

  root.DMA40City=Object.freeze({create,draw});
})(typeof globalThis!=='undefined'?globalThis:this);
