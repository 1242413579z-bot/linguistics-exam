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
  }
};
