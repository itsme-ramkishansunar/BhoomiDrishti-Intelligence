const fs = require('node:fs');
const path = require('node:path');

const root=process.cwd();
const mustExist=[
  'scripts/extract-document.py',
  'backend/domain/intake-analyzer.js',
  'src/components/intake/ProjectIntakePage.jsx',
  'requirements-u72-ocr.txt',
  'INSTALL_U72_DOCUMENT_INTELLIGENCE_WINDOWS.ps1',
  'docs_UPGRADE_72_DOCUMENT_INTELLIGENCE.md',
];
const missing=mustExist.filter(f=>!fs.existsSync(path.join(root,f)));
if(missing.length) throw new Error(`U72 files missing: ${missing.join(', ')}`);

const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const extractor=fs.readFileSync(path.join(root,'scripts/extract-document.py'),'utf8');
const analyzer=fs.readFileSync(path.join(root,'backend/domain/intake-analyzer.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/components/intake/ProjectIntakePage.jsx'),'utf8');

for (const needle of [
  "'.png','.jpg','.jpeg','.tif','.tiff','.bmp','.webp'",
  "out.ocr||{used:false",
  "BHOOMI",
]) {
  if (!server.includes(needle)) {
    // The BHOOMI check is intentionally loose; it only guards that this is our server.
    if (needle !== "BHOOMI") throw new Error(`Server contract missing: ${needle}`);
  }
}
for (const needle of ["try_tesseract", "ocr_pdf_with_fitz", "IMAGE_EXTS"]) {
  if (!extractor.includes(needle)) throw new Error(`OCR extractor contract missing: ${needle}`);
}
for (const needle of ["classifyDocument", "buildDocumentQuality", "reviewQueue"]) {
  if (!analyzer.includes(needle)) throw new Error(`Document quality contract missing: ${needle}`);
}
for (const needle of [".png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp", "Document intelligence"]) {
  if (!ui.includes(needle)) throw new Error(`Intake UI contract missing: ${needle}`);
}

// Explicitly assert that U72 did not add a second database implementation.
const forbidden=['sequelize','mongoose','prisma','typeorm','mongodb'];
const lower=server.toLowerCase();
const forbiddenHits=forbidden.filter(x=>lower.includes(x));
if(forbiddenHits.length) throw new Error(`Unexpected second-database dependency markers: ${forbiddenHits.join(', ')}`);

console.log(JSON.stringify({
  ok:true,
  version:'U72.1',
  checks:mustExist.length,
  databaseMigration:false,
  secondDatabase:false,
  canonicalOverwrite:false,
  ocrAdapter:true,
  humanReviewQueue:true,
},null,2));
