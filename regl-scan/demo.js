const numerify = require('glsl-numerify');
const quad = require('glsl-quad');
const ext = require('util-extend');

const zoom = 2;
const scale = 16;
const size = {width: 16, height: 16};
const wid = 2.1;
const matSize = {width: (scale * size.width + 1) * zoom, height: (scale * size.height + 1) * zoom};
const screenSize = {width: (scale * size.width * wid + 1) * zoom, height: (scale * size.height + 1) * zoom};

const c1 = document.createElement('canvas');
c1.width = screenSize.width;
c1.height = screenSize.height;
c1.style.width = screenSize.width + 'px';
c1.style.height = screenSize.height + 'px';
document.body.appendChild(c1);

const regl = require('regl')({canvas: c1});

const prefixSum = require('./')(regl, {
  reduce: `vec4 reduce(vec4 prefix, vec4 sum) {
    return prefix + sum;
  }`
});

const input = new Uint8Array(size.width * size.height * 4);
for (let j = 0; j < size.height; j++) {
  for (let i = 0; i < size.width; i++) {
    input[(i + j * size.width) * 4] = Math.floor(Math.random() * 2);
  }
}

var fbos = {
  orig: regl.framebuffer({color: regl.texture(ext({data: input.slice(0)}, size))}),
  src: regl.framebuffer({color: regl.texture(ext({data: input}, size))}),
  dest: regl.framebuffer({color: regl.texture(ext({data: input}, size))}),
  num1: regl.framebuffer({color: regl.texture(matSize)}),
  num2: regl.framebuffer({color: regl.texture(matSize)})
};

const drawToScreen = regl({
  vert: `
    precision mediump float;
    attribute vec2 xy;
    attribute vec2 uvs;
    varying vec2 uv;
    uniform vec2 scale, shift;
    void main () {
      uv = uvs;
      gl_Position = vec4(xy * scale + shift, 0, 1);
    }
  `,
  frag: `
    precision mediump float;
    uniform sampler2D src;
    varying vec2 uv;
    void main () {
      gl_FragColor = texture2D(src, uv);
    }
  `,
  attributes: {
    xy: quad.verts,
    uvs: quad.uvs
  },
  uniforms: {
    src: regl.prop('src'),
    scale: regl.prop('scale'),
    shift: regl.prop('shift')
  },
  count: 6
});

const drawNumbers = regl({
  frag: numerify.makeFrag({
    multiplier: 255,
    sourceSize: `vec2(${size.width}, ${size.height})`,
    destinationSize: `vec2(${size.width * scale + 1}, ${size.height * scale + 1})`,
    destinationCellSize: `vec2(${scale}, ${scale})`
  }),
  vert: numerify.makeVert(),
  attributes: {a_position: quad.verts, a_uv: quad.uvs},
  elements: quad.indices,
  framebuffer: regl.prop('dest'),
  uniforms: {
    source_texture: regl.prop('src'),
    digits_texture: regl.prop('digits'),
    u_clip_y: 1
  }
});

require('resl')({
  manifest: {
    digits: {
      type: 'image',
      src: numerify.digits.uri,
      parser: (data) => regl.texture({data, flipY: true})
    }
  },
  onDone: ({digits}) => {
    ext(fbos, prefixSum.compute({src: fbos.src, dest: fbos.dest, axis: 0}));
    ext(fbos, prefixSum.compute({src: fbos.dest, dest: fbos.src, axis: 1}));

    drawNumbers({src: fbos.orig, dest: fbos.num1, digits});
    drawNumbers({src: fbos.dest, dest: fbos.num2, digits});

    drawToScreen({src: fbos.num1, scale: [1 / wid, 1], shift: [-1 + 1 / wid, 0]});
    drawToScreen({src: fbos.num2, scale: [1 / wid, 1], shift: [1 - 1 / wid, 0]});
  }
});
