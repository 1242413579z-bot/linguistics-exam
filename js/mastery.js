/* mastery.js - 掌握地图 */
const MasteryPage = {
  currentCategory: 'all',
  allQuestions: [],

  async init() {
    this.allQuestions = await DataLoader.getAllQuestions();
    this.render();
  },

  async render() {
    const main = document.getElementById('main-content');
    const cats = await DataLoader.loadCategories();

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🗺️ 掌握地图</h1>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btn-generate-card">生成掌握卡</button>
          <button class="btn btn-primary" id="btn-batch-practice">批量练习 (<span id="batch-count">0</span>)</button>
        </div>
      </div>

      <div class="mastery-tabs" id="category-tabs">
        <div class="mastery-tab active" data-cat="all">全部 <span class="count">${this.allQuestions.length}</span></div>
        ${cats.categories.map(c => {
          const count = this.allQuestions.filter(q => q.parentName === c.name).length;
          return `<div class="mastery-tab" data-cat="${c.id}">${c.icon || ''} ${App.escapeHtml(c.name)} <span class="count">${count}</span></div>`;
        }).join('')}
      </div>

      <div class="mastery-status-row" id="status-row"></div>

      <div class="card">
        <div class="row-between" style="margin-bottom:16px;">
          <h3 style="font-size:16px;">题目地图</h3>
          <span class="text-secondary" id="grid-count">0 题</span>
        </div>
        <div class="q-grid" id="q-grid"></div>
      </div>
    `;

    // 分类切换
    main.querySelectorAll('.mastery-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        main.querySelectorAll('.mastery-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentCategory = tab.dataset.cat;
        this.renderGrid();
      });
    });

    document.getElementById('btn-batch-practice').addEventListener('click', () => this.batchPractice());
    document.getElementById('btn-generate-card').addEventListener('click', () => this.generateCard());

    this.renderGrid();
  },

  getFilteredQuestions() {
    if (this.currentCategory === 'all') return this.allQuestions;
    const cat = this.allQuestions.filter(q => {
      // 通过 chapterId 前缀匹配分类
      return true;
    });
    // 更好的方式：通过分类获取子章节 id
    return this.allQuestions; // 简化：前端全量，后续优化
  },

  async renderGrid() {
    const grid = document.getElementById('q-grid');
    const statusRow = document.getElementById('status-row');
    let questions = this.allQuestions;

    if (this.currentCategory !== 'all') {
      const cats = await DataLoader.loadCategories();
      const cat = cats.categories.find(c => c.id === this.currentCategory);
      const chapterIds = (cat?.children || []).map(c => c.id);
      questions = questions.filter(q => chapterIds.includes(q.chapterId));
    }

    // 统计
    const counts = { unseen: 0, mastered: 0, unfamiliar: 0, unknown: 0 };
    questions.forEach(q => {
      const status = Storage.getMasteryStatus(q.chapterId, q.id);
      counts[status] = (counts[status] || 0) + 1;
    });

    statusRow.innerHTML = `
      <div class="status-card"><div class="status-dot unseen"></div><div><div class="status-label">未做过</div><div class="status-count">${counts.unseen}</div></div></div>
      <div class="status-card"><div class="status-dot mastered"></div><div><div class="status-label">完全掌握</div><div class="status-count">${counts.mastered}</div></div></div>
      <div class="status-card"><div class="status-dot unfamiliar"></div><div><div class="status-label">不熟练/错误</div><div class="status-count">${counts.unfamiliar}</div></div></div>
      <div class="status-card"><div class="status-dot unknown"></div><div><div class="status-label">完全不会</div><div class="status-count">${counts.unknown}</div></div></div>
    `;

    document.getElementById('grid-count').textContent = `${questions.length} 题`;
    document.getElementById('batch-count').textContent = questions.length;

    // 渲染网格
    grid.innerHTML = questions.map(q => {
      const status = Storage.getMasteryStatus(q.chapterId, q.id);
      return `<div class="q-cell ${status}" data-chapter="${q.chapterId}" data-qid="${q.id}">
        <div class="tooltip">${App.escapeHtml(q.chapterName)} #${q.id} - ${App.escapeHtml((q.stem||'').slice(0,20))}...</div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.q-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        window.location.href = `practice.html?chapter=${cell.dataset.chapter}`;
      });
    });
  },

  batchPractice() {
    // 跳转到第一个未掌握的章节
    const questions = this.currentCategory === 'all' ? this.allQuestions : this.allQuestions;
    const target = questions.find(q => {
      const s = Storage.getMasteryStatus(q.chapterId, q.id);
      return s === 'unseen' || s === 'unfamiliar' || s === 'unknown';
    });
    if (target) {
      window.location.href = `practice.html?chapter=${target.chapterId}`;
    } else {
      alert('所有题目都已掌握！🎉');
    }
  },

  generateCard() {
    const counts = { unseen: 0, mastered: 0, unfamiliar: 0, unknown: 0 };
    this.allQuestions.forEach(q => {
      const status = Storage.getMasteryStatus(q.chapterId, q.id);
      counts[status]++;
    });
    const total = this.allQuestions.length;
    const rate = total > 0 ? ((counts.mastered / total) * 100).toFixed(1) : 0;
    alert(`掌握卡\n\n总题数：${total}\n完全掌握：${counts.mastered} (${rate}%)\n不熟练：${counts.unfamiliar}\n完全不会：${counts.unknown}\n未做过：${counts.unseen}`);
  }
};

document.addEventListener('DOMContentLoaded', () => MasteryPage.init());
