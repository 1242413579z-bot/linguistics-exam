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

/* ===== 学科关键词 =====
   语言学部分依据南师大语言学及应用语言学考研参考书《语言学纲要》
   (叶蜚声、徐通锵) 的章节体系划分:

     概论   <- 导言 + 第一章 语言的功能 + 第二章 语言是符号系统
     语音   <- 第三章 语音和音系
     语法   <- 第四章 语法
     语义   <- 第五章 语义和语用(语义部分:词汇、词义、句义)
     语用   <- 第五章 语义和语用(语用部分)
     文字   <- 第六章 文字
     历史语言学 <- 第七章 语言演变与语言分化 + 第八章 语言的接触
                   + 第九章 语言系统的演变
   (注意: 语音/语法/词汇"的演变"属第九章节, 归历史语言学, 不归语音/语法/语义)

   现代汉语依据黄伯荣廖序东《现代汉语》(绪论/语音/文字/词汇/语法/修辞),
   古代汉语依据王力《古代汉语》通论(工具书/文字/词汇/语法/音韵/训诂/修辞/句读)
*/
const KEYWORDS = {
  /* ---------- 语言学 · 概论(导言、语言的功能、语言是符号系统) ---------- */
  'ling-intro': ['语言学的对象','语言学的作用','语言学的分支','语言的社会功能','信息传递功能','人际互动功能','语言的思维功能','语言和思维','思维功能','语言符号','符号的任意性','任意性','线条性','语言符号的系统性','二层性','开放性','传授性','语言符号是人类特有','语言与言语','言语','语言的本质','语言的功能','社会功能','语言是人类最重要的交际工具','普通语言学','应用语言学','社会语言学','心理语言学','描写语言学','语文学','索绪尔','乔姆斯基','结构主义','转换生成','生成语法','马氏文通','语言的定义','语言的特点','符号系统','语言是符号系统'],

  /* ---------- 语言学 · 语音(第三章 语音和音系) ---------- */
  'ling-phonetics': ['语音和音系','音系','语音四要素','语音的物理属性','音高','音长','音强','音质','发音器官','发音部位','发音方法','元音','辅音','声带','声门','音素','国际音标','严式音标','宽式音标','音位','音位变体','区别特征','音位的聚合','音位的组合','音节','音节结构','语流音变','同化','异化','弱化','脱落','韵律特征','韵律','声调','重音','轻音','语调','音系学','语音学','语音单位','音位的系统性'],

  /* ---------- 语言学 · 语法(第四章 语法) ---------- */
  'ling-grammar': ['语法','语法单位','语素','词组','组合规则','聚合规则','词法','句法','构词法','复合词','派生词','词类','形态','语法范畴','语法手段','语法形式','语法意义','性数格','时体态','人称','递归','变换','层次分析','直接成分','语言的结构类型','孤立语','黏着语','屈折语','复综语','普遍特征','普遍语法','语序','虚词','组合的层次性','聚合的类','显性意义','隐性意义'],

  /* ---------- 语言学 · 语义(第五章 词汇、词义、句义) ---------- */
  'ling-semantics': ['词汇','基本词汇','一般词汇','词义','词的义项','义项','义素','义素分析','语义场','语义特征','同义词','反义词','上下位','词义的关系','词义的概括性','句义','词语搭配','语义指向','歧义','句法歧义','语义角色','述谓','论元','命题','词义的民族性','词汇的组成'],

  /* ---------- 语言学 · 语用(第五章 语用) ---------- */
  'ling-pragmatics': ['语用','语用学','语境','话题','说明','焦点','预设','言语行为','言内行为','言外行为','言后行为','会话准则','合作原则','礼貌原则','量的准则','质的准则','指示','指示语','蕴含','言外之意','会话含义','话语','衔接','连贯','信息结构'],

  /* ---------- 语言学 · 文字(第六章 文字) ---------- */
  'ling-writing': ['文字和语言','文字的基本性质','文字的产生','象形文字','表意文字','表音文字','意音文字','文字系统的分类','文字的发展','文字的传播','书面语','字符','字母','拼音文字','楔形文字','圣书字','文字类型','自源文字','他源文字','文字的作用'],

  /* ---------- 语言学 · 历史语言学(第七、八、九章) ---------- */
  'ling-historical': [
    /* 第七章 语言演变与语言分化 */
    '语言演变','语言的发展演变','演变的原因','演变的特点','渐变性','不平衡性','语言的分化','社会方言','地域方言','方言','亲属语言','谱系分类','语系','语族','语支','原始基础语','基础语','共同语','语言的统一',
    /* 第八章 语言的接触 */
    '语言接触','社会接触','借词','词汇借用','语言联盟','系统感染','语言的替换','语言底层','底层','通用书面语','民族共同语','标准语','混合语','洋泾浜','克里奥尔','语言融合','语言消亡','双语','双重语言','语言转用',
    /* 第九章 语言系统的演变 */
    '语音的演变','语音演变规律','历史比较法','语法的演变','类推','重新分析','语法化','词汇的演变','新词','旧词消亡','词语替换','词义的演变','词义扩大','词义缩小','词义转移','语言系统的演变','演变的规律'
  ],

  /* ---------- 现代汉语(黄伯荣廖序东本) ---------- */
  'mc-intro': ['现代汉语','普通话','共同语','现代汉民族共同语','现代汉语的特点','七大方言区','七大方言','官话','吴语','湘语','赣语','客家话','闽语','粤语','北方方言','推广普通话','汉语规范化','口语和书面语','文学语言','方言区','现代汉语的形成','汉语的地位'],
  'mc-phonetics': ['声母','韵母','声调','声韵配合','音变','元音','辅音','音节','四呼','儿化','轻声','音位','变调','声韵','调值','调类','拼音','拼音方案','韵头','韵腹','韵尾','语音四要素','音素','音标','国际音标','声带','声门','浊音','清音','送气','塞音','擦音','塞擦音','鼻音','边音','入派四声','音位变体','条件变体','语流音变','同化','异化','弱化','脱落','国标码','声调符号','隔音符号'],
  'mc-writing': ['汉字','汉字的特点','笔顺','六书','隶变','楷书','篆书','字形','简体','繁体','偏旁','部首','笔画','甲骨文','金文','造字法','同音字','多音字','形声字','会意字','象形字','指事字','近形字','书写','标点符号','部件','规范汉字','汉字规范化','异体字','繁简字'],
  'mc-lexicon': ['语素','词的结构','词义','合成词','单纯词','联绵词','连绵词','同义词','反义词','基本词汇','一般词汇','熟语','成语','谚语','惯用语','歇后语','词汇','外来词','义项','多义词','同音词','同形词','概念义','色彩义','词义的概括性','双音节化','简称','缩略','古语词','方言词','行业词','释义','词义演变','语义场','词缀','词根','词义的分解'],
  'mc-grammar': ['短语','句法成分','主语','谓语','宾语','定语','状语','补语','中心语','词类','实词','虚词','词性','搭配','语病','句式','存现句','主谓谓语句','复句','把字句','被字句','量词','语气词','句法','层次分析','歧义','区别词','兼语','连谓','名词','动词','形容词','数词','代词','副词','介词','连词','助词','叹词','拟声词','句类','句型','单句','关联词','语序','独立语','句子的分类','成分分析法','句子成分'],
  'mc-pragmatics': ['修辞','修辞格','辞格','语用','语境','预设','言语行为','焦点','话题','比喻','借代','夸张','对偶','排比','移就','双关','仿词','委婉','比拟','反复','设问','反问','话语推进','衔接手段','连贯','信息结构','前提','修辞方式'],

  /* ---------- 古代汉语(王力本 通论) ---------- */
  'ac-intro': ['古代汉语','文言','古汉语','文言文','汉语史','古代汉语分期','文言与白话','学习古代汉语'],
  'ac-tools': ['工具书','字典','词典','说文解字','康熙字典','尔雅','广韵','辞源','辞海','经籍纂诂','经典释文','字书','注音方法','直音','读若','读如','部首','检字法','字典排列','部首排列','汉语大字典','助字辨略','词诠','古汉语虚词'],
  'ac-writing': ['甲骨文','金文','小篆','隶书','隶变','六书','古今字','异体字','繁简字','说文','字形','通假字','本字','大篆','籀文','会意','形声','指事','象形','转注','假借','偏旁','部首','亦声字','四体二用','正字','俗字','造字法','许慎','汉字形体','古文','籀文'],
  'ac-lexicon': ['本义','引申义','假借义','联绵词','古今词义','词义','词汇','同源词','复合词','单纯词','偏义复词','连绵词','重言词','同义连文','同义词辨析','单音词','复音词','古今词义的差别','词义的更替','词语的替换','古书词义'],
  'ac-grammar': ['词类活用','使动用法','意动用法','为动用法','判断句','被动句','宾语前置','双宾语','定语后置','状语后置','主谓倒装','省略句','句式','句法','语序','词类','虚词','代词','副词','介词','连词','助词','语气词','兼词','名词','动词','形容词','用作状语','用作动词','无定代词','指示代词','人称代词','疑问代词','否定副词','程度副词','范围副词','时间副词','发语词'],
  'ac-phonology': ['音韵','音韵学','声母','韵母','声调','反切','韵书','平仄','三十六字母','等呼','阴阳','古音','上古音','中古音','近古音','入声','浊音清化','韵部','韵摄','声纽','对转','旁转','五音','七音','广韵','切韵','唐韵','集韵','平水韵','阳声韵','阴声韵','入声韵','四声','字母','聲類','钱大昕','古韵','鱼铎阳','破读','读破','如字','叶音','協音','古聲母','守温','韵图','等韵'],
  'ac-exegesis': ['训诂','训诂学','古注','注疏','传注','笺','疏','正义','章句','集解','互文','形训','声训','义训','读破','十三经注疏','经籍纂诂','脱文','衍文','浑言','析言','注釋體例','注解體例','古书注解','毛传','郑笺','孔疏'],
  'ac-rhetoric': ['修辞','比喻','对偶','排比','借代','夸张','互文','委婉','辞格','用典','比拟','引用','代称','并提','互文见义','古汉语修辞'],
  'ac-punctuation': ['句读','标点','断句','加标点','翻译','今译','古文今译','标点符号','句读翻译','古文的标点','语译']
};

/* 名词解释类术语补充: 真题里大量短术语题(如"内部曲折""义丛"),
   仅靠章节通用词无法命中, 按参考书归属补入。 */
const TERMS = {
  'ling-intro': ['生成性','语言符号的生成性','索绪尔','结构主义','转换生成','生成语法','韩礼德','叶尔姆斯列夫','萨丕尔','伍尔夫','应用语言学','普通语言学','社会语言学','心理语言学','共时语言学','历时语言学','语言中枢','语言理解','语言与思维','聋哑','语言和说话','语言流变','语言规划','语言结构分类','形式主义','功能主义','比较语言学','世界语','语言学流派','语言的本质'],
  'ling-phonetics': ['音高','音长','音强','音质','发音体','乐音','噪音','尖团音','文白异读','平仄','拗救','孤平','韵律','声波','语音属性'],
  'ling-grammar': ['组合关系','聚合关系','递归性','开放性','内部曲折','内部屈折','语法范畴','情态','词缀','词尾','语素','转换分析','语法单位'],
  'ling-semantics': ['多义词','义丛','总分词','类义词','理性义','附加义','义素','语义场','词义关系','语义关系'],
  'ling-pragmatics': ['言内意外','言外之意','会话','话轮','礼貌','语境'],
  'ling-writing': ['文字和语言','书写符号','表音','表意','意音','文字类型','文字系统'],
  'ling-historical': ['语言替换','历史语言学','语系','语网','语支','意译词','音译词','演变规律','语言分化'],
  'mc-intro': ['现代汉民族共同语','共同语','方言区','社会变体','语言规划'],
  'mc-phonetics': ['音高','音长','音强','音质','清浊','逻辑重音','押韵'],
  'mc-writing': ['造字方法','字符','同形字','四定','错别字'],
  'mc-lexicon': ['义素','语义关系','语义场','同形词'],
  'mc-grammar': ['语法功能','选择疑问句','是非问句','名词谓语句','动态存在句','代副词','插说','语义指向','马氏文通'],
  'mc-pragmatics': ['语体','话轮','衔接','连贯'],
  'ac-intro': ['乾嘉学派','小学'],
  'ac-tools': ['类书','索引'],
  'ac-phonology': ['古无舌上音','反切','韵部','平仄'],
  'ac-exegesis': ['十三经','义疏','因声求义','声训','形训','义训','乾嘉','注疏','章句'],
  'ac-grammar': ['指代性副词','宾语前置','词类活用']
};
Object.keys(TERMS).forEach(id => {
  if (!KEYWORDS[id]) KEYWORDS[id] = [];
  TERMS[id].forEach(t => { if (!KEYWORDS[id].includes(t)) KEYWORDS[id].push(t); });
});

/* 历史语言学优先判定词(第七/八/九章): 命中即归历史语言学,
   避免"语音的演变/语法的演变/词义的演变"被误分到语音/语法/语义 */
const HISTORICAL_PRIORITY = new RegExp([
  /* 第七章 语言演变与语言分化 */
  '演变', '演化', '分化', '语言的分化', '渐变性', '不平衡性', '社会方言', '地域方言', '方言',
  '亲属语言', '谱系', '语系', '语族', '语支', '原始基础语', '基础语', '原始语',
  /* 第八章 语言的接触 */
  '语言接触', '社会接触', '借词', '音译词', '词汇借用', '语言联盟', '系统感染',
  '语言的替换', '语言底层', '语言融合', '语言消亡', '语言转用', '双重语言',
  '通用书面语', '标准语', '民族共同语', '混合语', '洋泾浜', '克里奥尔', '克里奥耳', '皮钦',
  /* 第九章 语言系统的演变 */
  '语音的演变', '语音演变规律', '历史比较', '语法的演变', '类推', '重新分析', '语法化',
  '词汇的演变', '词语替换', '词义的演变', '词义扩大', '词义缩小', '词义转移', '演变的规律'
].join('|'));

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

/* 古代汉语按题型标题直接路由:
   標點/句讀/翻譯 -> 句读翻译;  解釋加點字/加框詞語 -> 词汇(古今词义) */
function routeAncientChinese(stem) {
  const text = matchText(stem);
  const head = (text.split('\n')[0] || '');
  if (/标点|句读|断句|翻译|今译/.test(head)) return 'ac-punctuation';
  if (/解释加框|解释加点|解释带点|加框|加点字|加框字|词语解释|解释下列|词义|古今词义|词语/.test(head)) return 'ac-lexicon';
  return null;
}

/* 古文断句/翻译题识别: 虚词密度高或题干含标点翻译要求 */
function looksLikeClassicalPassage(stem) {
  const text = matchText(stem).replace(/\s/g, '');
  if (!text) return false;
  if (/标点|句读|断句|今译|古文今译|加标点/.test(text)) return true;
  if (text.length < 40) return false;
  const markers = ['曰','之','其','者','也','而','以','于','则','矣','乎','焉','哉','夫','为','与'];
  let hits = 0;
  markers.forEach(m => { if (text.includes(m)) hits += 1; });
  return hits >= 6;
}

/* 繁简对照: 南师大早期真题多用繁體(如 2009-2012 年卷), 而关键词用简体。
   匹配前统一转简体; 仅用于内部匹配, 不改动展示文本。 */
const TRAD_TO_SIMP = {
  /* —— 语言学/音韵/训诂类高频字 —— */
  '聲':'声','韻':'韵','調':'调','讀':'读','語':'语','詞':'词','義':'义','體':'体','釋':'释','註':'注','詁':'诂','訓':'训','彙':'汇','標':'标','譯':'译','說':'说','論':'论','記':'记','傳':'传','經':'经','書':'书','學':'学','漢':'汉','問':'问','題':'题','響':'响','發':'发','聽':'听','覺':'觉','寫':'写','歸':'归','來':'来','時':'时','後':'后','進':'进','還':'还','樣':'样','頭':'头','點':'点','幾':'几','無':'无','異':'异','齊':'齐','節':'节','給':'给','結':'结','絕':'绝','強':'强','長':'长','當':'当','圖':'图','據':'据','處':'处','備':'备','戰':'战','單':'单','嚴':'严','風':'风','飛':'飞','養':'养','齒':'齿','龍':'龙','龜':'龟','馬':'马','車':'车','鳥':'鸟','魚':'鱼','東':'东','盡':'尽','舊':'旧','舉':'举','難':'难','觀':'观','樂':'乐','萬':'万','畫':'画','劃':'划','術':'术','復':'复','於':'于','並':'并','讓':'让','愛':'爱','國':'国','內':'内','兩':'两','習':'习','驗':'验','價':'价','資':'资','質':'质','農':'农','識':'识','誤':'误','誌':'志','認':'认','誠':'诚','課':'课','談':'谈','請':'请','誰':'谁','講':'讲','謝':'谢','議':'议','護':'护','邊':'边','鄉':'乡','醫':'医','鐘':'钟','鑄':'铸','門':'门','閉':'闭','開':'开','間':'间','關':'关','陽':'阳','陰':'阴','陳':'陈','隨':'随','雖':'虽','雙':'双','雲':'云','電':'电','靈':'灵','靜':'静','韓':'韩','頁':'页','順':'顺','須':'须','預':'预','領':'领','飄':'飘','餘':'余','館':'馆','駕':'驾','騎':'骑','髮':'发','鬥':'斗','魯':'鲁','鮮':'鲜','鳴':'鸣','鴻':'鸿','鵲':'鹊','麗':'丽','黃':'黄','實':'实','寶':'宝','導':'导','將':'将','專':'专','監':'监','蓋':'盖','虛':'虚','謂':'谓','號':'号','蟲':'虫','製':'制','複':'复','規':'规','親':'亲','計':'计','討':'讨','許':'许','詩':'诗','詳':'详','誦':'诵','諺':'谚','讚':'赞','賀':'贺','負':'负','財':'财','責':'责','貴':'贵','買':'买','費':'费','賓':'宾','賣':'卖','購':'购','贈':'赠','趕':'赶','趙':'赵','趨':'趋','跡':'迹','踐':'践','蹤':'踪','軍':'军','較':'较','載':'载','輔':'辅','輕':'轻','輪':'轮','轟':'轰','迴':'回','連':'连','週':'周','遊':'游','運':'运','過':'过','達':'达','違':'违','遠':'远','適':'适','選':'选','遺':'遗','邏':'逻','鄰':'邻','鑑':'鉴','閱':'阅','陣':'阵','陸':'陆','階':'阶','險':'险','隱':'隐','雜':'杂','願':'愿','顧':'顾','顯':'显','飲':'饮','飾':'饰','驚':'惊','齡':'龄','黽':'黾','黨':'党','鼓':'鼓','麥':'卖',
  /* —— 说文/小学类专名 —— */
  '說':'说','隸':'隶','楷':'楷','篆':'篆','籀':'籀','亦':'亦','轉':'转','假':'假','借':'借','偏':'偏','旁':'旁','部':'部','首':'首','形':'形','聲':'声','會':'会','意':'意','指':'指','象':'象','許':'许','慎':'慎','段':'段','玉':'玉','裁':'裁','載':'载',
  /* —— 常用繁简(题干叙述用字) —— */
  '這':'这','們':'们','個':'个','應':'应','該':'该','現':'现','見':'见','對':'对','與':'与','為':'为','產':'产','種':'种','種':'种','麼':'么','無':'无','沒':'没','圓':'圆','説':'说',
  /* —— 古汉语通论常见 —— */
  '脫':'脱','註':'注','疏':'疏','箋':'笺','正':'正','章':'章','句':'句','集':'集','解':'解','讀':'读','破':'破','渾':'浑','析':'析','衍':'衍','闕':'阙','異':'异','體':'体','俗':'俗','通':'通','假':'假','借':'借','古':'古','今':'今','字':'字','詞':'词','彙':'汇','單':'单','複':'复','音':'音','韻':'韵','紐':'纽','攝':'摄','等':'等','呼':'呼','對':'对','轉':'转','旁':'旁','濁':'浊','清':'清','入':'入','聲':'声','調':'调','類':'类','四':'四','五':'五','七':'七','音':'音','母':'母','守':'守','溫':'温','錢':'钱','昕':'昕','顧':'顾','炎':'炎','武':'武','陳':'陈','第':'第','朱':'朱','駿':'骏','聲':'声',
  /* —— 现代汉语/语言学题干常见 —— */
  '發':'发','音':'音','節':'节','調':'调','值':'值','位':'位','變':'变','體':'体','兒':'儿','輕':'轻','濁':'浊','清':'清','送':'送','氣':'气','塞':'塞','擦':'擦','鼻':'鼻','邊':'边','國':'国','標':'标','碼':'码','隔':'隔','符':'符','號':'号','筆':'笔','畫':'画','順':'顺','簡':'简','繁':'繁','異':'异','規':'规','範':'范','部':'部','件':'件','語':'语','素':'素','綴':'缀','根':'根','合':'合','並':'并','略':'略','稱':'称','縮':'缩','語':'语','行':'行','業':'业','釋':'释','義':'义','場':'场','色':'色','彩':'彩','粧':'妆','句':'句','類':'类','型':'型','单':'单','复':'复','關':'关','聯':'联','獨':'独','立':'立','層':'层','次':'次','成':'成','分':'分','析':'析','歧':'歧','義':'义','區':'区','别':'别','兼':'兼','連':'连','謂':'谓','數':'数','代':'代','副':'副','介':'介','連':'连','助':'助','嘆':'叹','擬':'拟','聲':'声','關':'关','語':'语','序':'序','預':'预','設':'设','焦':'焦','點':'点','話':'话','題':'题','言':'言','語':'语','行':'行','為':'为','內':'内','外':'外','後':'后','會':'会','準':'准','則':'则','禮':'礼','貌':'貌','原':'原','則':'则','含':'含','蓄':'蓄','意':'意','銜':'衔','接':'接','貫':'贯','連':'连','信':'信','息':'息','結':'结','構':'构',
  /* —— 文字/字体 —— */
  '楔':'楔','形':'形','聖':'圣','書':'书','自':'自','源':'源','他':'他','傳':'传','播':'播','發':'发','展':'展','分':'分','統':'统','系':'系','象':'象','表':'表','拼':'拼','拉':'拉','丁':'丁','希':'希','臘':'腊'
};

/* 含繁体字才做转换, 避免无谓遍历 */
const TRAD_RE = new RegExp('[' + Object.keys(TRAD_TO_SIMP).join('') + ']');

function toSimplified(text) {
  const s = text || '';
  if (!TRAD_RE.test(s)) return s;
  let out = '';
  for (const ch of s) out += (TRAD_TO_SIMP[ch] || ch);
  return out;
}

/* 去掉选择题选项行, 保留题干本体 */
function stripOptions(stem) {
  return (stem || '')
    .split('\n')
    .filter(line => !/^\s*[A-EＡ-Ｅ][\.、．）)]/.test(line))
    .join('\n');
}

/* 匹配用文本: 去选项 + 转简体 */
function matchText(stem) {
  return toSimplified(stripOptions(stem));
}

/* 题型标题(如"四、名詞解釋（每小題4分）")描述的是题型而非考点,
   参与关键词匹配会把所有题都拉向"语法""文字"等, 故打分前先去掉。 */
const TYPE_HEADER_RE = /^\s*[一二三四五六七八九十百\d]+\s*[、.．,，)]\s*(名詞解釋|名词解释|術語解釋|术语解释|填空|簡答|简答|論述|论述|分析|解釋|解释|單選|单选|多選|多选|判斷|判断|操作|標點|标点|翻譯|翻译|作文|改錯|改错|問答|问答|舉例|举例)/;

function topicText(stem) {
  const lines = matchText(stem).split('\n');
  if (lines.length > 1 && TYPE_HEADER_RE.test(lines[0])) lines.shift();
  return lines.join('\n');
}

/* 提取核心考点:取题干最后一行, 仅保留中英文数字, 去掉开头序号 */
function extractKeyPoint(stem) {
  const text = topicText(stem);
  if (!text) return '';
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
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
  const text = topicText(stem);
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
      // 古代汉语: 先按题型标题路由(标点翻译 / 解释词语)
      if (areas.includes('ac')) {
        const byHeader = routeAncientChinese(q.stem);
        if (byHeader) { pushQuestion(q, byHeader, p); return; }
        // 无标题提示但明显是古文长句的, 视为标点翻译
        if (looksLikeClassicalPassage(q.stem)) { pushQuestion(q, 'ac-punctuation', p); return; }
      }
      // 语言学: 语言演变与语言分化 / 语言的接触 / 语言系统的演变
      // (纲要第七、八、九章) -> 历史语言学, 优先于语音/语法/语义
      if (areas.includes('ling') && HISTORICAL_PRIORITY.test(matchText(q.stem))) {
        pushQuestion(q, 'ling-historical', p);
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
