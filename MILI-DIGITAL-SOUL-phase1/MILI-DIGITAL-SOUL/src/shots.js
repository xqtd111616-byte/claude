/* 六个镜头。每个镜头是一个纯函数：(u, s, T, b) → 场景状态，不做任何绘制。
 *   u: 镜头内进度 0~1   s: 镜头内秒数   T: 全局时间   b: { beat, pulse } 节拍信息
 * 渲染器按状态统一绘制，因此镜头只负责"描述这一刻画面应该是什么样"。 */
(function (M) {
  'use strict';
  const { lerp, smooth, easeOut, easeInOut } = M.util;
  const C = M.COLORS;

  // 眨眼：每 3.7 秒一次，持续 0.16 秒
  const blink = T => { const p = T % 3.7; return p < 0.16 ? 1 - Math.sin((p / 0.16) * Math.PI) : 1; };

  const base = () => ({
    bg: { rgb: '38,52,140', a: 0.5, pulse: 0 },
    code: { density: 0, alpha: 0, speed: 1, rgb: C.cy },
    parts: { rise: 0, orbit: 0, converge: 0, burst: 0, alpha: 0, count: 0, dir: 1, ox: 960, oy: 640 },
    rings: { n: 0, alpha: 0, beat: 0 },
    core: null, scan: -1, char: null,
    cam: { x: 960, y: 540, zoom: 1, rot: 0 },
    title: null, bloom: 0.4, fade: 0, glitchScreen: 0,
  });
  const chr = o => Object.assign({
    x: 960, y: 640, scale: 1, reveal: 1, wire: 0, alpha: 1, eyeOpen: 1,
    look: { x: 0, y: 0 }, smile: 0.3, hairAmp: 1, pulse: 0, glitch: 0,
  }, o);

  M.SCENES = {
    // 1 启动：黑暗中代码雨渐起，中心光点增亮，标题打字出现
    boot(u, s, T, b) {
      return Object.assign(base(), {
        bg: { rgb: '30,44,120', a: 0.25 + 0.3 * u, pulse: 0 },
        code: { density: 0.12 + 0.55 * smooth(0, 1, u), alpha: 0.3 + 0.45 * u, speed: 1, rgb: C.cy },
        parts: { rise: 1, orbit: 0, converge: 0, burst: 0, alpha: 0.7, count: 260, dir: 1, ox: 960, oy: 640 },
        core: { r: 8 + 110 * u * u, a: smooth(0, 0.2, u) },
        scan: smooth(0.1, 0.9, u),
        title: { text: 'MILI-DIGITAL-SOUL', type: smooth(0.5, 0.95, u), alpha: smooth(0.45, 0.55, u), size: 72, y: 800, cursor: true },
        bloom: 0.5,
      });
    },
    // 2 苏醒：粒子汇聚成形，线框被扫描线填成实体，最后睁眼
    awaken(u, s, T, b) {
      return Object.assign(base(), {
        bg: { rgb: '44,56,150', a: 0.5, pulse: b.pulse * 0.15 },
        code: { density: 0.4, alpha: 0.3, speed: 1, rgb: C.cy },
        parts: {
          rise: 0.5 * (1 - smooth(0, 0.6, u)), orbit: smooth(0.7, 1, u),
          converge: smooth(0, 0.7, u) * (1 - smooth(0.75, 1, u)),
          burst: 0, alpha: 0.9, count: 640, dir: 1, ox: 960, oy: 640,
        },
        char: chr({
          reveal: easeInOut(smooth(0.04, 0.8, u)), wire: 1 - 0.5 * smooth(0.6, 1, u),
          eyeOpen: smooth(0.8, 0.92, u) * blink(T), pulse: b.pulse * 0.5, smile: 0.2,
        }),
        cam: { x: 960, y: 540, zoom: lerp(1, 1.07, easeOut(u)), rot: 0 },
      });
    },
    // 3 数据流：代码雨与光环环绕，镜头缓慢推近并轻微旋转
    stream(u, s, T, b) {
      return Object.assign(base(), {
        bg: { rgb: '30,70,170', a: 0.55, pulse: b.pulse * 0.2 },
        code: { density: 0.95, alpha: 0.6, speed: 1.4, rgb: C.cy },
        parts: { rise: 0.25, orbit: 1, converge: 0, burst: 0, alpha: 0.9, count: 720, dir: 1, ox: 960, oy: 640 },
        rings: { n: 3, alpha: 0.9, beat: 0 },
        char: chr({
          wire: 0.35, eyeOpen: blink(T), look: { x: Math.sin(T * 0.9) * 0.7, y: Math.sin(T * 0.6) * 0.3 },
          pulse: b.pulse * 0.7, hairAmp: 1.3, smile: 0.35,
        }),
        cam: { x: lerp(960, 930, u), y: lerp(560, 540, u), zoom: lerp(1.08, 1.24, easeInOut(u)), rot: Math.sin(u * Math.PI) * 0.025 },
      });
    },
    // 4 共鸣：整体随 120 BPM 脉动，洋红色调，冲击波与粒子迸发
    resonance(u, s, T, b) {
      const P = b.pulse;
      return Object.assign(base(), {
        bg: { rgb: '120,40,130', a: 0.5, pulse: P * 0.5 },
        code: { density: 0.75, alpha: 0.3 + 0.4 * P, speed: 1.8, rgb: C.mg },
        parts: { rise: 0, orbit: 0.6, converge: 0, burst: 1, alpha: 0.95, count: 720, dir: 1, ox: 960, oy: 640 },
        rings: { n: 2, alpha: 0.6, beat: 1 },
        char: chr({
          scale: 1 + 0.025 * P, eyeOpen: blink(T), pulse: P, hairAmp: 2.4, smile: 1,
          look: { x: Math.sin(T * 1.3) * 0.4, y: 0 },
        }),
        cam: { x: 960, y: 540, zoom: 1.14 + 0.05 * P, rot: lerp(0.02, -0.02, u) },
        bloom: 0.55 + 0.25 * P,
      });
    },
    // 5 碎裂：画面撕裂、身体从下往上溶解成代码
    fragment(u, s, T, b) {
      const g = 0.3 + 0.7 * smooth(0, 0.6, u);
      return Object.assign(base(), {
        bg: { rgb: '30,60,150', a: 0.5, pulse: 0 },
        code: { density: 1, alpha: 0.85, speed: 2.2, rgb: C.cy },
        parts: { rise: 0.8, orbit: 0, converge: 0, burst: 0.4, alpha: 0.9, count: 720, dir: -1, ox: 960, oy: 640 },
        char: chr({
          reveal: 1 - smooth(0.6, 1, u), wire: 1, glitch: g,
          eyeOpen: Math.floor(T * 10) % 7 === 0 ? 0.25 : blink(T), hairAmp: 3, smile: 0,
        }),
        cam: { x: 960, y: 540, zoom: lerp(1.2, 1.12, u), rot: Math.sin(T * 9) * 0.004 * g },
        glitchScreen: g,
      });
    },
    // 6 重生：重新拼合，推近到眼睛特写，微笑后渐隐，留下标题
    rebirth(u, s, T, b) {
      const z = easeInOut(smooth(0.1, 0.85, u)), fade = smooth(0.86, 1, u);
      return Object.assign(base(), {
        bg: { rgb: '50,70,170', a: 0.55, pulse: b.pulse * 0.2 },
        code: { density: lerp(0.5, 0.15, u), alpha: 0.3, speed: 1, rgb: C.cy },
        parts: { rise: 0, orbit: smooth(0.3, 0.8, u), converge: 1 - smooth(0.4, 0.7, u), burst: 0, alpha: 0.9, count: 640, dir: 1, ox: 960, oy: 640 },
        char: chr({
          reveal: easeOut(smooth(0, 0.4, u)), wire: 1 - 0.7 * smooth(0.2, 0.5, u),
          glitch: 0.8 * (1 - smooth(0, 0.3, u)), eyeOpen: blink(T), smile: smooth(0.4, 0.8, u),
          pulse: b.pulse * 0.6, hairAmp: 1.1,
        }),
        cam: { x: 960, y: lerp(540, 452, z), zoom: lerp(1.1, 2.0, z), rot: 0 },
        fade,
        title: { text: 'MILI-DIGITAL-SOUL', type: 1, alpha: smooth(0.55, 0.68, u) * (1 - smooth(0.93, 1, u)), size: 64, y: 960, sub: '原创数字生命 · 第一阶段样片' },
      });
    },
  };
})(globalThis.MILI = globalThis.MILI || {});
