#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import json, re, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
required=[
 'index.html','manifest.webmanifest','sw.js','offline.html','README.md','SECURITY.md',
 'assets/collab.js','assets/data-sources.js','assets/webllm.js','assets/upgrade.js','assets/pwa-register.js','assets/upgrade.css',
 'data/texas-context.json','data/resources.json','data/cross-domain-schema.json',
 'icons/icon-192.png','icons/icon-512.png','server/server.js','server/package.json'
]
errors=[]; notes=[]
for f in required:
    if not (ROOT/f).is_file(): errors.append(f'Missing required file: {f}')
for f in ['manifest.webmanifest','data/texas-context.json','data/resources.json','data/cross-domain-schema.json','server/package.json']:
    try: json.loads((ROOT/f).read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'Invalid JSON {f}: {e}')

class IDs(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k=='id' and v: self.ids.append(v)
parser=IDs(); parser.feed((ROOT/'index.html').read_text(encoding='utf-8'))
seen=set(); dup=[]
for i in parser.ids:
    if i in seen: dup.append(i)
    seen.add(i)
if dup: errors.append('Duplicate HTML ids: '+', '.join(sorted(set(dup))))
else: notes.append(f'HTML IDs unique ({len(parser.ids)} IDs)')

html=(ROOT/'index.html').read_text(encoding='utf-8')
for needle in ['data-route="collaboration"','data-route="cross-domain"','data-route="live-data"','data-route="local-ai"','data-route="diagnostics"']:
    if needle not in html: errors.append(f'Missing route marker: {needle}')

sw=(ROOT/'sw.js').read_text(encoding='utf-8')
for f in ['./index.html','./manifest.webmanifest','./assets/upgrade.js','./assets/collab.js','./data/texas-context.json','./icons/icon-192.png']:
    if f not in sw: errors.append(f'Service worker core list missing: {f}')

server=(ROOT/'server/server.js').read_text(encoding='utf-8')
if "pathname.startsWith('/server/')" not in server: errors.append('Server does not block /server from static serving')
for typ in ['shared-task','comment','evidence','decision','incident']:
    if typ not in server: errors.append(f'Server sanitizer missing shared type: {typ}')
try:
    pkg=json.loads((ROOT/'server/package.json').read_text())
    if pkg.get('dependencies'): errors.append('Server should remain zero-dependency but dependencies were found')
    else: notes.append('Collaboration server has zero third-party runtime dependencies')
except Exception as e: errors.append(f'Server package check failed: {e}')

jsfiles=['assets/collab.js','assets/data-sources.js','assets/webllm.js','assets/upgrade.js','assets/pwa-register.js','sw.js','server/server.js']
try:
    subprocess.run(['node','--version'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for f in jsfiles:
        r=subprocess.run(['node','--check',str(ROOT/f)],capture_output=True,text=True)
        if r.returncode: errors.append(f'JS syntax failed {f}: {r.stderr.strip()}')
    # Check embedded base script too.
    scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
    for idx,src in enumerate(scripts):
        tmp=ROOT/'tools'/f'.inline-{idx}.js'; tmp.write_text(src,encoding='utf-8')
        r=subprocess.run(['node','--check',str(tmp)],capture_output=True,text=True)
        try: tmp.unlink()
        except: pass
        if r.returncode: errors.append(f'Inline JS syntax failed block {idx}: {r.stderr.strip()}')
    notes.append('JavaScript syntax checked with Node')
except Exception as e:
    notes.append(f'Node unavailable; JavaScript syntax check skipped: {e}')

manifest=json.loads((ROOT/'manifest.webmanifest').read_text())
for icon in manifest.get('icons',[]):
    if not (ROOT/icon['src'].lstrip('./')).is_file(): errors.append(f'Manifest icon missing: {icon["src"]}')

print('Texas Household Resilience OS bundle verification')
for n in notes: print('PASS:',n)
if errors:
    for e in errors: print('FAIL:',e)
    sys.exit(1)
print('PASS: required files, JSON, routes, service-worker references, server boundary and manifest assets')
