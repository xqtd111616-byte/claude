/* 全局配置：分辨率、帧率、时长、六个镜头的时间表。 */
(function (M) {
  'use strict';
  const FPS = 30, DURATION = 30;

  const SHOTS = [
    { id: 'boot',      name: '启动',   start: 0,  end: 4,  color: '#5ff3ff' },
    { id: 'awaken',    name: '苏醒',   start: 4,  end: 9,  color: '#6fb6ff' },
    { id: 'stream',    name: '数据流', start: 9,  end: 14, color: '#8a6bff' },
    { id: 'resonance', name: '共鸣',   start: 14, end: 19, color: '#ff4fa3' },
    { id: 'fragment',  name: '碎裂',   start: 19, end: 25, color: '#ff7a6b' },
    { id: 'rebirth',   name: '重生',   start: 25, end: 30, color: '#9ff5e1' },
  ];

  M.CONFIG = Object.freeze({ W: 1920, H: 1080, FPS, DURATION, FRAMES: FPS * DURATION, BPM: 120, SHOTS });

  // rgb 字符串用于 rgba()，hex 用于直接填色
  M.COLORS = Object.freeze({
    cy: '95,243,255', mg: '255,79,163', vi: '138,107,255', wh: '235,245,255',
    cyHex: '#5ff3ff', mgHex: '#ff4fa3', viHex: '#8a6bff',
  });

  M.clampTime = t => (Number.isFinite(t) ? Math.min(Math.max(t, 0), DURATION) : 0);

  // 时间 → 镜头。区间为 [start, end)，末帧（t = 30）归入最后一个镜头。
  M.shotAt = function (t) {
    t = M.clampTime(t);
    let i = SHOTS.findIndex(s => t >= s.start && t < s.end);
    if (i < 0) i = SHOTS.length - 1;
    const s = SHOTS[i];
    return { index: i, shot: s, sec: t - s.start, u: (t - s.start) / (s.end - s.start) };
  };
})(globalThis.MILI = globalThis.MILI || {});
