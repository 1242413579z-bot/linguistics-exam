/* tools/build-curated-index.js
   生成 data/question-bank.json —— 全站题目的统一索引, 支撑两套视图:

   1) 学科视图(完整/严选): 每道题归入一个学科章节。
      真题试卷里的题目也全部回归到学科, 因此"完整"下某个学科章节
      包含该考点的全部题目(真题 + 后续上传的练习题)。
   2) 试卷视图(真题): 按年份的南师大试卷, 一套卷子一套卷子地看。

   分类规则:
   - 题目若自带 subject 字段(学科章节 id) -> 直接采用(可用来自定义/覆盖)
   - 否则按试卷科目定位学科大类, 再用关键词在类内打分选出最匹配的章节

   用法: node tools/build-curated-index.js
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const qdir = path.join(root, 'data', 'questions');
const outFile = path.join(root, 'data', 'question-bank.json');

/* ===== 学科关键词:类内打分, 命中越多越匹配 ===== */
const KEYWORDS = {
  /* ---------- 语言学 ---------- */
  'ling-intro': ['语言','符号','本质','功能','社会','思维','语言学','交际','任意性','二层性','开放性','传授性','语言与言语','言语','普通语言学','应用语言学','社会语言学','描写语言学','转换生成','乔姆斯基','索绪尔','结构主义','马氏文通','生成性','线条性','语言符号','语言是人类','语言联盟','世界语','语言演变','语言发展','语言习得','狼孩','儿童语言','语文学','语言的本质'],
  'ling-phonetics': ['音素','音位','元音','辅音','音标','音节','韵律','音高','音长','音强','国际音标','语音','音质','声波','发音','声门','声带','音位变体','语音的社会属性'],
  'ling-grammar': ['语法','形态','词法','句法','语素','词类','语法范畴','组合','聚合','递归','构词','屈折','黏着','语法手段','语法意义','语法形式','组合规则','聚合规则','语序','虚词','分析语','汉语语法学'],
  'ling-semantics': ['语义','义素','义项','语义场','词义','歧义','语义指向','同义','反义','隐喻','语义特征','上下位','词义的概括性','义丛','语义关系'],
  'ling-pragmatics': ['语用','语境','言语行为','会话','合作原则','预设','焦点','话题','指示','礼貌','蕴含','言外之意','言内行为','言外行为','言后行为'],
  'ling-writing': ['文字','字母','表音','表意','字符','象形','楔形','拼音文字','意音文字','文字类型','文字起源'],
  'ling-historical': ['语言接触','混合语','洋泾浜','克里奥尔','语言联盟','社会方言','地域方言','方言','语族','语系','谱系','历史比较','语言演变','共同语','亲属语言','系统感染','语言替换','语言融合','双语','借词','底层','语系'],

  /* ---------- 现代汉语 ---------- */
  'mc-intro': ['现代汉语','普通话','共同语','现代汉语特点','现代汉民族共同语','七大方言','官话','吴语','湘语','赣语','客家','闽语','粤语','推广普通话','汉语规范化','口语和书面语','文学语言','方言区'],
  'mc-phonetics': ['声母','韵母','声调','音变','元音','辅音','音节','四呼','儿化','轻声','音位','变调','声韵','调值','调类','拼音','韵头','韵腹','韵尾','四要素','音素','音标','国际音标','声带','声门','浊音','清音','送气','塞音','擦音','塞擦音','鼻音','边音','入派四声','音位变体','条件变体','语流音变','同化','异化','弱化','脱落','国标码','南方方言','音的'],
  'mc-writing': ['汉字','笔顺','六书','隶变','楷书','篆书','字形','简体','繁体','偏旁','部首','笔画','甲骨','金文','造字法','同音字','多音字','形声','会意','象形','指事','近形字','书写','标点符号','造字方法','部件'],
  'mc-lexicon': ['语素','词义','合成词','单纯词','联绵词','连绵词','同义词','反义词','基本词汇','熟语','成语','词汇','外来词','词的结构','义项','多义词','同音词','同形词','概念义','色彩义','词义的概括性','双音节化','简称','缩略','古语词','方言词','行业词','释义法','词义演变','语义场','词缀','词根'],
  'mc-grammar': ['短语','主语','谓语','宾语','定语','状语','补语','词类','虚词','词性','搭配','语病','句式','存现句','主谓','复句','把字句','被字句','量词','语气词','句法','层次分析','歧义','区别词','兼语','连谓','名词','动词','形容词','数词','代词','副词','介词','连词','助词','叹词','拟声词','句类','句型','单句','关联词','成分','语序','句子','短语类型','独立语'],
  'mc-pragmatics': ['语用','修辞','语境','预设','言语行为','焦点','话题','辞格','比喻','借代','夸张','对偶','排比','移就','双关','仿词','委婉','话语推进','衔接手段','连贯','信息结构','前提'],

  /* ---------- 古代汉语 ---------- */
  'ac-intro': ['古代汉语','文言','古汉语','文言文','汉语史','古代汉语分期','文言与白话'],
  'ac-tools': ['工具书','字典','词典','说文解字','康熙字典','尔雅','广韵','注音','反切','直音','读若','读如','韵书','索引','辞源','辞海','经籍纂诂','经典释文','字书','字典排列','部首排列','检字法'],
  'ac-writing': ['甲骨','金文','小篆','隶变','六书','古今字','异体字','繁简','说文','字形','通假','本字','大篆','籀文','会意','形声','指事','象形','转注','假借','偏旁','部首','亦声字','四体二用','正字','俗字','造字法'],
  'ac-lexicon': ['本义','引申','假借','联绵','古今词义','词义','词汇','同源','复合词','单纯词','偏义复词','连绵词','重言词','同义连文','古今字','同义词辨析','單音詞','複音詞','单音词','复音词'],
  'ac-grammar': ['词类活用','使动','意动','判断句','被动句','宾语前置','虚词','句式','句法','语序','省略','词类','代词','副词','介词','连词','助词','名词','动词','形容词','用作状语','吾','其','之','者','所','莫','弗','毋','勿'],
  'ac-phonology': ['音韵','声母','韵母','声调','反切','韵书','平仄','三十六字母','等呼','阴阳','古音','上古音','中古音','入声','浊音清化','韵部','声纽','对转','旁转','五音','七音','广韵','切韵','唐韵','集韵','平水韵','阳声韵','阴声韵','入声韵','四声','字母','聲類','钱大昕','古韵','鱼铎阳','破读','读破','直音','读若','读如','如字','注音','叶音','協音','古聲母','聲母'],
  'ac-exegesis': ['训诂','注','疏','笺','正义','章句','互文','形训','声训','义训','古注','传注','集解','经籍纂诂','十三经注疏','脫文','脱文','衍文','偏义复词','同义连文','注釋體例','注解體例','渾言','析言'],
  'ac-rhetoric': ['修辞','比喻','对偶','排比','借代','夸张','互文','委婉','辞格','用典','互文见义'],
  'ac-punctuation': ['句读','翻译','标点','断句','今译','古文今译','标点符号','加标点','加标點']
};

/* 试卷科目 -> 学科大类(从试卷名判断) */
function areasOfPaper(chapterName) {
  const n = chapterName || '';
  const areas = new Set();
  // 汉语综合=现代汉语+古代汉语 综合卷
  if (n.includes('汉语综合')) { areas.add('mc'); areas.add('ac'); }
  if (n.includes('现代汉语')) areas.add('mc');
  if (n.includes('语言学')) areas.add('ling');
  if (n.includes('古代汉语') || n.includes('汉语史')) areas.add('ac');
  if (!areas.size) areas.add('ling');
  return [...areas];
}

function areaOfChapterId(id) {
  if (id.startsWith('ling-')) return 'ling';
  if (id.startsWith('mc-')) return 'mc';
  if (id.startsWith('ac-')) return 'ac';
  return null;
}

/* 古文断句/翻译题识别: 虚词密度高或题干含标点翻译要求 */
function looksLikeClassicalPassage(stem) {
  const text = (stem || '').replace(/\s/g, '');
  if (!text) return false;
  if (/标点|句读|断句|今译|古文今译|加标點|加标点/.test(text)) return true;
  if (text.length < 40) return false;
  const markers = ['曰','之','其','者','也','而','以','於','则','則','矣','乎','焉','哉','夫','為','为','與','与'];
  let hits = 0;
  markers.forEach(m => { if (text.includes(m)) hits += 1; });
  return hits >= 6;
}

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

/* 关键词打分, 在给定章节集合内选出最匹配的学科章节 */
function classify(stem, candidateIds) {
  const text = stem || '';
  let best = null;
  let bestScore = 0;
  candidateIds.forEach(id => {
    const kws = KEYWORDS[id] || [];
    let score = 0;
    kws.forEach(k => { if (text.includes(k)) score += 1; });
    if (score > bestScore) { bestScore = score; best = id; }
  });
  return { id: best, score: bestScore };
}

function main() {
  const cats = JSON.parse(fs.readFileSync(path.join(root, 'data', 'categories.json'), 'utf8'));

  // 拆出 学科分类 与 真题分类
  // 规则(与侧边栏一致): 三级分类(年份->试卷)=真题卷; 二级分类(学科->章节)=学科
  const subjectChapters = [];   // 学科章节(完整/严选视图)
  const paperChapters = [];     // 试卷章节(真题视图)
  const subjectChapterIdsByArea = { ling: [], mc: [], ac: [] };

  const isPaperCategory = (cat) => (cat.children || []).some(ch => ch.children && ch.children.length);

  cats.categories.forEach(cat => {
    const asPaper = isPaperCategory(cat);
    (cat.children || []).forEach(child => {
      const leaves = child.children
        ? child.children.map(sub => ({ id: sub.id, name: sub.name, group: child.name, catName: cat.name }))
        : [{ id: child.id, name: child.name, group: null, catName: cat.name }];
      leaves.forEach(leaf => {
        if (asPaper) {
          paperChapters.push({ ...leaf, group: child.name || null, catName: cat.name, paperName: child.name });
        } else {
          const area = areaOfChapterId(leaf.id);
          subjectChapters.push({ ...leaf, area });
          if (area) subjectChapterIdsByArea[area].push(leaf.id);
        }
      });
    });
  });

  // 试卷名(用于判断学科大类), 如 "402 语言学与古代汉语"
  paperChapters.forEach(p => { p.chapterName = p.name; });

  // 读取所有题目文件
  const allFiles = fs.readdirSync(qdir).filter(f => f.endsWith('.json'));
  const fileData = {};
  let missingCount = 0;
  paperChapters.forEach(p => {
    const f = path.join(qdir, p.id + '.json');
    if (!fs.existsSync(f)) { missingCount += 1; fileData[p.id] = null; return; }
    fileData[p.id] = JSON.parse(fs.readFileSync(f, 'utf8'));
  });
  // 学科文件(用户自己上传的练习题等)
  subjectChapters.forEach(s => {
    const f = path.join(qdir, s.id + '.json');
    if (!fs.existsSync(f)) { missingCount += 1; fileData[s.id] = null; return; }
    fileData[s.id] = JSON.parse(fs.readFileSync(f, 'utf8'));
  });

  // 未在分类树里的题目文件:仅提示, 不参与归类
  const knownIds = new Set([...subjectChapters.map(s => s.id), ...paperChapters.map(p => p.id)]);
  const orphanFiles = allFiles
    .map(f => f.replace(/\.json$/, ''))
    .filter(id => !knownIds.has(id));

  /* ===== 归类:每道题 -> 学科章节 ===== */
  const buckets = {};   // subjectChapterId -> [question]
  subjectChapters.forEach(s => { buckets[s.id] = []; });
  const unclassified = [];

  const pushQuestion = (q, subjectId, from) => {
    if (!buckets[subjectId]) buckets[subjectId] = [];
    buckets[subjectId].push({ q, from });
  };

  // 1) 学科文件里的题目:默认归属自身章节(subject 字段可覆盖)
  subjectChapters.forEach(s => {
    const data = fileData[s.id];
    if (!data) return;
    (data.questions || []).forEach(q => {
      const target = q.subject && buckets[q.subject] !== undefined ? q.subject : s.id;
      pushQuestion(q, target, null);
    });
  });

  // 2) 试卷文件里的题目:按科目定大类, 再按关键词在类内细分
  paperChapters.forEach(p => {
    const data = fileData[p.id];
    if (!data) return;
    const areas = areasOfPaper(p.chapterName || p.name);
    const candidates = areas.flatMap(a => subjectChapterIdsByArea[a] || []);
    if (!candidates.length) return;

    (data.questions || []).forEach(q => {
      // 显式指定优先
      if (q.subject && buckets[q.subject] !== undefined) {
        pushQuestion(q, q.subject, p);
        return;
      }
      // 古文标点/翻译题: 直接归入句读翻译
      if (areas.includes('ac') && looksLikeClassicalPassage(q.stem)) {
        pushQuestion(q, 'ac-punctuation', p);
        return;
      }
      const hit = classify(q.stem, candidates);
      if (hit.id && hit.score > 0) {
        pushQuestion(q, hit.id, p);
      } else {
        // 类内无法细分时, 归入该大类的"概论/绪论"
        const fallback = { ling: 'ling-intro', mc: 'mc-intro', ac: 'ac-intro' }[areas[0]];
        pushQuestion(q, fallback, p);
        unclassified.push({ paper: p.id, qid: q.id });
      }
    });
  });

  /* ===== 统计考点跨年份频次 ===== */
  const allQuestions = [];
  paperChapters.forEach(p => {
    const data = fileData[p.id];
    if (!data) return;
    (data.questions || []).forEach(q => allQuestions.push(Object.assign({}, q, { chapterId: p.id })));
  });
  subjectChapters.forEach(s => {
    const data = fileData[s.id];
    if (!data) return;
    (data.questions || []).forEach(q => allQuestions.push(Object.assign({}, q, { chapterId: s.id })));
  });

  const freqCount = {};
  const freqYears = {};
  allQuestions.forEach(q => {
    const key = extractKeyPoint(q.stem);
    if (key.length < 2) return;
    freqCount[key] = (freqCount[key] || 0) + 1;
    if (!freqYears[key]) freqYears[key] = new Set();
    const y = getQuestionYear(q);
    if (y) freqYears[key].add(y);
  });
  const frequency = {};
  Object.keys(freqCount).forEach(k => {
    frequency[k] = { count: freqCount[k], years: freqYears[k] ? freqYears[k].size : 0 };
  });

  /* ===== 严选判定 ===== */
  const isCurated = (q, key) => {
    if (q.curated === true) return true;
    if (q.curated === false) return false;
    if ((q.analysis && q.analysis.trim()) || (q.answer && q.answer.trim())) return true;
    const info = frequency[key];
    return !!(info && info.years >= 2);
  };

  /* ===== 组装学科视图 ===== */
  const subjects = {};
  const subjectFiles = {};
  let curatedTotal = 0;
  subjectChapters.forEach(s => {
    const list = (buckets[s.id] || []).slice().sort((a, b) => {
      const fa = a.from ? a.from.id : '';
      const fb = b.from ? b.from.id : '';
      if (fa !== fb) return fa < fb ? -1 : 1;
      return a.q.id - b.q.id;
    });

    const questions = [];
    const curatedIds = [];
    list.forEach((item, idx) => {
      const newId = idx + 1;
      const key = extractKeyPoint(item.q.stem);
      const curated = isCurated(item.q, key);
      if (curated) curatedIds.push(newId);
      questions.push({
        id: newId,
        origId: item.q.id,
        from: item.from ? item.from.id : null,
        fromName: item.from ? (item.from.paperName || item.from.name) : null,
        source: item.q.source || '',
        stem: item.q.stem || '',
        options: item.q.options || null,
        answer: item.q.answer || '',
        analysis: item.q.analysis || '',
        yearly: !!(item.q.source && item.q.source.includes('真题'))
      });
    });
    curatedTotal += curatedIds.length;
    subjects[s.id] = {
      name: s.name,
      group: s.group,
      catName: s.catName,
      total: questions.length,
      curatedIds,
      questionIds: questions.map(q => q.id)
    };
    // 题目明细单独落盘, 练习页按需加载该学科, 避免每次拉整库
    subjectFiles[s.id] = { subjectId: s.id, name: s.name, group: s.group, catName: s.catName, questions };
  });

  /* ===== 组装试卷视图 ===== */
  const papers = {};
  paperChapters.forEach(p => {
    const data = fileData[p.id];
    const qs = data ? (data.questions || []) : [];
    const curatedIds = qs.filter(q => isCurated(q, extractKeyPoint(q.stem))).map(q => q.id);
    papers[p.id] = {
      name: p.name,
      catName: p.catName,
      group: p.group,
      year: getQuestionYear({ source: p.name }) || null,
      total: qs.length,
      questionIds: qs.map(q => q.id),
      curatedIds
    };
  });

  /* 汇总 totals / questionIds(同时覆盖学科与试卷, 便于掌握地图等直接使用) */
  const chapterTotals = {};
  const chapterQuestionIds = {};
  Object.keys(subjects).forEach(id => {
    chapterTotals[id] = subjects[id].total;
    chapterQuestionIds[id] = subjects[id].questionIds;
  });
  Object.keys(papers).forEach(id => {
    chapterTotals[id] = papers[id].total;
    chapterQuestionIds[id] = papers[id].questionIds;
  });

  const curatedByChapter = {};
  Object.keys(subjects).forEach(id => { curatedByChapter[id] = subjects[id].curatedIds; });
  Object.keys(papers).forEach(id => { curatedByChapter[id] = papers[id].curatedIds; });

  const bank = {
    generatedAt: new Date().toISOString(),
    description: '题目总索引: 由 tools/build-curated-index.js 生成, 题目或分类变更后需重新生成',
    stats: {
      totalQuestions: allQuestions.length,
      subjectChapters: subjectChapters.length,
      paperChapters: paperChapters.length,
      curatedTotal,
      keywordFallback: unclassified.length,
      missingFiles: missingCount
    },
    subjects,
    papers,
    chapterTotals,
    chapterQuestionIds,
    curated: curatedByChapter,
    frequency
  };

  fs.writeFileSync(outFile, JSON.stringify(bank), 'utf8');

  // 学科题目明细: 每学科一个文件, 练习页按需加载
  const sdir = path.join(root, 'data', 'subjects');
  fs.mkdirSync(sdir, { recursive: true });
  // 清理已不存在的学科文件
  fs.readdirSync(sdir).filter(f => f.endsWith('.json')).forEach(f => {
    if (!subjectFiles[f.replace(/\.json$/, '')]) fs.unlinkSync(path.join(sdir, f));
  });
  Object.keys(subjectFiles).forEach(id => {
    fs.writeFileSync(path.join(sdir, id + '.json'), JSON.stringify(subjectFiles[id]), 'utf8');
  });

  const assigned = Object.keys(subjects).reduce((s, id) => s + subjects[id].total, 0);
  const bankKb = Math.round(fs.statSync(outFile).size / 1024);
  console.log('已生成 ' + path.relative(root, outFile) + '  (' + bankKb + ' KB)');
  console.log('已生成 data/subjects/*.json  (' + Object.keys(subjectFiles).length + ' 个学科文件)');
  console.log('  题目总数     : ' + bank.stats.totalQuestions);
  console.log('  已归入学科   : ' + assigned);
  console.log('  学科章节数   : ' + subjectChapters.length);
  console.log('  试卷数       : ' + paperChapters.length);
  console.log('  严选合计     : ' + curatedTotal);
  console.log('  未命中的题目(已归入概论/绪论) : ' + unclassified.length);
  if (orphanFiles.length) {
    console.log('  提示: 以下题目文件未出现在分类树中 -> ' + orphanFiles.join(', '));
  }
  console.log('\n  各学科题量:');
  subjectChapters.forEach(s => {
    const t = subjects[s.id].total;
    if (t > 0) console.log(`    ${s.catName} / ${s.group ? s.group + ' / ' : ''}${s.name}  ->  ${t} 题 (严选 ${subjects[s.id].curatedIds.length})`);
  });
}

main();
