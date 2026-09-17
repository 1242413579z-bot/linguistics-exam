/* data-loader.js - 加载分类与题库数据 */
const DataLoader = {
  _categories: null,
  _questionCache: {},
  _bank: null,
  _subjectCache: {},

  async loadCategories() {
    if (this._categories) return this._categories;
    try {
      const res = await fetch('data/categories.json?v=12');
      this._categories = await res.json();
      return this._categories;
    } catch (e) {
      console.error('加载分类失败:', e);
      return { categories: [] };
    }
  },

  async loadQuestions(chapterId) {
    if (this._questionCache[chapterId]) return this._questionCache[chapterId];
    let result;
    try {
      const res = await fetch(`data/questions/${chapterId}.json?v=12`);
      if (!res.ok) {
        // 题目文件尚未录入(分类里已有该章节, 但还没有题库文件)
        result = { chapterId, chapterName: '', questions: [], missing: true };
      } else {
        result = await res.json();
      }
    } catch (e) {
      console.error(`加载题目失败 (${chapterId}):`, e);
      result = { chapterId, chapterName: '', questions: [], missing: true };
    }
    // 缓存(含未录入的情况), 避免重复请求
    this._questionCache[chapterId] = result;
    return result;
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

  /* 获取所有题目（用于智能组卷等） */
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

  /* ===== 题目总索引(question-bank.json) ===== */
  async loadBank() {
    if (this._bank) return this._bank;
    try {
      const res = await fetch('data/question-bank.json?v=12');
      this._bank = res.ok ? await res.json() : { subjects: {}, papers: {}, curated: {}, chapterTotals: {}, chapterQuestionIds: {} };
    } catch (e) {
      console.error('加载题目总索引失败:', e);
      this._bank = { subjects: {}, papers: {}, curated: {}, chapterTotals: {}, chapterQuestionIds: {} };
    }
    return this._bank;
  },

  /* 某学科章节的题目明细(按需加载, 单独文件) */
  async loadSubjectQuestions(subjectId) {
    if (this._subjectCache[subjectId]) return this._subjectCache[subjectId];
    try {
      const res = await fetch(`data/subjects/${subjectId}.json?v=12`);
      if (!res.ok) {
        this._subjectCache[subjectId] = { questions: [] };
      } else {
        this._subjectCache[subjectId] = await res.json();
      }
    } catch (e) {
      console.error(`加载学科题目失败 (${subjectId}):`, e);
      this._subjectCache[subjectId] = { questions: [] };
    }
    return this._subjectCache[subjectId];
  },

  /* 是否学科章节(完整/严选视图) */
  async isSubjectChapter(chapterId) {
    const bank = await this.loadBank();
    return !!bank.subjects[chapterId];
  },

  /* 学科/试卷的严选题目 ID 集合 */
  async getCuratedSet(chapterId) {
    const bank = await this.loadBank();
    return new Set((bank.curated && bank.curated[chapterId]) || []);
  },

  /* 各章题目总数(学科 + 试卷) */
  async getChapterTotals() {
    const bank = await this.loadBank();
    return bank.chapterTotals || {};
  },

  /* 各章题目 ID 列表(学科 + 试卷) */
  async getChapterQuestionIds() {
    const bank = await this.loadBank();
    return bank.chapterQuestionIds || {};
  },

  /* ===== 题库三分类:完整 / 严选 / 真题 ===== */

  /* 从题目来源中提取年份 (如 "2013年南师大611真题" -> 2013) */
  getQuestionYear(q) {
    const m = (q.source || '').match(/(19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : null;
  },

  /* 是否为真题(来源标注真题, 或经学科聚合时带 yearly 标记) */
  isPastQuestion(q) {
    if (q.yearly) return true;
    return !!(q.source && q.source.includes('真题'));
  },

  /* 按范围过滤题目
     scope: all(完整) | curated(严选) | past(真题) */
  filterByScope(questions, scope, curatedSet) {
    if (scope === 'curated') return questions.filter(q => curatedSet.has(q.id));
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
