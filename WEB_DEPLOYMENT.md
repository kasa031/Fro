# 🌐 Web Deployment Guide - Frö

## 🎯 Mål
Deploye web-versjonen av appen slik at den kan testes i nettleseren uten å kjøre lokalt.

---

## 🚀 Metode 1: Vercel (Anbefalt)

### Steg 1: Installer Vercel CLI
```powershell
npm install -g vercel
```

### Steg 2: Logg inn på Vercel
```powershell
npx vercel login
```

### Steg 3: Bygg web-versjonen
```powershell
npx expo export --platform web
```

### Steg 4: Deploy til Vercel
```powershell
npx vercel --prod
```

### Steg 5: Sett miljøvariabler i Vercel Dashboard
1. Gå til: https://vercel.com
2. Velg prosjektet "fro"
3. Settings → Environment Variables
4. Legg til alle `EXPO_PUBLIC_*` variabler fra `.env`-filen:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`

### Steg 6: Få web-link
- Vercel gir deg en link (f.eks. `https://fro-xxx.vercel.app`)
- Oppdater `BRUKSANVISNING.md` med denne linken

---

## 🔄 Metode 2: Expo Web Hosting (Alternativ)

Expo har egen web-hosting, men den er mer begrenset.

### Steg 1: Deploy med EAS
```powershell
npx eas update --branch production --message "Deploy web version"
```

### Steg 2: Web-link
- Gå til: https://expo.dev/accounts/ms.tery/projects/fro
- Web-versjonen skal være tilgjengelig der

**Merk:** Dette fungerer ikke like bra som Vercel for web-versjoner.

---

## ⚠️ Feilsøking

### "expo-router" feil
Hvis du får feil om expo-router:
- Sjekk at `expo-router` er fjernet fra `package.json`
- Sjekk at `app.json` ikke har `expo-router` i plugins

### "Build failed"
- Sjekk at alle dependencies er installert (`npm install`)
- Sjekk at `.env`-filen har riktig innhold
- Prøv å bygge lokalt først: `npm run build:web`

### Miljøvariabler fungerer ikke
- Sjekk at alle variabler har `EXPO_PUBLIC_` prefix
- Sjekk at variablene er satt i Vercel Dashboard
- Restart deployment etter å ha lagt til variabler

---

## ✅ Når deployment er ferdig

1. Oppdater `BRUKSANVISNING.md` med web-linken
2. Test web-versjonen i nettleseren
3. Del linken med testbrukere
