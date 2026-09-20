$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Root ".venv-u72-ocr"
$Python = Join-Path $Venv "Scripts\python.exe"

Write-Host "BHOOMIDHRISHTI U72 Document Intelligence setup" -ForegroundColor Cyan
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw "Python launcher 'py' was not found. Install Python 3.10+ and rerun."
}
if (-not (Test-Path $Python)) {
  py -3 -m venv $Venv
}
& $Python -m pip install --upgrade pip
& $Python -m pip install -r (Join-Path $Root "requirements-u72-ocr.txt")

$tesseract = Get-Command tesseract -ErrorAction SilentlyContinue
if ($tesseract) {
  Write-Host "Tesseract detected: $($tesseract.Source)" -ForegroundColor Green
} else {
  Write-Warning "Tesseract OCR executable is not on PATH. Text PDFs will still work; scanned PDFs/images will remain safely queued for OCR setup."
}

Write-Host ""
Write-Host "U72 OCR environment ready." -ForegroundColor Green
Write-Host "The backend will automatically prefer: $Python"
Write-Host "No database migration or data reset is performed."
