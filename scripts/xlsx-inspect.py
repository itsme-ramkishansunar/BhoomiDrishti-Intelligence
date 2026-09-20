import json, sys, zipfile, xml.etree.ElementTree as ET
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'; REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def q(tag): return f'{{{NS}}}{tag}'
def ci(ref):
    n=0
    for c in ''.join(x for x in ref if x.isalpha()).upper(): n=n*26+ord(c)-64
    return n-1
def main(path):
  with zipfile.ZipFile(path) as z:
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
      r=ET.fromstring(z.read('xl/sharedStrings.xml'))
      shared=[''.join(t.text or '' for t in si.iter(q('t'))) for si in r.findall(q('si'))]
    wb=ET.fromstring(z.read('xl/workbook.xml')); rr=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rels={x.attrib['Id']:x.attrib['Target'] for x in rr}
    out=[]
    for sh in wb.find(q('sheets')):
      name=sh.attrib.get('name','Sheet'); rid=sh.attrib.get(f'{{{REL}}}id'); target=rels.get(rid,'')
      target=target.lstrip('/'); target=target if target.startswith('xl/') else 'xl/'+target
      if target not in z.namelist(): continue
      root=ET.fromstring(z.read(target)); raw=[]; maxc=-1
      for row in root.findall('.//'+q('row')):
        vals={}
        for c in row.findall(q('c')):
          i=ci(c.attrib.get('r','A1')); v=c.find(q('v')); typ=c.attrib.get('t'); val=''
          if typ=='s' and v is not None: val=shared[int(v.text or 0)] if int(v.text or 0)<len(shared) else ''
          elif typ=='inlineStr': val=''.join(t.text or '' for t in c.iter(q('t')))
          elif v is not None: val=v.text or ''
          vals[i]=val; maxc=max(maxc,i)
        raw.append([vals.get(i,'') for i in range(maxc+1)])
      headers=raw[0] if raw else []; data=[]
      for r in raw[1:]:
        data.append({str(h).strip() or f'column_{i+1}': (r[i] if i<len(r) else '') for i,h in enumerate(headers)})
      out.append({'sheet':name,'headers':headers,'rows':data})
  print(json.dumps(out,ensure_ascii=False))
if __name__=='__main__': main(sys.argv[1])
