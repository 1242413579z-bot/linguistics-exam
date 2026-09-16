# restructure.py - 重新整理分类结构和真题数据
import json
import re
import os
import base64
import subprocess
import tempfile

BASE = r'e:\语言学大观园'
REPO = "1242413579z-bot/linguistics-exam"

# ============================================================
# 1. 解析真题和解析
# ============================================================

def read_lines(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read().split('\n')

def parse_exams(filepath, start_line=0, end_line=None):
    """解析试题部分（跳过解析部分）"""
    lines = read_lines(filepath)
    if end_line:
        lines = lines[start_line:end_line]
    else:
        lines = lines[start_line:]
    
    exams = []
    current_exam = None
    current_section = None
    current_questions = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # 检测试题标题（不含"解析"）
        exam_match = re.match(r'^#\s*南京师范大学\s*(\d{4})\s*年硕士研究生入学考试初试试题[（(]([^)）]+)[)）]', line)
        if exam_match and '解析' not in line:
            if current_exam:
                if current_section and current_questions:
                    current_exam['sections'].append({'title': current_section, 'questions': current_questions})
                exams.append(current_exam)
            
            year = exam_match.group(1)
            code = exam_match.group(2).strip().replace('回忆版', '').strip()
            current_exam = {'year': year, 'code': code, 'subject': '', 'sections': []}
            current_section = None
            current_questions = []
            i += 1
            continue
        
        # 检测解析标题 - 停止
        if '解析' in line and line.startswith('#') and '南京师范大学' in line:
            if current_exam:
                if current_section and current_questions:
                    current_exam['sections'].append({'title': current_section, 'questions': current_questions})
                exams.append(current_exam)
            break
        
        if not current_exam:
            i += 1
            continue
        
        # 科目代码
        subject_match = re.match(r'^#\s*科目代码[：:]\s*(\S+)\s*科目名称[：:]\s*(.+)', line)
        if subject_match:
            current_exam['code'] = subject_match.group(1).strip()
            current_exam['subject'] = subject_match.group(2).strip()
            i += 1
            continue
        
        # 大题标题
        section_match = re.match(r'^#\s*([一二三四五六七八九十]+)[、．\.]?\s*(.+)', line)
        if section_match:
            if current_section and current_questions:
                current_exam['sections'].append({'title': current_section, 'questions': current_questions})
            current_section = f"{section_match.group(1)}、{section_match.group(2).strip()}"
            current_questions = []
            i += 1
            continue
        
        # 子部分标题
        sub_section_match = re.match(r'^#\s*(第.+部分|.+必做题|.+专业必做题)', line)
        if sub_section_match:
            if current_section and current_questions:
                current_exam['sections'].append({'title': current_section, 'questions': current_questions})
            current_section = sub_section_match.group(1).strip()
            current_questions = []
            i += 1
            continue
        
        # 题目
        q_match = re.match(r'^(\d+)[.、．]\s*(.+)', line)
        if q_match and current_section:
            q_num = int(q_match.group(1))
            q_text = q_match.group(2).strip()
            current_questions.append({'num': q_num, 'text': q_text, 'sub_items': []})
            i += 1
            continue
        
        # 子项
        sub_match = re.match(r'^[（(](\d+)[)）]\s*(.+)', line)
        if sub_match and current_questions:
            current_questions[-1]['sub_items'].append({'num': int(sub_match.group(1)), 'text': sub_match.group(2).strip()})
            i += 1
            continue
        
        # 附加文本
        if line and current_questions and not line.startswith('#') and not line.startswith('!'):
            current_questions[-1]['text'] += '\n' + line
        
        i += 1
    
    if current_exam:
        if current_section and current_questions:
            current_exam['sections'].append({'title': current_section, 'questions': current_questions})
        exams.append(current_exam)
    
    return exams

def parse_analyses(filepath, start_line=0):
    """解析分析部分"""
    lines = read_lines(filepath)
    if start_line:
        lines = lines[start_line:]
    
    analyses = {}  # {year_code: {section_title: {q_num: text}}}
    current_key = None
    current_section = None
    current_q_num = None
    current_text = []
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # 检测解析标题
        analysis_match = re.match(r'^#\s*南京师范大学\s*(\d{4})\s*年硕士研究生入学考试初试试题解析[（(]([^)）]+)[)）]', line)
        if analysis_match:
            if current_key and current_q_num and current_text:
                if current_key not in analyses:
                    analyses[current_key] = {}
                if current_section not in analyses[current_key]:
                    analyses[current_key][current_section] = {}
                analyses[current_key][current_section][current_q_num] = '\n'.join(current_text)
            
            year = analysis_match.group(1)
            code = analysis_match.group(2).strip()
            current_key = f"{year}_{code}"
            current_section = None
            current_q_num = None
            current_text = []
            i += 1
            continue
        
        if not current_key:
            i += 1
            continue
        
        # 科目代码
        subject_match = re.match(r'^#\s*科目代码[：:]\s*(\S+)\s*科目名称[：:]\s*(.+)', line)
        if subject_match:
            i += 1
            continue
        
        # 大题标题
        section_match = re.match(r'^#\s*([一二三四五六七八九十]+)[、．\.]?\s*(.+)', line)
        if section_match:
            if current_q_num and current_text:
                if current_key not in analyses:
                    analyses[current_key] = {}
                if current_section not in analyses[current_key]:
                    analyses[current_key][current_section] = {}
                analyses[current_key][current_section][current_q_num] = '\n'.join(current_text)
            
            current_section = f"{section_match.group(1)}、{section_match.group(2).strip()}"
            current_q_num = None
            current_text = []
            i += 1
            continue
        
        # 题目标题（在解析中）
        q_match = re.match(r'^#\s*(\d+)[.、．]\s*(.+)', line)
        if q_match:
            if current_q_num and current_text:
                if current_key not in analyses:
                    analyses[current_key] = {}
                if current_section not in analyses[current_key]:
                    analyses[current_key][current_section] = {}
                analyses[current_key][current_section][current_q_num] = '\n'.join(current_text)
            
            current_q_num = int(q_match.group(1))
            current_text = [q_match.group(2).strip()]
            i += 1
            continue
        
        # 子项标题
        sub_match = re.match(r'^#\s*[（(](\d+)[)）]\s*(.+)', line)
        if sub_match:
            if current_q_num and current_text:
                if current_key not in analyses:
                    analyses[current_key] = {}
                if current_section not in analyses[current_key]:
                    analyses[current_key][current_section] = {}
                analyses[current_key][current_section][current_q_num] = '\n'.join(current_text)
            
            current_q_num = f"sub_{sub_match.group(1)}"
            current_text = [sub_match.group(2).strip()]
            i += 1
            continue
        
        # 累积文本
        if line and current_q_num and not line.startswith('#'):
            current_text.append(line)
        
        i += 1
    
    # 保存最后一条
    if current_key and current_q_num and current_text:
        if current_key not in analyses:
            analyses[current_key] = {}
        if current_section not in analyses[current_key]:
            analyses[current_key][current_section] = {}
        analyses[current_key][current_section][current_q_num] = '\n'.join(current_text)
    
    return analyses

# ============================================================
# 2. 生成按年份组织的 JSON
# ============================================================

def generate_year_jsons(all_exams, all_analyses):
    """按年份生成 JSON 文件"""
    # 按年份分组
    by_year = {}
    for exam in all_exams:
        year = exam['year']
        if year not in by_year:
            by_year[year] = []
        by_year[year].append(exam)
    
    chapters = []  # [{id, name, children: [{id, name}]}]
    
    for year in sorted(by_year.keys()):
        year_id = f'njsu-{year}'
        year_name = f'{year}年'
        children = []
        
        for exam in sorted(by_year[year], key=lambda x: x['code']):
            code = exam['code']
            subject = exam.get('subject', '') or code
            chapter_id = f'njsu-{year}-{code}'
            chapter_name = f'{code} {subject}'
            
            # 构建题目列表
            questions = []
            q_id = 1
            analysis_key = f"{year}_{code}"
            
            for section in exam['sections']:
                section_title = section['title']
                for q in section['questions']:
                    q_num = q['num']
                    stem_parts = [f"{section_title}", f"{q_num}. {q['text']}"]
                    for sub in q.get('sub_items', []):
                        stem_parts.append(f"  ({sub['num']}) {sub['text']}")
                    
                    stem = '\n'.join(stem_parts)
                    
                    # 查找解析
                    analysis = ''
                    if analysis_key in all_analyses:
                        if section_title in all_analyses[analysis_key]:
                            if q_num in all_analyses[analysis_key][section_title]:
                                analysis = all_analyses[analysis_key][section_title][q_num]
                    
                    questions.append({
                        'id': q_id,
                        'source': f'{year}年南师大{code}真题',
                        'stem': stem,
                        'options': None,
                        'answer': '',
                        'analysis': analysis
                    })
                    q_id += 1
            
            json_data = {
                'chapterId': chapter_id,
                'chapterName': chapter_name,
                'questions': questions
            }
            
            filepath = os.path.join(BASE, 'data', 'questions', f'{chapter_id}.json')
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            
            children.append({'id': chapter_id, 'name': chapter_name})
            print(f'  {chapter_name}: {len(questions)} 题, 有解析 {sum(1 for q in questions if q["analysis"])} 题')
        
        chapters.append({'id': year_id, 'name': year_name, 'children': children})
    
    return chapters

# ============================================================
# 3. 更新 categories.json
# ============================================================

def update_categories(njsu_chapters):
    cats_path = os.path.join(BASE, 'data', 'categories.json')
    with open(cats_path, 'r', encoding='utf-8') as f:
        cats = json.load(f)
    
    # 重建分类
    new_categories = [
        {
            'id': 'linguistics',
            'name': '语言学概论',
            'icon': '📚',
            'children': [
                {'id': 'ling-intro', 'name': '概论'},
                {'id': 'ling-phonetics', 'name': '语音'},
                {'id': 'ling-grammar', 'name': '语法'},
                {'id': 'ling-semantics', 'name': '语义'},
                {'id': 'ling-pragmatics', 'name': '语用'},
                {'id': 'ling-writing', 'name': '文字'},
                {'id': 'ling-historical', 'name': '历史语言学'},
            ]
        },
        {
            'id': 'modern-chinese',
            'name': '现代汉语',
            'icon': '📖',
            'children': [
                {'id': 'mc-intro', 'name': '绪论'},
                {'id': 'mc-phonetics', 'name': '语音'},
                {'id': 'mc-writing', 'name': '文字'},
                {'id': 'mc-lexicon', 'name': '词汇'},
                {'id': 'mc-grammar', 'name': '语法'},
                {'id': 'mc-pragmatics', 'name': '语用'},
            ]
        },
        {
            'id': 'ancient-chinese',
            'name': '古代汉语',
            'icon': '🏛️',
            'children': [
                {'id': 'ac-intro', 'name': '绪论'},
                {'id': 'ac-tools', 'name': '工具书'},
                {'id': 'ac-writing', 'name': '文字'},
                {'id': 'ac-lexicon', 'name': '词汇'},
                {'id': 'ac-grammar', 'name': '语法'},
                {'id': 'ac-phonology', 'name': '音韵'},
                {'id': 'ac-exegesis', 'name': '训诂'},
                {'id': 'ac-rhetoric', 'name': '修辞'},
                {'id': 'ac-punctuation', 'name': '句读翻译'},
            ]
        },
        {
            'id': 'mock-papers',
            'name': '模拟卷与练习',
            'icon': '✏️',
            'children': [
                {'id': 'mp-mock', 'name': '模拟题'},
                {'id': 'mp-practice', 'name': '练习题'},
            ]
        },
        {
            'id': 'njsu-papers',
            'name': '南师大真题',
            'icon': '📜',
            'children': njsu_chapters  # 三级结构: [{id, name, children: [{id, name}]}]
        }
    ]
    
    cats['categories'] = new_categories
    with open(cats_path, 'w', encoding='utf-8') as f:
        json.dump(cats, f, ensure_ascii=False, indent=2)
    
    print(f'已更新 categories.json')

# ============================================================
# 4. 修改 main.js 支持三级侧边栏
# ============================================================

def update_sidebar_js():
    js_path = os.path.join(BASE, 'js', 'main.js')
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换侧边栏渲染代码
    old_code = '''    cats.categories.forEach((cat, idx) => {
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
    });'''
    
    new_code = '''    cats.categories.forEach((cat, idx) => {
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
            html += `<a class="category-child" href="practice.html?chapter=${sub.id}" data-chapter="${sub.id}">${sub.name}</a>`;
          });
          html += `</div></div>`;
        } else {
          html += `<a class="category-child" href="practice.html?chapter=${child.id}" data-chapter="${child.id}">${child.name}</a>`;
        }
      });
      html += `</div></div>`;
    });'''
    
    content = content.replace(old_code, new_code)
    
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('已更新 main.js 侧边栏（支持三级分类）')

# ============================================================
# 5. 更新 CSS 支持三级样式
# ============================================================

def update_css():
    css_path = os.path.join(BASE, 'css', 'style.css')
    with open(css_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在文件末尾添加三级分类样式
    extra_css = '''

/* ===== 三级分类侧边栏 ===== */
.category-subgroup {
  margin-left: 12px;
}
.category-subgroup.collapsed .category-subchildren {
  display: none;
}
.category-subheader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #666);
  border-radius: 6px;
  transition: background 0.15s;
}
.category-subheader:hover {
  background: var(--bg-hover, rgba(0,0,0,0.04));
}
.category-subheader .arrow {
  font-size: 10px;
  transition: transform 0.2s;
}
.category-subgroup:not(.collapsed) .category-subheader .arrow {
  transform: rotate(0deg);
}
.category-subgroup.collapsed .category-subheader .arrow {
  transform: rotate(-90deg);
}
.category-subchildren {
  padding-left: 8px;
}
'''
    
    if '.category-subgroup' not in content:
        content += extra_css
        with open(css_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('已更新 style.css（三级分类样式）')

# ============================================================
# 6. 绑定三级分类折叠事件
# ============================================================

def update_sidebar_events():
    js_path = os.path.join(BASE, 'js', 'main.js')
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在折叠绑定后添加子分类折叠
    old_code = '''    // 绑定分类折叠
    sidebar.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });'''
    
    new_code = '''    // 绑定分类折叠
    sidebar.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });
    // 绑定子分类折叠
    sidebar.querySelectorAll('.category-subheader').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });'''
    
    content = content.replace(old_code, new_code)
    
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('已更新 main.js 事件绑定（三级折叠）')

# ============================================================
# 7. 清理旧真题文件
# ============================================================

def cleanup_old_files():
    qdir = os.path.join(BASE, 'data', 'questions')
    old_files = [
        'njsu-402.json', 'njsu-602.json', 'njsu-610.json', 'njsu-611.json',
        'njsu-613.json', 'njsu-802.json', 'njsu-802-extra.json',
        'njsu-803.json', 'njsu-804.json',
        'pp-own-school.json', 'pp-other-schools.json',
        # 旧的语义学语用学
        'sp-relations.json', 'sp-speech-acts.json', 'sp-implicature.json', 'sp-presupposition.json',
        # 旧的分类章节
        'ling-lexicon.json', 'ling-evolution.json', 'ling-writing.json',
        'mc-rhetoric.json',
    ]
    for fname in old_files:
        fpath = os.path.join(qdir, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
            print(f'  删除: {fname}')

# ============================================================
# 8. 通过 GitHub API 推送
# ============================================================

def gh_api_with_file(endpoint, method="POST", data=None):
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
    json.dump(data, tmp, ensure_ascii=False)
    tmp.close()
    cmd = ["gh", "api", f"repos/{REPO}/{endpoint}", "-X", method, "--input", tmp.name]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    os.unlink(tmp.name)
    if result.returncode != 0:
        return None, result.stderr[:500]
    try:
        return json.loads(result.stdout) if result.stdout.strip() else {}, ""
    except:
        return {}, ""

def push_to_github():
    # 收集所有要上传的文件
    files_to_upload = [
        'data/categories.json',
        'js/main.js',
        'css/style.css',
    ]
    
    # 添加新的真题 JSON 文件
    qdir = os.path.join(BASE, 'data', 'questions')
    for fname in os.listdir(qdir):
        if fname.startswith('njsu-') and fname.endswith('.json'):
            files_to_upload.append(f'data/questions/{fname}')
    
    # 获取 base commit
    result = subprocess.run(["gh", "api", f"repos/{REPO}/git/refs/heads/master"], capture_output=True, text=True, encoding='utf-8')
    ref = json.loads(result.stdout)
    base_sha = ref['object']['sha']
    
    result = subprocess.run(["gh", "api", f"repos/{REPO}/git/commits/{base_sha}"], capture_output=True, text=True, encoding='utf-8')
    commit = json.loads(result.stdout)
    base_tree = commit['tree']['sha']
    
    # 创建 blobs
    import base64 as b64mod
    tree_items = []
    for filepath in files_to_upload:
        full_path = os.path.join(BASE, filepath.replace('/', os.sep))
        if not os.path.exists(full_path):
            continue
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        b64 = b64mod.b64encode(content.encode('utf-8')).decode('ascii')
        blob_data = {"content": b64, "encoding": "base64"}
        print(f"  Blob: {filepath} ({len(content)} chars)...", end="", flush=True)
        blob, err = gh_api_with_file("git/blobs", "POST", blob_data)
        if blob and 'sha' in blob:
            tree_items.append({"path": filepath, "mode": "100644", "type": "blob", "sha": blob['sha']})
            print(" OK")
        else:
            print(f" FAILED: {err}")
    
    # 删除旧文件
    for filepath in [
        'data/questions/njsu-402.json', 'data/questions/njsu-602.json',
        'data/questions/njsu-610.json', 'data/questions/njsu-611.json',
        'data/questions/njsu-613.json', 'data/questions/njsu-802.json',
        'data/questions/njsu-802-extra.json', 'data/questions/njsu-803.json',
        'data/questions/njsu-804.json', 'data/questions/pp-own-school.json',
        'data/questions/pp-other-schools.json',
        'data/questions/sp-relations.json', 'data/questions/sp-speech-acts.json',
        'data/questions/sp-implicature.json', 'data/questions/sp-presupposition.json',
        'data/questions/ling-lexicon.json', 'data/questions/ling-evolution.json',
        'data/questions/ling-writing.json', 'data/questions/mc-rhetoric.json',
    ]:
        tree_items.append({"path": filepath, "mode": "100644", "type": "blob", "sha": None})
    
    # 创建 tree
    print(f"\nCreating tree ({len(tree_items)} items)...", end="", flush=True)
    tree_data = {"base_tree": base_tree, "tree": tree_items}
    tree, err = gh_api_with_file("git/trees", "POST", tree_data)
    if not tree or 'sha' not in tree:
        print(f" FAILED: {err}")
        return
    print(f" OK ({tree['sha'][:8]})")
    
    # 创建 commit
    print("Creating commit...", end="", flush=True)
    commit_data = {"message": "refactor: 重构分类结构+真题按年份+导入解析", "tree": tree['sha'], "parents": [base_sha]}
    new_commit, err = gh_api_with_file("git/commits", "POST", commit_data)
    if not new_commit or 'sha' not in new_commit:
        print(f" FAILED: {err}")
        return
    print(f" OK ({new_commit['sha'][:8]})")
    
    # 更新 ref
    print("Updating ref...", end="", flush=True)
    ref_data = {"sha": new_commit['sha'], "force": False}
    _, err = gh_api_with_file("git/refs/heads/master", "PATCH", ref_data)
    if err:
        print(f" FAILED: {err}")
    else:
        print(" OK")
        print(f"\n✅ 推送成功!")

# ============================================================
# Main
# ============================================================

def main():
    zhenti_path = os.path.join(BASE, '真题', '真题_batch1_p1-200.md')
    analysis_path = os.path.join(BASE, '真题', '真题_batch2_p201-382.md')
    
    # 1. 解析试题
    print("=== 解析试题 ===")
    all_exams = parse_exams(zhenti_path)
    print(f"共 {len(all_exams)} 套试题")
    
    # 2. 解析解析（batch1 后半部分 + batch2）
    print("\n=== 解析解析 ===")
    # batch1 的解析从第 4379 行开始
    analyses1 = parse_analyses(zhenti_path, start_line=4378)
    analyses2 = parse_analyses(analysis_path)
    all_analyses = {**analyses1, **analyses2}
    print(f"共 {len(all_analyses)} 套解析")
    
    # 3. 按年份生成 JSON
    print("\n=== 生成年份 JSON ===")
    njsu_chapters = generate_year_jsons(all_exams, all_analyses)
    print(f"\n{len(njsu_chapters)} 个年份")
    
    # 4. 更新 categories.json
    print("\n=== 更新分类 ===")
    update_categories(njsu_chapters)
    
    # 5. 更新侧边栏代码
    print("\n=== 更新代码 ===")
    update_sidebar_js()
    update_sidebar_events()
    update_css()
    
    # 6. 清理旧文件
    print("\n=== 清理旧文件 ===")
    cleanup_old_files()
    
    # 7. 推送
    print("\n=== 推送到 GitHub ===")
    push_to_github()
    
    print("\n完成!")

if __name__ == '__main__':
    main()
