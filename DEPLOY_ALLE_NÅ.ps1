# 🚀 Deploy til alle plattformer og push til GitHub

# STEG 1: Gå inn i prosjektmappen
Set-Location "c:\Users\Karina\Desktop\2025_2026\SmidigProsjekt\Eventyrhagen"

# STEG 2: Deploy til Expo (mobil)
Write-Host "`n📱 Deployer til Expo (mobil)..." -ForegroundColor Yellow
# Slett dist-mappen hvis den eksisterer for å unngå konflikter
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
# Kjør EAS update direkte (den eksporterer automatisk)
$env:CI = "1"
npx eas update --branch production --message "Deploy: Klikkbare avdelinger med modal, horisontal layout, fikset alignment" --non-interactive

# STEG 3: Bygg og deploy web-versjonen til Vercel
Write-Host "`n🌐 Bygger web-versjonen..." -ForegroundColor Yellow
npx expo export --platform web

Write-Host "`n🌐 Deployer til Vercel..." -ForegroundColor Yellow
npx vercel --prod

# STEG 4: Git - Legg til alle endringer
Write-Host "`n📦 Legger til endringer i Git..." -ForegroundColor Yellow
git add .

# STEG 5: Commit
Write-Host "`n💾 Committer endringer..." -ForegroundColor Yellow
git commit -m "Deploy: Klikkbare avdelinger med modal, horisontal layout, fikset alignment"

# STEG 6: Push til GitHub
Write-Host "`n⬆️ Pusher til GitHub..." -ForegroundColor Yellow
git push

Write-Host "`n✅ Alt ferdig! Appen er deployet til:" -ForegroundColor Green
Write-Host "  📱 Mobil: Expo EAS Update (production branch)" -ForegroundColor Cyan
Write-Host "  🌐 Web: Vercel" -ForegroundColor Cyan
Write-Host "  📦 Git: GitHub" -ForegroundColor Cyan
