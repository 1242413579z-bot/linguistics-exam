# push_via_api.py - 通过 GitHub API 推送文件
import json
import subprocess
import base64
import os

REPO = "1242413579z-bot/linguistics-exam"
BASE = r"e:\语言学大观园"

def gh_api(endpoint, method="GET", data=None):
    """调用 GitHub API"""
    cmd = ["gh", "api", f"repos/{REPO}/{endpoint}"]
    if method != "GET":
        cmd.extend(["-X", method])
    if data is not None:
        cmd.extend(["-f", f"input={json.dumps(data)}"])
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"API error: {result.stderr[:200]}")
        return None
    try:
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except:
        return {}

def gh_api_raw(endpoint, method="GET", fields=None):
    """调用 GitHub API (raw fields)"""
    cmd = ["gh", "api", f"repos/{REPO}/{endpoint}"]
    if method != "GET":
        cmd.extend(["-X", method])
    if fields:
        for k, v in fields.items():
            cmd.extend(["-f", f"{k}={v}"])
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"  API error: {result.stderr[:300]}")
        return None
    try:
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except:
        return {}

def create_blob(content, encoding="base64"):
    """创建 blob"""
    if encoding == "base64":
        b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        data = f'{{"content":"{b64}","encoding":"base64"}}'
    else:
        data = f'{{"content":"{content}","encoding":"utf-8"}}'
    
    cmd = ["gh", "api", f"repos/{REPO}/git/blobs", "-X", "POST", "-f", f"input={data}"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"  blob error: {result.stderr[:300]}")
        return None
    return json.loads(result.stdout).get('sha')

def main():
    # 1. 获取当前 master 分支的 commit SHA
    ref = gh_api("git/refs/heads/master")
    if not ref:
        print("无法获取分支引用")
        return
    base_sha = ref['object']['sha']
    print(f"Base commit: {base_sha[:8]}")

    # 2. 获取当前 tree
    commit = gh_api(f"git/commits/{base_sha}")
    base_tree = commit['tree']['sha']
    print(f"Base tree: {base_tree[:8]}")

    # 3. 要上传的文件列表
    files_to_upload = [
        "data/categories.json",
        ".gitignore",
        "data/questions/njsu-402.json",
        "data/questions/njsu-602.json",
        "data/questions/njsu-610.json",
        "data/questions/njsu-611.json",
        "data/questions/njsu-613.json",
        "data/questions/njsu-802.json",
        "data/questions/njsu-803.json",
        "data/questions/njsu-804.json",
        "data/questions/njsu-802-extra.json",
    ]

    # 4. 为每个文件创建 blob
    tree_items = []
    for filepath in files_to_upload:
        full_path = os.path.join(BASE, filepath.replace('/', os.sep))
        if not os.path.exists(full_path):
            print(f"  跳过（不存在）: {filepath}")
            continue
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"  Creating blob: {filepath} ({len(content)} chars)")
        sha = create_blob(content)
        if sha:
            tree_items.append({
                "path": filepath,
                "mode": "100644",
                "type": "blob",
                "sha": sha
            })
        else:
            print(f"  FAILED: {filepath}")

    # 5. 添加删除操作
    for filepath in ["data/questions/pp-own-school.json", "data/questions/pp-other-schools.json"]:
        tree_items.append({
            "path": filepath,
            "mode": "100644",
            "type": "blob",
            "sha": None  # null sha = delete
        })
        print(f"  Delete: {filepath}")

    # 6. 创建新 tree
    print(f"\nCreating tree with {len(tree_items)} items...")
    tree_data = {
        "base_tree": base_tree,
        "tree": tree_items
    }
    
    cmd = ["gh", "api", f"repos/{REPO}/git/trees", "-X", "POST", "-f", f"input={json.dumps(tree_data)}"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"Tree creation failed: {result.stderr[:500]}")
        return
    new_tree = json.loads(result.stdout)
    new_tree_sha = new_tree['sha']
    print(f"New tree: {new_tree_sha[:8]}")

    # 7. 创建 commit
    print("Creating commit...")
    commit_data = {
        "message": "feat: 导入南师大2009-2025年真题(9个科目1034题)",
        "tree": new_tree_sha,
        "parents": [base_sha]
    }
    cmd = ["gh", "api", f"repos/{REPO}/git/commits", "-X", "POST", "-f", f"input={json.dumps(commit_data)}"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"Commit creation failed: {result.stderr[:500]}")
        return
    new_commit = json.loads(result.stdout)
    new_commit_sha = new_commit['sha']
    print(f"New commit: {new_commit_sha[:8]}")

    # 8. 更新 ref
    print("Updating master ref...")
    ref_data = {"sha": new_commit_sha, "force": False}
    cmd = ["gh", "api", f"repos/{REPO}/git/refs/heads/master", "-X", "PATCH", "-f", f"input={json.dumps(ref_data)}"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"Ref update failed: {result.stderr[:500]}")
        return
    print(f"\n✅ 推送成功! Commit: {new_commit_sha[:8]}")

if __name__ == "__main__":
    main()
