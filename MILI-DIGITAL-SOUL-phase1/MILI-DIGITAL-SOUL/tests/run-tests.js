'use strict';
/* 阶段一测试：零依赖，用法 node tests/run-tests.js（或 npm test）。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
['util', 'config', 'fx', 'character', 'shots', 'renderer'].forEach(f => require(path.join(root, 'src', f + '.js')));
const M = globalThis.MILI;
const { W, H, FPS, DURATION, FRAMES, SHOTS } = M.CONFIG;
const { createHarness } = require('./mock-canvas.js');
const h = createHarness(M);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function* nums(o, p = '') {
  if (typeof o === 'number') yield [p, o];
  else if (o && typeof o === 'object') for (const k of Object.keys(o)) yield* nums(o[k], p + '.' + k);
}
const sceneAt = f => { const t = f / FPS, s = M.shotAt(t), pulse = Math.exp(-(((t * M.CONFIG.BPM) / 60) % 1) * 5.5); return M.SCENES[s.shot.id](s.u, s.sec, t, { beat: (t * M.CONFIG.BPM) / 60, pulse }); };

// ---------- 配置与时间轴 ----------
test('配置：1920×1080、30 FPS、30 秒、900 帧', () => {
  assert.deepEqual([W, H, FPS, DURATION, FRAMES], [1920, 1080, 30, 30, 900]);
});
test('配置：六个镜头首尾相接，正好覆盖 0~30 秒', () => {
  assert.equal(SHOTS.length, 6);
  assert.equal(SHOTS[0].start, 0);
  assert.equal(SHOTS[5].end, DURATION);
  for (let i = 1; i < SHOTS.length; i++) assert.equal(SHOTS[i].start, SHOTS[i - 1].end);
  SHOTS.forEach(s => assert.equal(typeof M.SCENES[s.id], 'function', `缺少镜头函数 ${s.id}`));
});
test('shotAt：镜头边界归属正确，越界与 NaN 被收敛', () => {
  SHOTS.forEach((s, i) => {
    assert.equal(M.shotAt(s.start).index, i);
    assert.equal(M.shotAt(s.end - 1 / FPS).index, i);
  });
  assert.equal(M.shotAt(DURATION).index, SHOTS.length - 1);
  assert.equal(M.shotAt(-3).index, 0);
  assert.equal(M.clampTime(NaN), 0);
});
test('shotAt：镜头内进度 u 单调递增且落在 [0,1]', () => {
  let prev = { index: -1, u: 0 };
  for (let f = 0; f <= FRAMES; f++) {
    const { index, u } = M.shotAt(f / FPS);
    assert.ok(u >= 0 && u <= 1, `帧 ${f} 的 u=${u}`);
    if (index === prev.index) assert.ok(u >= prev.u, `帧 ${f} 的 u 倒退`);
    prev = { index, u };
  }
});
test('fx.timecode：时间码格式', () => {
  assert.equal(M.fx.timecode(0), '00:00.00');
  assert.equal(M.fx.timecode(12.4), '00:12.40');
  assert.equal(M.fx.timecode(DURATION), '00:30.00');
});

// ---------- 确定性 ----------
test('util.rnd：确定性，范围 [0,1)，分布大致均匀', () => {
  assert.equal(M.util.rnd(3, 4, 5), M.util.rnd(3, 4, 5));
  let sum = 0;
  for (let i = 0; i < 10000; i++) { const v = M.util.rnd(i, 7, 9); assert.ok(v >= 0 && v < 1); sum += v; }
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02, `均值 ${sum / 10000}`);
});
test('镜头状态函数：纯函数且所有数值有限', () => {
  for (let f = 0; f <= FRAMES; f += 5) {
    const a = sceneAt(f), b = sceneAt(f);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `帧 ${f} 两次结果不同`);
    for (const [p, v] of nums(a)) assert.ok(Number.isFinite(v), `帧 ${f} ${p} = ${v}`);
  }
});
test('particlePos：纯函数、与调用顺序无关、坐标有限', () => {
  const w = { rise: 0.3, orbit: 0.5, converge: 0.6, burst: 0.4, dir: 1, ox: 960, oy: 640 };
  const a = M.fx.particlePos(7, 12.34, w);
  M.fx.particlePos(99, 3.3, w); M.fx.particlePos(7, 25, w);
  assert.deepEqual(M.fx.particlePos(7, 12.34, w), a);
  for (let i = 0; i < 720; i++) for (const t of [0, 7.5, 14.2, 21, 29.97]) {
    const q = M.fx.particlePos(i, t, w);
    assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y));
  }
});
test('源码规范：渲染相关文件不使用 Math.random / Date / performance.now', () => {
  for (const f of fs.readdirSync(path.join(root, 'src')).filter(f => f !== 'player.js')) {
    const src = fs.readFileSync(path.join(root, 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 去掉注释再检查
    assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(src), `${f} 含有非确定性调用`);
  }
});

// ---------- renderAt ----------
test('渲染器：画布被设置为 1920×1080', () => {
  assert.deepEqual([h.main.width, h.main.height], [1920, 1080]);
});
test('renderAt：同一时间 → 完全相同的绘制序列，与调用顺序无关', () => {
  const a = h.render(12.34).hash;
  h.render(3); h.render(27.7); h.render(0);
  assert.equal(h.render(12.34).hash, a);
  assert.equal(h.render(12.34, { hud: false }).hash, a);
});
test('renderAt：不同时间 → 不同画面；相邻帧也不同', () => {
  const hs = [0, 30, 100, 200, 300, 450, 600, 750, 899].map(f => h.renderFrame(f).hash);
  assert.equal(new Set(hs).size, hs.length);
  assert.notEqual(h.renderFrame(200).hash, h.renderFrame(201).hash);
});
test('renderAt：返回 { t, frame, shot }', () => {
  assert.deepEqual(h.render(14).meta, { t: 14, frame: 420, shot: 3 });
  assert.deepEqual(h.render(0).meta, { t: 0, frame: 0, shot: 0 });
  assert.deepEqual(h.render(30).meta, { t: 30, frame: 900, shot: 5 });
});
test('renderFrame(n) 等价于 renderAt(n / 30)', () => {
  for (const n of [0, 1, 119, 120, 370, 575, 899, 900]) assert.equal(h.renderFrame(n).hash, h.render(n / FPS).hash);
});
test('renderAt：越界被限制到 [0,30]，NaN 视为 0', () => {
  assert.equal(h.render(-5).hash, h.render(0).hash);
  assert.equal(h.render(999).hash, h.render(30).hash);
  assert.equal(h.render(NaN).hash, h.render(0).hash);
});
test('renderAt：全部 901 个时刻（含 30 秒）无异常、无非法绘图参数', () => {
  const bad = [];
  for (let f = 0; f <= FRAMES; f++) {
    const r = h.renderFrame(f);
    assert.ok(r.calls > 100, `帧 ${f} 几乎没有绘制`);
    if (r.bad.length) bad.push(`帧 ${f}: ${r.bad.slice(0, 3).join('; ')}`);
  }
  assert.deepEqual(bad.slice(0, 5), []);
});
test('画面内容：镜头 1 没有角色，镜头 2~6 有角色', () => {
  assert.ok(!h.render(1).byName.bezierCurveTo, '镜头 1 不应绘制角色路径');
  for (const t of [6, 12, 16, 22, 27]) assert.ok(h.render(t).byName.bezierCurveTo > 0, `t=${t} 应有角色`);
});
test('画面内容：信息层默认关闭，开启后恰好多 4 段文字', () => {
  const off = h.render(15).byName.fillText, on = h.render(15, { hud: true }).byName.fillText;
  assert.equal(on - off, 4);
});
test('画面内容：结尾渐隐为纯黑，中段没有整屏黑场', () => {
  assert.ok(h.render(30).fills.includes('rgba(0,0,0,1.000)'), '30 秒应有不透明黑色遮罩');
  assert.ok(!h.render(15).fills.includes('rgba(0,0,0,1.000)'));
});

// ---------- 网页文件 ----------
test('index.html：引用的脚本和样式都存在，src/ 下的脚本全部被引用', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g), ...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]);
  refs.forEach(r => assert.ok(fs.existsSync(path.join(root, r)), `缺少文件 ${r}`));
  for (const f of fs.readdirSync(path.join(root, 'src'))) assert.ok(refs.includes('src/' + f), `index.html 没有引用 src/${f}`);
  assert.ok(refs.indexOf('src/player.js') > refs.indexOf('src/renderer.js'), 'player.js 必须在 renderer.js 之后加载');
});
test('player.js：语法正确', () => {
  new vm.Script(fs.readFileSync(path.join(root, 'src', 'player.js'), 'utf8'), { filename: 'player.js' });
});

// ---------- 运行 ----------
let pass = 0; const fails = [];
const t0 = Date.now();
for (const { name, fn } of tests) {
  const s = Date.now();
  try { fn(); pass++; console.log(`  ✓ ${name} (${Date.now() - s}ms)`); }
  catch (e) { fails.push(name); console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').slice(0, 4).join('\n      ')}`); }
}
console.log(`\n共 ${tests.length} 项，通过 ${pass}，失败 ${fails.length}，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
process.exit(fails.length ? 1 : 0);
