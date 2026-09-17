/* records.js - 学习记录页 */
const RecordsPage = {
  filter: 'all',
  records: [],
  questionMap: {},   // "chapterId:qid" -> question
  chapterMap: {},    // chapterId -> chapter

  TYPES: {
    favorite: { label: '收藏', icon: '⭐', cls: 'favorite' },
    unfamiliar: { label: '标记为不熟练', icon: '△', cls: 'unfamiliar' },
    unknown: { label: '标记为完全不会', icon: '✗', cls: 'unknown' },
    mastered: { label: '标记为掌握', icon: '✓', cls: 'mastered' },
    retest: { label: '加入错题复测', icon: '🔄', cls: 'retest' },
    note: { label: '添加笔记', icon: '📋', cls: 'note' }
  },

  async init() {
    this.records = Storage.getLearningRecords();

    const chapters = await DataLoader.getAllChapters();
    chapters.forEach(c => { this.chapterMap[c.id] = c; });

    // 载入涉及到的章节题目,用于展示题干
    const chapterIds = [...new Set(this.records.map(r => r.chapterId))];
    for (const cid of chapterIds) {
      const data = await DataLoader.loadQuestions(cid);
      (data.questions || []).forEach(q => { this.questionMap[`${cid}:${q.id}`] = q; });
    }

    this.render();
  },

  getFiltered() {
    if (this.filter === 'all') return this.records;
    if (this.filter === 'mastery') {
      return this.records.filter(r => ['mastered', 'unfamiliar', 'unknown'].includes(r.type));
    }
    return this.records.filter(r => r.type === this.filter);
  },

  getStem(record) {
    const q = this.questionMap[`${record.chapterId}:${record.questionId}`];
    if (!q) return '';
    const stem = (q.stem || '').replace(/\n/g, ' ');
    return stem.length > 80 ? stem.slice(0, 80) + '…' : stem;
  },

  getChapterName(record) {
    const c = this.chapterMap[record.chapterId];
    if (!c) return record.chapterId;
    return `${c.parentName} · ${c.name}`;
  },

  render() {
    const main = document.getElementById('main-content');
    const list = this.getFiltered();
    const all = this.records;

    const counts = {
      all: all.length,
      favorite: all.filter(r => r.type === 'favorite').length,
      mastery: all.filter(r => ['mastered', 'unfamiliar', 'unknown'].includes(r.type)).length,
      note: all.filter(r => r.type === 'note').length,
      retest: all.filter(r => r.type === 'retest').length
    };

    const chips = [
      { key: 'all', label: `全部 ${counts.all}` },
      { key: 'favorite', label: `收藏 ${counts.favorite}` },
      { key: 'mastery', label: `掌握状态 ${counts.mastery}` },
      { key: 'note', label: `笔记 ${counts.note}` },
      { key: 'retest', label: `错题复测 ${counts.retest}` }
    ];

    let bodyHtml;
    if (!list.length) {
      bodyHtml = `
        <div class="empty-state">
          <div class="empty-icon">🗂️</div>
          <h3>暂无内容</h3>
          <p>发生收藏、错题、掌握或完成题目后,这里会持续累积。</p>
          <a class="btn btn-primary" href="index.html">去学习</a>
        </div>
      `;
    } else {
      bodyHtml = list.map(r => {
        const meta = this.TYPES[r.type] || { label: r.type, icon: '•' };
        const stem = this.getStem(r);
        const timeText = r.time ? App.formatDate(r.time) : '—';
        return `
          <div class="record-item">
            <div class="record-icon">${meta.icon}</div>
            <div class="record-body">
              <div class="record-title">${meta.label}</div>
              <div class="record-meta">${App.escapeHtml(this.getChapterName(r))} · 第 ${r.questionId} 题 · ${timeText}</div>
              ${stem ? `<div class="record-stem">${App.escapeHtml(stem)}</div>` : ''}
            </div>
            <a class="btn btn-secondary btn-sm" href="practice.html?chapter=${encodeURIComponent(r.chapterId)}">查看</a>
          </div>
        `;
      }).join('');
    }

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📊 学习记录</h1>
        <span class="text-secondary text-sm">共 ${list.length} 条 · 按时间倒序展示</span>
      </div>

      <div class="filter-chips">
        ${chips.map(c => `<div class="chip ${this.filter === c.key ? 'active' : ''}" data-filter="${c.key}">${c.label}</div>`).join('')}
      </div>

      <div class="card">
        ${bodyHtml}
      </div>
    `;

    main.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filter = chip.dataset.filter;
        this.render();
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => RecordsPage.init());
