/* 特效层：辉光、粒子、代码流、光环、扫描线、标题、信息层。
 * 所有函数都只依赖传入的时间 t，不保存任何状态。 */
(function (M) {
  'use strict';
  const { W, H, FPS, FRAMES, BPM, SHOTS } = M.CONFIG;
  const { clamp, lerp, smooth, easeOut, rnd, rgba, a01 } = M.util;
  const C = M.COLORS, TAU = Math.PI * 2;
  const FONT = '"Noto Sans Mono CJK SC","DejaVu Sans Mono",Menlo,Consolas,monospace';

  // 径向辉光（需要在 lighter 合成模式下调用才有"发光"效果）
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(rgb, a));
    g.addColorStop(0.4, rgba(rgb, a * 0.3));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function background(ctx, bg) {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.72);
    g.addColorStop(0, rgba(bg.rgb, bg.a + bg.pulse * 0.3));
    g.addColorStop(1, rgba(bg.rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- 代码流：每列一条下落的字符流，字符按网格行吸附，闪烁只由 (列, 行, 时间) 哈希决定 ----
  const GL = '01{}[]<>/\\=+*#$%;:ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ><MILISOUL';
  function codeStream(ctx, t, o) {
    if (o.density <= 0 || o.alpha <= 0) return;
    const cw = 28, lh = 24, cols = Math.ceil(W / cw);
    ctx.save();
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < cols; c++) {
      if (rnd(c, 11) > o.density) continue;
      const speed = (150 + rnd(c, 12) * 420) * o.speed;
      const len = 8 + Math.floor(rnd(c, 13) * 22);
      const cycle = H + len * lh + 200;
      const head = ((rnd(c, 14) * cycle + t * speed) % cycle) - 100;
      const hr = Math.floor(head / lh);
      const x = c * cw + cw / 2;
      for (let i = 0; i < len; i++) {
        const row = hr - i, y = row * lh;
        if (y < -lh || y > H + lh) continue;
        const flick = rnd(c, row, 7) > 0.85 ? Math.floor(t * 8) : 0;
        const ch = GL[Math.floor(rnd(c, row + 5000, flick) * GL.length)];
        const f = 1 - i / len;
        ctx.fillStyle = i === 0 ? rgba(C.wh, o.alpha) : rgba(o.rgb, o.alpha * f * f * 0.9);
        ctx.fillText(ch, x, y);
      }
    }
    ctx.restore();
  }

  // ---- 粒子：位置是 (i, t, 权重) 的解析函数；rise/orbit/converge/burst 四种运动按权重混合 ----
  function particlePos(i, t, w) {
    const r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3), r4 = rnd(i, 4), r5 = rnd(i, 5);
    const bp = ((t * BPM) / 60) % 1;
    let X = 0, Y = 0;
    if (w.rise > 0) {
      const m = (r3 * (H + 40) + t * (25 + r2 * 95)) % (H + 40);
      X += w.rise * (r1 * W + Math.sin(t * 0.8 + r4 * TAU) * 14);
      Y += w.rise * (w.dir > 0 ? H + 20 - m : m - 20);
    }
    if (w.orbit > 0) {
      const rad = 180 + r2 * 560;
      const a = r1 * TAU + ((t * (0.25 + 0.5 * r3)) / (0.6 + rad / 500)) * (r4 < 0.5 ? 1 : -1);
      X += w.orbit * (w.ox + Math.cos(a) * rad);
      Y += w.orbit * (w.oy - 120 + Math.sin(a) * rad * 0.36 + (r3 - 0.5) * 200);
    }
    if (w.converge > 0) {
      let tx, ty;
      if (r4 < 0.32) { // 一部分汇聚到头部，其余汇聚到躯干
        const a = r1 * TAU, rr = Math.sqrt(r2);
        tx = w.ox + Math.cos(a) * rr * 88; ty = w.oy - 245 + Math.sin(a) * rr * 105;
      } else {
        tx = w.ox + (r1 - 0.5) * (300 + r3 * 120); ty = w.oy - 110 + r2 * 420;
      }
      const sx = r5 * W, sy = H - ((r3 * H + t * 60) % H);
      const k = smooth(r3 * 0.45, 0.55 + r3 * 0.45, w.converge);
      X += w.converge * lerp(sx, tx, k);
      Y += w.converge * lerp(sy, ty, k);
    }
    if (w.burst > 0) { // 每个节拍从胸口向外迸发
      const d = easeOut(bp) * (120 + r2 * 820), a = r1 * TAU;
      X += w.burst * (w.ox + Math.cos(a) * d);
      Y += w.burst * (w.oy - 100 + Math.sin(a) * d * 0.7);
    }
    const sum = w.rise + w.orbit + w.converge + w.burst;
    return { x: X / sum, y: Y / sum, sum, size: 1.1 + r4 * r4 * 3.4, r2, r4 };
  }

  function particles(ctx, t, w) {
    if (w.alpha <= 0 || w.count <= 0 || w.rise + w.orbit + w.converge + w.burst <= 0) return;
    const p = ((t * BPM) / 60) % 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < w.count; i++) {
      const q = particlePos(i, t, w);
      let a = w.alpha * (0.3 + 0.7 * Math.pow(Math.sin(t * 2.2 + q.r4 * 40), 2));
      a *= 1 - (w.burst / q.sum) * p * 0.8;
      const col = q.r2 < 0.55 ? C.cy : q.r2 < 0.82 ? C.mg : C.wh;
      ctx.fillStyle = rgba(col, a);
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      if (q.size > 3.9) glow(ctx, q.x, q.y, q.size * 5, col, a * 0.5);
    }
    ctx.restore();
  }

  // ---- 光环：旋转虚线椭圆 + 环上的光点；beat 开启时每拍向外扩散冲击波 ----
  function rings(ctx, t, ox, oy, o) {
    if (o.n <= 0 && !o.beat) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2;
    for (let k = 0; k < o.n; k++) {
      const dir = k % 2 ? -1 : 1, rx = 330 + k * 130, ry = rx * (0.28 + k * 0.03), cy = oy + 40;
      const rgb = k % 2 ? C.mg : C.cy;
      ctx.strokeStyle = rgba(rgb, o.alpha * (0.6 - k * 0.12));
      ctx.setLineDash([40 + k * 30, 14, 6, 14]);
      ctx.lineDashOffset = -t * (60 + k * 25) * dir;
      ctx.beginPath(); ctx.ellipse(ox, cy, rx, ry, 0, 0, TAU); ctx.stroke();
      const a = t * (0.9 + k * 0.3) * dir + k * 2;
      glow(ctx, ox + Math.cos(a) * rx, cy + Math.sin(a) * ry, 28, rgb, o.alpha * 0.9);
    }
    ctx.setLineDash([]);
    if (o.beat) {
      const p = ((t * BPM) / 60) % 1;
      for (let j = 0; j < 3; j++) {
        const age = p + j;
        ctx.strokeStyle = rgba(C.mg, (1 - age / 3) * 0.8);
        ctx.lineWidth = 4 - j;
        ctx.beginPath(); ctx.arc(ox, oy + 30, age * 420 + 20, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 开场的中心光点 + 横向镜头光芒
  function coreLight(ctx, c) {
    if (!c || c.a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, W / 2, H / 2, c.r * 4.5, C.cy, c.a * 0.55);
    glow(ctx, W / 2, H / 2, c.r * 1.6, C.wh, c.a * 0.8);
    const g = ctx.createLinearGradient(W / 2 - c.r * 9, 0, W / 2 + c.r * 9, 0);
    g.addColorStop(0, rgba(C.cy, 0));
    g.addColorStop(0.5, rgba(C.wh, c.a * 0.9));
    g.addColorStop(1, rgba(C.cy, 0));
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - c.r * 9, H / 2 - 1.5, c.r * 18, 3);
    ctx.restore();
  }

  // 自上而下扫过画面的激光线（pos 为 0~1，范围外不绘制）
  function scanBeam(ctx, pos) {
    if (!(pos > 0 && pos < 1)) return;
    const y = pos * H;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y - 60, 0, y);
    g.addColorStop(0, rgba(C.cy, 0));
    g.addColorStop(1, rgba(C.cy, 0.22));
    ctx.fillStyle = g; ctx.fillRect(0, y - 60, W, 60);
    ctx.fillStyle = rgba(C.wh, 0.85); ctx.fillRect(0, y - 1, W, 2);
    ctx.restore();
  }

  // 屏幕撕裂：用画布自身的横条做水平错位，条数/位置/偏移都由 15Hz 阶梯种子决定
  function tear(ctx, canvas, t, amt) {
    if (amt <= 0) return;
    const seed = Math.floor(t * 15);
    for (let k = 0; k < 5; k++) {
      if (rnd(seed, k, 31) > amt * 0.9) continue;
      const y = Math.floor(rnd(seed, k, 32) * (H - 120));
      const h = 16 + Math.floor(rnd(seed, k, 33) * 90);
      const dx = (rnd(seed, k, 34) - 0.5) * 160 * amt;
      ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
    }
  }

  // 收尾：暗角 + 扫描线 + 缓慢移动的亮带
  function finish(ctx, t) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.11)';
    ctx.beginPath();
    for (let y = 0; y < H; y += 4) ctx.rect(0, y, W, 1);
    ctx.fill();
    const by = ((t * 140) % (H + 240)) - 120;
    const b = ctx.createLinearGradient(0, by, 0, by + 200);
    b.addColorStop(0, rgba(C.cy, 0));
    b.addColorStop(0.5, rgba(C.cy, 0.035));
    b.addColorStop(1, rgba(C.cy, 0));
    ctx.fillStyle = b; ctx.fillRect(0, by, W, 200);
  }

  // 打字机标题（居中位置按完整文本计算，打字过程中不会左右跳动）
  function title(ctx, tt, t) {
    if (!tt || tt.alpha <= 0) return;
    const n = Math.floor(tt.text.length * clamp(tt.type));
    const cursor = tt.cursor && tt.type < 1 && Math.floor(t * 3) % 2 === 0 ? '█' : '';
    ctx.save();
    ctx.globalAlpha = a01(tt.alpha);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${tt.size}px ${FONT}`;
    const x = (W - ctx.measureText(tt.text).width) / 2;
    ctx.shadowColor = M.COLORS.cyHex; ctx.shadowBlur = 26;
    ctx.fillStyle = '#eaffff';
    ctx.fillText(tt.text.slice(0, n) + cursor, x, tt.y);
    if (tt.sub) {
      ctx.shadowBlur = 10;
      ctx.font = `400 ${Math.round(tt.size * 0.36)}px ${FONT}`;
      ctx.fillStyle = rgba(C.cy, 0.9);
      ctx.textAlign = 'center';
      ctx.fillText(tt.sub, W / 2, tt.y + tt.size * 0.85);
    }
    ctx.restore();
  }

  // 信息层（预览用）：取景框角标 + 时间码 + 镜头名
  const pad = n => String(n).padStart(2, '0');
  function timecode(t) {
    const cs = Math.floor(t * 100 + 1e-6);
    return `${pad(Math.floor(cs / 6000))}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
  }
  function hud(ctx, t, info) {
    ctx.save();
    ctx.strokeStyle = rgba(C.cy, 0.5); ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [x, y, sx, sy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) {
      ctx.moveTo(x + sx * 40, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 40);
    }
    ctx.stroke();
    ctx.font = `18px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(C.wh, 0.75);
    ctx.textAlign = 'left';
    ctx.fillText('MILI-DIGITAL-SOUL', 70, 70);
    ctx.fillText(`${timecode(t)}  F${String(info.frame).padStart(3, '0')}/${FRAMES}`, 70, H - 70);
    ctx.textAlign = 'right';
    ctx.fillText(`镜头 ${info.index + 1}/${SHOTS.length} ${info.shot.name}`, W - 70, 70);
    ctx.fillText(`${W}×${H} · ${FPS}fps`, W - 70, H - 70);
    ctx.restore();
  }

  M.fx = { FONT, glow, background, codeStream, particlePos, particles, rings, coreLight, scanBeam, tear, finish, title, hud, timecode };
})(globalThis.MILI = globalThis.MILI || {});
