/* favorites.js - 收藏本 */
const FavoritesPage = {
  filterCategory: 'all',
  sortOrder: 'desc',

  async init() {
    this.render();
  },

  async render() {
    const main = document.getElementById('main-content');
    const favorites = Storage.getFavorites();
    const cats = await DataLoader.loadCategories();

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⭐ 收藏本</h1>
      </div>
      <div class="row-between" style="margin-bottom:16px;">
        <div class="row" style="gap:10px;">
          <select class="select" id="category-filter">
            <option value="all">全部分类</option>
            ${cats.categories.map(c => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="row" style="gap:10px;">
          <span class="text-secondary">${favorites.length} 题</span>
          <select class="select" id="sort-order">
            <option value="desc">收藏时间：新到旧</option>
            <option value="asc">收藏时间：旧到新</option>
          </select>
        </div>
      </div>
      <div id="fav-list"></div>
    `;

    document.getElementById('category-filter').value = this.filterCategory;
    document.getElementById('sort-order').value = this.sortOrder;

    document.getElementById('category-filter').addEventListener('change', (e) => {
      this.filterCategory = e.target.value;
      this.renderList();
    });
    document.getElementById('sort-order').addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.renderList();
    });

    this.renderList();
  },

  async renderList() {
    const list = document.getElementById('fav-list');
    let favorites = Storage.getFavorites();

    // 筛选
    if (this.filterCategory !== 'all') {
      await DataLoader.loadCategories();
      const chapterIds = DataLoader.getCategoryChapterIds(this.filterCategory);
      favorites = favorites.filter(f => chapterIds.includes(f.chapterId));
    }

    // 排序
    favorites.sort((a, b) => this.sortOrder === 'desc' ? b.time - a.time : a.time - b.time);

    if (favorites.length === 0) {
      list.innerHTML = `
        <div class="card empty-state" style="text-align:left;">
          <h3>还没有收藏题目</h3>
          <p>在题目中点击"收藏"，就能在这里集中复习。</p>
          <a class="btn btn-primary" href="index.html">选择章节练习</a>
        </div>
      `;
      return;
    }

    // 加载题目详情
    const items = [];
    for (const fav of favorites) {
      const data = await DataLoader.loadQuestions(fav.chapterId);
      const q = data.questions.find(x => x.id === fav.id);
      if (q) {
        const chapter = await DataLoader.getChapter(fav.chapterId);
        items.push({ ...fav, question: q, chapter });
      }
    }

    list.innerHTML = items.map(item => `
      <div class="card" style="margin-bottom:12px;padding:18px;">
        <div class="row-between" style="margin-bottom:10px;">
          <div class="row" style="gap:10px;">
            <span class="q-source">${App.escapeHtml(item.chapter?.parentName || '')} · ${App.escapeHtml(item.chapter?.name || '')}</span>
            <span class="badge badge-gray">${App.escapeHtml(item.question.source || '')}</span>
          </div>
          <span class="text-xs text-secondary">${App.formatDate(item.time)}</span>
        </div>
        <div class="q-stem" style="font-size:14px;">${App.escapeHtml(item.question.stem)}</div>
        <div class="row" style="gap:8px;margin-top:12px;">
          <a class="btn btn-secondary btn-sm" href="practice.html?chapter=${item.chapterId}">去练习</a>
          <button class="btn btn-ghost btn-sm" data-remove="${item.id}|${item.chapterId}">取消收藏</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [id, chapterId] = btn.dataset.remove.split('|');
        Storage.removeFavorite(parseInt(id), chapterId);
        this.render();
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => FavoritesPage.init());
