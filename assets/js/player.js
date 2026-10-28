/* ============================================================
   player.js — 连续时间轴讲解播放器
   音频驱动：进度＝真实播放位置，可拖动、可暂停冻结、跨讲连续
   ============================================================ */
(function () {
  'use strict';
  var TK = window.TK, $ = TK.$, $$ = TK.$$, S = TK.S;

  var A = null, ST = {
    i: 0, off: 0, playing: false, ended: false, silent: false,
    answer: null, cd: null, drag: false, wasPlaying: false, started: false
  };
  var TOTAL = 0;

  /* ---------------- 建表 ---------------- */
  function est(seg) {
    var n = (seg.n || '').length;
    return Math.max(5, n / 4.35 + 1.2);
  }
  function build() {
    var t = 0;
    TK.segs = [];
    TK.course.forEach(function (L) {
      L.start = t;
      (L.segs || []).forEach(function (sg) {
        sg.lid = L.id; sg.lname = L.title; sg.ch = L.ch;
        var tm = TK.timing[sg.id];
        sg.file = tm ? tm[0] : null;
        sg.dur = tm ? tm[1] : est(sg);
        sg.start = t; t += sg.dur;
        TK.segs.push(sg);
      });
      L.end = t;
    });
    TOTAL = t;
    TK.total = t;
  }
  TK.buildCourse = build;
  function segAt(t) {
    for (var i = 0; i < TK.segs.length; i++) if (t < TK.segs[i].start + TK.segs[i].dur) return i;
    return TK.segs.length - 1;
  }
  function lessonOf(i) { var sg = TK.segs[i]; return TK.course.filter(function (L) { return L.id === sg.lid; })[0]; }

  /* ---------------- 幻灯片渲染 ---------------- */
  function figHTML(fid) {
    var f = TK.figs[fid]; if (!f) return '';
    return '<figure class="figbox">' + f.svg + '<figcaption>' + f.t + '</figcaption>' +
      '<div class="sr-desc">' + TK.esc(f.d) + '</div></figure>';
  }
  function tblHTML(tb) {
    if (!tb) return '';
    return '<table class="tbl"><thead><tr>' + tb.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + tb.rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function bulHTML(list) {
    return '<ul class="bul">' + (list || []).map(function (x, i) {
      return '<li data-i="' + i + '">' + x + '</li>';
    }).join('') + '</ul>';
  }

  function render(seg, L) {
    var idx = TK.segs.indexOf(seg) + 1;
    var hop = (L.segs.indexOf(seg) + 1) + ' / ' + L.segs.length;
    var deck = $('#deck');
    var head = '<div class="s-kick"><span class="dot"></span><span class="tt">' + L.ch + ' · ' + L.id +
      '</span><span>' + hop + '</span></div>';
    var html = '';

    if (seg.k === 'qte') {
      html = '<section class="slide">' + head +
        '<h1 class="s-title">' + seg.ask + '<small>' + (seg.kp ? '考点：' + seg.kp : '') + '</small></h1>' +
        '<div class="s-body two"><div class="qopts" id="qsOpts">' +
        seg.opts.map(function (o, i) {
          return '<button class="qopt" data-k="' + i + '"><span class="k">' + 'ABCD'[i] + '</span><span>' + o + '</span></button>';
        }).join('') + '</div>' +
        '<div class="qside"><div class="ring" id="ring"><svg viewBox="0 0 48 48"><circle class="rc" cx="24" cy="24" r="20"/>' +
        '<circle class="rp" id="arc" cx="24" cy="24" r="20"/></svg><b id="sec">' + (seg.win || 8) + '</b></div>' +
        '<div class="qside-t" id="qsideT">听我把题说完，再计时</div></div></div>' +
        '<div class="qte-fb" id="qfb"></div>' +
        '<div class="sub"><div class="cur" id="subCur"></div><div class="nx" id="subNx"></div></div></section>';
    } else if (seg.k === 'ex') {
      var q = TK.bankOf(seg.q) || {};
      var steps = '<div class="exsteps">' + (seg.steps || []).map(function (x, i) {
        return '<div class="st" data-i="' + i + '"><i>' + (i + 1) + '</i><span>' + x + '</span></div>';
      }).join('') + '</div>';
      var stem = '<div class="exq"><div class="tag">题库原题 · ' + seg.q + '</div><div class="stem">' + (q.stem || '') + '</div>' +
        '<div class="meta">' + (q.marks || '') + ' 分　评分要点 ' + (q.points || []).length + ' 条　' + (q.from || '') + '</div></div>';
      var ans = '<div class="exans"><b>答题骨架</b>' + (seg.ans || '') + '</div>';
      var pts = '<div class="pts"><b>评分要点 · ' + (q.points || []).length + ' 条</b><ul>' +
        (q.points || []).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
      html = '<section class="slide">' + head +
        '<h1 class="s-title">课末例题 · ' + (q.title || seg.q) + '<small>学完这一讲，回头看考试怎么问</small></h1>' +
        '<div class="s-body two"><div class="exwrap">' + stem + steps + '</div>' +
        '<div class="exside">' + (seg.fig ? figHTML(seg.fig) : '') + ans + pts + '</div></div>' +
        '<div class="sub"><div class="cur" id="subCur"></div><div class="nx" id="subNx"></div></div></section>';
    } else if (seg.k === 'sum') {
      html = '<section class="slide">' + head +
        '<h1 class="s-title">' + (seg.t || '本讲小结') + '<small>' + L.title + '</small></h1>' +
        '<div class="s-body"><div class="sumcard">' + (seg.b || []).map(function (x, i) {
          return '<div class="it" data-i="' + i + '"><em>' + ('0' + (i + 1)).slice(-2) + '</em><span>' + x + '</span></div>';
        }).join('') + '</div></div>' +
        '<div class="sub"><div class="cur" id="subCur"></div><div class="nx" id="subNx"></div></div></section>';
    } else {
      var two = !!(seg.fig || seg.tbl);
      html = '<section class="slide">' + head +
        '<h1 class="s-title">' + (seg.t || '') + (seg.sub ? '<small>' + seg.sub + '</small>' : '') + '</h1>' +
        '<div class="s-body' + (two ? ' two' : '') + '">' +
        '<div>' + bulHTML(seg.b) + '</div>' +
        (two ? '<div>' + (seg.fig ? figHTML(seg.fig) : tblHTML(seg.tbl)) + '</div>' : '') +
        '</div>' +
        '<div class="sub"><div class="cur" id="subCur"></div><div class="nx" id="subNx"></div></div></section>';
    }
    deck.innerHTML = html;
    deck.scrollTop = 0;
    wire(seg);
    // 字幕切句
    var sents = (seg.n || '').match(/[^。！？；!?;\n]+[。！？；!?;]?/g) || [''];
    sents = sents.map(function (s) { return s.trim(); }).filter(Boolean);
    var cum = [], acc = 0, tot = seg.n ? seg.n.length : 1;
    sents.forEach(function (s) { acc += s.length; cum.push(s.length / tot); });
    var run = 0; cum = cum.map(function (v) { run += v; return run; });
    ST.sents = sents; ST.cum = cum;
    // 顶栏
    $('#chChip').textContent = L.ch + ' · ' + L.id;
    $('#barTitle').textContent = L.title;
    $('#barCount').textContent = (TK.segs.indexOf(seg) + 1) + ' / ' + TK.segs.length;
    $('#tMeta').textContent = L.title + ' · ' + (seg.t || seg.kp || (seg.k === 'qte' ? '课中提问' : seg.k === 'ex' ? '例题 ' + seg.q : ''));
  }

  function wire(seg) {
    if (seg.k === 'qte') {
      $$('#qsOpts .qopt').forEach(function (b) {
        b.addEventListener('click', function () { answer(+b.getAttribute('data-k'), false); });
      });
    }
  }

  /* ---------------- 音频与时间 ---------------- */
  function ensureAudio() {
    if (A) return A;
    A = new Audio();
    A.preload = 'auto';
    A.muted = !!S.muted;
    A.addEventListener('play', function () { ST.playing = true; });
    A.addEventListener('pause', function () { if (!ST.seeking) { } });
    return A;
  }

  function loadSeg(seg, off) {
    var a = ensureAudio();
    ST.off = off || 0;
    ST.ended = false;
    ST.answer = null;
    ST.cd = null;
    if (!seg.file) { ST.silent = true; try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { } return; }
    ST.silent = false;
    a.src = seg.file;
    a.playbackRate = S.speed || 1;
    var want = off || 0;
    function seekNow() {
      try { if (want > .05) a.currentTime = Math.min(want, Math.max(0, (a.duration || want + 1) - .04)); } catch (e) { }
    }
    if (a.readyState >= 1) seekNow(); else a.addEventListener('loadedmetadata', seekNow, { once: true });
  }

  function play() {
    if (TK.paused()) { TK.setPaused(false); }
    $('#pause').hidden = true;
    var seg = TK.segs[ST.i]; if (!seg) return;
    if (ST.ended && seg.k !== 'qte') { next(); return; }
    ST.playing = true;
    if (!ST.silent) {
      var a = ensureAudio();
      a.playbackRate = S.speed || 1;
      var p = a.play();
      if (p && p.catch) p.catch(function () { ST.playing = false; TK.toast('浏览器拦截了自动播放，点一下播放键继续', 'bad'); });
    }
    syncBtn();
  }
  function pause(soft) {
    ST.playing = false;
    if (!ST.silent && A) A.pause();
    syncBtn(soft);
  }
  function syncBtn() {
    var b = $('#btnPlay'); if (!b) return;
    b.textContent = (TK.paused() || !ST.playing) ? '▶' : '❚❚';
  }

  function enter(i, off, autoplay) {
    TK.clearLater();
    if (i < 0) i = 0;
    if (i >= TK.segs.length) return finish();
    ST.i = i;
    var seg = TK.segs[i], L = lessonOf(i);
    var changed = ST.lid !== L.id;
    ST.lid = L.id;
    render(seg, L);
    if (changed && $('#side').innerHTML) renderSide();
    loadSeg(seg, off || 0);
    $('#deck').scrollTop = 0;
    S.pos = seg.start + (off || 0); TK.save();
    if (autoplay) play(); else { pause(true); }
    updateSoon();
  }

  function next() {
    if (ST.i >= TK.segs.length - 1) return finish();
    enter(ST.i + 1, 0, true);
  }
  function prev() {
    var seg = TK.segs[ST.i];
    if (ST.off > 2.2) return enter(ST.i, 0, ST.playing);
    if (ST.i > 0) enter(ST.i - 1, 0, ST.playing);
  }

  function curT() {
    var seg = TK.segs[ST.i];
    if (!seg) return TOTAL;
    return seg.start + Math.min(ST.off, seg.dur);
  }

  function seek(t, autoplay) {
    t = TK.clamp(t, 0, TOTAL - .08);
    var i = segAt(t), seg = TK.segs[i], off = Math.max(0, t - seg.start);
    if (i === ST.i) {
      // 同一段：直接定位，不重建画面
      ST.off = off; ST.ended = off >= seg.dur - .05;
      if (!ST.silent && A) { try { A.currentTime = off; } catch (e) { } }
      if (autoplay) play(); else pause(true);
      updateSoon();
      return;
    }
    if (off > seg.dur - 1.2) off = 0;
    enter(i, off, autoplay);
  }

  /* ---------------- 每帧 ---------------- */
  TK.onFrame = function (ts, dt) {
    if (!ST.started) return;
    var seg = TK.segs[ST.i]; if (!seg) return;
    if (ST.playing && !ST.ended && !TK.paused()) {
      if (ST.silent) {
        ST.off += dt / 1000 * (S.speed || 1);
      } else if (A) {
        ST.off = A.currentTime;
        if (A.ended || (seg.dur && ST.off >= seg.dur - .04)) ST.off = seg.dur;
      }
      if (ST.off >= seg.dur - .04) endSeg(seg);
    }
    updateUI();
  };

  function endSeg(seg) {
    if (ST.ended) return;
    ST.ended = true;
    if (seg.k === 'qte' && !ST.answer) { startCountdown(seg); return; }
    if (seg.k === 'qte' && ST.answer) return;
    next();
  }

  function updateSoon() { setTimeout(updateUI, 60); }

  function updateUI() {
    var seg = TK.segs[ST.i]; if (!seg) return;
    var ratio = TK.clamp(ST.off / (seg.dur || 1), 0, 1);
    var g = curT(), pct = TK.clamp(g / TOTAL, 0, 1) * 100;
    $('#tlFill').style.width = pct + '%';
    $('#tlKnob').style.left = pct + '%';
    $('#tNow').textContent = TK.fmt(g);
    $('#tAll').textContent = TK.fmt(TOTAL);
    // 字幕
    var cur = $('#subCur');
    if (cur && ST.sents && ST.sents.length) {
      var k = 0;
      while (k < ST.cum.length - 1 && ratio > ST.cum[k]) k++;
      if (cur.textContent !== ST.sents[k]) {
        cur.textContent = ST.sents[k];
        var nx = $('#subNx'); if (nx) nx.textContent = ST.sents[k + 1] || '';
      }
    }
    // 要点渐显
    var items = $$('#deck [data-i]');
    if (items.length) {
      var n = items.length;
      var shown = TK.clamp(Math.floor(ratio * (n + .9)) + 1, 1, n);
      for (var i = 0; i < n; i++) items[i].classList.toggle('on', i < shown);
    }
    // QTE 倒计时
    if (ST.cd && ST.cd.active) {
      var left = (ST.cd.win - (TK.vtime() - ST.cd.start)) / 1000;
      var sec = $('#sec'), arc = $('#arc'), ring = $('#ring');
      if (sec) sec.textContent = Math.ceil(Math.max(0, left));
      if (arc) arc.style.strokeDashoffset = 125.6 * (1 - Math.max(0, left) / ST.cd.secs);
      if (ring) ring.classList.toggle('hot', left <= 3);
      if (left <= 0) answer(-1, true);
    }
    syncBtn();
  }

  /* ---------------- QTE ---------------- */
  function startCountdown(seg) {
    var win = (seg.win || 8) * 1000;
    ST.cd = { active: true, start: TK.vtime(), win: win, secs: seg.win || 8 };
    var t = $('#qsideT'); if (t) t.textContent = '计时开始 · 快选';
    TK.sfx('qte');
  }
  function answer(k, timeout) {
    var seg = TK.segs[ST.i];
    if (!seg || seg.k !== 'qte' || ST.answer) return;
    var ok = k === seg.a;
    ST.answer = { k: k, ok: ok, timeout: !!timeout };
    ST.cd = null;
    S.qte[seg.q] = ok ? 1 : 0;
    if (ok) { S.marks[seg.q] = 1; }
    TK.save();
    $$('#qsOpts .qopt').forEach(function (b, i) {
      if (i === seg.a) b.classList.add('right');
      else if (i === k) b.classList.add('wrong');
      b.disabled = true;
    });
    var fb = $('#qfb');
    if (fb) {
      fb.className = 'qte-fb show ' + (ok ? 'good' : 'bad');
      fb.innerHTML = '<b>' + (ok ? '✓ 对了' : (timeout ? '⏱ 时间到' : '✗ 再想想')) + '</b>　正确答案：<b>' +
        'ABCD'[seg.a] + '. ' + seg.opts[seg.a] + '</b>' + (seg.why ? '<br><span style="color:var(--dim)">' + seg.why + '</span>' : '');
    }
    var t = $('#qsideT');
    if (t) t.textContent = ok ? '答对' : timeout ? '超时' : '答错';
    var ring = $('#ring'); if (ring) ring.style.opacity = .25;
    if (ok) {
      TK.sfx('correct', S.combo); TK.hitCombo(); TK.addScore(12);
      TK.burst(24); TK.floatText('+12', 'var(--gr)');
      TK.later(1900, next);
    } else {
      TK.sfx('wrong'); TK.breakCombo();
      TK.later(3600, next);
    }
  }

  /* ---------------- 时间轴拖动 ---------------- */
  function bindTimeline() {
    var tl = $('#tl'), track = $('#tlTrack'), tip = $('#tlTip');
    function ratioOf(e) {
      var r = track.getBoundingClientRect();
      return TK.clamp((e.clientX - r.left) / r.width, 0, 1);
    }
    function paintTip(e) {
      var p = ratioOf(e), t = p * TOTAL;
      tip.textContent = TK.fmt(t) + '　' + (TK.segs[segAt(t)] || {}).lname;
      tip.style.left = (p * 100) + '%';
    }
    track.addEventListener('pointermove', function (e) {
      tl.classList.add('hover'); paintTip(e);
      if (ST.drag) {
        var p = ratioOf(e);
        $('#tlFill').style.width = (p * 100) + '%';
        $('#tlKnob').style.left = (p * 100) + '%';
        $('#tNow').textContent = TK.fmt(p * TOTAL);
      }
    });
    track.addEventListener('pointerleave', function () { tl.classList.remove('hover'); });
    track.addEventListener('pointerdown', function (e) {
      ST.drag = true; ST.wasPlaying = ST.playing;
      tl.classList.add('drag');
      try { track.setPointerCapture(e.pointerId); } catch (err) { }
      pause(true);
      paintTip(e);
      e.preventDefault();
    });
    track.addEventListener('pointerup', function (e) {
      if (!ST.drag) return;
      ST.drag = false; tl.classList.remove('drag');
      var p = ratioOf(e);
      seek(p * TOTAL, ST.wasPlaying);
    });
    track.addEventListener('click', function (e) { e.preventDefault(); });
  }

  /* ---------------- 暂停 / 复制 / 讲义 / 目录 ---------------- */
  function togglePause() {
    if (TK.paused()) { TK.setPaused(false); $('#pause').hidden = true; play(); TK.sfx('resume'); }
    else { TK.setPaused(true); $('#pause').hidden = false; pause(); TK.sfx('pause'); }
  }
  function setPausedNoOverlay(p) {
    TK.setPaused(p);
    $('#pause').hidden = true;
  }

  function lessonText(L) {
    var out = [];
    out.push('《汽车电子控制技术·精讲课》' + L.ch + ' ' + L.id + '　' + L.title);
    out.push('本讲目标：' + (L.goals || []).join('；'));
    out.push('');
    (L.segs || []).forEach(function (s, i) {
      out.push('【' + (i + 1) + '】' + (s.t || (s.k === 'qte' ? '课中提问' : s.k === 'ex' ? '例题 ' + s.q : '小结')));
      if (s.n) out.push(s.n);
      if (s.b) s.b.forEach(function (x) { out.push('· ' + TK.strip(x)); });
      if (s.tbl) { out.push('[表] ' + s.tbl.head.join(' | ')); s.tbl.rows.forEach(function (r) { out.push('  ' + r.join(' | ')); }); }
      if (s.fig && TK.figs[s.fig]) { out.push('[图] ' + TK.figs[s.fig].t); out.push('（图意：' + TK.figs[s.fig].d + '）'); }
      if (s.k === 'qte') {
        out.push('问：' + TK.strip(s.ask));
        s.opts.forEach(function (o, k) { out.push('  ' + 'ABCD'[k] + '. ' + TK.strip(o)); });
        out.push('答：' + 'ABCD'[s.a] + '　' + TK.strip(s.why));
      }
      if (s.k === 'ex') {
        var q = TK.bankOf(s.q) || {};
        out.push('原题：' + TK.strip(q.stem));
        out.push('答题骨架：' + TK.strip(s.ans || ''));
      }
      out.push('');
    });
    out.push('（以上为「' + L.id + ' ' + L.title + '」整讲内容，可直接粘贴给 AI 提问。）');
    return out.join('\n');
  }

  function copyLesson() {
    var L = lessonOf(ST.i);
    TK.showCopy('复制本讲 · ' + L.id + ' ' + L.title, lessonText(L));
  }

  function openSheet() {
    var L = lessonOf(ST.i);
    $('#sheetTitle').textContent = '讲义 · ' + L.id + ' ' + L.title;
    var h = '<p style="color:var(--dim)">本讲目标：' + (L.goals || []).join('；') + '</p>';
    (L.segs || []).forEach(function (s) {
      h += '<h3>' + (s.t || (s.k === 'qte' ? '课中提问' : s.k === 'ex' ? '例题 ' + s.q : '小结')) + '</h3>';
      if (s.n) h += '<p>' + s.n + '</p>';
      if (s.b) h += '<ul>' + s.b.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
      if (s.tbl) h += tblHTML(s.tbl);
      if (s.fig && TK.figs[s.fig]) h += '<p style="color:var(--dim2);font-size:12.5px">［图］' + TK.figs[s.fig].t + '——' + TK.figs[s.fig].d + '</p>';
      if (s.k === 'qte') h += '<div class="qbox"><b>问：</b>' + s.ask + '<br>' + s.opts.map(function (o, k) {
        return 'ABCD'[k] + '. ' + o;
      }).join('<br>') + '<br><b>答：</b>' + 'ABCD'[s.a] + '　' + s.why + '</div>';
      if (s.k === 'ex') {
        var q = TK.bankOf(s.q) || {};
        h += '<div class="qbox"><b>' + s.q + '（' + (q.marks || '') + ' 分）</b><br>' + q.stem + '<br><b>答题骨架：</b>' + (s.ans || '') + '</div>';
      }
    });
    $('#sheetBody').innerHTML = h;
    $('#sheetBody').scrollTop = 0;
    $('#sheet').hidden = false;
  }

  function openMenu() {
    var cur = TK.segs[ST.i] ? TK.segs[ST.i].lid : '';
    $('#menuBody').innerHTML = TK.course.map(function (L, i) {
      var min = Math.round((L.end - L.start) / 60);
      return '<div class="mrow' + (L.id === cur ? ' cur' : '') + '" data-l="' + L.id + '">' +
        '<span class="no">' + ('0' + (i + 1)).slice(-2) + '</span><span>' + L.title + '</span>' +
        '<span class="mi2">' + min + ' 分 · ' + L.segs.length + ' 段</span></div>';
    }).join('');
    $$('#menuBody .mrow').forEach(function (r) {
      r.addEventListener('click', function () {
        var lid = r.getAttribute('data-l');
        var sg = TK.segs.filter(function (s) { return s.lid === lid; })[0];
        $('#menu').hidden = true;
        if (sg) enter(TK.segs.indexOf(sg), 0, ST.playing);
      });
    });
    $('#menu').hidden = false;
  }

  function renderSide() {
    var cur = TK.segs[ST.i] ? TK.segs[ST.i].lid : '';
    $('#side').innerHTML = '<div class="side-in"><h4>课程目录</h4>' + TK.course.map(function (L, i) {
      var done = (L.segs || []).every(function (s) { return s.k !== 'qte' || S.qte[s.q] != null; });
      return '<div class="les' + (L.id === cur ? ' cur' : '') + '" data-l="' + L.id + '">' +
        '<span class="no">' + ('0' + (i + 1)).slice(-2) + '</span><span class="nm">' + L.title + '</span>' +
        (done ? '<span class="ok">✓</span>' : '') + '</div>';
    }).join('') + '</div>';
    $$('#side .les').forEach(function (r) {
      r.addEventListener('click', function () {
        var lid = r.getAttribute('data-l');
        var sg = TK.segs.filter(function (s) { return s.lid === lid; })[0];
        if (sg) enter(TK.segs.indexOf(sg), 0, ST.playing);
      });
    });
  }

  /* ---------------- 结束 ---------------- */
  function finish() {
    ST.playing = false; pause(true);
    $('#deck').innerHTML = '<section class="slide"><div class="s-kick"><span class="dot"></span><span class="tt">课程结束</span></div>' +
      '<h1 class="s-title">13 讲走完了<small>接下来用期末卷把 35 道题全部过一遍——不抽题，每题都考。</small></h1>' +
      '<div class="s-body"><div class="sumcard"><div class="it"><em>01</em><span>建议先做期末客观小问，主观题凭记忆写要点，再对照评分要点补。</span></div>' +
      '<div class="it"><em>02</em><span>错得多的题，回到对应讲重听一遍（目录里点讲名即可）。</span></div>' +
      '<div class="it"><em>03</em><span>所有讲稿都能在「讲义」里复制，粘给外部 AI 帮你追问。</span></div></div></div>' +
      '<div class="row-end" style="position:absolute;left:clamp(22px,4.4vw,74px);bottom:34px"><a class="btn primary" href="#/exam">开始期末全量考核</a>' +
      '<a class="btn" href="#/overview">全题库概览</a></div></section>';
    TK.sfx('pass'); TK.burst(120);
  }

  /* ---------------- 控制绑定 ---------------- */
  function bind() {
    $('#btnPlay').addEventListener('click', togglePause);
    $('#btnNext').addEventListener('click', next);
    $('#btnPrev').addEventListener('click', prev);
    $('#btnMute').addEventListener('click', function () {
      S.muted = !S.muted; TK.save();
      this.textContent = S.muted ? '🔇' : '🔊';
      this.classList.toggle('off', S.muted);
      if (A) A.muted = S.muted;
      TK.toast(S.muted ? '已静音' : '已恢复声音');
    });
    $('#btnSpeed').addEventListener('click', function () {
      var arr = [1, 1.25, 1.5, 0.9], i = arr.indexOf(S.speed || 1);
      S.speed = arr[(i + 1) % arr.length]; TK.save();
      this.textContent = S.speed.toFixed(2).replace(/0$/, '') + '×';
      if (A) A.playbackRate = S.speed;
      TK.toast('语速 ' + this.textContent);
    });
    $('#btnSheet').addEventListener('click', openSheet);
    $('#sheetX').addEventListener('click', function () { $('#sheet').hidden = true; });
    $('#sheetCopy').addEventListener('click', copyLesson);
    $('#btnCopy').addEventListener('click', copyLesson);
    $('#btnSide').addEventListener('click', function () { $('#side').classList.toggle('open'); });
    $('#pResume').addEventListener('click', togglePause);
    $('#pCopy').addEventListener('click', copyLesson);
    $('#pSheet').addEventListener('click', function () { $('#pause').hidden = true; TK.setPaused(false); play(); openSheet(); });
    $('#menuX').addEventListener('click', function () { $('#menu').hidden = true; });
    $('#btnExam2').addEventListener('click', function () { location.hash = '#/exam'; });
    if (S.muted) { $('#btnMute').textContent = '🔇'; $('#btnMute').classList.add('off'); }
    $('#btnSpeed').textContent = (S.speed || 1).toFixed(2).replace(/0$/, '') + '×';

    document.addEventListener('keydown', function (e) {
      var pg = $('#pageLayer');
      if (pg && !pg.hidden) return;
      var t = e.target.tagName;
      if (t === 'TEXTAREA' || t === 'INPUT') return;
      if (e.key === ' ') { e.preventDefault(); togglePause(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key.toLowerCase() === 'c') { copyLesson(); }
      else if (e.key.toLowerCase() === 's') { openSheet(); }
      else if (e.key.toLowerCase() === 'm') { openMenu(); }
      else if (e.key.toLowerCase() === 'n') { $('#btnMute').click(); }
      else if (e.key.toLowerCase() === 'p') { $('#btnSpeed').click(); }
      else if (e.key === 'Escape') { $('#sheet').hidden = true; $('#menu').hidden = true; $('#modal').hidden = true; }
      else if (/^[1-4]$/.test(e.key)) {
        var seg = TK.segs[ST.i];
        if (seg && seg.k === 'qte' && !ST.answer) answer(+e.key - 1, false);
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  TK.player = {
    start: function (at) {
      build();
      ST.started = true;
      bindTimeline();
      // 章节刻度
      $('#tlMarks').innerHTML = TK.course.map(function (L) {
        return '<i class="lab" style="left:' + (L.start / TOTAL * 100) + '%" data-l="' + L.id + '"></i>';
      }).join('');
      var start = at || 0;
      enter(segAt(start), start - TK.segs[segAt(start)].start, false);
      renderSide();
      updateUI();
    },
    resume: function () { setPausedNoOverlay(false); play(); },
    halt: function () { ST.playing = false; if (A) A.pause(); TK.setPaused(true); $('#pause').hidden = true; },
    toggle: togglePause,
    openMenu: openMenu,
    openSheet: openSheet,
    copyLesson: copyLesson,
    lessonText: lessonText,
    gotoLesson: function (lid) {
      var sg = TK.segs.filter(function (s) { return s.lid === lid; })[0];
      if (sg) enter(TK.segs.indexOf(sg), 0, true);
    },
    state: ST,
    seekTo: function (t) { seek(t, false); },
    total: function () { return TOTAL; }
  };
  TK.lessonOf = function () { return lessonOf(ST.i); };

  TK.bind = bind;
  TK.bindPlayer = bind;
})();
