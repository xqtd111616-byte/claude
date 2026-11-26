/* 原创 AI 少女「MILI」：纯 Canvas 路径绘制，无任何外部素材。
 * 局部坐标：原点在颈根，头心约 (0,-245)，向下为正；半身像范围 y∈[-470, 340]。
 * 每个部件函数既能画线框（mode='wire'）也能画实体（mode='fill'），
 * 线框 + 带扫描线的实体显现 = "由代码生成"的效果。 */
(function (M) {
  'use strict';
  const { lerp, rnd, rgba, a01 } = M.util;
  const { glow } = M.fx;
  const C = M.COLORS, TAU = Math.PI * 2;
  const TOP = -470, BOT = 340;

  // ---- 几何工具：三次贝塞尔采样 + 变宽飘带（用于双马尾）----
  function bez(p, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
  }
  function ribbon(ctx, p, w0, w1) {
    const n = 18, L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = bez(p, t), b = bez(p, Math.min(1, t + 0.01)), c = bez(p, Math.max(0, t - 0.01));
      let dx = b[0] - c[0], dy = b[1] - c[1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = lerp(w0, w1, t) * (1 + 0.18 * Math.sin(t * Math.PI)) * 0.5;
      L.push([a[0] - dy * w, a[1] + dx * w]); R.push([a[0] + dy * w, a[1] - dx * w]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  // 线框模式：沿用调用方设置好的描边样式；实体模式：填充 + 可选描边
  function paint(ctx, mode, fill, stroke, lw) {
    if (mode === 'wire') { ctx.stroke(); return; }
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  const vgrad = (ctx, y0, y1, stops) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  };

  // ---- 眼睛：数据虹膜（准星 + 瞳孔）+ 上眼睑 + 外眼角睫毛 ----
  function eye(ctx, x, y, side, open, look) {
    const hy = 21 * open;
    ctx.save();
    ctx.translate(x, y);
    if (hy > 1.2) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, 23, hy, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = '#f4f7ff'; ctx.fillRect(-26, -26, 52, 52);
      const ix = look.x * 5, iy = look.y * 3;
      const g = ctx.createRadialGradient(ix, iy + 2, 2, ix, iy, 19);
      g.addColorStop(0, '#0b1230'); g.addColorStop(0.3, '#2a63ff'); g.addColorStop(0.72, '#5ff3ff'); g.addColorStop(1, '#a98bff');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(ix, iy, 16, 21, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ix, iy, 9, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ix - 14, iy); ctx.lineTo(ix - 6, iy); ctx.moveTo(ix + 6, iy); ctx.lineTo(ix + 14, iy);
      ctx.stroke();
      ctx.fillStyle = '#050816'; ctx.beginPath(); ctx.arc(ix, iy, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ix - 6, iy - 8, 4.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(ix + 7, iy + 7, 2.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b1038'; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 23, Math.max(hy, 0.8), 0, Math.PI, TAU); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(side * 21, -2); ctx.lineTo(side * 33, -10); ctx.stroke();
    if (hy > 4) {
      ctx.strokeStyle = 'rgba(27,16,56,0.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, 0, 22, hy, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- 身体上的电路纹：虚线流动 + 胸口"灵魂核心" ----
  function circuit(ctx, T, pulse) {
    ctx.save();
    ctx.strokeStyle = C.cyHex; ctx.lineWidth = 2.4;
    ctx.shadowColor = C.cyHex; ctx.shadowBlur = 12;
    ctx.setLineDash([22, 12]); ctx.lineDashOffset = -T * 80;
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, 8); ctx.moveTo(0, 48); ctx.lineTo(0, BOT); ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 18, 60); ctx.lineTo(s * 70, 60); ctx.lineTo(s * 100, 100); ctx.lineTo(s * 100, BOT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 40, -70); ctx.lineTo(s * 130, -48); ctx.lineTo(s * 168, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 150, 40); ctx.lineTo(s * 150, 120); ctx.lineTo(s * 134, 140); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-14, -82); ctx.lineTo(0, -52); ctx.lineTo(14, -82); ctx.stroke();
    ctx.restore();

    const cr = 15 + 4 * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 28, cr * 4, C.cy, 0.55 + 0.3 * pulse);
    glow(ctx, 0, 28, cr * 1.6, C.wh, 0.9);
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 28, cr, 0, TAU);
    ctx.fillStyle = '#effcff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.cyHex; ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = T * 0.6 + (k * TAU) / 6, x = Math.cos(a) * (cr + 16), y = 28 + Math.sin(a) * (cr + 16);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(C.cy, 0.8); ctx.lineWidth = 2; ctx.stroke();
  }

  // ---- 全部部件，按从后到前的顺序 ----
  function drawParts(ctx, mode, S) {
    const T = S.T, fill = mode === 'fill', amp = S.hairAmp;
    ctx.lineJoin = 'round';
    const hg = fill ? vgrad(ctx, -380, 300, [[0, '#4a33b8'], [0.35, '#8a5bff'], [0.7, '#ff4fa3'], [1, '#5ff3ff']]) : null;

    // 1 脑后发团
    ctx.beginPath(); ctx.ellipse(0, -255, 118, 128, 0, 0, TAU);
    paint(ctx, mode, '#2b1f78', '#1a1250', 2);

    // 2 双马尾：每侧两层飘带，摆动相位由时间驱动
    for (const s of [-1, 1]) {
      const sw = k => Math.sin(T * 1.6 + s * 0.9 + k * 1.1) * amp * (10 + k * 14);
      ribbon(ctx, [[s * 92, -300], [s * (195 + sw(0)), -255], [s * (262 + sw(1)), -30], [s * (222 + sw(2)), 285]], 84, 6);
      paint(ctx, mode, hg, '#1a1250', 2);
      ribbon(ctx, [[s * 86, -310], [s * (150 + sw(0) * 0.7), -240], [s * (188 + sw(1) * 0.7), -10], [s * (150 + sw(2) * 0.7), 215]], 56, 4);
      paint(ctx, mode, hg, 'rgba(255,255,255,0.28)', 2);
    }

    // 3 脖子
    ctx.beginPath(); ctx.moveTo(-21, -155); ctx.lineTo(-24, -80); ctx.lineTo(24, -80); ctx.lineTo(21, -155); ctx.closePath();
    paint(ctx, mode, '#dcb6c8', '#a77a98', 2);

    // 4 躯干（紧身战衣）
    ctx.beginPath();
    ctx.moveTo(-24, -88);
    ctx.bezierCurveTo(-100, -80, -178, -56, -204, 22);
    ctx.lineTo(-176, BOT); ctx.lineTo(176, BOT); ctx.lineTo(204, 22);
    ctx.bezierCurveTo(178, -56, 100, -80, 24, -88);
    ctx.lineTo(0, -44); ctx.closePath();
    paint(ctx, mode, fill ? vgrad(ctx, -90, BOT, [[0, '#262e74'], [1, '#0f1238']]) : null, C.viHex, 2.5);
    if (fill) {
      circuit(ctx, T, S.pulse);
      ctx.save(); // 洋红色项圈
      ctx.strokeStyle = C.mgHex; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.shadowColor = C.mgHex; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(-23, -102); ctx.quadraticCurveTo(0, -90, 23, -102); ctx.stroke();
      ctx.restore();
    }

    // 5 脸
    ctx.beginPath();
    ctx.moveTo(-78, -285);
    ctx.bezierCurveTo(-84, -215, -60, -160, -22, -142);
    ctx.quadraticCurveTo(0, -134, 22, -142);
    ctx.bezierCurveTo(60, -160, 84, -215, 78, -285);
    ctx.bezierCurveTo(70, -345, -70, -345, -78, -285);
    ctx.closePath();
    paint(ctx, mode, fill ? vgrad(ctx, -345, -135, [[0, '#fbe9f0'], [1, '#efcfdd']]) : null, '#b98aa6', 2);

    // 6 耳机模块 + 天线
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * 92, -205, 27, 0, TAU);
      paint(ctx, mode, '#171a46', C.cyHex, 3);
      if (fill) {
        ctx.beginPath(); ctx.arc(s * 92, -205, 15, 0, TAU); ctx.strokeStyle = C.mgHex; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(s * 92, -205, 5, 0, TAU); ctx.fillStyle = C.cyHex; ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 98, -229); ctx.lineTo(s * 126, -292);
        ctx.strokeStyle = C.cyHex; ctx.lineWidth = 3; ctx.stroke();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, s * 126, -292, 22, C.cy, 0.8); ctx.restore();
      }
    }

    // 7 五官
    if (fill) {
      ctx.fillStyle = 'rgba(255,100,150,0.35)';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 56, -163, 15, 7, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(120,70,100,0.5)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, -167); ctx.lineTo(-2, -161); ctx.stroke();
      ctx.strokeStyle = '#8a3d68'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10, -151); ctx.quadraticCurveTo(0, -147 + S.smile * 7, 10, -151); ctx.stroke();
      eye(ctx, -40, -190, -1, S.eyeOpen, S.look);
      eye(ctx, 40, -190, 1, S.eyeOpen, S.look);
    }

    // 8 刘海 + 两侧鬓发
    ctx.beginPath();
    ctx.moveTo(-96, -285);
    ctx.bezierCurveTo(-100, -358, -46, -392, 0, -392);
    ctx.bezierCurveTo(46, -392, 100, -358, 96, -285);
    ctx.bezierCurveTo(102, -250, 100, -214, 90, -178);
    ctx.bezierCurveTo(84, -205, 76, -232, 64, -246);
    ctx.lineTo(56, -226); ctx.lineTo(44, -262); ctx.lineTo(30, -222); ctx.lineTo(14, -264); ctx.lineTo(0, -220);
    ctx.lineTo(-14, -264); ctx.lineTo(-30, -222); ctx.lineTo(-46, -262); ctx.lineTo(-58, -228); ctx.lineTo(-66, -246);
    ctx.bezierCurveTo(-76, -232, -84, -205, -90, -178);
    ctx.bezierCurveTo(-100, -214, -102, -250, -96, -285);
    ctx.closePath();
    paint(ctx, mode, hg, '#1a1250', 2);
    if (fill) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-62, -336); ctx.quadraticCurveTo(-24, -372, 40, -356);
      ctx.moveTo(-78, -300); ctx.quadraticCurveTo(-70, -330, -52, -346);
      ctx.stroke();
    }

    // 9 光环（悬浮在头顶，缓慢旋转的虚线环）
    if (fill) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(C.cy, 0.9); ctx.lineWidth = 3;
      ctx.shadowColor = C.cyHex; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(0, -410, 118, 24, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([4, 12]); ctx.lineDashOffset = -T * 40; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -410, 140, 31, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 对外入口 ----
  // S: { T, x, y, scale, reveal, wire, alpha, eyeOpen, look:{x,y}, smile, hairAmp, pulse, glitch }
  function draw(ctx, S) {
    const T = S.T;
    ctx.save();
    ctx.translate(S.x, S.y + Math.sin(T * 1.4) * 4);
    ctx.scale(S.scale, S.scale);
    ctx.globalAlpha = a01(S.alpha);

    ctx.save(); // 背后的光晕
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -130, 560, C.vi, 0.28 * S.reveal);
    ctx.restore();

    if (S.wire > 0) { // 线框层
      ctx.save();
      ctx.globalAlpha *= a01(S.wire);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(95,243,255,0.85)'; ctx.lineWidth = 1.6;
      drawParts(ctx, 'wire', S);
      ctx.restore();
    }

    if (S.reveal > 0) { // 实体层：从上往下显现；故障时按横向条带错位
      const seed = Math.floor(T * 15), bands = S.glitch > 0.02 ? 10 : 1;
      const bh = (BOT - TOP) / bands, limit = TOP + (BOT - TOP) * S.reveal;
      for (let b = 0; b < bands; b++) {
        const y0 = TOP + b * bh;
        if (y0 >= limit) break;
        const hit = bands > 1 && rnd(b, seed, 41) > 0.45;
        const dx = hit ? (rnd(b, seed, 42) - 0.5) * 2 * (20 + 120 * S.glitch) * S.glitch : 0;
        ctx.save();
        ctx.beginPath(); ctx.rect(-460, y0, 920, Math.min(bh, limit - y0) + 0.5); ctx.clip();
        ctx.translate(dx, 0);
        drawParts(ctx, 'fill', S);
        ctx.restore();
      }
      if (S.glitch > 0.1) { // 青/洋红色通道分离
        const gdx = S.glitch * (10 + 14 * rnd(seed, 43));
        for (const [dir, col] of [[-1, C.cyHex], [1, C.mgHex]]) {
          ctx.save();
          ctx.globalAlpha *= a01(S.glitch * 0.55);
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.translate(dir * gdx, 0);
          drawParts(ctx, 'wire', S);
          ctx.restore();
        }
      }
    }

    if (S.reveal > 0.01 && S.reveal < 0.99) { // 显现边缘的扫描线
      const y = TOP + (BOT - TOP) * S.reveal;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-300, y, 300, y);
      g.addColorStop(0, rgba(C.cy, 0)); g.addColorStop(0.5, 'rgba(220,255,255,0.95)'); g.addColorStop(1, rgba(C.cy, 0));
      ctx.fillStyle = g; ctx.fillRect(-300, y - 1.5, 600, 3);
      glow(ctx, 0, y, 240, C.cy, 0.22);
      ctx.restore();
    }
    ctx.restore();
  }

  M.character = { draw, drawParts, TOP, BOT };
})(globalThis.MILI = globalThis.MILI || {});
