/* paper.js - 智能组卷 */
const PaperPage = {
  mode: 'standard',
  sources: { wrong: true, favorites: true, notes: false },
  paperCount: 10,

  async init() {
    this.render();
  },

  async render() {
    const main = document.getElementById('main-content');
    const history = Storage.getPaperHistory();

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📝 智能组卷</h1>
        <button class="btn btn-secondary" id="view-history">查看历史 (${history.length})</button>
      </div>

      <div class="tabs" style="margin-bottom:20px;display:inline-flex;">
        <div class="tab ${this.mode === 'standard' ? 'active' : ''}" data-mode="standard">标准卷</div>
        <div class="tab ${this.mode === 'custom' ? 'active' : ''}" data-mode="custom">自定义卷</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:12px;">${this.mode === 'standard' ? '标准卷规则' : '自定义卷设置'}</h3>
          <p class="text-secondary text-sm" style="margin-bottom:16px;">
            ${this.mode === 'standard' 
              ? '个人题源不足时，会优先补入待巩固题；仍有缺口时允许生成降级标准卷。'
              : '自定义题源、题量，生成专属练习卷。'}
          </p>

          ${this.mode === 'custom' ? `
            <div style="margin-bottom:16px;">
              <label class="text-sm" style="display:block;margin-bottom:6px;">题目数量</label>
              <input type="number" class="input" id="paper-count" value="${this.paperCount}" min="1" max="100" style="width:120px;">
            </div>
          ` : ''}

          <h4 style="font-size:14px;margin-bottom:10px;">题目来源</h4>
          <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;">
            <input type="checkbox" id="src-wrong" ${this.sources.wrong ? 'checked' : ''}>
            <span>❌ 错题</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;">
            <input type="checkbox" id="src-favorites" ${this.sources.favorites ? 'checked' : ''}>
            <span>⭐ 收藏题</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;">
            <input type="checkbox" id="src-notes" ${this.sources.notes ? 'checked' : ''}>
            <span>📋 有笔记的题</span>
          </label>
        </div>

        <div>
          <div class="card" style="margin-bottom:16px;">
            <h3 style="font-size:16px;margin-bottom:12px;">组卷资格</h3>
            <div class="row-between" style="margin-bottom:8px;">
              <span class="text-sm text-secondary">预计题数</span>
              <span id="expected-count">0</span>
            </div>
            <div class="row-between" style="margin-bottom:8px;">
              <span class="text-sm text-secondary">候选题数</span>
              <span id="candidate-count">0</span>
            </div>
            <div class="row-between" style="margin-bottom:16px;">
              <span class="text-sm text-secondary">题库补充</span>
              <span id="supplement-count">0</span>
            </div>
            <button class="btn btn-secondary" style="width:100%;margin-bottom:8px;" id="check-btn">检查可组卷</button>
            <button class="btn btn-primary" style="width:100%;" id="create-btn">创建智能组卷</button>
          </div>
        </div>
      </div>

      <div id="paper-result" style="margin-top:20px;"></div>
    `;

    // 模式切换
    main.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.mode = tab.dataset.mode;
        this.render();
      });
    });

    // 来源勾选
    document.getElementById('src-wrong').addEventListener('change', (e) => { this.sources.wrong = e.target.checked; });
    document.getElementById('src-favorites').addEventListener('change', (e) => { this.sources.favorites = e.target.checked; });
    document.getElementById('src-notes').addEventListener('change', (e) => { this.sources.notes = e.target.checked; });
    document.getElementById('paper-count')?.addEventListener('change', (e) => { this.paperCount = parseInt(e.target.value) || 10; });

    document.getElementById('check-btn').addEventListener('click', () => this.checkEligibility());
    document.getElementById('create-btn').addEventListener('click', () => this.createPaper());
    document.getElementById('view-history').addEventListener('click', () => this.showHistory());
  },

  async getCandidates() {
    const candidates = [];
    const all = await DataLoader.getAllQuestions();
    const wrongSet = new Set(Storage.getRetestList().map(r => `${r.chapterId}:${r.id}`));
    const favSet = new Set(Storage.getFavorites().map(f => `${f.chapterId}:${f.id}`));
    const notesKeys = Object.keys(Storage.getNotes());

    all.forEach(q => {
      const key = `${q.chapterId}:${q.id}`;
      if (this.sources.wrong && wrongSet.has(key)) candidates.push(q);
      else if (this.sources.favorites && favSet.has(key)) candidates.push(q);
      else if (this.sources.notes && notesKeys.includes(key)) candidates.push(q);
    });

    return candidates;
  },

  async checkEligibility() {
    const candidates = await this.getCandidates();
    const expected = this.mode === 'standard' ? 10 : this.paperCount;
    document.getElementById('expected-count').textContent = expected;
    document.getElementById('candidate-count').textContent = candidates.length;
    document.getElementById('supplement-count').textContent = Math.max(0, expected - candidates.length);
  },

  async createPaper() {
    const candidates = await this.getCandidates();
    const expected = this.mode === 'standard' ? 10 : this.paperCount;

    if (candidates.length === 0) {
      alert('没有可用的题目来源！请先在练习页收藏题目、加入错题或添加笔记。');
      return;
    }

    // 随机抽取
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const paper = shuffled.slice(0, Math.min(expected, shuffled.length));

    // 保存历史
    Storage.addPaperHistory({
      mode: this.mode,
      sources: { ...this.sources },
      count: paper.length,
      questions: paper.map(q => ({ id: q.id, chapterId: q.chapterId, stem: q.stem }))
    });

    // 显示结果
    const result = document.getElementById('paper-result');
    result.innerHTML = `
      <div class="card">
        <h3 style="font-size:16px;margin-bottom:16px;">已生成试卷（${paper.length} 题）</h3>
        ${paper.map((q, i) => `
          <div style="padding:12px 0;border-bottom:1px solid var(--border-light);">
            <div class="row" style="gap:10px;margin-bottom:6px;">
              <span class="q-number">第 ${i+1} 题</span>
              <span class="q-source">${App.escapeHtml(q.parentName || '')} · ${App.escapeHtml(q.chapterName || '')}</span>
              <span class="badge badge-gray">${App.escapeHtml(q.source || '')}</span>
            </div>
            <div class="q-stem" style="font-size:14px;">${App.escapeHtml(q.stem)}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  showHistory() {
    const history = Storage.getPaperHistory();
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📝 组卷历史</h1>
        <button class="btn btn-secondary" onclick="PaperPage.render()">返回组卷</button>
      </div>
      ${history.length === 0 ? '<div class="card empty-state"><h3>暂无组卷记录</h3></div>' :
        history.map(h => `
          <div class="card" style="margin-bottom:12px;">
            <div class="row-between" style="margin-bottom:8px;">
              <strong>${h.mode === 'standard' ? '标准卷' : '自定义卷'} · ${h.count} 题</strong>
              <span class="text-xs text-secondary">${App.formatDate(h.createdAt)}</span>
            </div>
            <div class="text-sm text-secondary">题目来源：${h.sources.wrong ? '错题 ' : ''}${h.sources.favorites ? '收藏 ' : ''}${h.sources.notes ? '笔记' : ''}</div>
          </div>
        `).join('')
      }
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => PaperPage.init());
