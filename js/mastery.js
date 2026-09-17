/* mastery.js - 掌握地图
   设计对照参考站: 掌握状态 / 题目属性 / 题目地图 三段式。
   全部数据来自预生成索引 + 本地存储, 不加载任何题库文件, 打开即可渲染。
*/
const MasteryPage = {
  currentCategory: 'all',
  attrFilter: null,   // null | 'favorite' | 'note'
  chapters: [],       // [{id, name, parentName}]
  idsByChapter: {},   // chapterId -> [questionId]
  totals: {},         // chapterId -> 题目数
  mastery: {},        // "chapterId:qid" -> status
  progress: {},       // chapterId -> [questionId]
  favSet: new Set(),
  noteSet: new Set(),

  async init() {
    const [idsByChapter, totals] = await Promise.all([
      DataLoader.getChapterQuestionIds(),
      DataLoader.getChapterTotals()
    ]);
    this.idsByChapter = idsByChapter;
    this.totals = totals;

    // 本地数据一次性读入, 避免逐题读取 localStorage
    this.mastery = Storage.getMastery();
    this.progress = Storage.getProgress();
    this.favSet = new Set(Storage.getFavorites().map(f => `${f.chapterId}:${f.id}`));
    this.noteSet = new Set(Object.keys(Storage.getNotes()));

    // 章节顺序沿用分类树, 只取学科章节
    // (真题卷的题目已归入学科, 若同时统计会重复计数)
    const cats = await DataLoader.loadCategories();
    const bank = await DataLoader.loadBank();
    this.cats = cats;
    this.chapters = [];
    cats.categories.forEach(cat => {
      (cat.children || []).forEach(child => {
        const leaves = child.children ? child.children : [child];
        leaves.forEach(leaf => {
          if (!bank.subjects[leaf.id]) return;
          this.chapters.push({ id: leaf.id, name: leaf.name, group: cat.name, catId: cat.id });
        });
      });
    });

    this.render();
  },

  /* 当前分类下的章节 */
  scopedChapters() {
    if (this.currentCategory === 'all') return this.chapters;
    return this.chapters.filter(c => c.catId === this.currentCategory);
  },

  /* 当前分类下的所有题目(扁平), 用于统计 */
  scopedQuestions() {
    const out = [];
    this.scopedChapters().forEach(ch => {
      (this.idsByChapter[ch.id] || []).forEach(qid => out.push({ chapterId: ch.id, id: qid }));
    });
    return out;
  },

  statusOf(q) {
    const st = this.mastery[`${q.chapterId}:${q.id}`];
    return (st === 'mastered' || st === 'unfamiliar' || st === 'unknown') ? st : 'unseen';
  },

  isFavorite(q) { return this.favSet.has(`${q.chapterId}:${q.id}`); },
  hasNote(q) { return this.noteSet.has(`${q.chapterId}:${q.id}`); },

  /* 应用题目属性筛选 */
  applyAttrFilter(list) {
    if (this.attrFilter === 'favorite') return list.filter(q => this.isFavorite(q));
    if (this.attrFilter === 'note') return list.filter(q => this.hasNote(q));
    return list;
  },

  render() {
    const main = document.getElementById('main-content');

    const tabCount = (catId) => {
      const chapters = catId === 'all' ? this.chapters : this.chapters.filter(c => c.catId === catId);
      return chapters.reduce((s, c) => s + (this.totals[c.id] || 0), 0);
    };

    const cats = this.cats.categories.filter(c => this.chapters.some(ch => ch.catId === c.id));
    const totalAll = tabCount('all');

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🗺️ 掌握地图</h1>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btn-generate-card">生成掌握卡</button>
          <button class="btn btn-primary" id="btn-batch-practice">批量练习（<span id="batch-count">0</span>）</button>
        </div>
      </div>

      <div class="mastery-tabs" id="category-tabs">
        <div class="mastery-tab ${this.currentCategory === 'all' ? 'active' : ''}" data-cat="all">全部<span class="count">${totalAll}</span></div>
        ${cats.map(c => `
          <div class="mastery-tab ${this.currentCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
            ${c.icon || ''} ${App.escapeHtml(c.name)}<span class="count">${tabCount(c.id)}</span>
          </div>
        `).join('')}
      </div>

      <div class="map-section-title">掌握状态</div>
      <div class="mastery-status-row" id="status-row"></div>

      <div class="map-section-title">题目属性</div>
      <div class="mastery-status-row" id="attr-row"></div>

      <div class="card" style="margin-top:20px;">
        <div class="row-between" style="margin-bottom:16px;">
          <h2 style="font-size:17px;">题目地图</h2>
          <span class="text-secondary text-sm" id="grid-count">0 题</span>
        </div>
        <div id="q-map"></div>
      </div>
    `;

    main.querySelectorAll('.mastery-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        main.querySelectorAll('.mastery-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentCategory = tab.dataset.cat;
        this.renderStats();
        this.renderMap();
      });
    });

    document.getElementById('btn-batch-practice').addEventListener('click', () => this.batchPractice());
    document.getElementById('btn-generate-card').addEventListener('click', () => this.generateCard());

    this.renderStats();
    this.renderMap();
  },

  renderStats() {
    const questions = this.applyAttrFilter(this.scopedQuestions());

    const counts = { unseen: 0, mastered: 0, unfamiliar: 0, unknown: 0 };
    questions.forEach(q => { counts[this.statusOf(q)] += 1; });

    const favorites = questions.filter(q => this.isFavorite(q)).length;
    const notes = questions.filter(q => this.hasNote(q)).length;

    document.getElementById('status-row').innerHTML = `
      <div class="status-card"><div class="status-dot unseen"></div><div><div class="status-label">未做过</div><div class="status-count">${counts.unseen}</div></div></div>
      <div class="status-card"><div class="status-dot mastered"></div><div><div class="status-label">完全掌握</div><div class="status-count">${counts.mastered}</div></div></div>
      <div class="status-card"><div class="status-dot unfamiliar"></div><div><div class="status-label">不熟练/错误</div><div class="status-count">${counts.unfamiliar}</div></div></div>
      <div class="status-card"><div class="status-dot unknown"></div><div><div class="status-label">完全不会</div><div class="status-count">${counts.unknown}</div></div></div>
    `;

    document.getElementById('attr-row').innerHTML = `
      <div class="status-card clickable ${this.attrFilter === 'favorite' ? 'active' : ''}" data-attr="favorite">
        <div class="status-dot favorite"></div><div><div class="status-label">收藏题</div><div class="status-count">${favorites}</div></div>
      </div>
      <div class="status-card clickable ${this.attrFilter === 'note' ? 'active' : ''}" data-attr="note">
        <div class="status-dot note"></div><div><div class="status-label">有笔记</div><div class="status-count">${notes}</div></div>
      </div>
    `;

    document.querySelectorAll('[data-attr]').forEach(card => {
      card.addEventListener('click', () => {
        const attr = card.dataset.attr;
        this.attrFilter = this.attrFilter === attr ? null : attr;
        this.renderStats();
        this.renderMap();
      });
    });

    // 批量练习: 待巩固题数
    document.getElementById('batch-count').textContent =
      counts.unseen + counts.unfamiliar + counts.unknown;
  },

  renderMap() {
    const wrap = document.getElementById('q-map');
    const chapters = this.scopedChapters();

    const blocks = [];
    let shown = 0;
    chapters.forEach(ch => {
      let ids = this.idsByChapter[ch.id] || [];
      if (this.attrFilter === 'favorite') ids = ids.filter(id => this.favSet.has(`${ch.id}:${id}`));
      if (this.attrFilter === 'note') ids = ids.filter(id => this.noteSet.has(`${ch.id}:${id}`));
      if (!ids.length) return;

      shown += ids.length;
      const done = (this.progress[ch.id] || []).length;

      blocks.push(`
        <div class="map-chapter">
          <div class="map-chapter-head">
            <span class="map-chapter-name">${App.escapeHtml(ch.name)}</span>
            <span class="text-secondary text-xs">${ids.length} 题${done ? ` · 已做 ${done}` : ''}</span>
            <a class="map-chapter-link" href="practice.html?chapter=${encodeURIComponent(ch.id)}">去练习 →</a>
          </div>
          <div class="q-grid">${ids.map(id => this.renderCell(ch.id, id)).join('')}</div>
        </div>
      `);
    });

    document.getElementById('grid-count').textContent = `${shown} 题`;

    if (!blocks.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:40px 20px;">
        <h3>${this.attrFilter ? '该范围内没有匹配的题目' : '该分类下暂无题目'}</h3>
        <p>${this.attrFilter ? '换个筛选条件, 或先在练习页收藏题目 / 添加笔记。' : '等待题库录入后即可查看。'}</p>
      </div>`;
      return;
    }

    wrap.innerHTML = blocks.join('');
  },

  renderCell(chapterId, qid) {
    const status = this.statusOf({ chapterId, id: qid });
    const marks = [
      this.favSet.has(`${chapterId}:${qid}`) ? '⭐' : '',
      this.noteSet.has(`${chapterId}:${qid}`) ? '📋' : ''
    ].join('');
    const statusLabel = { unseen: '未做过', mastered: '完全掌握', unfamiliar: '不熟练', unknown: '完全不会' }[status];
    return `<a class="q-cell ${status}" href="practice.html?chapter=${encodeURIComponent(chapterId)}&q=${qid}" title="第 ${qid} 题 · ${statusLabel}${marks ? ' · ' + marks : ''}">${marks ? `<span class="q-cell-mark">${marks}</span>` : ''}</a>`;
  },

  async batchPractice() {
    const questions = this.applyAttrFilter(this.scopedQuestions());
    const target = questions.find(q => this.statusOf(q) !== 'mastered');
    if (target) {
      window.location.href = `practice.html?chapter=${target.chapterId}&q=${target.id}&scope=${App.getScope()}`;
    } else {
      alert(questions.length ? '该范围内所有题目都已掌握' : '该范围内暂无题目');
    }
  },

  generateCard() {
    const questions = this.applyAttrFilter(this.scopedQuestions());
    const counts = { unseen: 0, mastered: 0, unfamiliar: 0, unknown: 0 };
    questions.forEach(q => { counts[this.statusOf(q)] += 1; });

    const total = questions.length;
    const rate = total ? ((counts.mastered / total) * 100).toFixed(1) : '0.0';
    const catName = this.currentCategory === 'all'
      ? '全部'
      : (this.cats.categories.find(c => c.id === this.currentCategory)?.name || '');
    const attrName = this.attrFilter === 'favorite' ? '（收藏题）' : this.attrFilter === 'note' ? '（有笔记）' : '';

    // 按章节给出掌握率最高的前几章, 便于定位
    const rows = this.scopedChapters().map(ch => {
      let ids = this.idsByChapter[ch.id] || [];
      if (this.attrFilter === 'favorite') ids = ids.filter(id => this.favSet.has(`${ch.id}:${id}`));
      if (this.attrFilter === 'note') ids = ids.filter(id => this.noteSet.has(`${ch.id}:${id}`));
      const m = ids.filter(id => this.mastery[`${ch.id}:${id}`] === 'mastered').length;
      return { name: ch.name, total: ids.length, mastered: m };
    }).filter(r => r.total > 0)
      .sort((a, b) => (b.mastered / b.total) - (a.mastered / a.total))
      .slice(0, 8);

    alert(`掌握卡 · ${catName}${attrName}\n\n` +
      `总题数：${total}\n` +
      `完全掌握：${counts.mastered}（${rate}%）\n` +
      `不熟练：${counts.unfamiliar}\n` +
      `完全不会：${counts.unknown}\n` +
      `未做过：${counts.unseen}\n\n` +
      `掌握率较高的章节：\n` +
      rows.map(r => `· ${r.name}  ${r.mastered}/${r.total}`).join('\n'));
  }
};

document.addEventListener('DOMContentLoaded', () => MasteryPage.init());
