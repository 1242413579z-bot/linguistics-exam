/* notes.js - 题目笔记 */
const NotesPage = {
  filterCategory: 'all',
  filterTag: 'all',
  searchKeyword: '',

  async init() {
    this.render();
  },

  async render() {
    const main = document.getElementById('main-content');
    const cats = await DataLoader.loadCategories();
    const notes = Storage.getNotes();
    const allTags = new Set();
    Object.values(notes).forEach(n => (n.tags || []).forEach(t => allTags.add(t)));

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📋 题目笔记</h1>
      </div>
      <div class="row" style="gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <select class="select" id="category-filter" style="min-width:140px;">
          <option value="all">全部分类</option>
          ${cats.categories.map(c => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('')}
        </select>
        <input type="text" class="input" id="search-input" placeholder="搜索思路、推导或关键词" style="flex:1;min-width:200px;">
        <select class="select" id="tag-filter" style="min-width:140px;">
          <option value="all">全部标签</option>
          ${[...allTags].map(t => `<option value="${App.escapeHtml(t)}">${App.escapeHtml(t)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="search-btn">搜索</button>
      </div>
      <div id="notes-list"></div>
    `;

    document.getElementById('category-filter').value = this.filterCategory;
    document.getElementById('tag-filter').value = this.filterTag;

    document.getElementById('category-filter').addEventListener('change', (e) => { this.filterCategory = e.target.value; this.renderList(); });
    document.getElementById('tag-filter').addEventListener('change', (e) => { this.filterTag = e.target.value; this.renderList(); });
    document.getElementById('search-btn').addEventListener('click', () => { this.searchKeyword = document.getElementById('search-input').value; this.renderList(); });
    document.getElementById('search-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') { this.searchKeyword = e.target.value; this.renderList(); } });

    this.renderList();
  },

  async renderList() {
    const list = document.getElementById('notes-list');
    const notes = Storage.getNotes();
    const keys = Object.keys(notes);

    if (keys.length === 0) {
      list.innerHTML = `
        <div class="card empty-state" style="text-align:left;">
          <h3>还没有题目笔记</h3>
          <p>在原题中打开"笔记"即可记录思路，保存后会显示在这里。</p>
          <a class="btn btn-primary" href="index.html">选择章节练习</a>
        </div>
      `;
      return;
    }

    let items = [];
    for (const key of keys) {
      const [chapterId, questionId] = key.split(':');
      const note = notes[key];

      // 分类筛选
      if (this.filterCategory !== 'all') {
        await DataLoader.loadCategories();
        const chapterIds = DataLoader.getCategoryChapterIds(this.filterCategory);
        if (!chapterIds.includes(chapterId)) continue;
      }

      // 标签筛选
      if (this.filterTag !== 'all' && !(note.tags || []).includes(this.filterTag)) continue;

      // 搜索
      if (this.searchKeyword && !note.content.includes(this.searchKeyword)) continue;

      const data = await DataLoader.loadQuestions(chapterId);
      const q = data.questions.find(x => x.id === parseInt(questionId));
      const chapter = await DataLoader.getChapter(chapterId);
      items.push({ key, chapterId, questionId: parseInt(questionId), note, question: q, chapter });
    }

    if (items.length === 0) {
      list.innerHTML = '<div class="card empty-state"><h3>没有匹配的笔记</h3></div>';
      return;
    }

    list.innerHTML = items.map(item => `
      <div class="card" style="margin-bottom:12px;">
        <div class="row-between" style="margin-bottom:10px;">
          <div class="row" style="gap:10px;flex-wrap:wrap;">
            <span class="q-source">${App.escapeHtml(item.chapter?.parentName || '')} · ${App.escapeHtml(item.chapter?.name || '')}</span>
            <span class="badge badge-gray">${App.escapeHtml(item.question?.source || '')}</span>
          </div>
          <span class="text-xs text-secondary">${App.formatDate(item.note.updatedAt)}</span>
        </div>
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:10px;font-size:13px;color:var(--text-secondary);">${App.escapeHtml(item.question?.stem || '')}</div>
        <div class="q-stem" style="font-size:14px;white-space:pre-wrap;">${App.escapeHtml(item.note.content)}</div>
        ${(item.note.tags || []).length ? `<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap;">${item.note.tags.map(t => `<span class="badge badge-blue">${App.escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="row" style="gap:8px;margin-top:12px;">
          <a class="btn btn-secondary btn-sm" href="practice.html?chapter=${item.chapterId}">查看原题</a>
          <button class="btn btn-ghost btn-sm" data-delete="${item.key}">删除笔记</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [chapterId, questionId] = btn.dataset.delete.split(':');
        Storage.deleteNote(chapterId, parseInt(questionId));
        this.renderList();
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => NotesPage.init());
