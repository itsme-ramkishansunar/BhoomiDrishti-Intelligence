import sys, json, os, zipfile, re, shutil, subprocess, tempfile

# Windows-safe Unicode output: land records may contain Devanagari and other scripts.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from xml.etree import ElementTree as ET

IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'}
# India-wide OCR preference. We only use language packs that are actually installed,
# so a missing regional pack never breaks document intake.
OCR_LANGUAGE_PRIORITY = [
    'eng','hin','mar','nep','ben','asm','guj','kan','mal','ori','pan','tam','tel','urd',
    'script/Devanagari','script/Bengali','script/Gurmukhi','script/Gujarati','script/Oriya',
    'script/Tamil','script/Telugu','script/Kannada','script/Malayalam','script/Latin'
]

def installed_tesseract_languages():
    exe=shutil.which('tesseract')
    if not exe: return set()
    try:
        r=subprocess.run([exe,'--list-langs'],capture_output=True,text=True,timeout=15)
        if r.returncode!=0: return set()
        return {x.strip() for x in r.stdout.splitlines()[1:] if x.strip()}
    except Exception:
        return set()

def choose_ocr_language(text=''):
    installed=installed_tesseract_languages()
    if not installed: return 'eng'
    # Script-aware ordering: preserve English as a bridge for bilingual government PDFs.
    scripts=[]
    ranges=[('Devanagari','\u0900','\u097f'),('Bengali','\u0980','\u09ff'),('Gurmukhi','\u0a00','\u0a7f'),('Gujarati','\u0a80','\u0aff'),('Odia','\u0b00','\u0b7f'),('Tamil','\u0b80','\u0bff'),('Telugu','\u0c00','\u0c7f'),('Kannada','\u0c80','\u0cff'),('Malayalam','\u0d00','\u0d7f'),('Arabic','\u0600','\u06ff')]
    for name,a,b in ranges:
        if any(ord(c)>=ord(a) and ord(c)<=ord(b) for c in text): scripts.append(name)
    preferred=['eng']
    if 'Devanagari' in scripts: preferred += ['hin','mar','nep','script/Devanagari']
    if 'Bengali' in scripts: preferred += ['ben','asm','script/Bengali']
    if 'Gurmukhi' in scripts: preferred += ['pan','script/Gurmukhi']
    if 'Gujarati' in scripts: preferred += ['guj','script/Gujarati']
    if 'Odia' in scripts: preferred += ['ori','script/Oriya']
    if 'Tamil' in scripts: preferred += ['tam','script/Tamil']
    if 'Telugu' in scripts: preferred += ['tel','script/Telugu']
    if 'Kannada' in scripts: preferred += ['kan','script/Kannada']
    if 'Malayalam' in scripts: preferred += ['mal','script/Malayalam']
    if 'Arabic' in scripts: preferred += ['urd']
    preferred += [x for x in OCR_LANGUAGE_PRIORITY if x not in preferred]
    requested=os.environ.get('BHOOMI_OCR_LANGS','').strip()
    if requested:
        requested=[x.strip() for x in requested.split('+') if x.strip()]
        chosen=[x for x in requested if x in installed]
    else:
        chosen=[x for x in preferred if x in installed]
    return '+'.join(chosen[:13]) if chosen else 'eng'

def read_text(path):
    with open(path,'r',encoding='utf-8',errors='replace') as f: return f.read()

def extract_docx(path):
    with zipfile.ZipFile(path) as z:
        xml=z.read('word/document.xml')
    root=ET.fromstring(xml)
    ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    return '\n'.join(''.join(t.text or '' for t in p.findall('.//w:t',ns)).strip() for p in root.findall('.//w:p',ns) if ''.join(t.text or '' for t in p.findall('.//w:t',ns)).strip())

def extract_xlsx(path):
    ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    with zipfile.ZipFile(path) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall(f'{{{ns}}}si'):
                shared.append(''.join(t.text or '' for t in si.iter(f'{{{ns}}}t')))
        out=[]
        sheets=[n for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')]
        for name in sorted(sheets):
            root=ET.fromstring(z.read(name)); out.append(f'=== {name} ===')
            for row in root.findall(f'.//{{{ns}}}row'):
                vals=[]
                for c in row.findall(f'{{{ns}}}c'):
                    v=c.find(f'{{{ns}}}v'); val='' if v is None else (v.text or '')
                    if c.get('t')=='s' and val.isdigit() and int(val)<len(shared): val=shared[int(val)]
                    vals.append(val)
                if vals: out.append(' | '.join(vals))
        return '\n'.join(out)

def try_pypdf(path):
    try:
        import pypdf
        r=pypdf.PdfReader(path)
        pages=[p.extract_text() or '' for p in r.pages]
        return '\n\n'.join(pages), 'python:pypdf'
    except Exception:
        return '', None

def try_tesseract(image_path, lang=None):
    lang = lang or choose_ocr_language('')
    # First prefer pytesseract when both the Python wrapper and the Tesseract
    # executable are available. Otherwise use the CLI directly.
    try:
        import pytesseract
        text=pytesseract.image_to_string(image_path, lang=lang)
        return text or '', 'tesseract:pytesseract'
    except Exception:
        pass
    exe=shutil.which('tesseract')
    if exe:
        try:
            r=subprocess.run([exe, image_path, 'stdout', '-l', lang, '--psm', '6'],
                             capture_output=True, text=True, timeout=60)
            if r.returncode == 0:
                return r.stdout or '', 'tesseract:cli'
        except Exception:
            pass
    return '', None

def ocr_pdf_with_fitz(path, lang=None):
    try:
        import fitz
    except Exception:
        return '', None, 0
    pages=[]
    doc=fitz.open(path)
    lang = lang or choose_ocr_language('')
    try:
        for page in doc:
            pix=page.get_pixmap(matrix=fitz.Matrix(1.6,1.6), alpha=False)
            fd,tmp=tempfile.mkstemp(suffix='.png')
            os.close(fd)
            try:
                pix.save(tmp)
                text,engine=try_tesseract(tmp,lang)
                if text.strip():
                    pages.append(text)
            finally:
                try: os.remove(tmp)
                except Exception: pass
    finally:
        doc.close()
    return '\n\n'.join(pages), ('fitz+tesseract' if pages else None), len(pages)

def extract_pdf(path):
    text,parser=try_pypdf(path)
    # Scanned PDFs often contain little/no embedded text. Only invoke OCR as a
    # fallback so ordinary digital PDFs remain fast and dependency-light.
    if len(re.sub(r'\s+','',text)) >= 40:
        return text, parser, {'used':False,'engine':None,'pages':0,'reason':'embedded_text'}
    ocr_text,engine,pages=ocr_pdf_with_fitz(path)
    if ocr_text.strip():
        return ocr_text, 'ocr:pdf', {'used':True,'engine':engine,'pages':pages,'reason':'scanned_pdf_fallback','languages':choose_ocr_language(ocr_text)}
    if text.strip():
        return text, parser or 'python:pypdf', {'used':False,'engine':None,'pages':0,'reason':'ocr_unavailable','languages':None}
    raise RuntimeError('PDF extraction unavailable. Install pypdf for text PDFs; for scanned PDFs install PyMuPDF + pytesseract and Tesseract OCR.')

def main():
    path=sys.argv[1]; ext=os.path.splitext(path)[1].lower()
    parser='python:stdlib'; ocr={'used':False,'engine':None,'pages':0,'reason':None,'languages':None}
    if ext=='.pdf':
        text,parser,ocr=extract_pdf(path)
    elif ext=='.docx':
        text=extract_docx(path)
    elif ext=='.xlsx':
        text=extract_xlsx(path)
    elif ext in IMAGE_EXTS:
        text,engine=try_tesseract(path, choose_ocr_language(''))
        if not text.strip():
            raise RuntimeError('Image OCR unavailable. Install Tesseract OCR and ensure it is on PATH, or install pytesseract.')
        parser='ocr:image'
        ocr={'used':True,'engine':engine,'pages':1,'reason':'image_document','languages':choose_ocr_language(text)}
    else:
        text=read_text(path)
    print(json.dumps({
        'text':text,
        'parser':parser,
        'textChars':len(text),
        'ocr':ocr,
    },ensure_ascii=False))

if __name__=='__main__':
    main()
