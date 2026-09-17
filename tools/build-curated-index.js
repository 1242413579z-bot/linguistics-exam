/* tools/build-curated-index.js
   预生成「严选」索引, 避免练习页每次加载全部题库文件。

   严选规则:
   1. 题目内 curated === true  -> 直接入选
   2. 题目内 curated === false -> 直接排除
   3. 否则自动判定: 含答案或解析(优质题), 或核心考点跨 >= 2 个年份出现(考频高)

   用法: node tools/build-curated-index.js
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const qdir = path.join(root, 'data', 'questions');
const outFile = path.join(root, 'data', 'curated-index.json');

/* 提取核心考点:取题干最后一行, 仅保留中英文数字, 去掉开头序号 */
function extractKeyPoint(stem) {
  if (!stem) return '';
  const lines = stem.split('\n').map(s => s.trim()).filter(Boolean);
  let last = lines[lines.length - 1] || '';
  last = last.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
  last = last.replace(/^[0-9]+/, '');
  return last;
}

function getQuestionYear(q) {
  const m = (q.source || '').match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

function isPastQuestion(q) {
  return !!(q.source && q.source.includes('真题'));
}

function main() {
  const cats = JSON.parse(fs.readFileSync(path.join(root, 'data', 'categories.json'), 'utf8'));

  // 收集章节与题目
  const chapters = [];
  cats.categories.forEach(cat => {
    (cat.children || []).forEach(child => {
      if (child.children) {
        child.children.forEach(sub => chapters.push({ id: sub.id, parentName: `${cat.name} · ${child.name}` }));
      } else {
        chapters.push({ id: child.id, parentName: cat.name });
      }
    });
  });

  const questionsByChapter = {};
  const all = [];
  const missing = [];
  chapters.forEach(ch => {
    const f = path.join(qdir, ch.id + '.json');
    if (!fs.existsSync(f)) {
      missing.push(ch.id);
      questionsByChapter[ch.id] = [];
      return;
    }
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    const qs = data.questions || [];
    questionsByChapter[ch.id] = qs;
    qs.forEach(q => all.push(Object.assign({}, q, { chapterId: ch.id })));
  });

  // 统计考点跨年份频次
  const freq = {};
  const yearsByKey = {};
  all.forEach(q => {
    const key = extractKeyPoint(q.stem);
    if (key.length < 2) return;
    freq[key] = (freq[key] || 0) + 1;
    if (!yearsByKey[key]) yearsByKey[key] = new Set();
    const y = getQuestionYear(q);
    if (y) yearsByKey[key].add(y);
  });

  const frequency = {};
  Object.keys(freq).forEach(k => {
    frequency[k] = { count: freq[k], years: yearsByKey[k] ? yearsByKey[k].size : 0 };
  });

  // 逐章节计算严选题目
  const curated = {};
  const chapterTotals = {};
  let curatedTotal = 0;
  chapters.forEach(ch => {
    const ids = [];
    const qs = questionsByChapter[ch.id] || [];
    chapterTotals[ch.id] = qs.length;
    qs.forEach(q => {
      let hit;
      if (q.curated === true) hit = true;
      else if (q.curated === false) hit = false;
      else if ((q.analysis && q.analysis.trim()) || (q.answer && q.answer.trim())) hit = true;
      else {
        const info = frequency[extractKeyPoint(q.stem)];
        hit = !!(info && info.years >= 2);
      }
      if (hit) ids.push(q.id);
    });
    curated[ch.id] = ids;
    curatedTotal += ids.length;
  });

  const index = {
    generatedAt: new Date().toISOString(),
    description: '严选索引: 由 tools/build-curated-index.js 生成, 题目数据变更后需重新生成',
    totals: {
      all: all.length,
      curated: curatedTotal,
      past: all.filter(isPastQuestion).length
    },
    /* 每章题目总数(供知识目录/掌握地图等免加载题库使用) */
    chapterTotals,
    frequency,
    curated
  };

  fs.writeFileSync(outFile, JSON.stringify(index, null, 2) + '\n', 'utf8');

  console.log('已生成 ' + path.relative(root, outFile));
  console.log('  完整(全部题目) : ' + index.totals.all);
  console.log('  严选           : ' + index.totals.curated);
  console.log('  真题           : ' + index.totals.past);
  if (missing.length) {
    console.log('  提示: 以下章节在 categories.json 中但缺少题目文件 -> ' + missing.join(', '));
  }
}

main();
