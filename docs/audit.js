/* ============================================================
   audit.js — 内容与覆盖审计
   1) 每讲结构：旁白段数 / QTE / 例题 / 小结
   2) 配音：每段是否有音频与时长
   3) 题库覆盖：35 题是否每题都有例题段
   4) 图形引用是否存在
   ============================================================ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const sb = { window: { TK: { bank: [], figs: {}, course: [], timing: {}, examObj: {} } }, console };
vm.createContext(sb);
['data/bank.js', 'assets/js/figs.js', 'data/course1.js', 'data/course2.js', 'data/course3.js',
  'data/course4.js', 'data/timing.js', 'data/examobj.js'].forEach(f => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { console.log('缺少文件', f); process.exit(1); }
    vm.runInContext(fs.readFileSync(p, 'utf8'), sb);
  });

const TK = sb.window.TK, C = TK.course, B = TK.bank, T = TK.timing, F = TK.figs, EO = TK.examObj;
// 计算时间轴
let acc = 0;
C.forEach(L => {
  L.start = acc;
  L.segs.forEach(s => {
    const tm = T[s.id];
    s.dur = tm ? tm[1] : Math.max(5, (s.n || '').length / 4.35 + 1.2);
    acc += s.dur;
  });
  L.end = acc;
});
const TOTAL = acc;
let err = 0, warn = 0;
const rows = [];
const exQ = [];
let segs = 0, chars = 0, audio = 0, audioSec = 0, qtes = 0;
const ids = new Set();

C.forEach((L, i) => {
  let n = 0, tell = 0, ex = 0, sum = 0, qte = 0, audioOk = 0, audioMiss = [], lc = 0;
  (L.segs || []).forEach(s => {
    segs++; n++;
    if (ids.has(s.id)) { console.log('✗ 段 id 重复', s.id); err++; }
    ids.add(s.id);
    lc += (s.n || '').length; chars += (s.n || '').length;
    if (s.k !== 'qte' && (!s.n || s.n.length < 40)) { console.log('✗ 旁白过短', s.id); err++; }
    if (s.k === 'qte' && (!s.n || s.n.length < 8)) { console.log('✗ QTE 旁白缺失', s.id); err++; }
    if (s.k === 'tell') tell++;
    if (s.k === 'ex') { ex++; exQ.push(s.q); }
    if (s.k === 'sum') sum++;
    if (s.k === 'qte') {
      qte++; qtes++;
      if (!s.opts || s.opts.length !== 4) { console.log('✗ QTE 选项数不对', s.id); err++; }
      if (!(s.a >= 0 && s.a < 4)) { console.log('✗ QTE 答案越界', s.id); err++; }
      if (!s.why) { console.log('✗ QTE 缺解析', s.id); err++; }
    }
    if (s.fig && !F[s.fig]) { console.log('✗ 图不存在', s.id, s.fig); err++; }
    if (s.k === 'qte' && !s.ask) { console.log('✗ QTE 缺题干', s.id); err++; }
    if (s.k === 'ex') {
      const q = B.filter(x => x.id === s.q)[0];
      if (!q) { console.log('✗ 例题引用了不存在的题', s.id, s.q); err++; }
      if (!s.steps || s.steps.length < 2) { console.log('✗ 例题步骤不足', s.id); err++; }
      if (!s.ans) { console.log('✗ 例题缺答题骨架', s.id); err++; }
    }
    if (T[s.id]) { audio++; audioOk++; audioSec += T[s.id][1]; if (T[s.id][1] < 3) { console.log('✗ 音频时长异常', s.id); err++; } }
    else audioMiss.push(s.id);
  });
  if (qte < 1) { console.log('✗ 本讲无 QTE', L.id); err++; }
  if (sum < 1) { console.log('✗ 本讲无小结', L.id); err++; }
  if (tell < 2) { console.log('✗ 讲解段太少', L.id); err++; }
  if (audioMiss.length) { console.log('⚠ 缺音频', L.id, audioMiss.length + ' 段', audioMiss.slice(0, 4).join(',')); warn++; }
  rows.push([('0' + (i + 1)).slice(-2), L.id, L.title, n, tell, qte, ex, sum, lc, Math.round((L.end - L.start) / 60) + '′', audioOk + '/' + (n)]);
});

// 题库覆盖
const missing = B.filter(q => exQ.indexOf(q.id) < 0).map(q => q.id);
const dup = exQ.filter((v, i) => exQ.indexOf(v) !== i);
if (missing.length) { console.log('✗ 题库未覆盖', missing.join(',')); err++; }
if (dup.length) { console.log('⚠ 重复例题', dup.join(',')); warn++; }
// 客观小问
const noObj = B.filter(q => !EO[q.id]).map(q => q.id);
if (noObj.length) { console.log('✗ 期末客观小问缺失', noObj.join(',')); err++; }

console.log('\n讲   ID   标题                          段  讲 QTE 例 结  旁白字  时长  配音');
rows.forEach(r => console.log(r[0].padStart(2), r[1], r[2].padEnd(26, ' '), String(r[3]).padStart(2), String(r[4]).padStart(3),
  String(r[5]).padStart(3), String(r[6]).padStart(3), String(r[7]).padStart(2), String(r[8]).padStart(6), String(r[9]).padStart(5), String(r[10]).padStart(6)));

console.log('\n总讲数 ' + C.length + ' ｜ 段落 ' + segs + ' ｜ 旁白 ' + chars + ' 字 ｜ QTE ' + qtes +
  ' ｜ 例题覆盖 ' + (B.length - missing.length) + '/' + B.length + ' ｜ 配音 ' + audio + ' 段 ' + (audioSec / 60).toFixed(1) +
  ' 分钟 ｜ 总时长 ' + (TOTAL / 60).toFixed(1) + ' 分钟 ｜ 图形 ' + Object.keys(F).length + ' 张');
console.log('审计结果：错误 %d ｜ 警告 %d', err, warn);
process.exit(err ? 1 : 0);
