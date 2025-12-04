# 🧪 Test lokalt før deploy

# STEG 1: Gå inn i prosjektmappen
cd "c:\Users\Karina\Desktop\2025_2026\SmidigProsjekt\Eventyrhagen"

# STEG 2: Start Expo (for mobil-testing)
Write-Host "`n📱 Starter Expo for mobil-testing..." -ForegroundColor Yellow
Write-Host "Skann QR-koden med Expo Go for å teste på mobil" -ForegroundColor Cyan
Write-Host "Trykk Ctrl+C for å stoppe" -ForegroundColor Gray
npx expo start --clear

# ELLER hvis du vil teste web lokalt:
# npx expo start --web

# ELLER hvis du vil teste Vercel lokalt (etter at du har bygget):
# npx vercel dev
