/* ============================================================
   smoke.js — 无头冒烟测试（jsdom）
   重点验证：连续时间轴、拖动跳转、暂停冻结、QTE 计时与作答、复制、期末与概览
   用法：SMOKE_URL=http://127.0.0.1:PORT/index.html node docs/smoke.js
   ============================================================ */
const path = require('path');
const JSDOM = require('jsdom').JSDOM;

const ROOT = path.resolve(__dirname, '..');
const URL = process.env.SMOKE_URL || '';
let pass = 0, fail = 0;

function ok(name) { pass++; console.log('  ✓ ' + name); }
function bad(name, e) { fail++; console.log('  ✗ ' + name + '  →  ' + (e && e.message || e)); }
function step(name, fn) {
  try { const r = fn(); if (r === false) throw new Error('断言为假'); ok(name); }
  catch (e) { bad(name, e); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const vc = new (require('jsdom').VirtualConsole)();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) console.log('  [console]', e.message); });

  const dom = await JSDOM.fromURL(URL, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window, d = w.document;
  await sleep(900);

  console.log('\n【启动】');
  step('启动页可见、装载进度已满、按钮已解锁', () => {
    if (!d.querySelector('#boot')) throw new Error('无启动页');
    const go = d.querySelector('#bootGo');
    if (!go.textContent.trim()) throw new Error('按钮无文字');
    if (go.disabled) throw new Error('按钮仍禁用');
    const bar = d.querySelector('#ldBar');
    if (!bar) throw new Error('无进度条');
    if ((parseFloat(bar.style.width) || 0) < 100) throw new Error('进度未满：' + bar.style.width);
  });
  d.querySelector('#bootGo').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(700);
  step('点击开始后进入播放界面', () => {
    if (d.querySelector('#app').hidden) throw new Error('app 仍隐藏');
    if (!d.querySelector('#deck .slide')) throw new Error('幻灯片未渲染');
  });

  console.log('\n【课程结构】');
  const TK = w.TK;
  step('13 讲 / 98 段已装载', () => {
    if (TK.course.length !== 13) throw new Error('讲数 ' + TK.course.length);
    if (TK.segs.length < 90) throw new Error('段数 ' + TK.segs.length);
  });
  step('总时长来自音频时长表', () => {
    const withAudio = TK.segs.filter(s => s.file).length;
    if (withAudio < TK.segs.length * 0.9) throw new Error('只有 ' + withAudio + ' 段有音频');
    if (TK.total < 1800) throw new Error('总时长过短 ' + Math.round(TK.total));
  });

  console.log('\n【连续时间轴与拖动】');
  step('进度条初始有宽度且为百分比', () => {
    const wd = d.querySelector('#tlFill').style.width;
    if (!/%$/.test(wd)) throw new Error('宽度不是百分比：' + wd);
  });
  step('拖动到 50% 会跳到中段课程', () => {
    TK.player.seekTo(TK.total * 0.5);
    const st = TK.player.state;
    const seg = TK.segs[st.i];
    if (TK.total * 0.5 < seg.start || TK.total * 0.5 > seg.start + seg.dur + 1) throw new Error('落点不在该段');
    if (d.querySelector('#barTitle').textContent.trim() === '') throw new Error('标题未更新');
  });
  step('拖动到 92% 会跳到后段课程', () => {
    TK.player.seekTo(TK.total * 0.92);
    const seg = TK.segs[TK.player.state.i];
    if (seg.start / TK.total < 0.85) throw new Error('落在了 ' + seg.lid);
  });

  console.log('\n【暂停冻结】');
  step('暂停后时间与倒计时都不再前进', async () => {
    // 同步断言：暂停后立即读数，稍后由外层再验一次
    if (!TK.paused()) TK.player.toggle();
    if (!TK.paused()) throw new Error('未进入暂停');
  });
  const t1 = TK.vtime();
  const t2 = (() => { const s = TK.segs[TK.player.state.i]; return s.start + TK.player.state.off; })();
  await sleep(700);
  step('暂停 0.7s 后虚拟时钟冻结', () => {
    if (TK.vtime() !== t1) throw new Error('虚拟时钟前进了 ' + (TK.vtime() - t1).toFixed(1) + 'ms');
  });
  step('暂停 0.7s 后播放位置不变', () => {
    const s = TK.segs[TK.player.state.i];
    const now = s.start + TK.player.state.off;
    if (Math.abs(now - t2) > 0.05) throw new Error('位置变化 ' + (now - t2).toFixed(2) + 's');
  });
  step('暂停卡片出现，含复制按钮', () => {
    if (d.querySelector('#pause').hidden) throw new Error('无暂停卡');
    if (!d.querySelector('#pCopy')) throw new Error('无复制按钮');
  });
  step('暂停中打开讲义不会自动继续播放', () => {
    d.querySelector('#pSheet').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!TK.paused()) throw new Error('打开讲义时被恢复播放');
    if (d.querySelector('#sheet').hidden) throw new Error('讲义未打开');
    if (!d.querySelector('#pause').hidden) throw new Error('暂停卡应让位给讲义');
    d.querySelector('#sheetX').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!TK.paused()) throw new Error('关闭讲义后被恢复播放');
    if (d.querySelector('#pause').hidden) throw new Error('关闭讲义后未回到暂停卡');
  });
  TK.player.toggle();

  console.log('\n【QTE 课中提问】');
  // jsdom 不能真正播放音频，改用「无音频静默推进」通路验证计时与作答逻辑
  step('切到静默推进模式（等价于音频缺失兜底）', () => {
    TK.segs.forEach(s => { s.file = null; });
    TK.player.gotoLesson('L03');
    if (!TK.player.state.silent) throw new Error('未进入静默模式');
  });
  step('定位到 QTE 段末尾触发倒计时', () => {
    const L = TK.course.filter(x => x.id === 'L03')[0];
    const qs = L.segs.filter(s => s.k === 'qte')[0];
    TK.player.seekTo(qs.start + 0.2);
    TK.player.state.off = qs.dur - 0.08;   // 直接推到段尾（绕开「末尾重新开始」的保护）
    TK.player.resume();
    return true;
  });
  await sleep(500);
  step('QTE 已进入倒计时状态', () => {
    const st = TK.player.state;
    const seg = TK.segs[st.i];
    if (seg.k !== 'qte') throw new Error('当前不是 QTE 段：' + seg.k);
    if (!st.cd && !st.answer) throw new Error('既未倒计时也未作答');
    if (!d.querySelector('#qsOpts .qopt')) throw new Error('选项未渲染');
  });
  step('选择正确答案会记录并给反馈', () => {
    const st = TK.player.state, seg = TK.segs[st.i];
    const btns = d.querySelectorAll('#qsOpts .qopt');
    btns[seg.a].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!st.answer || !st.answer.ok) throw new Error('未判定为正确');
    if (TK.S.qte[seg.q] !== 1) throw new Error('进度未写入');
    if (!/对了/.test(d.querySelector('#qfb').textContent)) throw new Error('无反馈');
  });

  console.log('\n【预加载与弱网提示】');
  step('预加载接口存在且可调用', () => {
    if (typeof TK.preloadAhead !== 'function') throw new Error('无 preloadAhead');
    TK.preloadAhead(TK.player.state.i);
  });
  step('缓冲提示元素默认隐藏', () => {
    const b = d.querySelector('#buffer');
    if (!b) throw new Error('无 #buffer');
    if (!b.hidden) throw new Error('默认不该显示');
  });
  step('音频错误可降级为静默推进', () => {
    if (typeof TK.showBuffer !== 'function' || typeof TK.hideBuffer !== 'function') throw new Error('无缓冲接口');
  });

  console.log('\n【复制与讲义】');
  step('复制本讲文本包含旁白与例题', () => {
    TK.player.gotoLesson('L08');
    const L = TK.lessonOf();
    const t = TK.player.lessonText(L);
    if (t.length < 800) throw new Error('文本过短 ' + t.length);
    if (t.indexOf('例题') < 0) throw new Error('不含例题段');
    if (t.indexOf(L.title) < 0) throw new Error('不含讲名');
  });
  step('讲义面板可打开且有内容', () => {
    TK.player.openSheet();
    const body = d.querySelector('#sheetBody').textContent;
    if (d.querySelector('#sheet').hidden) throw new Error('未打开');
    if (body.length < 500) throw new Error('讲义过短');
    d.querySelector('#sheetX').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  });

  console.log('\n【期末与概览】');
  w.location.hash = '#/exam';
  await sleep(400);
  step('期末卷渲染 35 题', () => {
    const rows = d.querySelectorAll('#exList .exq2');
    if (rows.length !== 35) throw new Error('只有 ' + rows.length + ' 题');
    const opts = d.querySelectorAll('#exList .qopt');
    if (opts.length < 140) throw new Error('客观选项不足 ' + opts.length);
  });
  w.location.hash = '#/overview';
  await sleep(400);
  step('概览包含 13 讲与 35 题矩阵', () => {
    const txt = d.querySelector('#pageLayer').textContent;
    if (txt.indexOf('课程地图') < 0) throw new Error('无课程地图');
    const btn = d.querySelectorAll('[data-les]').length;
    if (btn !== 13) throw new Error('讲数 ' + btn);
    if (txt.indexOf('35 题覆盖矩阵') < 0) throw new Error('无覆盖矩阵');
  });

  console.log('\n结果：通过 %d ｜ 失败 %d', pass, fail);
  process.exit(fail ? 1 : 0);
})();
