/* 渲染器。核心约定：画面只由 time 决定。
 *   renderAt(time)  任意秒数（自动限制在 0~30），结果与调用顺序、历史帧无关
 *   renderFrame(n)  第 n 帧，等价于 renderAt(n / 30)，用于后续逐帧导出 */
(function (M) {
  'use strict';
  const { W, H, FPS, BPM } = M.CONFIG;
  const { rgba, clamp } = M.util;
  const fx = M.fx, C = M.COLORS;

  M.createRenderer = function (canvas, opts) {
    opts = opts || {};
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // 辉光（bloom）用 1/4 分辨率的小画布做模糊再叠加；没有提供就自动跳过
    const small = opts.createCanvas ? opts.createCanvas(480, 270) : null;
    const sctx = small ? small.getContext('2d') : null;

    function bloom(amount) {
      if (!sctx || amount <= 0) return;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.clearRect(0, 0, 480, 270);
      sctx.filter = 'blur(3px)';
      sctx.drawImage(canvas, 0, 0, 480, 270);
      sctx.filter = 'none';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = amount;
      ctx.drawImage(small, 0, 0, W, H);
      ctx.restore();
    }

    function renderAt(time, o) {
      o = o || {};
      const t = M.clampTime(time);
      const { index, shot, sec, u } = M.shotAt(t);
      const beat = (t * BPM) / 60, pulse = Math.exp(-(beat % 1) * 5.5);
      const S = M.SCENES[shot.id](u, sec, t, { beat, pulse });

      // 每帧从干净的绘图状态开始，保证与上一帧无关
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      fx.background(ctx, S.bg);
      fx.codeStream(ctx, t, S.code);
      fx.scanBeam(ctx, S.scan);
      fx.coreLight(ctx, S.core);

      // 镜头运动：围绕焦点缩放 + 旋转
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(S.cam.rot);
      ctx.scale(S.cam.zoom, S.cam.zoom);
      ctx.translate(-S.cam.x, -S.cam.y);
      fx.rings(ctx, t, S.parts.ox, S.parts.oy, S.rings);
      if (S.char) M.character.draw(ctx, Object.assign({ T: t }, S.char));
      fx.particles(ctx, t, S.parts);
      ctx.restore();

      bloom(S.bloom);
      // 镜头切换处：短促的屏幕撕裂 + 白闪
      const cut = index > 0 ? clamp(1 - sec / 0.22) : 0;
      fx.tear(ctx, canvas, t, Math.max(S.glitchScreen, cut));
      fx.finish(ctx, t);
      if (index > 0 && sec < 0.35) {
        ctx.fillStyle = rgba(C.wh, Math.exp(-sec * 11) * 0.55);
        ctx.fillRect(0, 0, W, H);
      }
      if (S.fade > 0) { ctx.fillStyle = rgba('0,0,0', S.fade); ctx.fillRect(0, 0, W, H); }
      fx.title(ctx, S.title, t);
      const frame = Math.round(t * FPS);
      if (o.hud) fx.hud(ctx, t, { index, shot, frame });
      return { t, frame, shot: index };
    }

    return { renderAt, renderFrame: (n, o) => renderAt(n / FPS, o), canvas, ctx };
  };
})(globalThis.MILI = globalThis.MILI || {});
