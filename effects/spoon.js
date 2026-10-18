(function (root) {
  'use strict';

  const WIDTH = 640;
  const HEIGHT = 400;
  const REVEAL_AT = 6;
  const GATHER_AT = 10;
  const SPOON_AT = 12;
  const SPOON_SOLID_AT = 14;
  const BEND_AT = 15;
  const FLIGHT_AT = 23;
  const MATRIX_AT = 37;
  const SECRETS_AT = 45;
  const PACMAN_AT = 62;
  const FADE_AT = 66.16;
  const CIRCLE_AT = 66.6;
  const CIRCLE_LOGO_AT = 69.6;
  const CIRCLE_LENS_AT = 72.6;
  const CIRCLE_END = 93.88;
  const BALL_COUNT = 1600;
  const CIRCLE_TEXT = 'FRENCH FRIES ARE GOOD FOR YOU...    LOCKBUSTER WE MISS YOU...    ';
  const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!';
  const TWO_PI = Math.PI * 2;

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
  const cross = (a, b) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const unit = point => {
    const length = Math.sqrt(dot(point, point));
    return length ? scale(point, 1 / length) : vec();
  };
  const lerpVec = (a, b, amount) => add(a, scale(sub(b, a), amount));
  const wrap = (value, period) => value - Math.floor(value / period) * period;

  function hash(value) {
    let number = value >>> 0;
    number ^= number >>> 16;
    number = Math.imul(number, 0x7feb352d) >>> 0;
    number ^= number >>> 15;
    number = Math.imul(number, 0x846ca68b) >>> 0;
    return (number ^ number >>> 16) >>> 0;
  }

  const noise = value => hash(value) / 4294967296;

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

  function project(point, centerX = 320, centerY = 190, focal = 650, near = 24) {
    if (point.z < near) return null;
    const amount = focal / point.z;
    return {x: centerX + point.x * amount, y: centerY + point.y * amount, scale: amount, z: point.z};
  }

  function makeSpoonMesh() {
    const points = [];
    const triangles = [];
    const addPoint = point => (points.push(point), points.length - 1);
    const addTriangle = (a, b, c) => triangles.push([a, b, c]);
    const rings = 5;
    const segments = 12;
    for (let side = 0; side < 2; side++) {
      const start = points.length;
      addPoint(vec(0, -99, 22 + side * 4));
      for (let ring = 1; ring <= rings; ring++) {
        const radius = ring / rings;
        for (let column = 0; column < segments; column++) {
          const angle = column * TWO_PI / segments;
          addPoint(vec(53 * radius * Math.cos(angle), -99 + 68 * radius * Math.sin(angle), 22 * (1 - radius * radius) + side * 4));
        }
      }
      const face = (a, b, c) => side === 1 ? addTriangle(a, c, b) : addTriangle(a, b, c);
      for (let column = 0; column < segments; column++) face(start, start + 1 + (column + 1) % segments, start + 1 + column);
      for (let ring = 1; ring < rings; ring++) for (let column = 0; column < segments; column++) {
        const a = start + 1 + (ring - 1) * segments + column;
        const b = start + 1 + ring * segments + column;
        const c = start + 1 + ring * segments + (column + 1) % segments;
        const d = start + 1 + (ring - 1) * segments + (column + 1) % segments;
        face(a, c, b);
        face(a, d, c);
      }
    }
    const perSide = 1 + rings * segments;
    for (let column = 0; column < segments; column++) {
      const a = 1 + (rings - 1) * segments + column;
      const b = 1 + (rings - 1) * segments + (column + 1) % segments;
      addTriangle(a, b, a + perSide);
      addTriangle(b, b + perSide, a + perSide);
    }
    const rows = [[-39,5],[-33,5],[-27,5],[-21,5.3],[-15,5.7],[-9,6.1],[-3,6.5],[3,6.8],[9,7],[33,8],[58,9.5],[83,11],[108,13],[132,14],[147,12],[156,7],[160,1]];
    const start = points.length;
    const bevel = 8;
    for (const [y, width] of rows) for (let column = 0; column < bevel; column++) {
      const angle = column * TWO_PI / bevel;
      addPoint(vec(width * Math.cos(angle), y, 2 + 3 * Math.sin(angle)));
    }
    for (let row = 0; row < rows.length - 1; row++) for (let column = 0; column < bevel; column++) {
      const a = start + row * bevel + column;
      const b = start + (row + 1) * bevel + column;
      const c = start + (row + 1) * bevel + (column + 1) % bevel;
      const d = start + row * bevel + (column + 1) % bevel;
      addTriangle(a, b, c);
      addTriangle(a, c, d);
    }
    for (let column = 1; column < bevel - 1; column++) {
      addTriangle(start, start + column + 1, start + column);
      const end = start + (rows.length - 1) * bevel;
      addTriangle(end, end + column, end + column + 1);
    }
    return {points, triangles};
  }

  function spoonPose(seconds) {
    const reveal = smooth(REVEAL_AT, SPOON_AT, seconds);
    const profile = smooth(SPOON_SOLID_AT, BEND_AT, seconds);
    return {
      position: vec(mix(0, 28, profile), mix(8 * Math.sin(seconds * .4), 0, profile), mix(190 + 510 * reveal, 700, profile)),
      angles: vec(
        mix(-.32 + .11 * Math.sin(seconds * .31), .06, profile),
        mix(.42 * Math.sin(seconds * .22), -78 * Math.PI / 180, profile),
        mix(-.58 + .11 * Math.sin(seconds * .27), -.14, profile)
      )
    };
  }

  function bendSpoon(point, seconds) {
    const angle = 5 * Math.PI / 6 * smooth(BEND_AT, BEND_AT + 6, seconds);
    const pivot = 5;
    const span = 43;
    const distance = pivot - point.y;
    if (angle < .000001 || distance <= 0) return point;
    const radius = span / angle;
    const theta = Math.min(angle, distance / radius);
    let y = pivot - radius * Math.sin(theta);
    let z = radius * (1 - Math.cos(theta));
    if (distance > span) {
      y -= (distance - span) * Math.cos(angle);
      z += (distance - span) * Math.sin(angle);
    }
    return vec(point.x, y + point.z * Math.sin(theta), z + point.z * Math.cos(theta));
  }

  function spoonMaterial(seconds, y) {
    const position = clamp((y + 168) / 328);
    const start = SPOON_AT + position * (SPOON_SOLID_AT - SPOON_AT - .55);
    return smooth(start, start + .55, seconds);
  }

  function buildTargets(mesh) {
    const areas = [];
    let total = 0;
    for (const triangle of mesh.triangles) {
      const edgeA = sub(mesh.points[triangle[1]], mesh.points[triangle[0]]);
      const edgeB = sub(mesh.points[triangle[2]], mesh.points[triangle[0]]);
      total += Math.sqrt(dot(cross(edgeA, edgeB), cross(edgeA, edgeB))) / 2;
      areas.push(total);
    }
    const targets = [];
    for (let index = 0; index < BALL_COUNT; index++) {
      const wanted = noise(index * 7 + 11) * total;
      let low = 0, high = areas.length;
      while (low < high) {
        const middle = low + high >> 1;
        if (areas[middle] < wanted) low = middle + 1; else high = middle;
      }
      const triangle = mesh.triangles[Math.min(low, mesh.triangles.length - 1)];
      const u = Math.sqrt(noise(index * 7 + 12));
      const v = noise(index * 7 + 13);
      targets.push(add(scale(mesh.points[triangle[0]], 1 - u), add(scale(mesh.points[triangle[1]], u * (1 - v)), scale(mesh.points[triangle[2]], u * v))));
    }
    return targets;
  }

  function ballFrame(seconds) {
    let flightSeconds = seconds;
    if (seconds > REVEAL_AT) {
      const amount = Math.min(1, seconds - REVEAL_AT);
      flightSeconds = REVEAL_AT + amount - amount ** 3 + .5 * amount ** 4;
    }
    const travel = vec(
      harmonic([[210,1.05],[75,.41]], flightSeconds),
      harmonic([[150,1.21],[65,.53,.4]], flightSeconds),
      harmonic([[580,1.4],[140,.61]], flightSeconds)
    );
    const heading = vec(
      harmonic([[.38,.93]], flightSeconds),
      harmonic([[.6,.71]], flightSeconds),
      harmonic([[.2,.85]], flightSeconds)
    );
    const pose = spoonPose(seconds);
    return {position: travel, rotation: rotation(heading), spoonRotation: rotation(pose.angles), spoonPosition: pose.position, gather: smooth(REVEAL_AT, GATHER_AT, seconds)};
  }

  function ballPoint(frame, index, target) {
    const x = wrap(noise(index * 5 + 1) * 700 - frame.position.x, 700) - 350;
    const y = wrap(noise(index * 5 + 2) * 480 - frame.position.y, 480) - 240;
    const z = 75 + wrap(noise(index * 5 + 3) * 1150 - frame.position.z, 1150);
    const free = rotate(frame.rotation, vec(x, y, z));
    const assembled = add(rotate(frame.spoonRotation, target), frame.spoonPosition);
    const fog = smooth(75, 155, z) * (1 - smooth(1060, 1225, z)) *
      (1 - smooth(305, 350, Math.abs(x))) * (1 - smooth(205, 240, Math.abs(y)));
    return {point: lerpVec(free, assembled, frame.gather), fade: fog + (1 - fog) * frame.gather ** 6};
  }

  function drawBallCloud(effect, ctx, images, seconds) {
    if (seconds >= SPOON_SOLID_AT) return;
    const frame = ballFrame(seconds);
    const samples = effect.samples;
    samples.length = 0;
    for (let index = 0; index < BALL_COUNT; index++) {
      const sample = ballPoint(frame, index, effect.targets[index]);
      const projected = project(sample.point);
      if (!projected) continue;
      const size = clamp(7 * projected.scale, 1.3, 40);
      if (projected.x < -40 || projected.x > WIDTH + 40 || projected.y < -40 || projected.y > HEIGHT + 40) continue;
      const image = clamp(Math.trunc(16 - 7 * projected.scale), 0, 15);
      const fog = clamp(1.3 - sample.point.z / 1500, .28, 1);
      const alpha = (1 - spoonMaterial(seconds, effect.targets[index].y)) * sample.fade * smooth(0, .8, seconds);
      if (alpha <= .002) continue;
      samples.push({x: projected.x, y: projected.y, z: projected.z, size, image, alpha: alpha * fog});
    }
    samples.sort((a, b) => b.z - a.z);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (const sample of samples) {
      ctx.globalAlpha = sample.alpha;
      ctx.drawImage(images.spoonBalls, sample.image * 16, 0, 16, 16,
        sample.x - sample.size / 2, sample.y - sample.size / 2, sample.size, sample.size);
    }
    ctx.restore();
  }

  function drawMetal(effect, ctx, seconds) {
    if (seconds < SPOON_AT || seconds >= FLIGHT_AT + 1.5) return;
    const pose = spoonPose(seconds);
    const matrix = rotation(pose.angles);
    const transformed = effect.transformed;
    const projected = effect.projected;
    for (let index = 0; index < effect.mesh.points.length; index++) {
      const point = rotate(matrix, bendSpoon(effect.mesh.points[index], seconds));
      transformed[index] = point;
      projected[index] = project(add(point, pose.position));
    }
    const triangles = effect.renderTriangles;
    triangles.length = 0;
    for (const indices of effect.mesh.triangles) {
      const a = transformed[indices[0]], b = transformed[indices[1]], c = transformed[indices[2]];
      const pa = projected[indices[0]], pb = projected[indices[1]], pc = projected[indices[2]];
      if (!pa || !pb || !pc) continue;
      const area = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
      if (area >= 0) continue;
      const normal = unit(cross(sub(b, a), sub(c, a)));
      const value = clamp(.14 + .24 * (normal.y + 1) / 2 + .5 * Math.exp(-Math.pow((normal.y + .28) / .14, 2)) +
        .32 * Math.exp(-Math.pow((normal.y - .53) / .055, 2)) + .16 * Math.exp(-Math.pow((normal.x + .4) / .23, 2)));
      const y = (effect.mesh.points[indices[0]].y + effect.mesh.points[indices[1]].y + effect.mesh.points[indices[2]].y) / 3;
      const depth = (pa.z + pb.z + pc.z) / 3;
      triangles.push({pa, pb, pc, depth, value, alpha: spoonMaterial(seconds, y)});
    }
    triangles.sort((a, b) => b.depth - a.depth);
    let layerAlpha = 1;
    if (seconds > FLIGHT_AT - .5) layerAlpha = 1 - smooth(FLIGHT_AT - .5, FLIGHT_AT + 1.5, seconds);
    ctx.save();
    for (const triangle of triangles) {
      const level = triangle.value;
      const alpha = triangle.alpha * layerAlpha;
      if (alpha <= .002) continue;
      ctx.beginPath();
      ctx.moveTo(triangle.pa.x, triangle.pa.y);
      ctx.lineTo(triangle.pb.x, triangle.pb.y);
      ctx.lineTo(triangle.pc.x, triangle.pc.y);
      ctx.closePath();
      ctx.fillStyle = `rgba(${10 + 228 * level | 0},${17 + 230 * level | 0},${30 + 225 * level | 0},${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBitmapText(ctx, image, text, x, y, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (const character of text) {
      const index = clamp(character.charCodeAt(0) - 32, 0, 59);
      ctx.drawImage(image, index % 10 * 16, Math.floor(index / 10) * 16, 16, 16, x, y, 16, 16);
      x += 16;
    }
    ctx.restore();
  }

  function drawQuote(ctx, images, seconds) {
    if (seconds < SPOON_SOLID_AT || seconds >= FLIGHT_AT + 1.5) return;
    let alpha = smooth(SPOON_SOLID_AT, SPOON_SOLID_AT + 1, seconds);
    alpha *= 1 - smooth(FLIGHT_AT, FLIGHT_AT + 1.5, seconds);
    const text = 'THERE IS NO SPOON';
    drawBitmapText(ctx, images.grey, text, (WIDTH - text.length * 16) / 2, 345, alpha);
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  class VoxelRenderer {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 200;
      const gl = this.canvas.getContext('webgl2', {alpha: false, antialias: false, preserveDrawingBuffer: true});
      if (!gl) throw new Error('WebGL 2 is unavailable');
      const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
        void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
        precision highp float; precision highp int;
        uniform float Time; uniform vec3 Origin,Right,Up,Forward; out vec4 outColor;
        void main(){
          vec2 position=vec2(gl_FragCoord.x,200.0-gl_FragCoord.y);
          vec2 uv=(position-vec2(160.0,100.0))/200.0;
          vec3 ray=normalize(vec3(uv.x,-uv.y,-.85));
          vec3 direction=Right*ray.x+Up*ray.y+Forward*ray.z;
          float jitter=fract(dot(position,vec2(.754877666,.569840296)))*.6;
          vec3 sum=vec3(0.0);
          for(int step=0;step<128;step++){
            float distance=(float(step)+.5+jitter)*(1000.0/128.0);
            vec3 p=Origin+direction*distance;
            float surface=min(p.y,length(p.xy)*sign(cos(p.z/3000.0)));
            float band=abs((fract(surface/200.0)-.5)*p.y)*5.0+1.0;
            int ux=int(p.x),uz=int(p.z);
            int pattern=((uz-ux)^(uz+ux))&(uz/999);
            float q=fract(float(pattern)/83.0-Time*.01);
            float q2=q*q,q4=q2*q2,q8=q4*q4,q16=q8*q8,q32=q16*q16;
            float green=q32*q16*q2,blue=green*green,red=blue*green;
            sum+=vec3(red,green,blue)/band*(1000.0/128.0);
          }
          vec3 mapped=sum/(vec3(1.0)+sum);
          mapped=pow(mapped,vec3(.6))*(1.0-.2*dot(uv,uv));
          outColor=vec4(clamp(mapped,vec3(0.0),vec3(1.0)),1.0);
        }`);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      this.gl = gl;
      this.program = program;
      this.locations = Object.fromEntries(['Time','Origin','Right','Up','Forward'].map(name => [name, gl.getUniformLocation(program, name)]));
    }

    render(seconds) {
      const gl = this.gl;
      const time = (seconds + 7) * .65;
      const component = offset => clamp(Math.abs(((time * .1 + offset) - Math.floor(time * .1 + offset)) * 6 - 3) - 1);
      const axis = unit(vec(component(0), component(2 / 3), component(1 / 3)));
      const rodrigues = point => add(add(scale(point, Math.cos(1)), scale(cross(axis, point), Math.sin(1))), scale(axis, dot(axis, point) * (1 - Math.cos(1))));
      const right = rodrigues(vec(1, 0, 0));
      const up = rodrigues(vec(0, 1, 0));
      const forward = rodrigues(vec(0, 0, 1));
      gl.viewport(0, 0, 320, 200);
      gl.useProgram(this.program);
      gl.uniform1f(this.locations.Time, time);
      gl.uniform3f(this.locations.Origin, 0, 99 * Math.sin(time), -495 * time);
      gl.uniform3f(this.locations.Right, right.x, right.y, right.z);
      gl.uniform3f(this.locations.Up, up.x, up.y, up.z);
      gl.uniform3f(this.locations.Forward, forward.x, forward.y, forward.z);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return this.canvas;
    }
  }

  function drawFlightFallback(ctx, seconds) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const time = (seconds + 7) * .65;
    for (let row = 0; row < 80; row++) for (let column = 0; column < 128; column++) {
      const value = hash(row * 521 + column * 31 + Math.floor(time * 19));
      if ((value & 31) > 2) continue;
      const depth = (value >>> 8 & 255) / 255;
      ctx.fillStyle = `rgba(${120 + depth * 135 | 0},${40 + depth * 215 | 0},${150 + depth * 105 | 0},${.3 + depth * .7})`;
      ctx.fillRect(column * 5, row * 5, 2 + depth * 3, 2 + depth * 3);
    }
  }

  function drawVoxel(effect, ctx, seconds) {
    if (seconds < FLIGHT_AT || seconds >= MATRIX_AT + 1) return;
    const local = seconds - FLIGHT_AT;
    let alpha = smooth(0, 1.3, local);
    alpha *= 1 - smooth(FLIGHT_AT + 12.4, MATRIX_AT + 1, seconds);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (effect.voxel) ctx.drawImage(effect.voxel.render(local), 0, 0, WIDTH, HEIGHT);
    else drawFlightFallback(ctx, local);
    ctx.restore();
  }

  const CODE_STROKES = [
    [31,1,5,4,4,8,16],[4,4,8,12,20,4,4],[4,31,17,1,2,4,8],[0,31,4,4,4,4,31],[4,31,4,12,20,4,4],[8,31,9,9,9,17,2],
    [4,31,4,31,4,4,4],[15,17,1,2,4,8,16],[8,8,31,9,1,2,4],[0,31,1,1,1,1,31],[10,31,10,10,2,4,8],[16,8,1,17,2,4,24],
    [31,1,2,4,8,20,2],[8,31,9,10,8,8,7],[17,9,1,2,4,8,16],[15,17,9,6,2,4,8],[0,14,4,31,4,4,8],[20,10,1,1,2,4,8],
    [0,31,0,31,4,4,8],[8,8,12,10,9,8,8],[4,4,31,4,4,8,16],[0,31,0,0,0,0,31],[31,1,2,12,10,17,0],[4,31,2,12,21,4,4],
    [1,1,2,2,4,8,16],[4,4,10,10,17,17,0],[16,16,30,16,16,16,15],[31,1,1,2,4,8,0],[0,4,10,17,0,0,0],[4,31,4,4,21,21,4],
    [31,1,2,4,10,4,0],[14,0,14,0,14,0,0],[4,8,8,17,17,31,1],[1,17,10,4,10,17,0],[31,4,4,31,4,4,3],[8,31,9,10,8,8,8],
    [0,30,2,2,2,2,31],[31,1,1,31,1,1,31],[31,0,31,1,2,4,8],[17,17,17,1,1,2,4],[10,10,10,10,11,18,18],[16,16,16,17,18,20,24],
    [31,17,17,17,17,17,31],[31,17,1,1,2,4,8],[31,1,31,1,2,4,8],[14,17,19,21,25,17,14],[4,12,4,4,4,4,14],[14,17,1,2,4,8,31],
    [30,1,1,14,1,1,30],[2,6,10,18,31,2,2],[31,16,16,30,1,1,30],[14,16,16,30,17,17,14],[31,1,2,4,8,8,8],[14,17,17,14,17,17,14],
    [14,17,17,15,1,1,14],[0,4,0,31,0,4,0],[0,0,0,31,0,0,0]
  ];

  function terminalCell(seconds, column, row) {
    const clock = Math.min(seconds, SECRETS_AT + 3);
    const freeze = smooth(SECRETS_AT - 2, SECRETS_AT + 3, seconds);
    const speed = 3.4 + noise(column * 13 + 12) * 5.5;
    const tail = 6 + noise(column * 13 + 13) * 10;
    const head = (clock * speed + noise(column * 13 + 14) * 45) % 45;
    const distance = (head - row + 45) % 45;
    const glow = distance < tail ? (1 - distance / tail) ** 1.7 : 0;
    const index = row * 40 + column;
    const value = glow * (1 - freeze) + (.10 + .07 * noise(index + 78)) * freeze;
    const white = distance < .7 ? (1 - distance / .7) * (1 - freeze) : 0;
    const glyph = hash(index * 301 + Math.floor(clock * (5 + noise(index + 33) * 12))) % CODE_STROKES.length;
    return {glyph, red: value * .15 + white * .65, green: value * .92 + white * .65, blue: value * .42 + white * .65};
  }

  function pacmanPosition(seconds, band) {
    const age = seconds - PACMAN_AT;
    if (age < 0 || age >= 4 || band < 0 || band >= 13) return null;
    const amount = age / 4;
    const right = band % 2 === 0;
    let x = -24 + amount * (WIDTH + 48);
    if (!right) x = WIDTH - x;
    const y = band * 2 * 16 + Math.min(2, 25 - band * 2) * 8;
    return {x, y, right};
  }

  function eaten(seconds, column, row) {
    if (seconds < PACMAN_AT) return false;
    const pacman = pacmanPosition(seconds, Math.floor(row / 2));
    if (!pacman) return true;
    const center = column * 16 + 8;
    return pacman.right ? center < pacman.x + 8 : center > pacman.x - 8;
  }

  function drawStroke(ctx, stroke, x, y, color) {
    ctx.fillStyle = color;
    for (let row = 0; row < 7; row++) for (let column = 0; column < 5; column++) {
      if (stroke[row] >>> column & 1) ctx.fillRect(x + 2 + column * 2, y + 2 + row * 2, 2, 2);
    }
  }

  function decipher(target, seed, age) {
    if (age < 0) return null;
    if (target === ' ') return {character: ' ', settled: true};
    const correct = CODE_ALPHABET.indexOf(target);
    const deadline = 2.4 + noise(seed * 71 + 13) * 4;
    if (age >= deadline) return {character: target, settled: true};
    let step = Math.floor(age * 25 + 1e-7);
    if (age >= 2) step = 50 + Math.floor((age - 2) * 10 + 1e-7);
    let glyph = hash(seed * 977 + step * 7919) % (CODE_ALPHABET.length - 1);
    if (glyph >= correct) glyph++;
    return {character: CODE_ALPHABET[glyph], settled: false};
  }

  function drawTerminal(ctx, images, seconds) {
    if (seconds < MATRIX_AT - 1 || seconds >= CIRCLE_AT) return;
    let layerAlpha = smooth(MATRIX_AT - 1, MATRIX_AT + 2, seconds);
    layerAlpha *= 1 - smooth(FADE_AT, CIRCLE_AT, seconds);
    ctx.save();
    ctx.globalAlpha = layerAlpha;
    for (let row = 0; row < 25; row++) for (let column = 0; column < 40; column++) {
      if (eaten(seconds, column, row)) continue;
      const cell = terminalCell(seconds, column, row);
      drawStroke(ctx, CODE_STROKES[cell.glyph], column * 16, row * 16,
        `rgb(${clamp(cell.red) * 255 | 0},${clamp(cell.green) * 255 | 0},${clamp(cell.blue) * 255 | 0})`);
    }
    const messages = [
      {text: 'IDEA BY BILIZIR FROM DMA', column: 7, row: 8, start: SECRETS_AT + 2},
      {text: 'DMA IS GOOD FOR YOU !', column: 9, row: 16, start: SECRETS_AT + 6}
    ];
    for (const message of messages) for (let index = 0; index < message.text.length; index++) {
      const column = message.column + index;
      const row = message.row;
      if (eaten(seconds, column, row)) continue;
      const letter = decipher(message.text[index], row * 40 + column, seconds - message.start - index * .022);
      if (!letter || letter.character === ' ') continue;
      const alpha = letter.settled ? 1 : .78;
      drawBitmapText(ctx, images.grey, letter.character, column * 16, row * 16, alpha);
    }
    for (let band = 0; band < 13; band++) {
      const pacman = pacmanPosition(seconds, band);
      if (!pacman) continue;
      const opening = .16 + .95 * Math.abs(Math.sin((seconds - PACMAN_AT) * Math.PI * 7 + band * .4));
      const pixel = Math.min(2, 25 - band * 2) * 2;
      ctx.fillStyle = '#ffdf1e';
      for (let py = -4; py < 4; py++) for (let px = -4; px < 4; px++) {
        const xx = px + .5, yy = py + .5;
        const front = pacman.right ? xx : -xx;
        if (xx * xx + yy * yy > 15.6 || front > 0 && Math.abs(yy) < front * opening) continue;
        if (front < .6 && front > -.6 && py === -3) continue;
        ctx.fillRect(pacman.x + px * pixel, pacman.y + py * pixel, pixel, pixel);
      }
    }
    ctx.restore();
  }

  function circleRotation(seconds) {
    return rotation(vec(.30 + .28 * Math.sin(seconds * .32), .27 * Math.sin(seconds * .23), .12 * Math.sin(seconds * .19)));
  }

  function circlePoint(distance, row, seconds) {
    const start = Math.PI / 2 + (256 - 190) * Math.PI / 256;
    const angle = start + distance * TWO_PI / 256;
    const radius = 125 + row * (6.2 + 1.4 * Math.sin(seconds * .57));
    return vec(radius * Math.cos(angle), radius * Math.sin(angle), 0);
  }

  function projectCircle(point, matrix) {
    const rotated = add(rotate(matrix, point), vec(0, 0, 840));
    return project(rotated, 320, 195, 730, 40);
  }

  function drawCircularContours(ctx, seconds, alpha = 1) {
    const art = root.DMA40CircleData;
    if (!art) return;
    const advance = 20.4;
    let cells = (seconds * 60 - 190) / advance;
    let base = Math.floor(cells);
    let fraction = cells - base;
    if (fraction < 0) { base--; fraction++; }
    if (base >= 0) base %= CIRCLE_TEXT.length;
    const phase = -fraction * advance;
    const matrix = circleRotation(seconds);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#33aadd';
    for (let slot = 0; slot < 12; slot++) {
      const position = base + slot;
      const character = position >= 0 ? CIRCLE_TEXT[position % CIRCLE_TEXT.length] : ' ';
      const contours = art.Glyphs[String(character.charCodeAt(0))];
      if (!contours) continue;
      const path = new Path2D();
      for (const contour of contours) {
        contour.forEach((source, index) => {
          const distance = phase + slot * advance + source[0] * .68;
          const row = 5 + (source[1] - 5) * .68;
          const point = projectCircle(circlePoint(distance, row, seconds), matrix);
          if (!point) return;
          if (index) path.lineTo(point.x, point.y); else path.moveTo(point.x, point.y);
        });
        path.closePath();
      }
      ctx.fill(path, 'evenodd');
    }
    ctx.restore();
  }

  function drawCircleLogo(ctx, images, seconds, alpha) {
    const image = images.logo;
    const width = 220;
    const height = Math.round(width * image.height / image.width);
    const x = (WIDTH - width) / 2;
    const y = 195 - height / 2;
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let row = 0; row < height; row++) {
      const offset = 7 * Math.sin(row * .03 + seconds * 60 * -.035) + 7 * Math.sin(row * .01 + seconds * 60 * .05);
      const sourceY = row * image.height / height;
      ctx.drawImage(image, 0, sourceY, image.width, Math.max(1, image.height / height), x + offset, y + row, width, 1.2);
    }
    ctx.restore();
  }

  function drawReflection(effect, ctx, horizon, seconds) {
    const source = effect.circleSource;
    const sourceContext = source.getContext('2d');
    sourceContext.clearRect(0, 0, WIDTH, HEIGHT);
    sourceContext.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalAlpha = .55;
    for (let y = horizon; y < HEIGHT; y += 2) {
      const distance = y - horizon;
      const sourceY = horizon - 1 - distance * 180 / Math.max(1, HEIGHT - horizon);
      const wave = Math.sin(distance / 18 * TWO_PI + seconds * 2.4 + .3) * 3.5;
      ctx.drawImage(source, 0, sourceY, WIDTH, 2, wave, y, WIDTH, 2);
    }
    ctx.fillStyle = 'rgba(35,95,150,.18)';
    ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);
    ctx.restore();
  }

  function drawLens(effect, ctx, images, seconds) {
    const amount = smooth(CIRCLE_LENS_AT, CIRCLE_LENS_AT + 1.25, seconds);
    if (!amount) return;
    const local = seconds - CIRCLE_LENS_AT;
    const x = 320 + 145 * Math.sin(local * .63 + .8) + 20 * Math.sin(local * .19);
    const y = 195 + 95 * Math.cos(local * .77 + 1.6);
    const radius = 76 * amount;
    const zoom = 1 + 1.6 * amount;
    const source = effect.circleSource;
    const sourceContext = source.getContext('2d');
    sourceContext.clearRect(0, 0, WIDTH, HEIGHT);
    sourceContext.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.clip();
    ctx.translate(x, y);
    ctx.scale(zoom, zoom);
    ctx.translate(-x, -y);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = amount;
    const rim = ctx.createRadialGradient(x - radius * .3, y - radius * .4, radius * .1, x, y, radius);
    rim.addColorStop(.82, 'rgba(180,225,255,0)');
    rim.addColorStop(.98, 'rgba(210,240,255,.35)');
    rim.addColorStop(1, 'rgba(230,248,255,.7)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  function drawCircle(effect, ctx, images, seconds) {
    if (seconds < CIRCLE_AT || seconds >= CIRCLE_END) return;
    const local = seconds - CIRCLE_AT;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const alpha = smooth(0, .5, local);
    drawCircularContours(ctx, local, alpha);
    if (seconds >= CIRCLE_LOGO_AT) drawCircleLogo(ctx, images, local, smooth(CIRCLE_LOGO_AT, CIRCLE_LOGO_AT + 2.5, seconds));
    const horizon = clamp(300 + 22 * Math.sin(local * .31), 270, 368);
    drawReflection(effect, ctx, horizon, local);
    drawLens(effect, ctx, images, seconds);
  }

  function create() {
    const mesh = makeSpoonMesh();
    let voxel = null;
    try { voxel = new VoxelRenderer(); } catch (error) { console.warn(`DMA40 voxel fallback: ${error.message}`); }
    const circleSource = document.createElement('canvas');
    circleSource.width = WIDTH;
    circleSource.height = HEIGHT;
    return {
      mesh,
      targets: buildTargets(mesh),
      samples: [],
      transformed: new Array(mesh.points.length),
      projected: new Array(mesh.points.length),
      renderTriangles: [],
      voxel,
      circleSource
    };
  }

  function draw(effect, ctx, images, seconds) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (seconds < CIRCLE_AT) {
      drawBallCloud(effect, ctx, images, seconds);
      drawMetal(effect, ctx, seconds);
      drawQuote(ctx, images, seconds);
      drawVoxel(effect, ctx, seconds);
      drawTerminal(ctx, images, seconds);
    } else {
      drawCircle(effect, ctx, images, seconds);
    }
  }

  root.DMA40Spoon = Object.freeze({create, draw, constants: Object.freeze({CIRCLE_END})});
})(typeof globalThis !== 'undefined' ? globalThis : this);
