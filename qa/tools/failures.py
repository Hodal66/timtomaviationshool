import json,re,sys
d=json.load(open('qa/reports/e2e-results.json'))
def walk(s,out):
    for sp in s.get('specs',[]):
        for t in sp['tests']:
            for r in t['results']:
                if r['status'] in ('failed','timedOut'):
                    m=(r.get('error',{}).get('message') or '')
                    m=re.sub(r'\x1b\[[0-9;]*m','',m)
                    out.append((sp['title'][:80], m[:int(sys.argv[1]) if len(sys.argv)>1 else 700]))
    for c in s.get('suites',[]): walk(c,out)
out=[]
for s in d['suites']: walk(s,out)
for t,m in out: print('##',t); print(m); print()
