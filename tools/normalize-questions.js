/* 临时: 题目数据规范化 —— 先 dry-run 报告, 加 --apply 才写回
   处理三类问题:
   1) 转义残留 \_  ->  _(在页面上会显示成反斜杠, 属于受损)
   2) 填空题题干被截断(末行缺横线) -> 补 ______
   3) 题干实际是"参考答案"而题目文字丢失 -> 把答案移入 answer 字段并标注
*/
const fs = require('fs');
const path = require('path');
const qdir = path.join(__dirname, 'data', 'questions');
const APPLY = process.argv.includes('--apply');

const files = fs.readdirSync(qdir).filter(f => f.endsWith('.json'));
const changes = { escape: 0, blankAdded: 0, rescued: 0 };
const samples = { escape: [], blankAdded: [], rescued: [] };

/* 形如 "1. 祭 2. 壁 3. 畏" 的答案串 */
function looksLikeAnswerKey(line) {
  const groups = line.match(/\d+\.\s*[^\s，,、]{1,6}/g) || [];
  if (groups.length < 3) return false;
  // 去掉答案串后不应剩太多其他内容
  const rest = line.replace(/\d+\.\s*[^\s，,、]{1,6}/g, '').replace(/[，,、\s]/g, '');
  return rest.length <= 4;
}

files.forEach(f => {
  const full = path.join(qdir, f);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  let dirty = false;

  (data.questions || []).forEach(q => {
    let stem = q.stem || '';
    const orig = stem;

    // 1) 转义残留
    if (/\\_/.test(stem)) {
      stem = stem.replace(/\\_/g, '_');
      changes.escape += 1;
      if (samples.escape.length < 2) samples.escape.push(`${f}#${q.id}`);
    }

    const lines = stem.split('\n').map(s => s.trim()).filter(Boolean);
    const head = lines[0] || '';
    const last = lines[lines.length - 1] || '';
    const isFill = /填空/.test(head);

    // 3) 题干其实是参考答案, 题目文字丢失
    if (isFill && looksLikeAnswerKey(last)) {
      const note = '【原始资料中本题的题干缺失，仅存参考答案】';
      stem = stem.replace(last, note);
      q.answer = (q.answer && q.answer.trim()) ? q.answer : last;
      changes.rescued += 1;
      samples.rescued.push(`${f}#${q.id} :: 答案="${last}"`);
    }
    // 2) 填空题被截断(排除上一种情况)
    else if (isFill && last && !last.includes('_') && !/[。．.？?！!：:；;]$/.test(last) && last.length > 6) {
      stem = stem.replace(/\s*$/, '') + ' ______';
      changes.blankAdded += 1;
      if (samples.blankAdded.length < 8) samples.blankAdded.push(`${f}#${q.id} :: ...${last.slice(-36)}`);
    }

    if (stem !== orig) {
      dirty = true;
      q.stem = stem;
    }
  });

  if (dirty && APPLY) {
    fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
});

console.log(APPLY ? '=== 已写回 ===' : '=== dry-run (加 --apply 写回) ===');
console.log('转义残留 \\_ 修复      : ' + changes.escape);
console.log('补填空横线            : ' + changes.blankAdded);
console.log('答案串还原为 answer   : ' + changes.rescued);
console.log('\n补横线:'); samples.blankAdded.forEach(s => console.log('  ' + s));
console.log('\n还原答案:'); samples.rescued.forEach(s => console.log('  ' + s));
