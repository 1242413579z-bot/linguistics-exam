/* 临时: 修复"解析错位" —— 解析开头通常会复述题干,
   若某解析首行与同卷另一题干高度吻合, 说明抽取时错位。
   先 dry-run 报告, 加 --apply 才写回。 */
const fs = require('fs');
const path = require('path');
const qdir = path.join(__dirname, 'data', 'questions');
const APPLY = process.argv.includes('--apply');

function norm(s) {
  return (s || '').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
}
function lastLine(stem) {
  const lines = (stem || '').split('\n').map(s => s.trim()).filter(Boolean);
  return lines[lines.length - 1] || '';
}
/* 相似度: 两串去掉标点后, 短串有多少比例出现在长串中 */
function overlap(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  const [shortS, longS] = x.length <= y.length ? [x, y] : [y, x];
  if (shortS.length < 4) return 0;
  let best = 0;
  for (let len = Math.min(shortS.length, 30); len >= 4; len--) {
    for (let i = 0; i + len <= shortS.length; i++) {
      if (longS.includes(shortS.slice(i, i + len))) { best = len; break; }
    }
    if (best) break;
  }
  return best / shortS.length;
}

const report = { moved: [], removed: [], files: 0 };

fs.readdirSync(qdir).filter(f => f.endsWith('.json')).forEach(f => {
  const full = path.join(qdir, f);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const qs = data.questions || [];
  const withAnalysis = qs.filter(q => (q.analysis || '').trim());
  if (!withAnalysis.length) return;
  let dirty = false;

  withAnalysis.forEach(q => {
    const aFirst = (q.analysis || '').trim().split('\n')[0];
    const own = overlap(aFirst, lastLine(q.stem));

    // 找同卷里最吻合的其他题目
    let best = null, bestScore = 0;
    qs.forEach(o => {
      if (o.id === q.id) return;
      const s = overlap(aFirst, lastLine(o.stem));
      if (s > bestScore) { bestScore = s; best = o; }
    });

    // 明显更像别人的题(且自己几乎不吻合)
    if (best && bestScore >= 0.8 && own < 0.5) {
      if (!(best.analysis || '').trim()) {
        best.analysis = q.analysis;
        q.analysis = '';
        report.moved.push(`${f}: #${q.id} -> #${best.id}  (${lastLine(best.stem).slice(0, 26)})`);
        dirty = true;
      } else if (overlap((best.analysis || '').split('\n')[0], aFirst) >= 0.9) {
        // 与目标题已有解析重复 -> 移除错位的副本
        q.analysis = '';
        report.removed.push(`${f}: #${q.id} 解析与 #${best.id} 重复, 已移除错位副本`);
        dirty = true;
      }
    }
  });

  if (dirty) {
    report.files += 1;
    if (APPLY) fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
});

/* 补充规则: 两题解析完全相同 -> 只保留题干与解析吻合的那一题 */
fs.readdirSync(qdir).filter(f => f.endsWith('.json')).forEach(f => {
  const full = path.join(qdir, f);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const qs = (data.questions || []).filter(q => (q.analysis || '').trim());
  const seen = new Map();
  let dirty = false;
  qs.forEach(q => {
    const key = q.analysis.trim();
    if (!seen.has(key)) { seen.set(key, []); }
    seen.get(key).push(q);
  });
  seen.forEach(group => {
    if (group.length < 2) return;
    const aFirst = group[0].analysis.trim().split('\n')[0];
    // 选题干与解析最吻合的一题作为正确归属
    let keep = group[0], keepScore = -1;
    group.forEach(q => {
      const s = overlap(aFirst, lastLine(q.stem));
      if (s > keepScore) { keepScore = s; keep = q; }
    });
    group.forEach(q => {
      if (q.id === keep.id) return;
      report.removed.push(`${f}: #${q.id} 解析与 #${keep.id} 完全相同, 已移除错位副本`);
      q.analysis = '';
      dirty = true;
    });
  });
  if (dirty) {
    report.files += 1;
    if (APPLY) fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
});

console.log(APPLY ? '=== 已写回 ===' : '=== dry-run (加 --apply 写回) ===');
console.log('涉及文件: ' + report.files);
console.log('解析移位(还给正确题目): ' + report.moved.length);
report.moved.forEach(s => console.log('  ' + s));
console.log('移除重复解析副本: ' + report.removed.length);
report.removed.forEach(s => console.log('  ' + s));
