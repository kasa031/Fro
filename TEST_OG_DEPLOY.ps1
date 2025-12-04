# 🧪 Test lokalt, deretter deploy

# STEG 1: Gå inn i prosjektmappen
cd "c:\Users\Karina\Desktop\2025_2026\SmidigProsjekt\Eventyrhagen"

# STEG 2: Bygg web-versjonen lokalt (for testing)
Write-Host "`n🔨 Bygger web-versjonen lokalt..." -ForegroundColor Yellow
npx expo export --platform web

# STEG 3: Test Vercel lokalt
Write-Host "`n🌐 Starter Vercel dev server (lokal testing)..." -ForegroundColor Yellow
Write-Host "Åpne http://localhost:3000 i nettleseren for å teste" -ForegroundColor Cyan
Write-Host "Trykk Ctrl+C for å stoppe når du er ferdig med testing" -ForegroundColor Gray
npx vercel dev

# NÅR DU ER FERDIG MED TESTING:
# 1. Stopp Vercel dev (Ctrl+C)
# 2. Kjør DEPLOY_ALLE_NÅ.ps1 for å deploye til produksjon
