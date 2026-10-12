"""
Finds where the English "On the emergence of Pigeon Towers" marks each note:
the superscript numbers are separate, smaller words in the PDF, so their
positions (pdftotext -bbox-layout) give the words just before each marker.

  python3 -I migration/tools/anchor-english-notes.py <repo> <outdir>

Writes <outdir>/answer-en-<order>.json ([{number, block, before}]) for
  npx tsx migration/record-note-anchors.ts essay:on_the_emergence_of_pigeon_towers_-_english:<order> <answer>
The Arabic essays have no usable text layer; their answers come from reading
the page images (see migration/README.md).
"""
import json,re,sys,os,subprocess,statistics,unicodedata,html
repo,out=sys.argv[1],sys.argv[2]
PDF=os.path.join(repo,'migration/raw/weebly-zip-2025-04-23/uploads/1/9/1/0/19102967/on_the_emergence_of_pigeon_towers_-_english.pdf')
def norm(s): return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKC',s).lower())
def words(page):
    xml=subprocess.run(['pdftotext','-bbox-layout','-f',str(page),'-l',str(page),PDF,'-'],capture_output=True,text=True).stdout
    return [dict(x0=float(a),y0=float(b),x1=float(c),y1=float(d),t=html.unescape(w)) for a,b,c,d,w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>',xml)]
toc=json.load(open(os.path.join(repo,'migration/extracted/content/toc__on_the_emergence_of_pigeon_towers_-_english.json')))['data']['essays']
report=[]
for e in toc:
    f=os.path.join(repo,f"migration/extracted/content/essay__on_the_emergence_of_pigeon_towers_-_english__{e['order']}.json")
    d=json.load(open(f))['data']
    nums=[int(m.group(1)) for b in d['blocks'] if b['type']=='note' for m in [re.match(r'\s*(\d+)',b['text'])] if m]
    if not nums: continue
    body=[(i,b['text']) for i,b in enumerate(d['blocks']) if b['type']!='note']
    anchors=[]; want=list(nums)
    for page in range(e['first_page'],e['last_page']+1):
        ws=words(page)
        if not ws: continue
        med=statistics.median([w['y1']-w['y0'] for w in ws])
        for w in ws:
            if not want or not re.fullmatch(r'\d+',w['t']) or int(w['t'])!=want[0]: continue
            h=w['y1']-w['y0']
            if h>0.8*med: continue
            cy=(w['y0']+w['y1'])/2
            left=[v for v in ws if v is not w and v['x1']<=w['x0']+2 and v['y0']-2<=cy<=v['y1']+2 and not (re.fullmatch(r'\d+',v['t']) and (v['y1']-v['y0'])<=0.8*med)]
            if not left: continue
            a=max(left,key=lambda v:v['x1'])
            # Reading order: lines top to bottom, words left to right; markers left out.
            text_words=[v for v in ws if not (re.fullmatch(r'\d+',v['t']) and (v['y1']-v['y0'])<=0.8*med)]
            text_words.sort(key=lambda v:(round(v['y1']/4),v['x0']))
            upto=text_words[:text_words.index(a)+1]
            ctx=' '.join(v['t'] for v in upto[-14:])
            anchors.append({'number':want[0],'page':page,'context':ctx})
            want.pop(0)
    # match contexts to blocks: longest normalised suffix of ctx found in one block
    res=[]
    for a in anchors:
        k=norm(a['context']); hit=None
        for L in range(min(60,len(k)),7,-1):
            suf=k[-L:]; hs=[i for i,t in body if suf in norm(t)]
            if len(hs)==1: hit=(hs[0],suf); break
        # the exact words before the marker, in the block's own text
        entry={'number':a['number'],'block':hit[0] if hit else None}
        if hit:
            raw=dict(body)[hit[0]]
            # map normalised characters back to raw offsets
            idx=[i for i,ch in enumerate(raw) for _ in norm(ch)]
            nraw=''.join(norm(ch) for ch in raw); at=nraw.find(hit[1])
            off=idx[at+len(hit[1])-1]+1
            while off<len(raw) and raw[off] in '.,;:!?”’"\')]…–-': off+=1
            entry['offset']=off; entry['before']=raw[max(0,off-40):off]
        res.append(entry)
    missing=[n for n in nums if n not in [r['number'] for r in res if r['block'] is not None]]
    report.append((e['order'],len(nums),len(nums)-len(missing),missing))
    answer=[{'number':r['number'],'block':r['block'],'before':r['before'][-30:]} for r in res if r['block'] is not None]
    json.dump(answer,open(os.path.join(out,f"answer-en-{e['order']}.json"),'w'),ensure_ascii=False,indent=1)
for r in report: print('essay',r[0],'notes',r[1],'anchored',r[2],'missing',r[3])
