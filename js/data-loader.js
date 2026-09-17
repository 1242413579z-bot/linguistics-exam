/* data-loader.js - 加载分类与题库数据 */
const DataLoader = {
  _categories: null,
  _questionCache: {},
  _curatedIndex: null,

  async loadCategories() {
    if (this._categories) return this._categories;
    try {
      const res = await fetch('data/categories.json?v=5');
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
      const res = await fetch(`data/questions/${chapterId}.json?v=5`);
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

  /* 加载严选索引(预生成, 见 tools/build-curated-index.js)
     避免练习页为统计考频而加载全部题库文件 */
  async loadCuratedIndex() {
    if (this._curatedIndex) return this._curatedIndex;
    try {
      const res = await fetch('data/curated-index.json?v=5');
      this._curatedIndex = res.ok ? await res.json() : { curated: {}, frequency: {}, totals: {} };
    } catch (e) {
      console.error('加载严选索引失败:', e);
      this._curatedIndex = { curated: {}, frequency: {}, totals: {} };
    }
    return this._curatedIndex;
  },

  /* 某章节的严选题目 ID 集合 */
  async getCuratedSet(chapterId) {
    const index = await this.loadCuratedIndex();
    return new Set((index.curated && index.curated[chapterId]) || []);
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
