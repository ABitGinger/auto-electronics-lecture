/* ============================================================
   core.js — 存储 / 音效 / 特效 / 提示 / 复制 / 可控时钟
   ============================================================ */
(function () {
  'use strict';
  var TK = window.TK;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  TK.$ = $; TK.$$ = $$; TK.el = el;

  /* ---------- 存储 ---------- */
  var mem = {}, okStore = true;
  try { localStorage.setItem('__tk', '1'); localStorage.removeItem('__tk'); } catch (e) { okStore = false; }
  var KEY = 'tk.lec.v1';
  var S = { pos: 0, done: {}, qte: {}, marks: {}, score: 0, combo: 0, bestCombo: 0, speed: 1, muted: false, examAns: null, exam: [] };
  try {
    var raw = okStore ? localStorage.getItem(KEY) : null;
    if (raw) S = Object.assign(S, JSON.parse(raw));
  } catch (e) { }
  var st = null;
  function save() {
    clearTimeout(st);
    st = setTimeout(function () {
      try { if (okStore) localStorage.setItem(KEY, JSON.stringify(S)); else mem[KEY] = JSON.stringify(S); } catch (e) { }
    }, 200);
  }
  TK.S = S; TK.save = save; TK.storeOK = okStore;

  /* ---------- 音效 ---------- */
  var AC = null;
  function ac() {
    if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, s, d, type, g, to) {
    var c = ac(); if (!c || S.muted) return;
    var o = c.createOscillator(), gn = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, c.currentTime + s);
    if (to) o.frequency.exponentialRampToValueAtTime(to, c.currentTime + s + d);
    gn.gain.setValueAtTime(0.0001, c.currentTime + s);
    gn.gain.exponentialRampToValueAtTime(g == null ? .1 : g, c.currentTime + s + .012);
    gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + s + d);
    o.connect(gn); gn.connect(c.destination);
    o.start(c.currentTime + s); o.stop(c.currentTime + s + d + .03);
  }
  var SFX = {
    click: function () { tone(600, 0, .05, 'triangle', .035); },
    tick: function () { tone(1180, 0, .022, 'square', .02); },
    correct: function (c) { var b = 640 + Math.min(8, c || 0) * 38; tone(b, 0, .1, 'sine', .1); tone(b * 1.26, .07, .12, 'sine', .09); tone(b * 1.5, .15, .16, 'sine', .07); },
    wrong: function () { tone(180, 0, .18, 'sawtooth', .06, 110); tone(140, .06, .2, 'triangle', .045, 90); },
    qte: function () { tone(860, 0, .1, 'square', .045); tone(1280, .1, .12, 'square', .045); },
    pass: function () {[523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, i * .1, .32, 'sine', .09); }); },
    fail: function () {[392, 330, 262].forEach(function (f, i) { tone(f, i * .12, .28, 'triangle', .07); }); },
    pause: function () { tone(420, 0, .12, 'sine', .055, 300); },
    resume: function () { tone(520, 0, .1, 'sine', .05, 700); }
  };
  TK.sfx = function (n, a) { (SFX[n] || function () { })(a); };

  /* ---------- 提示 ---------- */
  function toast(msg, type) {
    var box = $('#toasts'); if (!box) return;
    var t = el('div', 'toast ' + (type || ''), msg);
    box.appendChild(t);
    setTimeout(function () { t.style.opacity = 0; setTimeout(function () { t.remove(); }, 300); }, 2600);
  }
  TK.toast = toast;

  function floatText(txt, color) {
    var f = el('div', 'float', txt);
    f.style.left = (window.innerWidth * .5 - 30) + 'px';
    f.style.top = (window.innerHeight * .58) + 'px';
    f.style.color = color || 'var(--gr)';
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1000);
  }
  TK.floatText = floatText;

  /* ---------- 彩带 ---------- */
  var cv, ctx, ps = [], raf = null;
  function initFx() {
    cv = $('#fx'); if (!cv) return;
    ctx = cv.getContext && cv.getContext('2d');
    size();
    window.addEventListener('resize', size);
  }
  function size() { if (cv) { cv.width = window.innerWidth; cv.height = window.innerHeight; } }
  function burst(n) {
    if (!ctx) return;
    var cols = ['#22d3ee', '#38bdf8', '#fb923c', '#34d399', '#fbbf24', '#a78bfa'];
    for (var i = 0; i < (n || 40); i++) {
      ps.push({
        x: innerWidth * (.5 + (Math.random() - .5) * .55), y: innerHeight * .42,
        vx: (Math.random() - .5) * 8, vy: -Math.random() * 9 - 2, g: .26,
        life: 80 + Math.random() * 50, w: 4 + Math.random() * 5, h: 7 + Math.random() * 6,
        c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6.3, vr: (Math.random() - .5) * .3
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  TK.burst = burst;
  function tick() {
    if (!ctx) { raf = null; return; }
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i]; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      if (p.life < 0 || p.y > cv.height + 40) { ps.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (ps.length) raf = requestAnimationFrame(tick); else { ctx.clearRect(0, 0, cv.width, cv.height); raf = null; }
  }

  /* ---------- 计分 ---------- */
  function addScore(n) {
    S.score += n;
    var e = $('#score'); if (e) e.textContent = S.score;
    save();
  }
  function hitCombo() {
    S.combo++; if (S.combo > S.bestCombo) S.bestCombo = S.combo;
    save();
  }
  function breakCombo() { S.combo = 0; save(); }
  TK.addScore = addScore; TK.hitCombo = hitCombo; TK.breakCombo = breakCombo;

  /* ---------- 复制 ---------- */
  function copyText(txt) {
    var ok = false;
    try {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
    } catch (e) { }
    if (navigator.clipboard) { navigator.clipboard.writeText(txt).catch(function () { }); ok = true; }
    return ok;
  }
  TK.copyText = copyText;
  TK.showCopy = function (title, txt) {
    $('#modalT').textContent = title;
    $('#modalText').value = txt;
    $('#modal').hidden = false;
    $('#copied').classList.remove('on');
    $('#modalText').scrollTop = 0;
  };

  /* ---------- 可控时钟：暂停即冻结 ---------- */
  var vt = { acc: 0, paused: false, last: 0, tasks: [] };
  TK.paused = function () { return vt.paused; };
  TK.setPaused = function (p) {
    vt.paused = p;
    document.body.classList.toggle('is-paused', p);
  };
  TK.later = function (ms, fn) {
    vt.tasks.push({ at: vt.acc + ms, fn: fn });
  };
  TK.clearLater = function () { vt.tasks = []; };
  TK.vtime = function () { return vt.acc; };
  function tickVt(ts) {
    if (!vt.last) vt.last = ts;
    var dt = ts - vt.last; vt.last = ts;
    if (dt > 200) dt = 200;
    if (!vt.paused) {
      vt.acc += dt;
      for (var i = vt.tasks.length - 1; i >= 0; i--) {
        if (vt.acc >= vt.tasks[i].at) { var f = vt.tasks[i].fn; vt.tasks.splice(i, 1); try { f(); } catch (e) { } }
      }
    }
    if (TK.onFrame) TK.onFrame(ts, dt);
    requestAnimationFrame(tickVt);
  }
  requestAnimationFrame(tickVt);

  /* ---------- 通用 ---------- */
  TK.fmt = function (s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var p = function (n) { return ('0' + n).slice(-2); };
    return (h ? h + ':' : '') + p(m) + ':' + p(ss);
  };
  TK.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  TK.bankOf = function (id) {
    for (var i = 0; i < TK.bank.length; i++) if (TK.bank[i].id === id) return TK.bank[i];
    return null;
  };
  TK.strip = function (s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, ''); };
  TK.esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };

  /* ---------- 触摸/点击反馈 ---------- */
  function haptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { }
  }
  TK.haptic = haptic;

  document.addEventListener('pointerdown', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.cb,.ib,.btn,.bigbtn,.qopt,.mrow,.les');
    if (!t || t.disabled) return;
    haptic(7);
    var r = t.getBoundingClientRect();
    var d = Math.max(r.width, r.height) * 1.6;
    var sp = document.createElement('span');
    sp.className = 'tap-ring';
    sp.style.width = sp.style.height = d + 'px';
    sp.style.left = (e.clientX - r.left) + 'px';
    sp.style.top = (e.clientY - r.top) + 'px';
    t.appendChild(sp);
    setTimeout(function () { sp.remove(); }, 480);
  }, { passive: true });

  TK.init = function () {
    initFx();
    $('#modalX').addEventListener('click', function () { $('#modal').hidden = true; });
    $('#modalCopy').addEventListener('click', function () {
      var ok = copyText($('#modalText').value);
      $('#copied').classList.toggle('on', ok);
      if (ok) TK.sfx('correct', 0);
    });
    window.addEventListener('resize', function () { size(); });
  };
})();
