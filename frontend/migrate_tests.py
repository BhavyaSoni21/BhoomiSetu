import os
import re
import glob

def get_rel_path(filepath):
    # Determine how many levels deep the file is relative to 'src'
    parts = filepath.replace('\\', '/').split('/')
    try:
        src_index = parts.index('src')
        depth = len(parts) - src_index - 2
        if depth <= 0:
            return './test/utils'
        return ('../' * depth) + 'test/utils'
    except ValueError:
        return './test/utils'

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove manual apiService mocks (multiline)
    content = re.sub(r"vi\.mock\(['\"](\.\./)+services/apiService['\"],\s*\(\)\s*=>\s*\(\{(.*?)\}\)\);", "", content, flags=re.DOTALL)
    
    # 2. Add renderWithProviders import
    rel_path = get_rel_path(path)
    
    # If the file already imports renderWithProviders, don't add it again
    if 'renderWithProviders' not in content:
        # Check if render is imported from @testing-library/react
        if re.search(r"import\s+\{[^}]*render[^}]*\}\s+from\s+['\"]@testing-library/react['\"];", content):
            # Replace render import with our custom one
            # Find the import block
            content = re.sub(
                r"(import\s+\{[^}]*)(render)([^}]*\}\s+from\s+['\"]@testing-library/react['\"];)",
                r"\1\3\nimport { renderWithProviders } from '" + rel_path + "';",
                content
            )
            # Replace render(...) with renderWithProviders(...)
            # Make sure we don't replace render if it's used as a variable or property, but simple function call is usually enough
            content = re.sub(r"\brender\(", "renderWithProviders(", content)
            
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

for file in glob.glob('src/**/*.test.tsx', recursive=True):
    # skip the two we will handle manually
    if "HistoricalImageryPanel" not in file and "Parcel360View" not in file:
        update_file(file)
        print(f"Updated {file}")
