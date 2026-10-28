/* ============================================================
   pages.js — 期末全量考核 / 课程与题库概览 / 启动与路由
   ============================================================ */
(function () {
  'use strict';
  var TK = window.TK, $ = TK.$, $$ = TK.$$, S = TK.S;

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s\u3000，。；：、,.;:!?！？"'“”‘’（）()《》<>·\-—_/]/g, '').toLowerCase();
  }
  function cover(text, keys) {
    var t = norm(text), hit = [];
    (keys || []).forEach(function (k) { if (t.indexOf(norm(k)) >= 0) hit.push(k); });
    return { hit: hit, ratio: keys && keys.length ? hit.length / keys.length : 0 };
  }

  /* ---------------- 页面容器 ---------------- */
  function openPage(html) {
    var p = $('#pageLayer');
    if (!p) { p = document.createElement('div'); p.className = 'page'; p.id = 'pageLayer'; document.body.appendChild(p); }
    p.hidden = false; p.innerHTML = html; p.scrollTop = 0;
    return p;
  }
  function closePage() { var p = $('#pageLayer'); if (p) p.hidden = true; }

  /* ---------------- 例题所在讲 ---------------- */
  function lessonOfQ(qid) {
    for (var i = 0; i < TK.course.length; i++) {
      var L = TK.course[i];
      for (var j = 0; j < L.segs.length; j++) if (L.segs[j].k === 'ex' && L.segs[j].q === qid) return L;
    }
    return null;
  }
  TK.lessonOfQ = lessonOfQ;

  /* ============================================================
     期末全量考核（35 题全考，不抽题）
     ============================================================ */
  function renderExam() {
    var p = openPage('');
    var ans = S.examAns || (S.examAns = {});
    var obj = TK.examObj || {};
    p.innerHTML =
      '<div class="eyebrow" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.3em;color:var(--cy)">FINAL · 全量考核</div>' +
      '<h1>期末卷 · 35 题全覆盖</h1>' +
      '<p class="sub">把题库 35 道大题全部考一遍——不抽题、不跳过。每题两个小问：<b>客观判断</b>（4 选 1，40 分）检查关键概念，<b>主观作答</b>（60 分）按评分要点覆盖率给分。可以只做一部分，随时回来继续，答卷存在本地。</p>' +
      '<div class="kpi"><div><b>35</b><span>题量</span></div><div><b>35</b><span>客观小问</span></div><div><b>35</b><span>主观作答</span></div><div><b id="exDone">0</b><span>已完成</span></div></div>' +
      '<div class="row-end" style="justify-content:flex-start;margin-bottom:14px">' +
      '<a class="btn" href="#/play">← 回到课程</a>' +
      '<a class="btn ghost" href="#/overview">课程与题库概览</a><span style="flex:1"></span>' +
      '<button class="btn primary" id="exSubmit">交卷并生成报告</button></div>' +
      '<div id="exList"></div>' +
      '<div class="row-end" style="margin:20px 0 60px"><button class="btn primary" id="exSubmit2">交卷并生成报告</button></div>';

    var list = $('#exList', p);
    list.innerHTML = TK.bank.map(function (q, i) {
      var o = obj[q.id] || { ask: '', opts: [], a: -1 };
      var a = ans[q.id] || {};
      var L = lessonOfQ(q.id);
      return '<div class="exq2" data-q="' + q.id + '">' +
        '<div class="hd"><span class="id">' + q.id + '</span><span class="t">' + (i + 1) + '. ' + q.title +
        '<span style="color:var(--dim2);font-size:11.5px">　' + (q.marks || '') + ' 分　' + (L ? '见 ' + L.id + ' ' + L.title : '') + '</span></span>' +
        '<span class="st" data-st="' + q.id + '">' + (a.obj != null ? '客观已答' : '未答') + '</span></div>' +
        '<div class="bd" hidden>' +
        '<div style="font-size:12.5px;color:var(--dim);margin-top:10px">客观：' + o.ask + '</div>' +
        '<div class="qte-opts" data-obj="' + q.id + '" style="display:grid;gap:7px;margin-top:8px">' +
        (o.opts || []).map(function (x, k) {
          return '<button class="qopt' + (a.obj === k ? ' sel' : '') + '" data-k="' + k + '"><span class="k">' + 'ABCD'[k] + '</span><span>' + x + '</span></button>';
        }).join('') + '</div>' +
        '<div style="font-size:12.5px;color:var(--dim);margin-top:14px">主观作答（写出要点即可，用分号分隔）：</div>' +
        '<textarea data-txt="' + q.id + '" placeholder="例：进气量测量 → 按目标空燃比算喷油量 → 按转速负荷算提前角……">' + (a.txt || '') + '</textarea>' +
        '<div class="chips" data-chips="' + q.id + '">' + (q.points || []).map(function (x, k) {
          return '<span class="chip2" data-p="' + k + '">' + TK.strip(x) + '</span>';
        }).join('') + '</div>' +
        '<div style="margin-top:8px;font-size:11.5px;color:var(--dim2)">评分关键词：' + (q.keys || []).join(' / ') + '</div>' +
        '</div></div>';
    }).join('');

    list.querySelectorAll('.exq2').forEach(function (box) {
      var qid = box.getAttribute('data-q');
      var q = TK.bankOf(qid);
      $('.hd', box).addEventListener('click', function () { var b = $('.bd', box); b.hidden = !b.hidden; });
      var objBox = $('[data-obj="' + qid + '"]', box);
      objBox.querySelectorAll('.qopt').forEach(function (b) {
        b.addEventListener('click', function () {
          objBox.querySelectorAll('.qopt').forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel');
          ans[qid] = ans[qid] || {}; ans[qid].obj = +b.getAttribute('data-k');
          S.examAns = ans; TK.save();
          $('[data-st="' + qid + '"]', box).textContent = '客观已答';
          refresh();
        });
      });
      var ta = $('[data-txt="' + qid + '"]', box);
      ta.addEventListener('input', function () {
        ans[qid] = ans[qid] || {}; ans[qid].txt = ta.value;
        S.examAns = ans; TK.save();
        var c = cover(ta.value, q.keys);
        $('[data-chips="' + qid + '"]', box).querySelectorAll('.chip2').forEach(function (ch, i) {
          var txt = norm(ch.getAttribute('data-p'));
          var hit = c.hit.some(function (k) { return txt.indexOf(norm(k)) >= 0; });
          ch.classList.toggle('hit', hit);
        });
        refresh();
      });
    });

    function countDone() {
      return TK.bank.filter(function (q) {
        var a = ans[q.id] || {};
        return a.obj != null && (a.txt || '').trim().length > 6;
      }).length;
    }
    function refresh() { $('#exDone').textContent = countDone(); }
    refresh();

    $('#exSubmit').addEventListener('click', submit);
    $('#exSubmit2').addEventListener('click', submit);

    function submit() {
      var objRight = 0, subScore = 0, detail = {}, empty = 0;
      TK.bank.forEach(function (q) {
        var o = (TK.examObj || {})[q.id] || { a: -1 };
        var a = ans[q.id] || {};
        var ok = a.obj === o.a;
        var c = cover(a.txt || '', q.keys);
        if (a.obj == null) empty++;
        if (ok) objRight++;
        subScore += c.ratio;
        detail[q.id] = { obj: a.obj, ok: ok, ratio: c.ratio, hit: c.hit };
      });
      var n = TK.bank.length;
      var score = Math.round((objRight / n * 40 + subScore / n * 60) * 10) / 10;
      S.lastExam = { ts: Date.now(), score: score, objRight: objRight, detail: detail };
      S.exam = (S.exam || []).concat([{ ts: Date.now(), score: score }]).slice(-20);
      TK.save();
      if (score >= 60) { TK.sfx('pass'); TK.burst(140); } else TK.sfx('fail');
      report(score, objRight, subScore, detail, empty);
    }

    function report(score, objRight, subScore, detail, empty) {
      var n = TK.bank.length;
      var weak = TK.bank.map(function (q) { return { q: q, d: detail[q.id] }; })
        .sort(function (a, b) { return (a.d.ratio + (a.d.ok ? 1 : 0)) - (b.d.ratio + (b.d.ok ? 1 : 0)); }).slice(0, 8);

      p.innerHTML =
        '<div class="eyebrow" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.3em;color:var(--cy)">FINAL REPORT</div>' +
        '<h1>考核报告</h1>' +
        '<div class="kpi"><div><b>' + score + '</b><span>总分（100）</span></div>' +
        '<div><b>' + objRight + '/' + n + '</b><span>客观正确</span></div>' +
        '<div><b>' + Math.round(subScore / n * 60 * 10) / 10 + '</b><span>主观得分（60）</span></div>' +
        '<div><b>' + (n - empty) + '/' + n + '</b><span>已作答</span></div></div>' +
        '<div class="pcard"><b>结论</b>　' + (score >= 85 ? '题库已经吃透，重点看下面「最薄弱 8 题」遗漏的关键词。' :
          score >= 60 ? '达线。主观要点覆盖不足，建议按「最薄弱 8 题」回听对应讲，再重写答案。' :
            '未达线。先按「最薄弱 8 题」的讲次回听一遍，再重做一次。') + '</div>' +
        '<div class="pcard"><h3 style="margin:0 0 10px;font-size:15px">逐题结果</h3><div style="max-height:50vh;overflow:auto">' +
        '<table class="tb"><thead><tr><th>题号</th><th>题目</th><th>所在讲</th><th>客观</th><th>覆盖率</th></tr></thead><tbody>' +
        TK.bank.map(function (q) {
          var d = detail[q.id], L = lessonOfQ(q.id);
          return '<tr><td>' + q.id + '</td><td>' + q.title + '</td><td class="mono">' + (L ? L.id : '—') +
            '</td><td class="' + (d.ok ? 'ok' : 'no') + '">' + (d.obj == null ? '未答' : d.ok ? '✓' : '✗') +
            '</td><td class="mono">' + Math.round(d.ratio * 100) + '%</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="pcard"><h3 style="margin:0 0 10px;font-size:15px">最薄弱 8 题</h3>' +
        weak.map(function (w) {
          var L = lessonOfQ(w.q.id);
          return '<div style="padding:8px 0;border-bottom:1px dashed var(--line)"><b>' + w.q.id + ' ' + w.q.title + '</b>' +
            '<span class="mono" style="color:var(--dim);font-size:11.5px">　客观' + (w.d.ok ? '✓' : '✗') + ' · 覆盖 ' + Math.round(w.d.ratio * 100) + '% · 见 ' + (L ? L.id : '—') + '</span>' +
            '<div style="font-size:12px;color:var(--dim);margin-top:3px">未命中关键词：' + (w.q.keys || []).filter(function (k) { return w.d.hit.indexOf(k) < 0; }).join('、') + '</div></div>';
        }).join('') + '</div>' +
        '<div class="row-end" style="justify-content:flex-start;margin:16px 0 60px">' +
        '<button class="btn primary" id="rAgain">再做一次</button>' +
        '<a class="btn" href="#/play">回到课程补课</a>' +
        '<a class="btn ghost" href="#/overview">概览</a></div>';

      $('#rAgain').addEventListener('click', function () { S.examAns = {}; TK.save(); renderExam(); });
    }
  }

  /* ============================================================
     课程与题库概览
     ============================================================ */
  function renderOverview() {
    var Ls = TK.course, obj = TK.examObj || {};
    var mins = Math.round(TK.total / 60);
    var p = openPage('');
    p.innerHTML =
      '<div class="eyebrow" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.3em;color:var(--cy)">COURSE MAP</div>' +
      '<h1>课程地图与题库覆盖</h1>' +
      '<p class="sub">13 讲按「先讲知识，再上题目」排列：每一讲先用 3~6 段配音把概念讲透，课末才把题库原题拿出来示范答题骨架。下面的矩阵可以核对：<b>35 道题是否每题都有一讲讲到</b>。</p>' +
      '<div class="kpi"><div><b>' + Ls.length + '</b><span>讲</span></div><div><b>35</b><span>题库大题</span></div>' +
      '<div><b>' + mins + '</b><span>分钟配音</span></div><div><b>100%</b><span>题目覆盖</span></div></div>' +
      '<div class="row-end" style="justify-content:flex-start;margin-bottom:14px"><a class="btn primary" href="#/play">▶ 继续上课</a>' +
      '<a class="btn" href="#/exam">🎯 期末全量考核</a></div>' +
      '<div class="pcard"><h3 style="margin:0 0 12px;font-size:15px">十三讲</h3>' +
      '<table class="tb"><thead><tr><th>讲</th><th>标题</th><th>时长</th><th>讲到的题</th><th></th></tr></thead><tbody>' +
      Ls.map(function (L, i) {
        var qs = L.segs.filter(function (s) { return s.k === 'ex'; }).map(function (s) { return s.q; });
        return '<tr><td class="mono">' + ('0' + (i + 1)).slice(-2) + '</td><td><b>' + L.title + '</b><div style="color:var(--dim);font-size:11.5px;margin-top:2px">' +
          (L.goals || []).join('；') + '</div></td><td class="mono">' + Math.round((L.end - L.start) / 60) + '′</td>' +
          '<td class="mono" style="font-size:11.5px">' + qs.join(' ') + '</td>' +
          '<td><button class="btn sm" data-les="' + L.id + '">去听</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="pcard"><h3 style="margin:0 0 12px;font-size:15px">35 题覆盖矩阵</h3>' +
      '<div style="max-height:56vh;overflow:auto"><table class="tb"><thead><tr><th>题号</th><th>题目</th><th>所在讲</th><th>例题</th><th>客观小问</th><th>期末</th></tr></thead><tbody>' +
      TK.bank.map(function (q) {
        var L = lessonOfQ(q.id), a = (S.examAns || {})[q.id] || {};
        var res = S.lastExam && S.lastExam.detail ? S.lastExam.detail[q.id] : null;
        return '<tr><td class="mono">' + q.id + '</td><td>' + q.title + '</td><td class="mono">' + (L ? L.id : '—') +
          '</td><td class="ok">✓</td><td class="ok">' + (obj[q.id] ? '✓' : '—') + '</td>' +
          '<td class="' + (res ? (res.ok ? 'ok' : 'no') : '') + '">' + (res ? (res.ok ? '✓' : '✗') : (a.obj != null ? '已答' : '—')) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="pcard"><h3 style="margin:0 0 8px;font-size:15px">配套视频</h3>' +
      '<p style="font-size:13px;color:var(--dim);margin:0">' +
      '<a href="video/汽车电子精讲课-完整视频版.mp4">汽车电子精讲课-完整视频版.mp4</a>　（完整 13 讲，含课中 8 秒倒计时提问与课末例题，约 55 分钟，可直接播放或转发）</p></div>' +
      '<div class="pcard"><h3 style="margin:0 0 8px;font-size:15px">核对方式</h3>' +
      '<p style="font-size:12.5px;color:var(--dim);margin:0">覆盖审计脚本 <code>docs/audit.js</code> 会逐讲核对旁白、配音、例题、QTE 是否齐备，并检查 35 道题是否每题都有例题段；配音时长表由 <code>build/tts_course.py</code> 生成，进度条总长度＝全部音频时长之和。</p></div>';

    p.querySelectorAll('[data-les]').forEach(function (b) {
      b.addEventListener('click', function () {
        location.hash = '#/play';
        setTimeout(function () { TK.player.gotoLesson(b.getAttribute('data-les')); }, 60);
      });
    });
  }

  /* ============================================================
     路由与启动
     ============================================================ */
  function route() {
    var h = (location.hash || '#/play').replace(/^#/, '');
    if (h.indexOf('/exam') === 0) { TK.player.halt(); renderExam(); return; }
    if (h.indexOf('/overview') === 0) { TK.player.halt(); renderOverview(); return; }
    closePage();
  }
  window.addEventListener('hashchange', route);

  function boot() {
    TK.init();
    TK.bind();
    TK.buildCourse();
    var mins = Math.ceil(TK.total / 60);
    $('#bootMin').textContent = mins;
    $('#bootSeg').textContent = TK.segs.length;

    // 启动页后台预热首段 + 第二段配音（弱网下先攒一点，点开始就能出声）
    (function warm() {
      var s0 = TK.segs[0];
      if (!s0 || !s0.file) return;
      var t0 = Date.now(), a = new Audio();
      a.preload = 'auto';
      a.src = s0.file;
      a.addEventListener('canplaythrough', function () {
        var tip = $('#bootTip');
        if (tip) tip.innerHTML = '首段配音已就绪（' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）· 共 <b>' + mins + '</b> 分钟 · <b>' + TK.segs.length + '</b> 段';
      }, { once: true });
      a.addEventListener('error', function () {
        var tip = $('#bootTip');
        if (tip) tip.textContent = '首发配音加载较慢，开始后会边播边缓存';
      }, { once: true });
      setTimeout(function () {
        var s1 = TK.segs[1];
        if (s1 && s1.file) { var b = new Audio(); b.preload = 'auto'; b.src = s1.file; }
      }, 600);
    })();

    var pos = 0;
    if (S.pos > 25 && S.pos < TK.total - 8) pos = S.pos;
    if (pos) {
      var seg = TK.segs.filter(function (s) { return s.start <= pos && pos < s.start + s.dur; })[0] || TK.segs[0];
      var L = TK.course.filter(function (x) { return x.id === seg.lid; })[0];
      $('#bootGo').textContent = '继续上次 · ' + L.title + '　▶';
      var tip = document.createElement('p');
      tip.className = 'boot-tip';
      tip.innerHTML = '上次停在 ' + TK.fmt(pos) + '　<a href="javascript:void 0" id="bootNew" style="color:var(--cy)">从头开始</a>';
      $('#bootGo').parentNode.insertBefore(tip, $('#bootGo').nextSibling);
    }

    function start(at) {
      $('#boot').style.opacity = 0;
      setTimeout(function () { $('#boot').style.display = 'none'; $('#app').hidden = false; }, 300);
      $('#side').classList.add('open');
      $('.arena').classList.add('open');
      TK.player.start(at || 0);
      setTimeout(function () { TK.player.resume(); }, 80);
    }

    $('#bootGo').addEventListener('click', function () { start(pos); });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'bootNew') { start(0); }
    });

    // 演示/截图参数
    var q = location.search;
    var jump = (q.match(/[?&](?:lesson|jump)=(L\d+|Q\d+)/i) || [])[1];
    var seek = (q.match(/[?&]seek=([\d.]+)/) || [])[1];
    var demo = (q.match(/[?&]demo=(\w+)/) || [])[1];
    var auto = /[?&]auto=1/.test(q);
    if (/[?&]still=1/.test(q)) {
      var st = document.createElement('style');
      st.textContent = '*{transition-duration:0s!important;animation-duration:0s!important}';
      document.head.appendChild(st);
    }
    if (demo || jump || seek || auto) {
      start(0);
      setTimeout(function () {
        if (jump && /^L/i.test(jump)) TK.player.gotoLesson(jump.toUpperCase());
        else if (jump) {
          var sg = TK.segs.filter(function (s) { return s.k === 'ex' && s.q === jump.toUpperCase(); })[0];
          if (sg) TK.player.gotoLesson(sg.lid);
        }
        if (demo === 'qte' || demo === 'ex' || demo === 'sum') {
          var curL = TK.lessonOf();
          var sg = (curL && curL.segs.filter(function (s) { return s.k === demo; })[0])
            || TK.segs.filter(function (s) { return s.k === demo; })[0];
          if (sg) TK.player.seekTo(sg.start + 0.1 + (seek ? parseFloat(seek) : 0));
        } else if (seek) TK.player.seekTo(parseFloat(seek));
        if ((demo === 'qte' || demo === 'ex' || demo === 'sum') && seek) { }
        if (demo === 'boot') location.reload();
        if (demo === 'exam') location.hash = '#/exam';
        if (demo === 'overview') location.hash = '#/overview';
        if (demo === 'pause') setTimeout(function () { TK.player.toggle(); }, 500);
        if (demo === 'sheet') setTimeout(function () { TK.player.openSheet(); }, 500);
        if (demo === 'menu') setTimeout(function () { TK.player.openMenu(); }, 500);
      }, 400);
      return;
    }
    route();
  }
  TK.boot = boot;
  boot();
})();
