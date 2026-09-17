/* dashboard.js - 学习仪表盘组件(首页 + 学习记录页共用) */
const Dashboard = {
  /* 热力图强度分级:0 无 / 1 轻 / 2 中 / 3 高 / 4 很高 */
  getLevel(count) {
    if (count <= 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  },

  getLevelLabel(level) {
    return ['无', '轻', '中', '高', '很高'][level] || '无';
  },

  /* 学习活动统计的起始月份(默认 9 月) */
  STUDY_START_MONTH: 9,

  /* 统计起点:当前"学年"的 9 月 1 日(若当前月早于 9 月, 则回溯到上一年) */
  getRangeStart() {
    const today = new Date();
    const m = this.STUDY_START_MONTH;
    let year = today.getFullYear();
    if (today.getMonth() + 1 < m) year -= 1;
    return new Date(year, m - 1, 1);
  },

  /* 统计终点:同年 12 月 31 日(覆盖到考研结束, 未来日期留空占位) */
  getRangeEnd() {
    const start = this.getRangeStart();
    return new Date(start.getFullYear(), 11, 31);
  },

  /* 构建起止范围内的逐日数据, 并按周切分 */
  buildWeeks() {
    const activity = Storage.getDailyActivity();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = this.getRangeStart();
    const end = this.getRangeEnd();

    const cells = [];
    // 首周对齐到周日(空位不计入作答)
    for (let i = 0; i < start.getDay(); i++) cells.push(null);

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = Storage._dateKey(cursor.getTime());
      cells.push({
        date: key,
        count: activity[key] || 0,
        time: cursor.getTime(),
        future: cursor > today
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  },

  /* 渲染热力图 HTML */
  renderHeatmap() {
    const weeks = this.buildWeeks();
    const todayKey = Storage._dateKey();

    // 月份标签:取每周第一个有效日期, 月份变化处打标
    let monthLabels = '';
    let lastMonth = -1;
    weeks.forEach(week => {
      const first = week.find(c => c);
      const m = first ? new Date(first.time).getMonth() + 1 : lastMonth;
      const width = week.length * 15;
      if (m !== lastMonth && first) {
        monthLabels += `<span style="flex:0 0 auto;width:${width}px;">${m}月</span>`;
        lastMonth = m;
      } else {
        monthLabels += `<span style="flex:0 0 auto;width:${width}px;"></span>`;
      }
    });

    const cellsHtml = weeks.map(week => {
      let col = '';
      for (let i = 0; i < 7; i++) {
        const cell = week[i];
        if (!cell) {
          col += '<div class="heat-cell empty"></div>';
          continue;
        }
        // 尚未到来的日期:留占位, 不参与强度统计
        if (cell.future) {
          col += `<div class="heat-cell future" title="${cell.date}(未到)"></div>`;
          continue;
        }
        const level = this.getLevel(cell.count);
        const isToday = cell.date === todayKey;
        col += `<div class="heat-cell" data-level="${level}" title="${cell.date}:${cell.count} 次作答判定${isToday ? '(今天)' : ''}"${isToday ? ' style="outline:1px solid var(--accent);outline-offset:1px;"' : ''}></div>`;
      }
      return `<div style="display:grid;grid-template-rows:repeat(7,12px);gap:3px;">${col}</div>`;
    }).join('');

    return `
      <div class="heatmap-wrap">
        <div style="display:flex;gap:3px;font-size:11px;color:var(--text-tertiary);margin-bottom:6px;">${monthLabels}</div>
        <div style="display:flex;gap:3px;">${cellsHtml}</div>
      </div>
      <div class="heat-legend">
        <span>刷题强度</span>
        <span>无</span>
        <div class="heat-cell" data-level="0"></div>
        <div class="heat-cell" data-level="1"></div>
        <div class="heat-cell" data-level="2"></div>
        <div class="heat-cell" data-level="3"></div>
        <div class="heat-cell" data-level="4"></div>
        <span>很高</span>
      </div>
    `;
  },

  /* 通知:汇总本机可执行的待办提醒 */
  async getNotifications(chapters) {
    const items = [];

    // 到期的错题复测
    const due = Storage.getDueRetest();
    if (due.length) {
      items.push({
        icon: '🔄',
        text: `${due.length} 道错题今日到期,建议复测`,
        link: 'retest.html'
      });
    }

    // 收藏了但尚未掌握
    const favorites = Storage.getFavorites();
    if (favorites.length) {
      const pending = favorites.filter(f => Storage.getMasteryStatus(f.chapterId, f.id) !== 'mastered');
      if (pending.length) {
        items.push({
          icon: '⭐',
          text: `收藏本中有 ${pending.length} 道题还未标记掌握`,
          link: 'favorites.html'
        });
      }
    }

    // 做了一半的章节
    const totals = await DataLoader.getChapterTotals();
    const inProgress = chapters
      .map(c => ({ c, done: Storage.getChapterProgress(c.id).length, total: totals[c.id] || 0 }))
      .filter(x => x.done > 0 && x.done < x.total);
    if (inProgress.length) {
      const first = inProgress[0];
      items.push({
        icon: '📘',
        text: `《${first.c.name}》已完成 ${first.done}/${first.total} 题,还没做完`,
        link: `practice.html?chapter=${encodeURIComponent(first.c.id)}`
      });
    }

    return items;
  },

  renderNotificationCard(items) {
    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="row-between" style="margin-bottom:14px;">
          <h2 style="font-size:17px;">通知</h2>
          <a class="text-secondary text-sm" href="learning-records.html">查看学习记录 →</a>
        </div>
        ${items.length === 0
          ? '<p class="text-secondary text-sm">暂无新通知。开始练习后,待复测、未掌握的收藏题和没做完的章节会在这里提醒你。</p>'
          : items.map(it => `
              <div class="notice-item">
                <span class="notice-icon">${it.icon}</span>
                <span class="notice-text">${App.escapeHtml(it.text)}</span>
                <a class="btn btn-secondary btn-sm" href="${it.link}">去看看</a>
              </div>
            `).join('')
        }
      </div>
    `;
  },

  /* 渲染仪表盘卡片组 HTML */
  async renderCards(chapters) {
    const daysLeft = Storage.getDaysLeft();
    const exam = Storage.getExamConfig();
    const todayCount = Storage.getTodayCount();
    const streak = Storage.getStreak();
    const maxStreak = Storage.getMaxStreak();
    const totalCount = Storage.getTotalCount();
    const activeDays = Storage.getActiveDayCount();

    // 继续学习:优先上次学习章节,否则第一个有题目的章节
    // (题量取自预生成索引, 首页无需加载任何题库文件)
    const totals = await DataLoader.getChapterTotals();
    const hasQuestions = (c) => (totals[c.id] || 0) > 0;

    const last = Storage.getLastChapter();
    let target = null;
    if (last) {
      const lastChapter = chapters.find(c => c.id === last.chapterId);
      if (lastChapter && hasQuestions(lastChapter)) target = lastChapter;
    }
    if (!target) target = chapters.find(hasQuestions) || chapters[0];

    let continueCard = '';
    if (target) {
      const total = totals[target.id] || 0;
      const done = Storage.getChapterProgress(target.id).length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      const lastTime = last && last.chapterId === target.id ? last.time : 0;
      continueCard = `
        <div class="dash-card continue-card" style="grid-column:span 2;">
          <div class="dash-label">继续学习</div>
          <div class="dash-value">${App.escapeHtml(target.parentName)} · ${App.escapeHtml(target.name)}</div>
          <div class="dash-sub">
            已完成 ${done} 题 · 还剩 ${Math.max(0, total - done)} 题
            ${lastTime ? ' · 上次学习 ' + App.formatDate(lastTime) : ''}
          </div>
          <div class="progress-bar"><div class="fill" style="width:${percent}%"></div></div>
          <a class="btn" href="practice.html?chapter=${encodeURIComponent(target.id)}">继续练习 →</a>
        </div>
      `;
    }

    return `
      <div class="dash-grid">
        ${continueCard}
        <div class="dash-card">
          <div class="dash-label">考研倒计时</div>
          <div class="dash-value accent">${daysLeft}<span class="unit">天</span></div>
          <div class="dash-sub">${App.escapeHtml(exam.name)} · ${exam.date}</div>
        </div>
        <div class="dash-card">
          <div class="dash-label">今日刷题数</div>
          <div class="dash-value ${todayCount > 0 ? 'success' : ''}">${todayCount}<span class="unit">题</span></div>
          <div class="dash-sub">累计作答 ${totalCount} 题</div>
        </div>
        <div class="dash-card">
          <div class="dash-label">连续学习</div>
          <div class="dash-value ${streak > 0 ? 'warning' : ''}">${streak}<span class="unit">天</span></div>
          <div class="dash-sub">最长纪录 ${maxStreak} 天 · 共 ${activeDays} 个作答日</div>
        </div>
      </div>
    `;
  }
};

/* ===== 首页 ===== */
const HomePage = {
  async init() {
    const main = document.getElementById('main-content');
    const chapters = await DataLoader.getAllChapters();

    if (!chapters.length) {
      main.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><h3>暂无章节</h3><p>请先配置题目分类</p></div>';
      return;
    }

    const cardsHtml = await Dashboard.renderCards(chapters);
    const cats = await DataLoader.loadCategories();
    const totals = await DataLoader.getChapterTotals();

    // 章节条目右侧标注:已做题数 / 尚未录入题目
    const chapterMeta = (id) => {
      if (!(totals[id] > 0)) return '<span class="text-tertiary text-xs"> · 待录入</span>';
      const done = Storage.getChapterProgress(id).length;
      return done ? `<span class="text-secondary text-xs"> · 已做 ${done}</span>` : '';
    };

    // 章节网格
    let gridHtml = '';
    cats.categories.forEach(cat => {
      gridHtml += `<div style="margin-bottom:20px;">
        <h3 style="font-size:15px;color:var(--text-secondary);margin-bottom:10px;">${cat.icon || '📁'} ${App.escapeHtml(cat.name)}</h3>
        <div class="chapter-grid">`;
      (cat.children || []).forEach(child => {
        if (child.children) {
          gridHtml += `<details class="year-picker">
            <summary>${App.escapeHtml(child.name)}<span class="text-secondary">${child.children.length} 套试卷</span></summary>
            <div class="year-papers">${child.children.map(paper => `
              <a class="chapter-entry" href="practice.html?chapter=${encodeURIComponent(paper.id)}">${App.escapeHtml(paper.name)}${chapterMeta(paper.id)}</a>
            `).join('')}</div>
          </details>`;
        } else {
          gridHtml += `<a class="chapter-entry" href="practice.html?chapter=${encodeURIComponent(child.id)}">${App.escapeHtml(child.name)}${chapterMeta(child.id)}</a>`;
        }
      });
      gridHtml += `</div></div>`;
    });

    const activeDays = Storage.getActiveDayCount();
    const notifications = await Dashboard.getNotifications(chapters);

    main.innerHTML = `
      ${cardsHtml}
      ${Dashboard.renderNotificationCard(notifications)}
      <div class="card" style="margin-bottom:20px;">
        <div class="row-between" style="margin-bottom:14px;">
          <h2 style="font-size:17px;">学习活动</h2>
          <span class="text-secondary text-sm">每日作答 · 已记录 ${activeDays} 个作答日</span>
        </div>
        ${Dashboard.renderHeatmap()}
      </div>
      <div class="card">
        <h2 style="font-size:17px;margin-bottom:16px;">题库分类</h2>
        ${gridHtml}
      </div>
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => HomePage.init());
