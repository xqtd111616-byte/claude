/* 数学与确定性随机工具。渲染中禁止使用 Math.random，保证 renderAt(t) 是 t 的纯函数。 */
(function (M) {
  'use strict';
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIn = t => t * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // 整数哈希（lowbias32）→ [0,1) 的确定性伪随机
  function ihash(x) {
    x |= 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }
  const rnd = (a, b = 0, c = 0) =>
    ihash((ihash(ihash(a) + Math.imul(b, 0x9e3779b1)) + Math.imul(c, 0x85ebca6b)) | 0) / 4294967296;

  // 透明度保护：NaN / 越界一律收敛到 [0,1]，避免非法颜色字符串
  const a01 = a => (a > 0 ? (a > 1 ? 1 : a) : 0);
  const rgba = (rgb, a) => `rgba(${rgb},${a01(a).toFixed(3)})`;

  M.util = { clamp, lerp, smooth, easeIn, easeOut, easeInOut, ihash, rnd, a01, rgba };
})(globalThis.MILI = globalThis.MILI || {});
