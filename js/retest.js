/* retest.js - 错题复测 */
const RetestPage = {
  filterCategory: 'all',

  async init() {
    this.render();
  },

  async render() {
    const main = document.getElementById('main-content');
    const cats = await DataLoader.loadCategories();
    const dueList = Storage.getDueRetest();
    const allRetest = Storage.getRetestList();

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🔄 错题复测</h1>
      </div>
      <div class="row-between" style="margin-bottom:16px;">
        <select class="select" id="category-filter">
          <option value="all">全部分类</option>
          ${cats.categories.map(c => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('')}
        </select>
        <div class="row" style="gap:10px;">
          <span class="text-secondary">今日待复测 <strong style="color:var(--accent);">${dueList.length}</strong> 题</span>
          <button class="btn btn-secondary btn-sm" id="view-all">查看全部复测题 (${allRetest.length})</button>
        </div>
      </div>

      <div id="retest-content"></div>
    `;

    document.getElementById('category-filter').value = this.filterCategory;
    document.getElementById('category-filter').addEventListener('change', (e) => {
      this.filterCategory = e.target.value;
      this.renderContent();
    });
    document.getElementById('view-all').addEventListener('click', () => this.renderContent(true));

    this.renderContent(false);
  },

  async renderContent(showAll = false) {
    const content = document.getElementById('retest-content');
    let list = showAll ? Storage.getRetestList() : Storage.getDueRetest();

    // 筛选
    if (this.filterCategory !== 'all') {
      const cats = await DataLoader.loadCategories();
      const cat = cats.categories.find(c => c.id === this.filterCategory);
      const chapterIds = (cat?.children || []).map(c => c.id);
      list = list.filter(r => chapterIds.includes(r.chapterId));
    }

    if (list.length === 0) {
      content.innerHTML = `
        <div class="card" style="padding:30px;">
          <p class="text-secondary" style="margin-bottom:20px;">${showAll ? '还没有错题复测计划。' : '今天暂时没有到期复测题目。'}</p>
          <p class="text-sm text-secondary" style="margin-bottom:16px;">在练习页点击"🔄"按钮，或从下方随机添加题目到复测计划：</p>
          <div class="row" style="gap:10px;">
            <button class="btn btn-secondary" id="add-1">随机添加 1 题</button>
            <button class="btn btn-secondary" id="add-3">随机添加 3 题</button>
            <button class="btn btn-secondary" id="add-5">随机添加 5 题</button>
          </div>
        </div>
      `;
      this.bindAddButtons();
      return;
    }

    // 加载题目详情
    const items = [];
    for (const r of list) {
      const data = await DataLoader.loadQuestions(r.chapterId);
      const q = data.questions.find(x => x.id === r.id);
      if (q) {
        const chapter = await DataLoader.getChapter(r.chapterId);
        items.push({ ...r, question: q, chapter });
      }
    }

    content.innerHTML = items.map(item => `
      <div class="card" style="margin-bottom:12px;padding:18px;">
        <div class="row-between" style="margin-bottom:10px;">
          <div class="row" style="gap:10px;">
            <span class="q-source">${App.escapeHtml(item.chapter?.parentName || '')} · ${App.escapeHtml(item.chapter?.name || '')}</span>
            <span class="badge badge-red">错 ${item.wrongCount} 次</span>
          </div>
          <span class="text-xs text-secondary">下次复测：${App.formatDate(item.nextReviewDate)}</span>
        </div>
        <div class="q-stem" style="font-size:14px;">${App.escapeHtml(item.question.stem)}</div>
        <div class="row" style="gap:8px;margin-top:12px;">
          <a class="btn btn-primary btn-sm" href="practice.html?chapter=${item.chapterId}">去复测</a>
          <button class="btn btn-ghost btn-sm" data-remove="${item.id}|${item.chapterId}">移出复测</button>
        </div>
      </div>
    `).join('');

    content.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [id, chapterId] = btn.dataset.remove.split('|');
        Storage.removeFromRetest(parseInt(id), chapterId);
        this.renderContent(showAll);
      });
    });
  },

  bindAddButtons() {
    const addRandom = async (count) => {
      const all = await DataLoader.getAllQuestions();
      const retest = Storage.getRetestList();
      const existingIds = new Set(retest.map(r => `${r.chapterId}:${r.id}`));
      const available = all.filter(q => !existingIds.has(`${q.chapterId}:${q.id}`));
      const shuffled = available.sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, Math.min(count, available.length));
      picked.forEach(q => Storage.addToRetest(q.id, q.chapterId));
      alert(`已添加 ${picked.length} 题到复测计划`);
      this.render();
    };

    document.getElementById('add-1')?.addEventListener('click', () => addRandom(1));
    document.getElementById('add-3')?.addEventListener('click', () => addRandom(3));
    document.getElementById('add-5')?.addEventListener('click', () => addRandom(5));
  }
};

document.addEventListener('DOMContentLoaded', () => RetestPage.init());
