/* main.js - 公共逻辑：侧边栏、导航、主题 */
const App = {
  currentPage: '',

  async init() {
    this.detectPage();
    await this.renderSidebar();
    this.initTheme();
    this.bindEvents();
    this.setActiveNav();
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
  async renderSidebar() {
    const cats = await DataLoader.loadCategories();
    const sidebar = document.getElementById('sidebar-body');
    if (!sidebar) return;

    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-title">题库快捷入口</div>
        <a class="sidebar-link" href="favorites.html" data-page="favorites.html"><span class="icon">⭐</span>收藏本</a>
        <a class="sidebar-link" href="mastery.html" data-page="mastery.html"><span class="icon">🗺️</span>掌握地图</a>
        <a class="sidebar-link" href="retest.html" data-page="retest.html"><span class="icon">🔄</span>错题复测</a>
        <a class="sidebar-link" href="paper.html" data-page="paper.html"><span class="icon">📝</span>智能组卷</a>
        <a class="sidebar-link" href="notes.html" data-page="notes.html"><span class="icon">📋</span>题目笔记</a>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">题库分类</div>
    `;

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
        html += `<a class="category-child" href="practice.html?chapter=${child.id}" data-chapter="${child.id}">${child.name}</a>`;
      });
      html += `</div></div>`;
    });

    html += `</div>`;
    sidebar.innerHTML = html;

    // 绑定分类折叠
    sidebar.querySelectorAll('.category-header').forEach(header => {
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

  setActiveNav() {
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

    // 章节激活
    const params = new URLSearchParams(window.location.search);
    const chapter = params.get('chapter');
    if (chapter) {
      document.querySelectorAll('.category-child').forEach(child => {
        if (child.dataset.chapter === chapter) child.classList.add('active');
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
