#!/usr/bin/env python3
"""Report localization coverage and possible references; does not modify files."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
issues = []

def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            issues.append('duplicate JSON key: ' + key)
        result[key] = value
    return result

data = json.loads((ROOT / 'assets/i18n.json').read_text(encoding='utf-8'), object_pairs_hook=unique_object)
base = data['en-US']
placeholder = re.compile(r'\{([A-Za-z_][A-Za-z0-9_]*)\}')
for locale, entries in data.items():
    if isinstance(entries, str):
        seen = {locale}
        target = entries
        while isinstance(data.get(target), str) and target not in seen:
            seen.add(target)
            target = data[target]
        if target in seen or not isinstance(data.get(target), dict):
            issues.append(f'{locale}: invalid or cyclic alias {entries}')
        continue
    missing = sorted(set(base) - set(entries))
    extra = sorted(set(entries) - set(base))
    if missing:
        issues.append(f'{locale}: missing {missing}')
    if extra:
        issues.append(f'{locale}: extra {extra}')
    for key in base.keys() & entries.keys():
        if set(placeholder.findall(base[key])) != set(placeholder.findall(entries[key])):
            issues.append(f'{locale}.{key}: placeholder mismatch')

files = list((ROOT / 'frontend').rglob('*.js'))
files += [ROOT / 'assets' / name for name in ('screensaver-main.qml', 'web-screensaver.html', 'font-server.js', 'font-server.sh')]
call = re.compile(r"(?:\bI18n\.t|\btr|\bt|\blocalizedError)\s*\(\s*(['\"])([\w]+)\1|\bi18n\s*:\s*(['\"])([\w]+)\3")
dynamic = re.compile(r"(?:\bI18n\.t|\btr|\bt|\blocalizedError)\s*\(\s*(?!['\"])([^\n]{1,100})")
used = set()
for path in files:
    text = path.read_text(encoding='utf-8')
    for match in call.finditer(text):
        key = match.group(2) or match.group(4)
        used.add(key)
        if key not in base:
            print(f'UNRESOLVED literal candidate {path.relative_to(ROOT)}: {key} (may be a comment)')
    for match in dynamic.finditer(text):
        line = text.count('\n', 0, match.start()) + 1
        print(f'DYNAMIC {path.relative_to(ROOT)}:{line}: {match.group(0).strip()}')
print(f'Dictionaries: {sum(isinstance(v, dict) for v in data.values())}; aliases: {sum(isinstance(v, str) for v in data.values())}; English keys: {len(base)}')
print('Potentially unused keys (literal scan only; do not delete without manual review):')
print(', '.join(sorted(set(base) - used)))
print('Issues:')
for issue in issues:
    print(' - ' + issue)
print(f'Total issues: {len(issues)}')
sys.exit(bool(issues))
