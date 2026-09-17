/* tools/build-curated-index.js
   生成 data/question-bank.json —— 全站题目的统一索引, 支撑两套视图:

   1) 学科视图(完整/严选): 每道题归入一个学科章节。
      真题试卷里的题目也全部回归到学科, 因此"完整"下某个学科章节
      包含该考点的全部题目(真题 + 后续上传的练习题)。
   2) 试卷视图(真题): 按年份的南师大试卷, 一套卷子一套卷子地看。

   分类规则:
   - 题目若自带 subject 字段(学科章节 id) -> 直接采用(可用来自定义/覆盖)
   - 混合卷(汉语综合 / 语言学与古代汉语)先按卷面分段判定古今归属,
     再在学科大类内用关键词打分选出最匹配的章节

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
     语义   <- 第五章 语义和语用(词汇、词义、句义)
     语用   <- 第五章 语义和语用(语用部分)
     文字   <- 第六章 文字
     历史语言学 <- 第七章 语言演变与语言分化 + 第八章 语言的接触
                   + 第九章 语言系统的演变
   (注意: "语音/语法/词汇的演变" 属第九章, 归历史语言学, 不归语音/语法/语义)

   现代汉语依据黄伯荣廖序东《现代汉语》(绪论/语音/文字/词汇/语法/修辞),
   古代汉语依据王力《古代汉语》通论(绪论/工具书/文字/词汇/语法/音韵/训诂/句读)
*/
const KEYWORDS = {
  /* ---------- 语言学 · 概论(导言、语言的功能、语言是符号系统) ---------- */
  'ling-intro': [
    '语言学的对象','语言学的作用','语言学的分支','语言学的建立','语言学流派','语言学史',
    '传统语言学','历史比较语言学','比较语言学','语文学','普通语言学','应用语言学','社会语言学','心理语言学','描写语言学','共时语言学','历时语言学','认知语言学','数理语言学','神经语言学','计算语言学',
    '语言的社会功能','信息传递功能','人际互动功能','语言的思维功能','语言和思维','思维方式','思维功能','语言的功能','社会功能','交际工具','辅助交际工具','语言是人类最重要的交际工具',
    '语言符号','符号系统','符号的任意性','任意性','线条性','二层性','两层性','开放性','生成性','能指','所指','语言与言语','言语','语言的本质','语言的定义','语言的特点','语言的结构类型',
    '索绪尔','乔姆斯基','chomsky','布龙菲尔德','韩礼德','莱考夫','雅各布逊','萨丕尔','伍尔夫','叶尔姆斯列夫','叶姆斯列夫','哥本哈根','布拉格学派','结构主义','转换生成','生成语法','支配和约束','原则系统','规则系统','普遍语法','形式主义','功能主义','世界语','语言规划','语言中枢','布洛卡','韦尼克','失语症','语言理解','语言习得','儿童语言','狼孩','聋哑','大脑','信息论','编码','解码','传信','发源地','语言学的三大发源地','成为一门独立','独立的学科','语言学之父','现代语言学之父','三要素','物质外壳','建筑材料','组合法则','尔雅','尔雅','说文解字','说文','词典','字典','工具书','语言流变','语言学流派','流派'
  ],

  /* ---------- 语言学 · 语音(第三章 语音和音系) ---------- */
  'ling-phonetics': [
    '语音和音系','音系','语音学','音系学','语音','语音四要素','语言四要素','语音的物理属性','物理属性','生理属性','社会属性','语音属性','语音单位','语音的社会属性',
    '音高','音长','音强','音质','发音器官','发音部位','发音方法','发音体','元音','辅音','声带','声门','乐音','噪音','声波','音素','国际音标','严式音标','宽式音标','标音',
    '音位','音位变体','区别特征','音位的聚合','音位的组合','音节','音节结构','语流音变','同化','异化','弱化','脱落','韵律','韵律特征','声调','重音','轻音','语调','音韵','平仄','韵书','切韵','广韵','韵图','等韵','尖团音','文白异读','语音分析','读法','变调'
  ],

  /* ---------- 语言学 · 语法(第四章 语法) ---------- */
  'ling-grammar': [
    '语法学','语法','语法单位','语法规则','语法形式','语法意义','语法手段','语法范畴','语法功能',
    '语素','音义结合','音义结合体','最小的音义结合体','词组','短语','句子结构','最小的使用单位','最小的能独立运用',
    '组合规则','聚合规则','组合关系','聚合关系','替换规则','线性序列','结构关系','组合的层次','组合的层次性','递归','递归性','层次分析','层次分析法','层析分析','中心词分析','中心词分析法','分布分析','变换分析','变换分析法','转换分析','直接成分','显性意义','隐性意义',
    '词法','句法','构词法','构词','复合词','派生词','词类','形态','词形变化','性数格','时体态','时态','人称代词','代词','动词重叠','重叠','语序','词序','虚词','兼语','双宾','双宾语',
    '语言的结构类型','孤立语','黏着语','屈折语','复综语','分析语','综合语','普遍特征','普遍语法','有几种意义','几种意义','分化','结构异同','结构的异同','歧义','句法歧义','复句','多重复句','陈述对象','陈述内容','特殊的句子成分','结构规则'
  ],

  /* ---------- 语言学 · 语义(第五章 词汇、词义、句义) ---------- */
  'ling-semantics': [
    '词汇','基本词汇','一般词汇','词汇的组成','词义','词义的概括性','词义的民族性','词的义项','义项','多义词','同音词','同音同形词','同形词','同义词','反义词','上下位',
    '义素','义素分析','语义成分','语义场','语义特征','语义关系','词义的关系','词义关系','语义指向','词语搭配','语义差异','语言的差异','歧义',
    '句义','语义角色','述谓','论元','命题','隐喻','换喻','转喻','派生意义','派生义','词义演变'
  ],

  /* ---------- 语言学 · 语用(第五章 语用) ---------- */
  'ling-pragmatics': [
    '语用','语用学','语用策略','语境','话题','话题链','焦点','预设','前提',
    '言语行为','言内行为','言外行为','言后行为','言内意外','言外之意','会话','话轮','会话含义','会话准则','合作原则','礼貌原则','量的准则','质的准则','指示','指示语','蕴含',
    '话语','衔接','连贯','信息结构','语体','口语语体','书面语体','辞格','修辞','修辞格','长句','短句','整句','散句'
  ],

  /* ---------- 语言学 · 文字(第六章 文字) ---------- */
  'ling-writing': [
    '文字','文字和语言','文字的基本性质','文字的产生','文字起源','文字的作用','文字系统','文字类型','文字的发展','文字的传播','文字系统','书面语','书面语和口语',
    '象形文字','表意文字','表音文字','意音文字','自源文字','借源文字','语素文字','音素文字','字符','字母','拼音文字','楔形文字','圣书字','六书','汉字','造字法','字形'
  ],

  /* ---------- 语言学 · 历史语言学(第七、八、九章) ---------- */
  'ling-historical': [
    /* 第七章 语言演变与语言分化 */
    '语言演变','语言的发展演变','语言发展','演变的原因','演变的特点','渐变性','不平衡性','不平衡','语言的分化','语言分化','社会方言','地域方言','方言','方言差异','亲属语言','亲属关系','语言之间','谱系分类','语系','语族','语支','语网','原始基础语','基础语','原始语','共同语','语言的统一','不同地域','全民语言',
    /* 第八章 语言的接触 */
    '语言接触','社会接触','借词','词汇借用','意译词','音译词','仿译词','仿造','语言联盟','系统感染','语言的替换','语言替换','语言底层','底层','通用书面语','共用语','民族共同语','标准语','混合语','洋泾浜','克里奥尔','克里奥耳','皮钦','语言融合','语言消亡','语言转用','双语','双重语言','专业用语','行业语',
    /* 第九章 语言系统的演变 */
    '语音的演变','语音演变规律','历史比较法','历史比较','语法的演变','类推','重新分析','语法化','词汇的演变','新词','旧词消亡','词语替换','词义的演变','词义扩大','词义缩小','词义转移','语言系统的演变','演变的规律'
  ],

  /* ---------- 现代汉语(黄伯荣廖序东本) ---------- */
  'mc-intro': [
    '现代汉语','普通话','共同语','现代汉民族共同语','现代汉语的特点','七大方言区','七大方言','官话','吴语','湘语','赣语','客家话','闽语','粤语','北方方言','推广普通话','汉语规范化','口语和书面语','文学语言','方言区','现代汉语的形成','汉语的地位','语言规划','社会变体','结构主义语法','现代汉语之父','方言分区','方言'
  ],
  'mc-phonetics': [
    '语音','声母','韵母','声调','声韵配合','音变','元音','辅音','音节','四呼','儿化','轻声','音位','变调','声韵','调值','调类','拼音','拼音方案','韵头','韵腹','韵尾','语音四要素','音素','音标','国际音标','声带','声门','浊音','清音','送气','塞音','擦音','塞擦音','鼻音','边音','入派四声','音位变体','条件变体','语流音变','同化','异化','弱化','脱落','国标码','声调符号','隔音符号','变读','节律','押韵','逻辑重音','音位和音位变体','发音部位','发音方法'
  ],
  'mc-writing': [
    '汉字','汉字的特点','笔顺','六书','隶变','楷书','篆书','字形','简体','繁体','偏旁','部首','笔画','甲骨文','金文','造字法','同音字','多音字','形声字','会意字','象形字','指事字','近形字','书写','标点符号','部件','规范汉字','汉字规范化','异体字','繁简字','造字方法','字符','同形字','四定','错别字'
  ],
  'mc-lexicon': [
    '语素','词的结构','词义','合成词','单纯词','联绵词','连绵词','同义词','反义词','基本词汇','一般词汇','熟语','成语','谚语','惯用语','歇后语','词汇','外来词','义项','多义词','同音词','同形词','概念义','色彩义','词义的概括性','双音节化','简称','缩略','古语词','方言词','行业词','释义','词义演变','语义场','词缀','词根','词义的分解','构词','构词方式','义素','语义关系','多义词和同音词','本义','语义','语义特征','语义差别'
  ],
  'mc-grammar': [
    '短语','句法成分','主语','谓语','宾语','定语','状语','补语','中心语','词类','实词','虚词','词性','搭配','病句','修改病句','语病','句式','存现句','主谓谓语句','复句','把字句','被字句','量词','语气词','句法','语法','层次分析','歧义','区别词','兼语','连谓','名词','动词','形容词','数词','代词','副词','介词','连词','助词','叹词','拟声词','句类','句型','单句','关联词','语序','独立语','句子的分类','成分分析法','句子成分','语法意义','分析语','代谓词','代名词','双宾','双宾语','分化','结构异同','结构的异同','疑问句','汉语语法学','语法学','多重复句','词和短语','虚词的语法意义','现代汉语语法的特点','并列短语','偏正短语','主谓短语','动宾短语','补充短语',
    '语法功能','选择疑问句','是非问句','名词谓语句','动态存在句','代副词','插说','语义指向','马氏文通','语法特点','特殊成分'
  ],
  'mc-pragmatics': [
    '修辞','修辞格','辞格','语用','语境','预设','言语行为','焦点','话题','话题链','比喻','借代','夸张','对偶','排比','移就','双关','仿词','委婉','比拟','反复','设问','反问','话语推进','衔接手段','连贯','信息结构','前提','修辞方式','语体'
  ],

  /* ---------- 古代汉语(王力本 通论) ---------- */
  'ac-intro': [
    '古代汉语','文言','古汉语','文言文','汉语史','古代汉语分期','文言与白话','学习古代汉语','古白话','白话','古代文化常识','文化常识','选拔','察举','征辟','语言史','古书常识','文献常识'
  ],
  'ac-tools': [
    '工具书','字典','词典','说文解字','说文','康熙字典','尔雅','广韵','辞源','辞海','经籍纂诂','经典释文','字书','注音方法','直音','读若','读如','部首','检字法','字典排列','部首排列','汉语大字典','助字辨略','词诠','古汉语虚词','类书','索引','扬雄','釋名','释名','重要著作','著作','书目','注本','图版','作者是谁'
  ],
  'ac-writing': [
    '甲骨文','金文','小篆','隶书','隶变','六书','古今字','异体字','繁简字','说文','字形','通假字','本字','大篆','籀文','会意','形声','指事','象形','转注','假借','偏旁','部首','亦声字','四体二用','正字','俗字','造字法','许慎','汉字形体','古文','篆书','楷书','字体','繁体','繁体字','简体','繁简转换','用字现象','通假','正体','声符','形声字','意符','字形演变'
  ],
  'ac-lexicon': [
    '本义','引申义','假借义','联绵词','古今词义','词义','词汇','同源词','复合词','单纯词','偏义复词','连绵词','重言词','同义连文','同义词辨析','单音词','复音词','古今词义的差别','词义的更替','词语的替换','古书词义','特指义','泛指义','词义引申','引申','古义','今义','多义词','词语解释','词义辨析','同源','系联','语源'
  ],
  'ac-grammar': [
    '词类活用','使动用法','意动用法','为动用法','判断句','被动句','宾语前置','双宾语','定语后置','状语后置','主谓倒装','省略句','句式','句法','语序','词类','虚词','代词','副词','介词','连词','助词','语气词','兼词','名词','动词','形容词','用作状语','用作动词','无定代词','指示代词','人称代词','疑问代词','否定副词','程度副词','范围副词','时间副词','发语词','特殊语法现象','特殊语法','语法现象','词类活用现象',
    '指代性副词','宾语前置','词类活用'
  ],
  'ac-phonology': [
    '音韵','音韵学','声母','韵母','声调','反切','韵书','平仄','三十六字母','等呼','阴阳','古音','上古音','中古音','近古音','入声','浊音清化','全浊','韵部','韵摄','声纽','对转','旁转','五音','七音','广韵','切韵','唐韵','集韵','平水韵','阳声韵','阴声韵','入声韵','四声','字母','聲類','钱大昕','古韵','鱼铎阳','破读','读破','如字','叶音','協音','古聲母','守温','韵图','等韵','双声','叠韵','被切字','声类','拗救','孤平','格律','古无舌上音','粘对','黏对','元音','辅音','发音部位'
  ],
  'ac-exegesis': [
    '训诂','训诂学','古注','注疏','传注','笺','疏','正义','章句','集解','互文','形训','声训','义训','读破','十三经注疏','经籍纂诂','脱文','衍文','浑言','析言','注釋體例','注解體例','古书注解','毛传','郑笺','孔疏',
    '校勘','注家','注音','注释','注解','训释','互训','递训','同训','声训','义训','形训','训诂术语','十三经','义疏','因声求义','乾嘉','注疏','章句','古书注音','評述','语源'
  ],
  'ac-punctuation': [
    '句读','标点','断句','加标点','标点并翻译','翻译成现代汉语','翻译','今译','古文今译','标点符号','句读翻译','古文的标点','语译','翻译下列'
  ]
};

/* 名词解释类术语补充: 真题里大量短术语题(如"内部曲折""义丛"),
   仅靠章节通用词无法命中, 按参考书归属补入。 */
const TERMS = {
  'ling-intro': ['生成性','语言符号的生成性','索绪尔','结构主义','转换生成','生成语法','韩礼德','叶尔姆斯列夫','萨丕尔','伍尔夫','应用语言学','普通语言学','社会语言学','心理语言学','共时语言学','历时语言学','语言中枢','语言理解','语言与思维','聋哑','语言和说话','语言流变','语言规划','语言结构分类','形式主义','功能主义','比较语言学','世界语','语言学流派','语言的本质','语言','言语','符号','交际工具','思维'],
  'ling-phonetics': ['音高','音长','音强','音质','发音体','乐音','噪音','尖团音','文白异读','平仄','拗救','孤平','韵律','声波','语音属性','语音','音位和音位变体','节律'],
  'ling-grammar': ['组合关系','聚合关系','递归性','开放性','内部曲折','内部屈折','语法范畴','情态','词缀','词尾','语素','转换分析','语法单位','语言的结构类型','孤立语','黏着语','屈折语','复综语','分析语','综合语','语法手段','语法形式','语法意义'],
  'ling-semantics': ['多义词','义丛','总分词','类义词','理性义','附加义','义素','语义场','词义关系','语义关系','隐喻','转喻','换喻','语义特征','语义指向'],
  'ling-pragmatics': ['言内意外','言外之意','会话','话轮','礼貌','语境','语用','语用策略','话题链','语体'],
  'ling-writing': ['文字和语言','书写符号','表音','表意','意音','文字类型','文字系统','文字','六书','汉字','自源文字','借源文字','语素文字','音素文字'],
  'ling-historical': ['语言替换','历史语言学','语系','语网','语支','意译词','音译词','演变规律','语言分化','社会方言','地域方言','亲属语言','谱系分类','语言接触','借词','类推','语法化','语言演变','语言发展','不平衡性','专业用语','行业语','全民语言'],
  'mc-intro': ['现代汉民族共同语','共同语','方言区','社会变体','语言规划','结构主义语法','现代汉语'],
  'mc-phonetics': ['音高','音长','音强','音质','清浊','逻辑重音','押韵','语音','节律','变读'],
  'mc-writing': ['造字方法','字符','同形字','四定','错别字','汉字','隶变','部件','繁简转换'],
  'mc-lexicon': ['义素','语义关系','语义场','同形词','构词方式','多义词','同音词'],
  'mc-grammar': ['语法功能','选择疑问句','是非问句','名词谓语句','动态存在句','代副词','插说','语义指向','马氏文通','代谓词','代名词','双宾语','疑问句','汉语语法学','句法成分','短语','复句'],
  'mc-pragmatics': ['语体','话轮','衔接','连贯','辞格','修辞格'],
  'ac-intro': ['乾嘉学派','小学','古代汉语','文言','古白话'],
  'ac-tools': ['类书','索引','尔雅','说文解字','方言','释名','扬雄'],
  'ac-phonology': ['古无舌上音','反切','韵部','平仄','双声','叠韵','全浊','拗救','孤平','格律'],
  'ac-exegesis': ['十三经','义疏','因声求义','声训','形训','义训','乾嘉','注疏','章句','校勘','脱文','衍文','训释','互训','递训','同训','系联'],
  'ac-grammar': ['指代性副词','宾语前置','词类活用','特殊语法现象','语法现象'],
  'ac-lexicon': ['特指义','泛指义','同义连文','偏义复词','同源词','引申义','本义','假借义']
};
Object.keys(TERMS).forEach(id => {
  if (!KEYWORDS[id]) KEYWORDS[id] = [];
  TERMS[id].forEach(t => { if (!KEYWORDS[id].includes(t)) KEYWORDS[id].push(t); });
});

/* 历史语言学优先判定词(第七/八/九章): 命中即归历史语言学,
   避免"语音的演变/语法的演变/词义的演变"被误分到语音/语法/语义 */
const HISTORICAL_PRIORITY = new RegExp([
  /* 第七章 语言演变与语言分化 */
  '演变', '演化', '分化', '语言的分化', '渐变性', '不平衡', '社会方言', '地域方言', '方言',
  '亲属语言', '亲属关系', '谱系', '语系', '语族', '语支', '语网', '原始基础语', '基础语', '原始语',
  '语言发展', '专业用语', '行业语',
  /* 第八章 语言的接触 */
  '语言接触', '社会接触', '借词', '音译词', '意译词', '仿译词', '仿造', '词汇借用', '语言联盟', '系统感染',
  '语言的替换', '语言替换', '语言底层', '语言融合', '语言消亡', '语言转用', '双重语言',
  '通用书面语', '标准语', '民族共同语', '混合语', '洋泾浜', '克里奥尔', '克里奥耳', '皮钦',
  /* 第九章 语言系统的演变 */
  '语音的演变', '语音演变规律', '历史比较', '语法的演变', '类推', '重新分析', '语法化',
  '词汇的演变', '词语替换', '词义的演变', '词义扩大', '词义缩小', '词义转移', '演变的规律'
].join('|'));

/* 现代汉语卷里混入的纯语言学考点(语系分类、语言接触等), 归历史语言学 */
const LINGUISTIC_ONLY = /语系|语族|语支|语网|亲属语言|亲属关系|谱系分类|语言接触|借词|音译词|意译词|仿译词|洋泾浜|克里奥尔|混合语|语言转用|语言融合|语言替换|原始印欧语|拉丁语/;

/* 古代汉语特征词: 出现即强烈提示该题属古代汉语 */
const CLASSICAL_TERMS = new RegExp([
  '标点', '标點', '句读', '句讀', '断句', '斷句', '今译', '今譯', '翻译', '翻譯', '加标点', '加標點',
  '加点', '加點', '加框', '划线', '劃線', '繁体', '繁體', '繁简', '繁簡', '异体字', '異體字', '古今字', '通假字', '假借字', '通假', '本字',
  '训诂', '訓詁', '古注', '注疏', '传注', '傳注', '章句', '正义', '正義', '笺注', '箋', '疏证', '疏證', '校勘', '脱文', '脫文', '衍文', '如字', '读破', '讀破', '声训', '聲訓', '形训', '形訓', '义训', '義訓',
  '反切', '韵书', '韻書', '平仄', '声纽', '聲紐', '三十六字母', '上古音', '中古音', '入声', '入聲', '全浊', '全濁', '浊音清化', '濁音清化', '叶音', '古音', '韵部', '韻部', '古韵', '古韻',
  '词类活用', '詞類活用', '使动用法', '使動用法', '意动用法', '意動用法', '为动用法', '為動用法', '判断句', '判斷句', '宾语前置', '賓語前置', '双宾语', '雙賓語', '定语后置', '定語後置',
  '说文', '說文', '尔雅', '爾雅', '广韵', '廣韻', '切韵', '切韻', '毛传', '毛傳', '郑笺', '鄭箋', '孔疏', '十三经', '十三經', '联绵词', '聯綿詞', '连绵词', '連綿詞', '偏义复词', '偏義複詞', '同义连文', '同義連文',
  '字词题', '字詞題', '文言', '古白话', '古白話', '古代汉语', '古代漢語', '汉语史', '漢語史', '拗救', '孤平', '格律',
  /* 古汉通论常见考点(用于区分混合卷里的古今归属) */
  '古书', '古書', '工具书', '工具書', '集解', '注解', '註解', '部首', '形声', '形聲', '声符', '聲符', '读若', '讀若', '读如', '讀如',
  '被切字', '康熙字典', '辞源', '辭源', '粘对', '粘對', '黏对', '上古', '中古', '近古', '单音词', '複音詞', '复音词', '古今词义', '古今詞義',
  '双声', '雙聲', '叠韵', '疊韻', '读作', '讀作', '释作', '釋作', '义为', '義為', '義爲',
  '的含义', '的含義', '的意義',
  /* 古代文献: 出现在题干里基本可以断定是古代汉语题 */
  '庄子', '莊子', '诗经', '詩經', '左传', '左傳', '史记', '史記', '孟子', '论语', '論語', '荀子', '韩非子', '韓非子',
  '战国策', '戰國策', '楚辞', '楚辭', '尚书', '尚書', '周易', '礼记', '禮記', '汉书', '漢書', '后汉书', '後漢書'
].join('|'));

/* 古文虚词: 用于估算一段文字的古汉语倾向 */
const CLASSICAL_MARKERS = ['曰','之','其','者','也','而','以','于','於','则','則','矣','乎','焉','哉','夫','为','為','与','與','耳','邪','耶'];

/* ===== 文本处理工具 ===== */

/* 繁简对照: 南师大早期真题多用繁體(如 2009-2012 年卷), 而关键词用简体。
   匹配前统一转简体; 仅用于内部匹配, 不改动展示文本。 */
const TRAD_TO_SIMP = {
  '聲':'声','韻':'韵','調':'调','讀':'读','語':'语','詞':'词','義':'义','體':'体','釋':'释','註':'注','詁':'诂','訓':'训','彙':'汇','標':'标','譯':'译','說':'说','論':'论','記':'记','傳':'传','經':'经','書':'书','學':'学','漢':'汉','問':'问','題':'题','響':'响','發':'发','聽':'听','覺':'觉','寫':'写','歸':'归','來':'来','時':'时','後':'后','進':'进','還':'还','樣':'样','頭':'头','點':'点','幾':'几','無':'无','異':'异','齊':'齐','節':'节','給':'给','結':'结','絕':'绝','強':'强','長':'长','當':'当','圖':'图','據':'据','處':'处','備':'备','戰':'战','單':'单','嚴':'严','風':'风','飛':'飞','養':'养','齒':'齿','龍':'龙','龜':'龟','馬':'马','車':'车','鳥':'鸟','魚':'鱼','東':'东','盡':'尽','舊':'旧','舉':'举','難':'难','觀':'观','樂':'乐','萬':'万','畫':'画','劃':'划','術':'术','復':'复','於':'于','並':'并','讓':'让','愛':'爱','國':'国','內':'内','兩':'两','習':'习','驗':'验','價':'价','資':'资','質':'质','農':'农','識':'识','誤':'误','誌':'志','認':'认','誠':'诚','課':'课','談':'谈','請':'请','誰':'谁','講':'讲','謝':'谢','議':'议','護':'护','邊':'边','鄉':'乡','醫':'医','鐘':'钟','鑄':'铸','門':'门','閉':'闭','開':'开','間':'间','關':'关','陽':'阳','陰':'阴','陳':'陈','隨':'随','雖':'虽','雙':'双','雲':'云','電':'电','靈':'灵','靜':'静','韓':'韩','頁':'页','順':'顺','須':'须','預':'预','領':'领','飄':'飘','餘':'余','館':'馆','駕':'驾','騎':'骑','髮':'发','鬥':'斗','魯':'鲁','鮮':'鲜','鳴':'鸣','鴻':'鸿','鵲':'鹊','麗':'丽','黃':'黄','實':'实','寶':'宝','導':'导','將':'将','專':'专','監':'监','蓋':'盖','虛':'虚','謂':'谓','號':'号','蟲':'虫','製':'制','複':'复','規':'规','親':'亲','計':'计','討':'讨','許':'许','詩':'诗','詳':'详','誦':'诵','諺':'谚','讚':'赞','賀':'贺','負':'负','財':'财','責':'责','貴':'贵','買':'买','費':'费','賓':'宾','賣':'卖','購':'购','贈':'赠','趕':'赶','趙':'赵','趨':'趋','跡':'迹','踐':'践','蹤':'踪','軍':'军','較':'较','載':'载','輔':'辅','輕':'轻','輪':'轮','轟':'轰','迴':'回','連':'连','週':'周','遊':'游','運':'运','過':'过','達':'达','違':'违','遠':'远','適':'适','選':'选','遺':'遗','邏':'逻','鄰':'邻','鑑':'鉴','閱':'阅','陣':'阵','陸':'陆','階':'阶','險':'险','隱':'隐','雜':'杂','願':'愿','顧':'顾','顯':'显','飲':'饮','飾':'饰','驚':'惊','齡':'龄','黽':'黾','黨':'党','麥':'卖',
  '說':'说','隸':'隶','籀':'籀','轉':'转','會':'会','指':'指','象':'象','許':'许','慎':'慎','載':'载','箋':'笺','闕':'阙','濁':'浊','紐':'纽','攝':'摄','溫':'温','錢':'钱','駿':'骏','這':'这','們':'们','個':'个','應':'应','該':'该','現':'现','見':'见','對':'对','產':'产','種':'种','麼':'么','沒':'没','圓':'圆','説':'说','脫':'脱','衍':'衍','渾':'浑','析':'析','俗':'俗','綴':'缀','場':'场','粧':'妆','層':'层','歧':'歧','區':'区','嘆':'叹','擬':'拟','預':'预','設':'设','焦':'焦','銜':'衔','貫':'贯','構':'构','聖':'圣','臘':'腊','崇':'崇','隻':'只',
  /* —— 说文/小学类专名 —— */
  '楷':'楷','篆':'篆','亦':'亦','假':'假','借':'借','偏':'偏','旁':'旁','部':'部','首':'首','形':'形','意':'意','段':'段','玉':'玉','裁':'裁',
  /* —— 古汉语通论常见 —— */
  '疏':'疏','正':'正','章':'章','句':'句','集':'集','解':'解','破':'破','古':'古','今':'今','字':'字','等':'等','呼':'呼','四':'四','五':'五','七':'七','音':'音','母':'母','守':'守','昕':'昕','炎':'炎','武':'武','第':'第','朱':'朱',
  /* —— 现代汉语/语言学题干常见 —— */
  '發':'发','值':'值','位':'位','變':'变','兒':'儿','輕':'轻','送':'送','氣':'气','塞':'塞','擦':'擦','鼻':'鼻','邊':'边','碼':'码','隔':'隔','符':'符','號':'号','筆':'笔','畫':'画','順':'顺','簡':'简','範':'范','件':'件','素':'素','綴':'缀','根':'根','合':'合','並':'并','略':'略','稱':'称','縮':'缩','行':'行','業':'业','場':'场','色':'色','彩':'彩','類':'类','型':'型','單':'单','複':'复','聯':'联','獨':'独','立':'立','次':'次','成':'成','分':'分','歧':'歧','區':'区','别':'别','兼':'兼','謂':'谓','數':'数','代':'代','副':'副','介':'介','助':'助','嘆':'叹','擬':'拟','序':'序','設':'设','點':'点','話':'话','言':'言','內':'内','外':'外','會':'会','準':'准','則':'则','禮':'礼','貌':'貌','原':'原','含':'含','蓄':'蓄','銜':'衔','接':'接','貫':'贯','信':'信','息':'息',
  /* —— 文字/字体 —— */
  '楔':'楔','聖':'圣','自':'自','源':'源','他':'他','播':'播','展':'展','統':'统','系':'系','表':'表','拼':'拼','拉':'拉','丁':'丁','希':'希',
  /* —— 补充: 早年真题(2009-2012)卷面常用字 —— */
  '疊':'叠','綿':'绵','辭':'辞','確':'确','諱':'讳','諡':'谥','藥':'药','驟':'骤','厭':'厌','繫':'系','繕':'缮','鎧':'铠','補':'补','訪':'访','詠':'咏','誼':'谊','謀':'谋','諸':'诸','譽':'誉','訛':'讹','訴':'诉','評':'评','試':'试','誇':'夸','誅':'诛','訂':'订','訊':'讯','診':'诊','詔':'诏','詰':'诘','諒':'谅','諷':'讽','諫':'谏','諧':'谐','誨':'诲','諭':'谕','辯':'辩','遞':'递','遲':'迟','鄭':'郑','鐵':'铁','飯':'饭','餅':'饼','軸':'轴','輩':'辈','輝':'辉','輸':'输','躍':'跃','總':'总','優':'优','繩':'绳','驥':'骥','馳':'驰','驅':'驱','檢':'检','權':'权','獲':'获','獵':'猎','獻':'献','獄':'狱','獸':'兽','環':'环','畢':'毕','盤':'盘','矯':'矫','礎':'础','祿':'禄','禍':'祸','積':'积','窮':'穷','竊':'窃','筍':'笋','篤':'笃','籌':'筹','紀':'纪','純':'纯','紙':'纸','細':'细','終':'终','組':'组','絲':'丝','綁':'绑','緣':'缘','編':'编','緩':'缓','練':'练','縣':'县','織':'织','繼':'继','續':'续','纓':'缨','纔':'才','罰':'罚','羅':'罗','聰':'聪','職':'职','肅':'肃','脹':'胀','腦':'脑','腳':'脚','腸':'肠','膚':'肤','膠':'胶','臉':'脸','臨':'临','臺':'台','葉':'叶','華':'华','莖':'茎','莊':'庄','蕭':'萧','薦':'荐','藝':'艺','蘇':'苏','蘭':'兰','虧':'亏','虜':'虏','衛':'卫','衝':'冲','裝':'装','裏':'里','爲':'为','視':'视','觸':'触','託':'托','訖':'讫','誌':'志','認':'认','該':'该','謎':'谜','謗':'谤','謠':'谣','謬':'谬','譁':'哗','證':'证','譜':'谱','豐':'丰','豔':'艳','貢':'贡','貧':'贫','貨':'货','販':'贩','貼':'贴','賊':'贼','賈':'贾','賦':'赋','賞':'赏','賢':'贤','賤':'贱','賴':'赖','贏':'赢','贛':'赣','軒':'轩','轍':'辙','醜':'丑','醞':'酝','針':'针','釘':'钉','釣':'钓','鈔':'钞','鈴':'铃','鉞':'钺','銀':'银','銅':'铜','銘':'铭','銳':'锐','銷':'销','鋤':'锄','鋒':'锋','鋪':'铺','錄':'录','錘':'锤','錦':'锦','錫':'锡','錮':'锢','鍵':'键','鍾':'钟','鎖':'锁','鎮':'镇','鏈':'链','鏡':'镜','閏':'闰','閑':'闲','閘':'闸','閡':'阂','閣':'阁','閥':'阀','閨':'闺','閻':'阎','闊':'阔','闌':'阑','闔':'阖','闡':'阐','闢':'辟','陞':'升','隊':'队','際':'际','雛':'雏','雞':'鸡','離':'离','霧':'雾','頂':'顶','頃':'顷','頑':'顽','頒':'颁','頗':'颇','頡':'颉','顆':'颗','額':'额','顏':'颜','顛':'颠','颯':'飒','飢':'饥','飪':'饪','飽':'饱','飼':'饲','餌':'饵','餒':'馁','餞':'饯','餚':'肴','餛':'馄','餓':'饿','餵':'喂','餾':'馏','饅':'馒','饒':'饶','饑':'饥','馭':'驭','馮':'冯','馴':'驯','駁':'驳','駐':'驻','駛':'驶','駝':'驼','駭':'骇','騙':'骗','騁':'骋','騖':'骛','騰':'腾','騷':'骚','驕':'骄','髒':'脏','鬆':'松','鬍':'胡','鬧':'闹','鬱':'郁','鯉':'鲤','鯨':'鲸','鰥':'鳏','鴉':'鸦','鴕':'鸵','鴨':'鸭','鵑':'鹃','鵝':'鹅','鷹':'鹰','鸞':'鸾','黴':'霉','龐':'庞'
};

/* 繁简映射里夹了不少"繁简同形"的占位项(如 '古':'古'), 统计繁体字数量时要把它们排除 */
const TRAD_ONLY = Object.keys(TRAD_TO_SIMP).filter(k => TRAD_TO_SIMP[k] !== k);

/* 含繁体字才做转换, 避免无谓遍历 */
const TRAD_RE = new RegExp('[' + TRAD_ONLY.join('') + ']');
const TRAD_RE_G = new RegExp('[' + TRAD_ONLY.join('') + ']', 'g');

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

/* 题型标题(如"四、名詞解釋（每小題4分）")里的题型词描述的是题型而非考点,
   参与关键词匹配会把所有题都拉向"语法""文字"等, 故匹配前只剥掉"序号 + 题型词",
   保留标题行其余内容(如"分析下列多重复句的层次和关系"里的"多重复句")。 */
const TYPE_HEADER_RE = /^\s*[一二三四五六七八九十百\d]+\s*[、.．,，)）]/;
const TYPE_WORD_RE = /(名詞解釋|名词解释|術語解釋|术语解释|填空題|填空题|填空|簡答題|简答题|簡答|简答|論述題|论述题|論述|论述|分析操作題|分析操作|分析題|分析题|分析|解釋題|解释题|解釋|解释|單項選擇題|单项选择题|單項選擇|單选|單選|多項選擇題|多選題|多选|判斷題|判断题|判斷|判断|操作分析題|操作題|操作题|操作|標點題|標點|标点|翻譯題|翻譯|翻译|作文題|作文|改錯題|改錯|改错|問答題|问答题|問答|问答|舉例題|舉例|举例|字詞題|字词题|常識填空題|常識|常识填空|按要求回答问题|根据材料)/g;

function topicText(stem) {
  const lines = matchText(stem).split('\n');
  if (lines.length && TYPE_HEADER_RE.test(lines[0])) {
    lines[0] = lines[0].replace(TYPE_HEADER_RE, '').replace(TYPE_WORD_RE, '');
  }
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

/* 古汉语倾向打分: 特征词 + 虚词密度 + 古文长句 */
function classicalScore(stem) {
  const raw = stripOptions(stem) || '';
  const text = toSimplified(raw).replace(/\s/g, '');
  let score = 0;
  if (CLASSICAL_TERMS.test(text)) score += 4;
  let hits = 0;
  CLASSICAL_MARKERS.forEach(m => { if (text.includes(m)) hits += 1; });
  if (hits >= 4) score += 2;
  if (hits >= 6) score += 2;
  if (text.length >= 30 && hits >= 3) score += 2;
  /* 古文引文: 含书名号 + 引号内的文言句 */
  if (/《[^》]{2,}》/.test(text) && hits >= 3) score += 2;
  /* 大量繁体字(古汉卷面特征) */
  const tradCount = (raw.match(TRAD_RE_G) || []).length;
  if (tradCount >= 4) score += 1;
  return score;
}

function looksClassical(stem) {
  return classicalScore(stem) >= 4;
}

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

/* 古代汉语按题型/题干特征直接路由 */
const AC_ROUTES = [
  [/繁体|繁體|繁简|繁簡|异体字|異體字|古今字|通假字|假借字|本字/, 'ac-writing'],
  [/标点|標點|句读|句讀|断句|斷句|今译|今譯|翻译|翻譯|语译|語譯/, 'ac-punctuation'],
  [/字词题|字詞題|加点|加點|加框|划线|劃線|解释下列|解釋下列|词语解释|詞語解釋|特指义|特指義|泛指义|泛指義|的意思是|的含义|的含義|的意義|意義是|釋作|释作|應釋為|可解释为|正确的解释|正確的解釋|的用法是|是指（）|读音是|读作|讀作|义为|義為|義爲/, 'ac-lexicon'],
  [/词类活用|詞類活用|使动用法|使動用法|意动用法|意動用法|为动用法|為動用法|宾语前置|賓語前置|判断句|判斷句|被动句|被動句|双宾语|雙賓語|特殊语法|特殊語法|语法现象|語法現象/, 'ac-grammar'],
  [/反切|韵书|韻書|平仄|三十六字母|全浊|全濁|浊音清化|濁音清化|叶音|广韵|廣韻|切韵|切韻|声训|聲訓|拗救|孤平|格律|上古音|中古音|入声|入聲|被切字|粘对|粘對|黏对|古韵|古韻|韵部|韻部|双声|雙聲|叠韵|疊韻/, 'ac-phonology'],
  [/训诂|訓詁|古注|注疏|传注|傳注|章句|正义|正義|笺|箋|疏证|疏證|校勘|脱文|脫文|衍文|如字|读破|讀破|互训|互訓|递训|遞訓|同训|同訓|义训|義訓|形训|形訓|训释|訓釋|注释|注釋|注解|注家/, 'ac-exegesis']
];

function routeAncientChinese(stem) {
  const text = matchText(stem);
  for (const [re, id] of AC_ROUTES) {
    if (re.test(text)) return id;
  }
  return null;
}

/* 古文断句/翻译题识别: 虚词密度高或题干含标点翻译要求 */
function looksLikeClassicalPassage(stem) {
  const text = matchText(stem).replace(/\s/g, '');
  if (!text) return false;
  if (/标点|標點|句读|句讀|断句|斷句|今译|今譯|古文今译|加标点|加標點/.test(text)) return true;
  if (text.length < 40) return false;
  let hits = 0;
  CLASSICAL_MARKERS.forEach(m => { if (text.includes(m)) hits += 1; });
  return hits >= 8;
}

/* 关键词打分, 在给定章节集合内选出最匹配的学科章节
   (英文关键词不区分大小写; 命中关键词越长, 说明越具体, 权重越高) */
function scoreIds(text, candidateIds) {
  let best = null;
  let bestScore = 0;
  candidateIds.forEach(id => {
    const kws = KEYWORDS[id] || [];
    let score = 0;
    kws.forEach(k => {
      if (text.includes(k.toLowerCase())) score += Math.min(3, Math.max(1, Math.round(k.length / 2)));
    });
    if (score > bestScore) { bestScore = score; best = id; }
  });
  return { id: best, score: bestScore };
}

function classify(stem, candidateIds) {
  return scoreIds(topicText(stem).toLowerCase(), candidateIds);
}

/* 题干本身没有考点词时(考点只出现在选项里, 如"这属于（）/A.仿译词…"),
   再带上选项匹配一次 */
function classifyWithOptions(q, candidateIds) {
  const opts = (q.stem || '')
    .split('\n')
    .filter(l => /^\s*[A-EＡ-Ｅ][\.、．）)]/.test(l))
    .join('\n');
  if (!opts) return { id: null, score: 0 };
  const text = topicText(q.stem).toLowerCase() + '\n' + toSimplified(opts).toLowerCase();
  return scoreIds(text, candidateIds);
}

/* 混合卷按卷面分块: 汉语综合(现代汉语+古代汉语)这类卷子把两科分块排列,
   每块都从"一、××题"重新起头、题号也从 1 重新编号, 据此切分最可靠;
   而"语言学与古代汉语"早年卷把两科题目交叉排在同一个大题里, 分块不成立,
   这种卷子改用逐题判定。 */
const SECTION_HEAD_RE = /^\s*一\s*[、.．,，)）]/;
const ITEM_ONE_RE = /^\s*1\s*[.．、,，)）]/;

function splitSections(questions) {
  const starts = [];
  questions.forEach((q, i) => {
    const lines = (q.stem || '').split('\n');
    const head = lines[0] || '';
    const item = lines[1] || '';
    if (SECTION_HEAD_RE.test(head) && (i === 0 || ITEM_ONE_RE.test(item))) starts.push(i);
  });
  if (starts.length !== 2) return null;
  const bounds = starts.slice(1).concat([questions.length]);
  return starts.map((s, i) => questions.slice(s, bounds[i]));
}

/* 逐题判定是否属于古代汉语: 古汉特征词命中, 或"古代汉语考点"比"另一科考点"更匹配。
   分块判定整段归属时允许用题型路由(单题看走眼不影响整段), 逐题判定时不用,
   免得语言学卷里的"…的意思是（）"被拉去古代汉语。 */
function votesClassical(q, acIds, otherIds, useRoutes) {
  if (classicalScore(q.stem) >= 4) return true;
  if (looksLikeClassicalPassage(q.stem)) return true;
  if (useRoutes && routeAncientChinese(q.stem)) return true;
  const a = Math.max(classify(q.stem, acIds).score, classifyWithOptions(q, acIds).score);
  if (!a) return false;
  const o = Math.max(classify(q.stem, otherIds).score, classifyWithOptions(q, otherIds).score);
  return a > o;
}

/* 返回每道题所属学科大类; 分块不干净时返回 null, 由调用方逐题判定 */
function mapAreasBySection(questions, areas, idsByArea) {
  const sections = splitSections(questions);
  if (!sections) return null;
  const otherArea = areas.filter(a => a !== 'ac')[0] || 'ling';
  const acIds = idsByArea.ac;
  const otherIds = idsByArea[otherArea];
  const ratios = sections.map(sec => {
    if (!sec.length) return 0;
    return sec.filter(q => votesClassical(q, acIds, otherIds, true)).length / sec.length;
  });
  const hi = ratios[0] >= ratios[1] ? 0 : 1;
  const lo = hi === 0 ? 1 : 0;
  if (!(ratios[hi] >= 0.5 && ratios[lo] <= 0.2)) return null;
  const map = [];
  sections.forEach((sec, i) => {
    const a = (i === hi) ? 'ac' : otherArea;
    sec.forEach(() => map.push(a));
  });
  return map;
}

function main() {
  const cats = JSON.parse(fs.readFileSync(path.join(root, 'data', 'categories.json'), 'utf8'));

  // 拆出 学科分类 与 真题分类
  // 规则(与侧边栏一致): 三级分类(年份->试卷)=真题卷; 二级分类(学科->章节)=学科
  const subjectChapters = [];   // 学科章节(完整/严选视图)
  const paperChapters = [];     // 试卷章节(真题视图)
  const subjectChapterIdsByArea = { ling: [], mc: [], ac: [] };

  const isPaperCategory = (cat) => cat.type === 'papers' || (cat.children || []).some(ch => ch.children && ch.children.length);

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
  paperChapters.forEach(p => { p.chapterName = p.name; p.areas = areasOfPaper(p.name); });

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

  // 2) 试卷文件里的题目
  paperChapters.forEach(p => {
    const data = fileData[p.id];
    if (!data) return;
    const areas = p.areas;
    const single = areas.length === 1;

    /* 混合卷: 先按卷面分块判定古今归属(这是最可靠的分科依据) */
    const areaByIndex = single ? null : mapAreasBySection(data.questions, areas, subjectChapterIdsByArea);

    (data.questions || []).forEach((q, qi) => {
      // 显式指定优先
      if (q.subject && buckets[q.subject] !== undefined) {
        pushQuestion(q, q.subject, p);
        return;
      }

      // 该题所属学科大类: 单科卷=卷面科目; 混合卷=分块结果; 分块失败则逐题判定
      const nonAc = areas.filter(a => a !== 'ac')[0] || 'ling';
      let area;
      if (single) {
        area = areas[0];
      } else if (areaByIndex) {
        area = areaByIndex[qi] || areas[0];
      } else {
        area = votesClassical(q, subjectChapterIdsByArea.ac, subjectChapterIdsByArea[nonAc]) ? 'ac' : nonAc;
      }

      const candidates = subjectChapterIdsByArea[area] || [];
      if (!candidates.length) { unclassified.push({ paper: p.id, qid: q.id, stem: q.stem || '' }); return; }

      // 古代汉语: 先按题型/题干特征路由(标点翻译 / 解释词语 / 音韵 / 训诂 ...)
      if (area === 'ac') {
        const byRoute = routeAncientChinese(q.stem);
        if (byRoute) { pushQuestion(q, byRoute, p); return; }
        if (looksLikeClassicalPassage(q.stem)) { pushQuestion(q, 'ac-punctuation', p); return; }
      }

      // 语言学: 语言演变与语言分化 / 语言的接触 / 语言系统的演变
      // (纲要第七、八、九章) -> 历史语言学, 优先于语音/语法/语义
      if (area === 'ling' && HISTORICAL_PRIORITY.test(matchText(q.stem))) {
        pushQuestion(q, 'ling-historical', p);
        return;
      }
      // 现代汉语卷里出现的纯语言学考点(语系、借词、亲属语言等)同样归历史语言学
      if (area === 'mc' && LINGUISTIC_ONLY.test(matchText(q.stem))) {
        pushQuestion(q, 'ling-historical', p);
        return;
      }
      // "【人】【男性】【成年】【未婚】是…的____" 是典型的义素分析题型
      if (area === 'ling' && (topicText(q.stem).match(/【[^】]*】/g) || []).length >= 3) {
        pushQuestion(q, 'ling-semantics', p);
        return;
      }

      let hit = classify(q.stem, candidates);
      if (!hit.id || !hit.score) hit = classifyWithOptions(q, candidates);
      if (hit.id && hit.score > 0) {
        pushQuestion(q, hit.id, p);
        return;
      }

      // 汉语综合卷的现代汉语段里仍会出现语言学理论题: 类内无命中时再试语言学
      if (area === 'mc' && areas.includes('ac')) {
        let lingHit = classify(q.stem, subjectChapterIdsByArea.ling);
        if (!lingHit.id || !lingHit.score) lingHit = classifyWithOptions(q, subjectChapterIdsByArea.ling);
        if (lingHit.id && lingHit.score > 0) { pushQuestion(q, lingHit.id, p); return; }
      }

      // 类内无法细分时, 归入该大类的"概论/绪论"
      pushQuestion(q, { ling: 'ling-intro', mc: 'mc-intro', ac: 'ac-intro' }[area], p);
      unclassified.push({ paper: p.id, qid: q.id, stem: q.stem || '' });
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
  if (process.env.DUMP) {
    unclassified.forEach((u, i) => {
      console.log(`  [${i + 1}] ${u.paper} | ` + (u.stem || '').replace(/\n/g, ' / ').slice(0, 100));
    });
  }
  console.log('\n  各学科题量:');
  subjectChapters.forEach(s => {
    const t = subjects[s.id].total;
    if (t > 0) console.log(`    ${s.catName} / ${s.group ? s.group + ' / ' : ''}${s.name}  ->  ${t} 题 (严选 ${subjects[s.id].curatedIds.length})`);
  });
}

main();
