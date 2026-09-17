/* practice.js - 练习页逻辑 */
const PracticePage = {
  chapterId: null,
  chapter: null,
  questions: [],
  allChapters: [],
  curatedSet: new Set(),
  scope: 'all', // all(完整) / curated(严选) / past(真题)
  layout: 'classic', // classic(经典, 连续浏览) / focus(专注, 每次一题)
  currentIndex: 0,

  async init() {
    this.chapterId = App.getQueryParam('chapter');
    if (!this.chapterId) {
      document.getElementById('main-content').innerHTML = 
        '<div class="empty-state"><div class="empty-icon">\u{1F4CB}</div><h3>未选择章节</h3><p>请从侧边栏选择一个章节开始练习</p><a class="btn btn-primary" href="index.html">返回首页</a></div>';
      return;
    }

    // 学科章节(完整/严选) 与 试卷章节(真题) 两种数据来源
    const bank = await DataLoader.loadBank();
    this.isSubject = !!bank.subjects[this.chapterId];

    if (this.isSubject) {
      const meta = bank.subjects[this.chapterId];
      const data = await DataLoader.loadSubjectQuestions(this.chapterId);
      this.questions = data.questions || [];
      this.chapter = {
        name: meta.name,
        parentName: [meta.catName, meta.group].filter(Boolean).join(' · ')
      };
    } else {
      this.chapter = await DataLoader.getChapter(this.chapterId);
      const data = await DataLoader.loadQuestions(this.chapterId);
      this.questions = data.questions || [];
      this.questionsMissing = !!data.missing;
    }

    this.navList = await this.buildNavList();
    this.curatedSet = await DataLoader.getCuratedSet(this.chapterId);
    Storage.setLastChapter(this.chapterId);
    Storage.setSetting('lastChapterSubject', this.isSubject);

    // 支持从侧边栏带入范围
    const urlScope = App.getQueryParam('scope');
    if (['all', 'curated', 'past'].includes(urlScope)) this.scope = urlScope;

    // 布局(支持 URL 覆盖, 便于分享/直达)
    const urlLayout = App.getQueryParam('layout');
    this.layout = ['classic', 'focus'].includes(urlLayout) ? urlLayout : App.getLayout();

    // 直达某题(掌握地图/错题复测等入口带 ?q=<题目ID>)
    const targetQ = parseInt(App.getQueryParam('q'), 10);
    if (targetQ) this._pendingJump = targetQ;

    this.render();
  },

  /* 上一节/下一节的导航列表:
     学科章节 -> 学科树顺序; 试卷 -> 年份下的试卷顺序 */
  async buildNavList() {
    const cats = await DataLoader.loadCategories();
    const list = [];
    cats.categories.forEach(cat => {
      (cat.children || []).forEach(child => {
        const leaves = child.children ? child.children : [child];
        leaves.forEach(leaf => {
          const isSubjectLeaf = /^(ling|mc|ac)-/.test(leaf.id);
          const isPaperLeaf = !!child.children; // 三级分类的叶子=试卷
          if (this.isSubject ? isSubjectLeaf : isPaperLeaf) {
            list.push({ id: leaf.id, name: leaf.name });
          }
        });
      });
    });
    return list;
  },

  render() {
    const main = document.getElementById('main-content');
    const progress = Storage.getChapterProgress(this.chapterId);
    const doneCount = progress.length;
    const total = this.questions.length;
    const stats = {
      all: this.questions.length,
      curated: DataLoader.filterByScope(this.questions, 'curated', this.curatedSet).length,
      past: DataLoader.filterByScope(this.questions, 'past', this.curatedSet).length
    };

    // 上一节/下一节
    const nav = this.navList || [];
    const idx = nav.findIndex(c => c.id === this.chapterId);
    const prev = idx > 0 ? nav[idx - 1] : null;
    const next = idx >= 0 && idx < nav.length - 1 ? nav[idx + 1] : null;

    main.innerHTML = `
      <div class="practice-header">
        <div>
          <div class="practice-title">
            ${this.isSubject ? '<span class="badge badge-green">学科</span>' : '<span class="badge badge-blue">真题卷</span>'}
            ${App.escapeHtml(this.chapter?.parentName || '')}${this.chapter?.name ? ' · ' + App.escapeHtml(this.chapter.name) : ''}
          </div>
          <div class="practice-meta">已完成 ${doneCount} / ${total} 题</div>
        </div>
        <div class="practice-nav">
          <button class="btn btn-secondary btn-sm" id="layout-toggle" title="切换经典/专注布局">
            ${this.layout === 'focus' ? '经典布局' : '专注布局'}
          </button>
          ${prev ? `<a class="btn btn-secondary" href="practice.html?chapter=${prev.id}&scope=${this.scope}">← 上一节</a>` : '<button class="btn btn-secondary" disabled>← 上一节</button>'}
          ${next ? `<a class="btn btn-secondary" href="practice.html?chapter=${next.id}&scope=${this.scope}">下一节 →</a>` : '<button class="btn btn-secondary" disabled>下一节 →</button>'}
        </div>
      </div>

      <div class="scope-tabs">
        <div class="scope-tab ${this.scope === 'all' ? 'active' : ''}" data-scope="all">完整 <span class="scope-count">${stats.all}</span></div>
        <div class="scope-tab ${this.scope === 'curated' ? 'active' : ''}" data-scope="curated">严选 <span class="scope-count">${stats.curated}</span></div>
        <div class="scope-tab ${this.scope === 'past' ? 'active' : ''}" data-scope="past">真题 <span class="scope-count">${stats.past}</span></div>
      </div>

      <div id="questions-container"></div>
    `;

    // 布局切换
    document.getElementById('layout-toggle').addEventListener('click', () => {
      this.layout = this.layout === 'focus' ? 'classic' : 'focus';
      Storage.setSetting('layout', this.layout);
      this.currentIndex = 0;
      this.render();
    });

    // 范围切换
    main.querySelectorAll('.scope-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        main.querySelectorAll('.scope-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.scope = tab.dataset.scope;
        this.currentIndex = 0;
        // 同步到地址栏与侧边栏范围
        const url = new URL(window.location.href);
        url.searchParams.set('scope', this.scope);
        window.history.replaceState(null, '', url);
        App.setScope(this.scope);
        document.querySelectorAll('.scope-chip').forEach(c => c.classList.toggle('active', c.dataset.scope === this.scope));
        this.renderQuestions();
      });
    });

    this.renderQuestions();
  },

  getFilteredQuestions() {
    return DataLoader.filterByScope(this.questions, this.scope, this.curatedSet);
  },

  renderQuestions() {
    const container = document.getElementById('questions-container');
    const list = this.getFilteredQuestions();

    // 处理 ?q=<题目ID> 直达
    if (this._pendingJump != null) {
      const idx = list.findIndex(q => q.id === this._pendingJump);
      if (idx >= 0) this.currentIndex = idx;
      this._pendingScrollTo = this._pendingJump;
      this._pendingJump = null;
    }

    if (list.length === 0) {
      // 题目文件尚未录入, 与"该范围无题目"区分开
      if (this.questionsMissing) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>该章节题目尚未录入</h3><p>分类中已保留此章节, 题目文件还未添加。可先浏览其他章节。</p><a class="btn btn-primary" href="index.html">返回首页</a></div>`;
        return;
      }
      const tips = {
        curated: '该章节暂无严选题目,可在「完整」范围中查看全部题目',
        past: '该章节暂无真题',
        all: '该范围下没有题目'
      };
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>暂无题目</h3><p>${tips[this.scope] || '该范围下没有题目'}</p></div>`;
      return;
    }

    // 真题范围:按年份分组展示
    if (this.scope === 'past' && this.layout !== 'focus') {
      const groups = DataLoader.groupByYear(list);
      container.innerHTML = groups.map(g => `
        <div class="year-group">
          <div class="year-group-title">${g.year ? g.year + ' 年真题' : '真题'}<span class="text-secondary text-sm">${g.questions.length} 题</span></div>
          ${g.questions.map((q, i) => this.renderQuestionCard(q, i)).join('')}
        </div>
      `).join('');
      this.bindQuestionEvents();
      this.scrollToPending();
      return;
    }

    // 专注布局:每次一题 + 底部题号快速切换
    if (this.layout === 'focus') {
      if (this.currentIndex >= list.length) this.currentIndex = Math.max(0, list.length - 1);
      if (this.currentIndex < 0) this.currentIndex = 0;
      container.innerHTML = `
        <div class="focus-wrap">
          ${this.renderQuestionCard(list[this.currentIndex], this.currentIndex)}
          ${this.renderFocusBar(list)}
        </div>
      `;
      this.bindQuestionEvents();
      this.bindFocusBar(list);
      this.bindFocusKeyboard(list);
      this.scrollToPending();
      return;
    }

    container.innerHTML = list.map((q, i) => this.renderQuestionCard(q, i)).join('');
    this.bindQuestionEvents();
    this.scrollToPending();
  },

  /* 滚动并高亮 ?q= 指定的题目 */
  scrollToPending() {
    if (this._pendingScrollTo == null) return;
    const qid = this._pendingScrollTo;
    this._pendingScrollTo = null;
    const el = document.querySelector(`.q-card[data-qid="${qid}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('q-card-highlight');
    setTimeout(() => el.classList.remove('q-card-highlight'), 2200);
  },

  /* 底部题号快速切换条 */
  renderFocusBar(list) {
    return `
      <div class="focus-bar">
        <button class="focus-nav-btn" data-goto="prev" ${this.currentIndex === 0 ? 'disabled' : ''}>← 上一题</button>
        <div class="focus-numbers">
          ${list.map((q, i) => {
            const st = Storage.getMasteryStatus(this.chapterId, q.id);
            const cls = ['mastered', 'unfamiliar', 'unknown'].includes(st) ? st : '';
            return `<button class="focus-num ${cls} ${i === this.currentIndex ? 'current' : ''}" data-goto-index="${i}" title="第 ${i + 1} 题">${i + 1}</button>`;
          }).join('')}
        </div>
        <button class="focus-nav-btn" data-goto="next" ${this.currentIndex === list.length - 1 ? 'disabled' : ''}>下一题 →</button>
      </div>
    `;
  },

  bindFocusBar(list) {
    const container = document.getElementById('questions-container');

    const goto = (i) => {
      this.currentIndex = Math.max(0, Math.min(list.length - 1, i));
      this.renderQuestions();
      document.querySelector('.practice-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    container.querySelectorAll('[data-goto-index]').forEach(btn => {
      btn.addEventListener('click', () => goto(parseInt(btn.dataset.gotoIndex, 10)));
    });
    container.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        goto(btn.dataset.goto === 'prev' ? this.currentIndex - 1 : this.currentIndex + 1);
      });
    });
  },

  /* 左右方向键切换题目(专注布局) */
  bindFocusKeyboard(list) {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (this.layout !== 'focus') return;
      if (e.key === 'ArrowLeft' && this.currentIndex > 0) {
        this.currentIndex -= 1;
        this.renderQuestions();
      } else if (e.key === 'ArrowRight' && this.currentIndex < list.length - 1) {
        this.currentIndex += 1;
        this.renderQuestions();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  },

  renderQuestionCard(q, idx) {
    const isFav = Storage.isFavorite(q.id, this.chapterId);
    const mastery = Storage.getMasteryStatus(this.chapterId, q.id);
    const userAns = Storage.getUserAnswer(this.chapterId, q.id);
    const hasNote = !!Storage.getNote(this.chapterId, q.id);
    const note = hasNote ? Storage.getNote(this.chapterId, q.id) : null;

    let optionsHtml = '';
    if (q.options && q.options.length) {
      optionsHtml = '<div class="q-options">' + 
        q.options.map((opt, i) => `<div class="q-option">${String.fromCharCode(65+i)}. ${App.escapeHtml(opt)}</div>`).join('') +
        '</div>';
    }

    const answerContent = userAns.answer || q.answer || '';
    const analysisContent = userAns.analysis || q.analysis || '';
    const hasAnswer = !!answerContent;
    const hasAnalysis = !!analysisContent;

    return `
      <div class="q-card" data-qid="${q.id}">
        <div class="q-header">
          <div class="row" style="gap:10px;">
            <span class="q-number">第 ${idx + 1} 题</span>
            <span class="q-source">${App.escapeHtml(q.source || '')}</span>
            ${q.from ? `<a class="q-origin" href="practice.html?chapter=${encodeURIComponent(q.from)}&q=${q.origId || ''}" title="来自 ${App.escapeHtml(q.fromName || '')}">原卷</a>` : ''}
            ${this.curatedSet.has(q.id) ? '<span class="badge badge-orange">严选</span>' : ''}
            ${hasAnswer ? '<span class="badge badge-green">有答案</span>' : ''}
            ${hasAnalysis ? '<span class="badge badge-blue">有解析</span>' : ''}
          </div>
          <div class="q-actions">
            <button class="q-action-btn ${isFav ? 'favorited' : ''}" data-action="favorite" title="收藏">${isFav ? '★' : '☆'}</button>
            <button class="q-action-btn ${hasNote ? 'active' : ''}" data-action="note" title="笔记">📋</button>
            <button class="q-action-btn" data-action="retest" title="加入错题复测">🔄</button>
          </div>
        </div>
        <div class="q-stem">${App.escapeHtml(q.stem)}</div>
        ${optionsHtml}

        <div class="mastery-selector">
          <button class="mastery-btn ${mastery === 'mastered' ? 'active-mastered' : ''}" data-mastery="mastered">✓ 完全掌握</button>
          <button class="mastery-btn ${mastery === 'unfamiliar' ? 'active-unfamiliar' : ''}" data-mastery="unfamiliar">△ 不熟练</button>
          <button class="mastery-btn ${mastery === 'unknown' ? 'active-unknown' : ''}" data-mastery="unknown">✗ 完全不会</button>
        </div>

        <div class="answer-section">
          <div class="answer-toggle">
            <button class="toggle-btn-sm ${hasAnswer ? 'active' : ''}" data-toggle="answer">${hasAnswer ? '收起答案' : '查看答案'}</button>
            <button class="toggle-btn-sm ${hasAnalysis ? 'active' : ''}" data-toggle="analysis">${hasAnalysis ? '收起解析' : '查看解析'}</button>
            <button class="toggle-btn-sm" data-toggle="edit">编辑答案/解析</button>
          </div>
          <div class="answer-content ${hasAnswer ? 'show' : ''}" id="answer-${q.id}">
            <div class="answer-label">答案</div>
            <div class="answer-text">${answerContent ? App.escapeHtml(answerContent) : '<span class="text-secondary">暂无答案，点击"编辑答案/解析"添加</span>'}</div>
          </div>
          <div class="answer-content ${hasAnalysis ? 'show' : ''}" id="analysis-${q.id}">
            <div class="answer-label">解析</div>
            <div class="answer-text">${analysisContent ? App.escapeHtml(analysisContent) : '<span class="text-secondary">暂无解析</span>'}</div>
          </div>
          <div class="answer-content answer-edit" id="edit-${q.id}">
            <div class="answer-label">编辑答案</div>
            <textarea class="textarea" id="edit-answer-${q.id}" placeholder="输入答案...">${App.escapeHtml(userAns.answer || q.answer || '')}</textarea>
            <div class="answer-label">编辑解析</div>
            <textarea class="textarea" id="edit-analysis-${q.id}" placeholder="输入解析..." rows="4">${App.escapeHtml(userAns.analysis || q.analysis || '')}</textarea>
            <button class="btn btn-primary btn-sm" data-save-edit="${q.id}">保存</button>
          </div>
        </div>
      </div>
    `;
  },

  bindQuestionEvents() {
    const container = document.getElementById('questions-container');

    // 收藏
    container.querySelectorAll('[data-action="favorite"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const qid = parseInt(card.dataset.qid);
        if (Storage.isFavorite(qid, this.chapterId)) {
          Storage.removeFavorite(qid, this.chapterId);
          btn.classList.remove('favorited');
          btn.textContent = '☆';
        } else {
          Storage.addFavorite(qid, this.chapterId);
          btn.classList.add('favorited');
          btn.textContent = '★';
        }
      });
    });

    // 笔记
    container.querySelectorAll('[data-action="note"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const qid = parseInt(card.dataset.qid);
        this.openNoteModal(qid);
      });
    });

    // 加入错题复测
    container.querySelectorAll('[data-action="retest"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const qid = parseInt(card.dataset.qid);
        Storage.addToRetest(qid, this.chapterId);
        btn.textContent = '✓';
        btn.style.color = 'var(--success)';
        setTimeout(() => { btn.textContent = '🔄'; btn.style.color = ''; }, 1500);
      });
    });

    // 掌握状态
    container.querySelectorAll('.mastery-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const qid = parseInt(card.dataset.qid);
        const status = btn.dataset.mastery;
        Storage.setMasteryStatus(this.chapterId, qid, status);
        Storage.markDone(this.chapterId, qid);
        // 刷新卡片样式
        card.querySelectorAll('.mastery-btn').forEach(b => {
          b.classList.remove('active-mastered', 'active-unfamiliar', 'active-unknown');
        });
        const cls = status === 'mastered' ? 'active-mastered' : status === 'unfamiliar' ? 'active-unfamiliar' : 'active-unknown';
        btn.classList.add(cls);
        // 记录学习活动(今日刷题数 / 连续学习 / 热力图)
        Storage.recordActivity(1);
        // 更新进度计数
        this.updateProgressCount();
        // 专注布局:判定后自动进入下一题
        if (this.layout === 'focus') {
          const total = this.getFilteredQuestions().length;
          if (this.currentIndex < total - 1) this.currentIndex += 1;
          this.renderQuestions();
        }
      });
    });

    // 答案/解析展开收起
    container.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const qid = parseInt(card.dataset.qid);
        const type = btn.dataset.toggle;
        const target = document.getElementById(`${type}-${qid}`);
        const isActive = btn.classList.contains('active');
        btn.classList.toggle('active');
        target.classList.toggle('show');
        const labels = { answer: '答案', analysis: '解析', edit: '编辑答案/解析' };
        btn.textContent = isActive ? `查看${labels[type]}` : `收起${type === 'edit' ? '' : labels[type]}`;
      });
    });

    // 保存编辑
    container.querySelectorAll('[data-save-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const qid = parseInt(card.dataset.qid);
        const answer = document.getElementById(`edit-answer-${qid}`).value;
        const analysis = document.getElementById(`edit-analysis-${qid}`).value;
        Storage.setUserAnswer(this.chapterId, qid, answer, analysis);
        // 更新显示
        const answerDiv = document.getElementById(`answer-${qid}`).querySelector('.answer-text');
        const analysisDiv = document.getElementById(`analysis-${qid}`).querySelector('.answer-text');
        answerDiv.innerHTML = answer ? App.escapeHtml(answer) : '<span class="text-secondary">暂无答案</span>';
        analysisDiv.innerHTML = analysis ? App.escapeHtml(analysis) : '<span class="text-secondary">暂无解析</span>';
        btn.textContent = '已保存 ✓';
        setTimeout(() => { btn.textContent = '保存'; }, 1500);
      });
    });
  },

  openNoteModal(qid) {
    const note = Storage.getNote(this.chapterId, qid);
    const modal = document.createElement('div');
    modal.className = 'note-modal show';
    modal.innerHTML = `
      <div class="note-modal-content">
        <h3>题目笔记</h3>
        <textarea class="textarea" id="note-content" placeholder="记录你的思路、推导或关键点..." rows="6">${note ? App.escapeHtml(note.content) : ''}</textarea>
        <input type="text" class="input note-tags-input" id="note-tags" placeholder="标签（用逗号分隔）" value="${note ? (note.tags || []).join(',') : ''}">
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button class="btn btn-secondary" id="note-cancel">取消</button>
          <button class="btn btn-primary" id="note-save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.getElementById('note-cancel').addEventListener('click', close);
    document.getElementById('note-save').addEventListener('click', () => {
      const content = document.getElementById('note-content').value;
      const tags = document.getElementById('note-tags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      if (content.trim()) {
        Storage.setNote(this.chapterId, qid, content, tags);
      } else {
        Storage.deleteNote(this.chapterId, qid);
      }
      close();
      this.renderQuestions(); // 刷新笔记图标状态
    });
  },

  updateProgressCount() {
    const progress = Storage.getChapterProgress(this.chapterId);
    const meta = document.querySelector('.practice-meta');
    if (meta) meta.textContent = `已完成 ${progress.length} / ${this.questions.length} 题`;
  }
};

document.addEventListener('DOMContentLoaded', () => PracticePage.init());
