'use strict';
/* 零依赖的 2D 画布模拟（仅测试用）。
 * 记录每一次绘图调用与属性赋值：统计次数、校验数值必须是有限数、
 * 并把整帧的调用序列折算成一个哈希，用来断言"同一时间 → 同一画面"。 */
const nameCache = new Map();
const strHash = s => {
  let h = nameCache.get(s);
  if (h === undefined) {
    h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    if (nameCache.size < 5000) nameCache.set(s, h);
  }
  return h;
};

function createHarness(M) {
  const st = { hash: 0, calls: 0, byName: {}, bad: [], fills: [] };
  const mix = n => { st.hash = Math.imul(st.hash ^ (n | 0), 16777619) >>> 0; };
  const check = (where, v) => {
    if (typeof v === 'number') { if (Number.isFinite(v)) mix(Math.round(v * 1000)); else st.bad.push(`${where} = ${v}`); }
    else if (typeof v === 'string') { if (/NaN|Infinity|undefined/.test(v)) st.bad.push(`${where} = "${v}"`); mix(strHash(v)); }
    else if (Array.isArray(v)) v.forEach(x => check(where, x));
  };
  const record = (k, args) => {
    st.calls++; st.byName[k] = (st.byName[k] || 0) + 1; mix(strHash(k));
    args.forEach((v, i) => check(`${k}[${i}]`, v));
  };
  const gradient = { addColorStop(o, c) { check('addColorStop.offset', o); check('addColorStop.color', c); } };

  function makeCtx(canvas) {
    const props = {};
    return new Proxy({}, {
      get(_, k) {
        if (typeof k === 'symbol') return undefined;
        if (k === 'canvas') return canvas;
        if (k === 'measureText') return s => ({ width: String(s).length * 12 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { record(k, a); return gradient; };
        if (k in props) return props[k];
        return (...a) => { record(k, a); };
      },
      set(_, k, v) {
        props[k] = v; check('set ' + String(k), v);
        if (k === 'fillStyle' && typeof v === 'string') st.fills.push(v);
        return true;
      },
    });
  }

  const main = { width: 0, height: 0 }, small = { width: 0, height: 0 };
  const mainCtx = makeCtx(main), smallCtx = makeCtx(small);
  main.getContext = () => mainCtx;
  small.getContext = () => smallCtx;

  const renderer = M.createRenderer(main, { createCanvas: (w, h) => { small.width = w; small.height = h; return small; } });
  const run = fn => {
    st.hash = 2166136261; st.calls = 0; st.byName = {}; st.bad = []; st.fills = [];
    const meta = fn();
    return { hash: st.hash, calls: st.calls, byName: st.byName, bad: st.bad, fills: st.fills, meta };
  };
  return {
    renderer, main, small,
    render: (t, o) => run(() => renderer.renderAt(t, o)),
    renderFrame: (n, o) => run(() => renderer.renderFrame(n, o)),
  };
}

module.exports = { createHarness };
