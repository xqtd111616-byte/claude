/* 网页播放器：播放 / 暂停 / 时间轴 / 逐帧步进。
 * 预览按真实时钟推进（掉帧也不会变慢）；拖动与步进时吸附到整帧。
 * 同时把 renderAt / renderFrame 挂到 window，便于控制台调试和第二阶段逐帧导出。 */
(function () {
  'use strict';
  const M = globalThis.MILI, { FPS, DURATION, FRAMES, SHOTS } = M.CONFIG;
  const $ = id => document.getElementById(id);
  const el = {
    stage: $('stage'), play: $('play'), tl: $('timeline'), segs: $('segs'), head: $('playhead'),
    clock: $('clock'), shot: $('shotName'), frame: $('frameNo'), loop: $('loop'), hud: $('hud'),
  };
  const renderer = M.createRenderer(el.stage, {
    createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  });
  const state = { t: 0, playing: false, wall0: 0, t0: 0 };
  const TOTAL = M.fx.timecode(DURATION);
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

  // 时间轴按镜头时长分段
  const segs = SHOTS.map(s => {
    const root = document.createElement('div');
    root.className = 'seg';
    root.style.flexGrow = s.end - s.start;
    root.style.flexBasis = '0';
    root.style.setProperty('--c', s.color);
    root.innerHTML = '<i class="fill"></i><span></span>';
    root.lastChild.textContent = s.name;
    el.segs.appendChild(root);
    return { root, fill: root.firstChild };
  });

  function ui() {
    const t = state.t, frame = Math.round(t * FPS), { index, u } = M.shotAt(t);
    el.clock.textContent = `${M.fx.timecode(t)} / ${TOTAL}`;
    el.head.style.left = (t / DURATION) * 100 + '%';
    el.tl.setAttribute('aria-valuenow', frame);
    el.tl.setAttribute('aria-valuetext', `第 ${frame} 帧，镜头 ${index + 1} ${SHOTS[index].name}`);
    segs.forEach((s, i) => {
      s.fill.style.width = (i < index ? 100 : i === index ? u * 100 : 0) + '%';
      s.root.classList.toggle('on', i === index);
    });
    el.shot.textContent = `镜头 ${index + 1}/${SHOTS.length} ${SHOTS[index].name}`;
    el.frame.textContent = `第 ${frame} / ${FRAMES} 帧`;
  }
  function draw() { renderer.renderAt(state.t, { hud: el.hud.checked }); ui(); }

  function tick(now) {
    if (!state.playing) return;
    let t = state.t0 + (now - state.wall0) / 1000;
    if (t >= DURATION) {
      if (el.loop.checked) { state.wall0 = now; state.t0 = 0; t = 0; }
      else { t = DURATION; setPlaying(false); }
    }
    state.t = t;
    draw();
    if (state.playing) requestAnimationFrame(tick);
  }
  function setPlaying(p) {
    if (p && state.t >= DURATION) state.t = 0; // 播完后再按播放：从头开始
    state.playing = p;
    el.play.innerHTML = p ? ICON_PAUSE : ICON_PLAY;
    el.play.setAttribute('aria-label', p ? '暂停' : '播放');
    if (p) { state.wall0 = performance.now(); state.t0 = state.t; requestAnimationFrame(tick); }
    else draw();
  }
  function seek(t) {
    state.t = M.clampTime(t);
    if (state.playing) { state.wall0 = performance.now(); state.t0 = state.t; }
    draw();
  }
  const stepFrames = n => { if (state.playing) setPlaying(false); seek(Math.round(state.t * FPS) / FPS + n / FPS); };

  // 时间轴：点击 / 拖动定位（拖动期间暂停，松手后恢复）
  const timeAt = e => {
    const r = el.tl.getBoundingClientRect();
    return Math.round(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * FRAMES) / FPS;
  };
  let drag = false, resume = false;
  el.tl.addEventListener('pointerdown', e => {
    el.tl.setPointerCapture(e.pointerId);
    drag = true; resume = state.playing;
    if (resume) setPlaying(false);
    seek(timeAt(e));
  });
  el.tl.addEventListener('pointermove', e => { if (drag) seek(timeAt(e)); });
  const endDrag = () => { if (!drag) return; drag = false; if (resume) setPlaying(true); };
  el.tl.addEventListener('pointerup', endDrag);
  el.tl.addEventListener('pointercancel', endDrag);

  el.play.addEventListener('click', () => setPlaying(!state.playing));
  el.hud.addEventListener('change', draw);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) setPlaying(false); });
  document.addEventListener('keydown', e => {
    const step = e.shiftKey ? FPS : 1;
    switch (e.key) {
      case ' ': if (e.target.matches('button, input')) return; e.preventDefault(); setPlaying(!state.playing); break;
      case 'ArrowLeft': e.preventDefault(); stepFrames(-step); break;
      case 'ArrowRight': e.preventDefault(); stepFrames(step); break;
      case 'Home': e.preventDefault(); seek(0); break;
      case 'End': e.preventDefault(); seek(DURATION); break;
      case 'h': case 'H': el.hud.checked = !el.hud.checked; draw(); break;
      case 'l': case 'L': el.loop.checked = !el.loop.checked; break;
    }
  });

  // 对外接口
  globalThis.renderAt = (time, o) => renderer.renderAt(time, o);
  globalThis.renderFrame = (n, o) => renderer.renderFrame(n, o);
  globalThis.MILI_PLAYER = { seek, play: () => setPlaying(true), pause: () => setPlaying(false), get state() { return Object.assign({}, state); } };

  el.play.innerHTML = ICON_PLAY;
  draw();
})();
