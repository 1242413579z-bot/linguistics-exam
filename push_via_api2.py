# push_via_api2.py - 通过 GitHub API 推送文件（使用 --input 避免命令行长度限制）
import json
import subprocess
import base64
import os
import tempfile

REPO = "1242413579z-bot/linguistics-exam"
BASE = r"e:\语言学大观园"

def gh_api_with_file(endpoint, method="POST", data=None):
    """调用 GitHub API，使用临时文件传递数据"""
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

def main():
    # 1. 获取当前 master 分支的 commit SHA
    result = subprocess.run(["gh", "api", f"repos/{REPO}/git/refs/heads/master"], capture_output=True, text=True, encoding='utf-8')
    ref = json.loads(result.stdout)
    base_sha = ref['object']['sha']
    print(f"Base commit: {base_sha[:8]}")

    # 2. 获取当前 tree
    result = subprocess.run(["gh", "api", f"repos/{REPO}/git/commits/{base_sha}"], capture_output=True, text=True, encoding='utf-8')
    commit = json.loads(result.stdout)
    base_tree = commit['tree']['sha']
    print(f"Base tree: {base_tree[:8]}")

    # 3. 要上传的文件
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

    # 4. 创建 blobs
    tree_items = []
    for filepath in files_to_upload:
        full_path = os.path.join(BASE, filepath.replace('/', os.sep))
        if not os.path.exists(full_path):
            print(f"  跳过: {filepath}")
            continue
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        blob_data = {"content": b64, "encoding": "base64"}
        
        print(f"  Blob: {filepath} ({len(content)} chars)...", end="", flush=True)
        blob, err = gh_api_with_file("git/blobs", "POST", blob_data)
        if blob and 'sha' in blob:
            sha = blob['sha']
            tree_items.append({"path": filepath, "mode": "100644", "type": "blob", "sha": sha})
            print(f" OK ({sha[:8]})")
        else:
            print(f" FAILED: {err}")

    # 5. 添加删除
    for filepath in ["data/questions/pp-own-school.json", "data/questions/pp-other-schools.json"]:
        tree_items.append({"path": filepath, "mode": "100644", "type": "blob", "sha": None})
        print(f"  Delete: {filepath}")

    # 6. 创建新 tree
    print(f"\nCreating tree ({len(tree_items)} items)...", end="", flush=True)
    tree_data = {"base_tree": base_tree, "tree": tree_items}
    tree, err = gh_api_with_file("git/trees", "POST", tree_data)
    if not tree or 'sha' not in tree:
        print(f" FAILED: {err}")
        return
    new_tree_sha = tree['sha']
    print(f" OK ({new_tree_sha[:8]})")

    # 7. 创建 commit
    print("Creating commit...", end="", flush=True)
    commit_data = {"message": "feat: 导入南师大2009-2025年真题(9个科目1034题)", "tree": new_tree_sha, "parents": [base_sha]}
    new_commit, err = gh_api_with_file("git/commits", "POST", commit_data)
    if not new_commit or 'sha' not in new_commit:
        print(f" FAILED: {err}")
        return
    new_commit_sha = new_commit['sha']
    print(f" OK ({new_commit_sha[:8]})")

    # 8. 更新 ref
    print("Updating ref...", end="", flush=True)
    ref_data = {"sha": new_commit_sha, "force": False}
    _, err = gh_api_with_file("git/refs/heads/master", "PATCH", ref_data)
    if err:
        print(f" FAILED: {err}")
    else:
        print(" OK")
        print(f"\n✅ 推送成功! Commit: {new_commit_sha[:8]}")

if __name__ == "__main__":
    main()
