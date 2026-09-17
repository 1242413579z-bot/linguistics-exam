/* settings.js - 设置页 */
const SettingsPage = {
  render() {
    const main = document.getElementById('main-content');
    const settings = Storage.getSettings();
    const exam = Storage.getExamConfig();
    const layout = App.getLayout();
    const scope = App.getScope();
    const theme = settings.theme || 'light';

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⚙️ 设置</h1>
      </div>

      <!-- 显示设置 -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="font-size:16px;margin-bottom:6px;">显示设置</h3>
        <p class="text-secondary text-sm" style="margin-bottom:16px;">选择练习时的题目呈现方式。</p>

        <div class="setting-options">
          <label class="setting-option ${layout === 'classic' ? 'active' : ''}">
            <input type="radio" name="layout" value="classic" ${layout === 'classic' ? 'checked' : ''}>
            <div>
              <div class="setting-option-title">经典布局</div>
              <div class="setting-option-desc">保留当前导航，连续浏览题目</div>
            </div>
          </label>
          <label class="setting-option ${layout === 'focus' ? 'active' : ''}">
            <input type="radio" name="layout" value="focus" ${layout === 'focus' ? 'checked' : ''}>
            <div>
              <div class="setting-option-title">专注布局</div>
              <div class="setting-option-desc">每次一题，底部题号快速切换（支持 ← → 键）</div>
            </div>
          </label>
        </div>
      </div>

      <!-- 个人设置 -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="font-size:16px;margin-bottom:6px;">个人设置</h3>
        <p class="text-secondary text-sm" style="margin-bottom:16px;">名称与默认范围仅保存在本机浏览器。</p>

        <div style="margin-bottom:16px;">
          <label class="text-sm" style="display:block;margin-bottom:6px;">显示名称</label>
          <input type="text" class="input" id="display-name" placeholder="例如:语言学考研人" value="${App.escapeHtml(settings.displayName || '')}" style="max-width:320px;">
        </div>

        <div>
          <label class="text-sm" style="display:block;margin-bottom:8px;">默认题库范围</label>
          <div class="row" style="gap:8px;">
            ${App.SCOPES.map(s => `
              <button class="chip ${scope === s.key ? 'active' : ''}" data-scope="${s.key}">${s.label}</button>
            `).join('')}
          </div>
          <p class="text-secondary text-xs" style="margin-top:8px;">进入练习页时默认选中的范围(链接中带 scope 参数时以链接为准)。</p>
        </div>
      </div>

      <!-- 学习目标 -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="font-size:16px;margin-bottom:6px;">学习目标</h3>
        <p class="text-secondary text-sm" style="margin-bottom:16px;">用于首页倒计时卡片。</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <input type="text" class="input" id="exam-name" placeholder="考试名称" value="${App.escapeHtml(exam.name)}" style="flex:1;min-width:140px;max-width:220px;">
          <input type="date" class="input" id="exam-date" value="${exam.date}" style="flex:1;min-width:150px;max-width:220px;">
        </div>
        <p class="text-secondary text-sm">当前:距 ${App.escapeHtml(exam.name)} 还有 <strong style="color:var(--accent);">${Storage.getDaysLeft()}</strong> 天</p>
      </div>

      <!-- 主题 -->
      <div class="card" style="margin-bottom:16px;">
        <h3 style="font-size:16px;margin-bottom:6px;">主题</h3>
        <div class="row" style="gap:8px;margin-top:12px;">
          <button class="chip ${theme === 'light' ? 'active' : ''}" data-theme="light">☀️ 浅色</button>
          <button class="chip ${theme === 'dark' ? 'active' : ''}" data-theme="dark">🌙 深色</button>
        </div>
      </div>

      <div class="row" style="gap:10px;">
        <button class="btn btn-primary" id="save-btn">保存设置</button>
        <span class="text-secondary text-sm" id="save-hint"></span>
      </div>
    `;

    // 布局
    main.querySelectorAll('input[name="layout"]').forEach(input => {
      input.addEventListener('change', () => {
        main.querySelectorAll('.setting-option').forEach(o => o.classList.remove('active'));
        input.closest('.setting-option').classList.add('active');
      });
    });

    // 默认范围
    main.querySelectorAll('[data-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.setScope(btn.dataset.scope);
        main.querySelectorAll('[data-scope]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    // 主题
    main.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.theme;
        Storage.setSetting('theme', next);
        document.documentElement.setAttribute('data-theme', next);
        App.updateThemeIcon(next);
        main.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('save-btn').addEventListener('click', () => this.save());
  },

  save() {
    const layout = document.querySelector('input[name="layout"]:checked')?.value || 'classic';
    const displayName = document.getElementById('display-name').value.trim();
    const examName = document.getElementById('exam-name').value.trim() || '考研初试';
    const examDate = document.getElementById('exam-date').value;

    Storage.setSetting('layout', layout);
    Storage.setSetting('displayName', displayName);
    if (examDate) Storage.setExamConfig({ name: examName, date: examDate });

    const hint = document.getElementById('save-hint');
    hint.textContent = '已保存 ✓';
    hint.style.color = 'var(--success)';
    setTimeout(() => { hint.textContent = ''; }, 2000);
  }
};

document.addEventListener('DOMContentLoaded', () => SettingsPage.render());
