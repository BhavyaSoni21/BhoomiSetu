import os
import re
import glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False
    original = content

    # 1. Fix dangling comma from broken import: import { , screen, ... } -> import { screen, ... }
    def fix_dangling_import(m):
        return m.group(0).replace('{ ,', '{').replace(', ,', ',').replace(',  ,', ',')
    new_content = re.sub(r'\{[^}]*\}', fix_dangling_import, content)
    if new_content != content:
        content = new_content
        changed = True

    # 2. Remove vi.mock('.../apiService', ...) block that still exists
    new_content = re.sub(
        r"vi\.mock\(['\"][^'\"]*apiService['\"],\s*\(\)\s*=>\s*\(\{.*?\}\)\);\n?",
        '',
        content,
        flags=re.DOTALL
    )
    if new_content != content:
        content = new_content
        changed = True

    # 3. Remove "import apiService from '...apiService';" lines when vi.mock is gone
    # (only remove if there's no longer any vi.mocked(apiService...) usage)
    if 'vi.mocked(apiService' not in content and 'apiService.' not in content.replace('import apiService', ''):
        new_content = re.sub(r"import apiService from '.*?apiService';\n?", '', content)
        if new_content != content:
            content = new_content
            changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
    
    return changed

count = 0
for filepath in glob.glob('src/**/*.test.tsx', recursive=True):
    if fix_file(filepath):
        count += 1

print(f"\nFixed {count} files.")
