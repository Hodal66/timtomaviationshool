import json,sys,os
sys.path.insert(0,os.path.dirname(__file__))
from dict_a import A
from dict_b import B
from dict_c import C
rows={}
for r in A+B+C: rows[r[0]]=r
for i,(code,name) in enumerate([("fr","fr"),("rw","rw"),("sw","sw")],start=1):
    body=",\n".join(f"  {json.dumps(r[0],ensure_ascii=False)}: {json.dumps(r[i],ensure_ascii=False)}" for r in rows.values() if r[i]!=r[0])
    open(f"src/lib/i18n/{code}.ts","w").write(f'import type {{ Dict }} from "./index";\n/** {name.upper()} translations. English text is the key. Reviewed by the author only: have a native speaker proof-read before launch. */\nconst d: Dict = {{\n{body},\n}};\nexport default d;\n')
ui=set(json.load(open('qa/i18n-ui.json')))|set(json.load(open('qa/i18n-t.json')))
miss=[s for s in ui if s not in rows]
print(len(rows),"entries; untranslated UI strings:",len(miss))
for s in miss: print("-",s[:110])
