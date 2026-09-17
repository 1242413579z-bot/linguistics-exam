/* main.js - 公共逻辑：侧边栏、导航、主题 */
const App = {
  currentPage: '',

  async init() {
    this.detectPage();
    await this.renderSidebar();
    this.initTheme();
    this.bindEvents();
    await this.setActiveNav();
  },

  detectPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    this.currentPage = path;
  },

  /* ===== 主题 ===== */
  initTheme() {
    const settings = Storage.getSettings();
    const theme = settings.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcon(theme);
  },

  toggleTheme() {
    const settings = Storage.getSettings();
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    settings.theme = newTheme;
    Storage.setSettings(settings);
    document.documentElement.setAttribute('data-theme', newTheme);
    this.updateThemeIcon(newTheme);
  },

  updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  /* ===== 侧边栏 ===== */
  SCOPES: [
    { key: 'all', label: '完整', desc: '全部题目' },
    { key: 'curated', label: '严选', desc: '高频优质题' },
    { key: 'past', label: '真题', desc: '按年份' }
  ],

  getScope() {
    return Storage.getSettings().scope || 'all';
  },

  setScope(scope) {
    const settings = Storage.getSettings();
    settings.scope = scope;
    Storage.setSettings(settings);
  },

  async renderSidebar() {
    const sidebar = document.getElementById('sidebar-body');
    if (!sidebar) return;

    const scope = this.getScope();

    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-title">学习概览</div>
        <a class="sidebar-link" href="index.html" data-page="index.html"><span class="icon">🏠</span>学习首页</a>
        <a class="sidebar-link" href="learning-records.html" data-page="learning-records.html"><span class="icon">📊</span>学习记录</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">题库范围</div>
        <div class="scope-switch">
          ${this.SCOPES.map(s => `<button class="scope-chip ${scope === s.key ? 'active' : ''}" data-scope="${s.key}" title="${s.desc}">${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">题库快捷入口</div>
        <a class="sidebar-link" href="favorites.html" data-page="favorites.html"><span class="icon">⭐</span>收藏本</a>
        <a class="sidebar-link" href="mastery.html" data-page="mastery.html"><span class="icon">🗺️</span>掌握地图</a>
        <a class="sidebar-link" href="retest.html" data-page="retest.html"><span class="icon">🔄</span>错题复测</a>
        <a class="sidebar-link" href="paper.html" data-page="paper.html"><span class="icon">📝</span>智能组卷</a>
        <a class="sidebar-link" href="notes.html" data-page="notes.html"><span class="icon">📋</span>题目笔记</a>
      </div>
      <div class="sidebar-section" id="category-section"></div>
    `;

    sidebar.innerHTML = html;

    await this.renderCategoryTree(scope);

    // 范围切换
    sidebar.querySelectorAll('.scope-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const next = chip.dataset.scope;
        this.setScope(next);
        sidebar.querySelectorAll('.scope-chip').forEach(c => c.classList.toggle('active', c.dataset.scope === next));
        await this.renderCategoryTree(next);
        this.setActiveNav();
      });
    });
  },

  /* 按当前范围渲染分类树 */
  async renderCategoryTree(scope) {
    const cats = await DataLoader.loadCategories();
    const section = document.getElementById('category-section');
    if (!section) return;

    const scopeLabel = (this.SCOPES.find(s => s.key === scope) || {}).label || '完整';

    let html = `<div class="sidebar-section-title">题库分类 · ${scopeLabel}</div>`;

    cats.categories.forEach((cat, idx) => {
      html += `
        <div class="category-group ${idx === 0 ? '' : 'collapsed'}">
          <div class="category-header" data-toggle="${cat.id}">
            <span>${cat.icon || '📁'} ${cat.name}</span>
            <span class="arrow">▼</span>
          </div>
          <div class="category-children">
      `;
      (cat.children || []).forEach(child => {
        if (child.children) {
          // 三级分类: 年份 -> 试卷
          html += `<div class="category-subgroup collapsed">
            <div class="category-subheader" data-toggle="${child.id}">
              <span>${child.name}</span>
              <span class="arrow">▼</span>
            </div>
            <div class="category-subchildren">`;
          child.children.forEach(sub => {
            html += `<a class="category-child" href="practice.html?chapter=${sub.id}&scope=${scope}" data-chapter="${sub.id}">${sub.name}</a>`;
          });
          html += `</div></div>`;
        } else {
          html += `<a class="category-child" href="practice.html?chapter=${child.id}&scope=${scope}" data-chapter="${child.id}">${child.name}</a>`;
        }
      });
      html += `</div></div>`;
    });

    section.innerHTML = html;

    // 绑定分类折叠
    section.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });
    // 绑定子分类折叠
    section.querySelectorAll('.category-subheader').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });
  },

  /* ===== 事件绑定 ===== */
  bindEvents() {
    // 主题切换
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

    // 侧边栏收起
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.toggle('show');
          overlay?.classList.toggle('show');
        } else {
          sidebar.classList.toggle('collapsed');
        }
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
      });
    }

    // 学习区/工具区切换
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (href) window.location.href = href;
      });
    });
  },

  async setActiveNav() {
    // 设置侧边栏激活状态
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
      if (link.dataset.page === this.currentPage) link.classList.add('active');
    });

    // 设置顶部导航激活
    const isTools = this.currentPage === 'tools.html';
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const href = tab.getAttribute('href');
      if ((isTools && href === 'tools.html') || (!isTools && href !== 'tools.html')) {
        tab.classList.add('active');
      }
    });

    const params = new URLSearchParams(window.location.search);

    // 侧边栏范围与当前页 scope 保持一致
    const urlScope = params.get('scope');
    if (urlScope && this.SCOPES.some(s => s.key === urlScope)) {
      if (this.getScope() !== urlScope) {
        this.setScope(urlScope);
        await this.renderCategoryTree(urlScope);
      }
      document.querySelectorAll('.scope-chip').forEach(c => c.classList.toggle('active', c.dataset.scope === urlScope));
    }

    // 章节激活
    const chapter = params.get('chapter');
    if (chapter) {
      document.querySelectorAll('.category-child').forEach(child => {
        if (child.dataset.chapter === chapter) {
          child.classList.add('active');
          child.closest('.category-subgroup')?.classList.remove('collapsed');
          child.closest('.category-group')?.classList.remove('collapsed');
        }
      });
    }
  },

  /* ===== 工具方法 ===== */
  getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  formatDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
