/* data-loader.js - 加载分类与题库数据 */
const DataLoader = {
  _categories: null,
  _questionCache: {},

  async loadCategories() {
    if (this._categories) return this._categories;
    try {
      const res = await fetch('data/categories.json?v=3');
      this._categories = await res.json();
      return this._categories;
    } catch (e) {
      console.error('加载分类失败:', e);
      return { categories: [] };
    }
  },

  async loadQuestions(chapterId) {
    if (this._questionCache[chapterId]) return this._questionCache[chapterId];
    try {
      const res = await fetch(`data/questions/${chapterId}.json?v=3`);
      if (!res.ok) {
        // 找不到文件时返回空
        return { chapterId, chapterName: '', questions: [] };
      }
      const data = await res.json();
      this._questionCache[chapterId] = data;
      return data;
    } catch (e) {
      console.error(`加载题目失败 (${chapterId}):`, e);
      return { chapterId, chapterName: '', questions: [] };
    }
  },

  /* 获取所有章节的平铺列表（支持三级分类） */
  async getAllChapters() {
    const cats = await this.loadCategories();
    const chapters = [];
    cats.categories.forEach(cat => {
      (cat.children || []).forEach(child => {
        if (child.children) {
          // 三级分类: 年份 -> 试卷
          child.children.forEach(sub => {
            chapters.push({ ...sub, parentId: cat.id, parentName: `${cat.name} · ${child.name}`, yearId: child.id });
          });
        } else {
          chapters.push({ ...child, parentId: cat.id, parentName: cat.name });
        }
      });
    });
    return chapters;
  },

  /* 获取分类信息 */
  async getCategory(categoryId) {
    const cats = await this.loadCategories();
    return cats.categories.find(c => c.id === categoryId);
  },

  /* 获取某分类下所有章节ID（支持三级分类） */
  getCategoryChapterIds(categoryId) {
    const cat = this._categories?.categories.find(c => c.id === categoryId);
    if (!cat) return [];
    const ids = [];
    (cat.children || []).forEach(child => {
      if (child.children) {
        child.children.forEach(sub => ids.push(sub.id));
      } else {
        ids.push(child.id);
      }
    });
    return ids;
  },

  /* 获取章节信息 */
  async getChapter(chapterId) {
    const chapters = await this.getAllChapters();
    return chapters.find(c => c.id === chapterId);
  },

  /* 获取所有题目（用于掌握地图等） */
  async getAllQuestions() {
    const chapters = await this.getAllChapters();
    const all = [];
    for (const ch of chapters) {
      const data = await this.loadQuestions(ch.id);
      data.questions.forEach(q => {
        all.push({ ...q, chapterId: ch.id, chapterName: ch.name, parentName: ch.parentName });
      });
    }
    return all;
  },

  /* 查找题目 */
  findQuestion(questions, questionId) {
    return questions.find(q => q.id === questionId);
  },

  /* ===== 题库三分类:完整 / 严选 / 真题 ===== */

  /* 从题目来源中提取年份 (如 "2013年南师大611真题" -> 2013) */
  getQuestionYear(q) {
    const m = (q.source || '').match(/(19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : null;
  },

  /* 是否为真题 */
  isPastQuestion(q) {
    return !!(q.source && q.source.includes('真题'));
  },

  /* 提取题目的核心考点文本(用于高频统计)
     归一化:仅保留中文、字母、数字,并去掉开头的序号 */
  extractKeyPoint(stem) {
    if (!stem) return '';
    const lines = stem.split('\n').map(s => s.trim()).filter(Boolean);
    let last = lines[lines.length - 1] || '';
    last = last.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
    last = last.replace(/^[0-9]+/, '');
    return last;
  },

  /* 统计核心考点跨年份出现频次 */
  buildFrequency(questions) {
    const freq = {};
    const yearsByKey = {};
    questions.forEach(q => {
      const key = this.extractKeyPoint(q.stem);
      if (key.length < 2) return;
      freq[key] = (freq[key] || 0) + 1;
      if (!yearsByKey[key]) yearsByKey[key] = new Set();
      const y = this.getQuestionYear(q);
      if (y) yearsByKey[key].add(y);
    });
    const out = {};
    Object.keys(freq).forEach(k => {
      out[k] = { count: freq[k], years: yearsByKey[k] ? yearsByKey[k].size : 0 };
    });
    return out;
  },

  /* 单题是否为严选题目
     规则(可被题目内 curated 字段覆盖):
     1. curated === true  -> 严选
     2. curated === false -> 不进入严选
     3. 自动判定:含答案或解析(优质题) 或 考点跨≥2年出现(考频高) */
  isCurated(q, freq) {
    if (q.curated === true) return true;
    if (q.curated === false) return false;
    if ((q.analysis && q.analysis.trim()) || (q.answer && q.answer.trim())) return true;
    if (freq) {
      const key = this.extractKeyPoint(q.stem);
      const info = freq[key];
      if (info && info.years >= 2) return true;
    }
    return false;
  },

  /* 按范围过滤题目
     scope: all(完整) | curated(严选) | past(真题) */
  filterByScope(questions, scope, freq) {
    if (scope === 'curated') return questions.filter(q => this.isCurated(q, freq));
    if (scope === 'past') return questions.filter(q => this.isPastQuestion(q));
    return questions;
  },

  /* 将真题按年份分组,返回 [{year, questions}] 年份倒序 */
  groupByYear(questions) {
    const map = {};
    questions.forEach(q => {
      const y = this.getQuestionYear(q) || 0;
      if (!map[y]) map[y] = [];
      map[y].push(q);
    });
    return Object.keys(map)
      .map(y => ({ year: parseInt(y, 10), questions: map[y] }))
      .sort((a, b) => b.year - a.year);
  }
};
