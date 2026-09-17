/* knowledge.js - 知识目录:按学科大纲浏览章节与掌握进度 */
const KnowledgePage = {
  cats: null,

  async init() {
    this.cats = await DataLoader.loadCategories();
    const totals = await DataLoader.getChapterTotals();
    const masteryCounts = Storage.getMasteryCountsByChapter();

    // 逐章节统计(仅读本地数据与预生成索引, 不加载题库文件)
    this.sections = [];
    this.cats.categories.forEach(cat => {
      const chapters = [];
      (cat.children || []).forEach(child => {
        if (child.children) {
          child.children.forEach(sub => {
            chapters.push({ id: sub.id, name: sub.name, group: child.name });
          });
        } else {
          chapters.push({ id: child.id, name: child.name, group: null });
        }
      });

      const rows = chapters.map(ch => {
        const m = masteryCounts[ch.id] || { mastered: 0, unfamiliar: 0, unknown: 0 };
        return {
          ...ch,
          total: totals[ch.id] || 0,
          done: Storage.getChapterProgress(ch.id).length,
          mastered: m.mastered,
          unfamiliar: m.unfamiliar,
          unknown: m.unknown
        };
      });
      this.sections.push({ cat, rows });
    });

    this.render();
  },

  render() {
    const main = document.getElementById('main-content');
    const displayName = Storage.getSetting('displayName', '');

    const totalQ = this.sections.reduce((s, sec) => s + sec.rows.reduce((a, r) => a + r.total, 0), 0);
    const totalMastered = this.sections.reduce((s, sec) => s + sec.rows.reduce((a, r) => a + r.mastered, 0), 0);

    const toc = this.sections.map(sec => `
      <div class="toc-group">
        <div class="toc-group-title">${sec.cat.icon || '📁'} ${App.escapeHtml(sec.cat.name)}</div>
        ${sec.rows.filter(r => r.total > 0).map(r =>
          `<a class="toc-link" data-target="cat-${r.id}">${App.escapeHtml(r.name)}</a>`
        ).join('')}
      </div>
    `).join('');

    const body = this.sections.map(sec => `
      <div class="knowledge-section" id="sec-${sec.cat.id}">
        <div class="knowledge-section-head">
          <h2 style="font-size:18px;">${sec.cat.icon || '📁'} ${App.escapeHtml(sec.cat.name)}</h2>
          <span class="text-secondary text-sm">${sec.rows.reduce((a, r) => a + r.total, 0)} 题 · ${sec.rows.filter(r => r.total > 0).length} 个章节</span>
        </div>
        <div class="card">
          ${sec.rows.length === 0 ? '<p class="text-secondary text-sm">该分类下暂无章节</p>' :
            sec.rows.map(r => this.renderChapterRow(r)).join('')}
        </div>
      </div>
    `).join('');

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📖 知识目录</h1>
        <span class="text-secondary text-sm">共 ${totalQ} 题 · 已掌握 ${totalMastered} 题${displayName ? ' · ' + App.escapeHtml(displayName) : ''}</span>
      </div>

      <div class="knowledge-layout">
        <aside class="knowledge-toc">
          <div class="knowledge-toc-title">知识目录</div>
          ${toc}
        </aside>
        <div id="knowledge-body">${body}</div>
      </div>
    `;

    // 目录跳转 + 高亮
    main.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', () => {
        const el = document.getElementById(link.dataset.target);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        main.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    this.bindScrollSpy();
  },

  renderChapterRow(r) {
    const percent = r.total ? Math.round((r.done / r.total) * 100) : 0;
    const empty = r.total === 0;
    return `
      <div class="knowledge-chapter" id="cat-${r.id}">
        <div class="knowledge-chapter-main">
          <div class="knowledge-chapter-name">
            ${r.group ? `<span class="text-secondary text-sm">${App.escapeHtml(r.group)} · </span>` : ''}${App.escapeHtml(r.name)}
          </div>
          ${empty
            ? '<div class="knowledge-chapter-meta">暂无题目</div>'
            : `<div class="knowledge-chapter-meta">
                 共 ${r.total} 题 · 已做 ${r.done} 题
                 ${r.mastered ? ` · <span style="color:var(--success);">掌握 ${r.mastered}</span>` : ''}
                 ${r.unfamiliar ? ` · <span style="color:var(--warning);">不熟练 ${r.unfamiliar}</span>` : ''}
                 ${r.unknown ? ` · <span style="color:var(--danger);">不会 ${r.unknown}</span>` : ''}
               </div>
               <div class="progress-bar" style="max-width:320px;"><div class="fill" style="width:${percent}%"></div></div>`
          }
        </div>
        ${empty ? '' : `<a class="btn btn-secondary btn-sm" href="practice.html?chapter=${encodeURIComponent(r.id)}&scope=${App.getScope()}">去练习</a>`}
      </div>
    `;
  },

  /* 滚动时高亮当前目录项 */
  bindScrollSpy() {
    const links = [...document.querySelectorAll('.toc-link')];
    if (!links.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const link = links.find(l => l.dataset.target === entry.target.id);
        if (link) {
          links.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    links.forEach(l => {
      const el = document.getElementById(l.dataset.target);
      if (el) observer.observe(el);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => KnowledgePage.init());
