import subprocess
import re
import sys

print('=== 1. Checking if .env or forbidden files are tracked in HEAD or git history ===')
tracked_files = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()

forbidden_patterns = ['.env', '.db', 'benchmark_results.json', 'node_modules', 'dist', 'audit_tmp']
found_forbidden_in_head = []
for f in tracked_files:
    for fb in forbidden_patterns:
        if fb in f:
            if f.endswith('.env.example'):
                continue
            found_forbidden_in_head.append(f)

print('Tracked forbidden files in working tree/HEAD:', found_forbidden_in_head)

# Check all commits in history for forbidden file paths
print('\n=== 2. Checking all commits in history for forbidden files ===')
all_commits = subprocess.check_output(['git', 'log', '--format=%H'], text=True).splitlines()
found_history_files = set()
for commit in all_commits:
    files = subprocess.check_output(['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit], text=True).splitlines()
    for f in files:
        for fb in forbidden_patterns:
            if fb in f:
                if f.endswith('.env.example'):
                    continue
                found_history_files.add((commit[:8], f))

print('Forbidden files ever committed in history:', list(found_history_files))

# Scan commit diffs across full history for secrets
print('\n=== 3. Scanning commit diffs across full history for secrets ===')
log_p = subprocess.check_output(['git', 'log', '-p', '--full-history'], text=True, errors='replace')

patterns = [
    re.compile(r'NEBIUS_API_KEY\s*=\s*[\'\"]?([a-zA-Z0-9_\-]{20,})[\'\"]?'),
    re.compile(r'\b(sk-[a-zA-Z0-9_\-]{20,})\b'),
    re.compile(r'\b(eyJ[a-zA-Z0-9_\-]{30,})\b'),
    re.compile(r'Bearer\s+([a-zA-Z0-9_\-]{20,})', re.IGNORECASE),
]

detected_secrets = []
for line in log_p.splitlines():
    if not line.startswith('+'):
        continue
    if line.startswith('+++'):
        continue
    for p in patterns:
        m = p.search(line)
        if m:
            val = m.group(1)
            # Filter out mock / test tokens
            if any(dummy in val.lower() for dummy in ['mock', 'placeholder', 'dummy', 'your_', 'test_key', 'example', 'secret']):
                continue
            detected_secrets.append((line[:100], val[:4] + '...' + val[-4:]))

print('Potential secret leaks found:', len(detected_secrets))
for l, redacted in detected_secrets:
    print('  Line:', l, 'Redacted:', redacted)

if len(found_forbidden_in_head) > 0 or len(found_history_files) > 0 or len(detected_secrets) > 0:
    print('\n[WARNING] Secrets or forbidden files detected!')
else:
    print('\n[PASS] Zero secrets or forbidden files found across all git history.')
