/* storage.js - localStorage 封装 */
const Storage = {
  PREFIX: 'linguistics_',

  _key(name) { return this.PREFIX + name; },

  get(name, defaultValue) {
    try {
      const raw = localStorage.getItem(this._key(name));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Storage get error:', e);
      return defaultValue;
    }
  },

  set(name, value) {
    try {
      localStorage.setItem(this._key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  remove(name) {
    localStorage.removeItem(this._key(name));
  },

  /* ===== 设置 ===== */
  getSettings() {
    return this.get('settings', { theme: 'light' });
  },
  setSettings(settings) {
    return this.set('settings', settings);
  },

  /* ===== 收藏 ===== */
  getFavorites() {
    return this.get('favorites', []);
  },
  addFavorite(questionId, chapterId) {
    const list = this.getFavorites();
    if (!list.find(f => f.id === questionId && f.chapterId === chapterId)) {
      list.push({ id: questionId, chapterId, time: Date.now() });
      this.set('favorites', list);
    }
  },
  removeFavorite(questionId, chapterId) {
    const list = this.getFavorites().filter(f => !(f.id === questionId && f.chapterId === chapterId));
    this.set('favorites', list);
  },
  isFavorite(questionId, chapterId) {
    return this.getFavorites().some(f => f.id === questionId && f.chapterId === chapterId);
  },

  /* ===== 掌握状态 ===== */
  getMastery() {
    return this.get('mastery', {});
  },
  getMasteryStatus(chapterId, questionId) {
    const key = `${chapterId}:${questionId}`;
    return this.getMastery()[key] || 'unseen';
  },
  setMasteryStatus(chapterId, questionId, status) {
    const mastery = this.getMastery();
    mastery[`${chapterId}:${questionId}`] = status;
    this.set('mastery', mastery);
  },

  /* ===== 笔记 ===== */
  getNotes() {
    return this.get('notes', {});
  },
  getNote(chapterId, questionId) {
    return this.getNotes()[`${chapterId}:${questionId}`] || null;
  },
  setNote(chapterId, questionId, content, tags = []) {
    const notes = this.getNotes();
    notes[`${chapterId}:${questionId}`] = {
      content,
      tags,
      updatedAt: Date.now()
    };
    this.set('notes', notes);
  },
  deleteNote(chapterId, questionId) {
    const notes = this.getNotes();
    delete notes[`${chapterId}:${questionId}`];
    this.set('notes', notes);
  },

  /* ===== 错题复测 ===== */
  getRetestList() {
    return this.get('retest', []);
  },
  addToRetest(questionId, chapterId) {
    const list = this.getRetestList();
    const existing = list.find(r => r.id === questionId && r.chapterId === chapterId);
    if (existing) {
      existing.wrongCount = (existing.wrongCount || 1) + 1;
      existing.nextReviewDate = this._calcNextReview(existing.wrongCount);
    } else {
      list.push({
        id: questionId,
        chapterId,
        nextReviewDate: this._calcNextReview(1),
        interval: 1,
        wrongCount: 1,
        addedAt: Date.now()
      });
    }
    this.set('retest', list);
  },
  updateRetest(questionId, chapterId, correct) {
    const list = this.getRetestList();
    const item = list.find(r => r.id === questionId && r.chapterId === chapterId);
    if (!item) return;
    if (correct) {
      item.wrongCount = Math.max(1, (item.wrongCount || 1) - 1);
      item.interval = item.interval * 2;
    } else {
      item.wrongCount = (item.wrongCount || 1) + 1;
      item.interval = 1;
    }
    item.nextReviewDate = this._calcNextReview(item.wrongCount, item.interval);
    this.set('retest', list);
  },
  removeFromRetest(questionId, chapterId) {
    const list = this.getRetestList().filter(r => !(r.id === questionId && r.chapterId === chapterId));
    this.set('retest', list);
  },
  getDueRetest() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.getRetestList().filter(r => r.nextReviewDate <= now.getTime());
  },
  _calcNextReview(wrongCount, interval) {
    // 间隔重复：错题次数越多，复测间隔越短
    // wrongCount: 1→1天, 2→1天, 3→2天, 4→3天, 5+→7天
    let days;
    if (wrongCount <= 1) days = interval || 1;
    else if (wrongCount === 2) days = 1;
    else if (wrongCount === 3) days = 2;
    else if (wrongCount === 4) days = 3;
    else days = 7;
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  },

  /* ===== 进度 ===== */
  getProgress() {
    return this.get('progress', {});
  },
  getChapterProgress(chapterId) {
    return this.getProgress()[chapterId] || [];
  },
  markDone(chapterId, questionId) {
    const progress = this.getProgress();
    if (!progress[chapterId]) progress[chapterId] = [];
    if (!progress[chapterId].includes(questionId)) {
      progress[chapterId].push(questionId);
      this.set('progress', progress);
    }
  },

  /* ===== 答案/解析（用户编辑） ===== */
  getUserAnswers() {
    return this.get('userAnswers', {});
  },
  getUserAnswer(chapterId, questionId) {
    return this.getUserAnswers()[`${chapterId}:${questionId}`] || { answer: '', analysis: '' };
  },
  setUserAnswer(chapterId, questionId, answer, analysis) {
    const data = this.getUserAnswers();
    data[`${chapterId}:${questionId}`] = { answer, analysis, updatedAt: Date.now() };
    this.set('userAnswers', data);
  },

  /* ===== 组卷历史 ===== */
  getPaperHistory() {
    return this.get('paperHistory', []);
  },
  addPaperHistory(paper) {
    const list = this.getPaperHistory();
    list.unshift({ ...paper, id: Date.now(), createdAt: Date.now() });
    this.set('paperHistory', list);
  }
};
