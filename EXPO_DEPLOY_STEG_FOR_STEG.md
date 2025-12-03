# 🚀 Expo Deployment - Steg-for-steg Guide

## Forutsetninger
- Node.js installert
- Expo CLI (installeres automatisk)
- Expo-konto (gratis - opprettes underveis)

---

## STEG 1: Opprett Expo-konto (hvis du ikke har en)

1. Gå til [https://expo.dev](https://expo.dev)
2. Klikk på **"Sign Up"** (eller "Log In" hvis du allerede har konto)
3. Opprett konto med:
   - E-post
   - Eller Google/GitHub-konto
4. Bekreft e-posten din (sjekk innboks)

---

## STEG 2: Åpne terminal/PowerShell

### Windows:
1. Trykk `Windows + X`
2. Velg **"Windows PowerShell"** eller **"Terminal"**
3. Naviger til prosjektmappen:
   ```powershell
   cd [din-prosjektsti]/fro
   ```

---

## STEG 3: Installer Expo CLI (hvis ikke allerede installert)

```powershell
npm install -g expo-cli
```

**Vent til installasjonen er ferdig** (kan ta 1-2 minutter)

---

## STEG 4: Logg inn på Expo

```powershell
npx expo login
```

**Hva skjer:**
1. Du blir bedt om å skrive inn **e-post** eller **brukernavn**
2. Deretter **passord**
3. Hvis du ikke har konto, følg instruksjonene på skjermen

**Eksempel:**
```
? Username or email: din-epost@eksempel.no
? Password: [skriv passordet ditt]
```

✅ Når du ser "Logged in as [ditt-brukernavn]" er du innlogget!

---

## STEG 5: Sjekk at alt fungerer lokalt

Først, test at appen fungerer lokalt:

```powershell
npm start
```

**Hva skjer:**
- Expo Development Server starter
- Du får en QR-kode i terminalen
- En nettleser åpnes automatisk

**Test web-versjonen:**
- Trykk `w` i terminalen for å åpne web-versjon
- Eller gå til `http://localhost:8081` i nettleseren
- Sjekk at appen fungerer

**Stopp serveren:**
- Trykk `Ctrl + C` i terminalen

---

## STEG 6: Sjekk miljøvariabler

⚠️ **VIKTIG**: Du må ha en `.env` fil med Firebase-nøklene dine!

1. Sjekk at `.env` filen eksisterer i `fro`-mappen
2. Den skal inneholde:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=din-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=ditt-auth-domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=ditt-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=ditt-storage-bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=ditt-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=ditt-app-id
   ```

3. **Sjekk at `.env` er i `.gitignore`** (skal ikke committes til Git)

---

## STEG 7: Sett opp miljøvariabler i Expo

### Metode 1: Via Expo Dashboard (Anbefalt)

1. Gå til [https://expo.dev](https://expo.dev)
2. Logg inn
3. Klikk på **"Projects"** eller **"Your Projects"**
4. Velg prosjektet ditt (eller opprett nytt hvis første gang)
5. Gå til **"Secrets"** eller **"Environment Variables"**
6. Legg til hver variabel:
   - Klikk **"Add Secret"** eller **"Add Variable"**
   - **Name**: `EXPO_PUBLIC_FIREBASE_API_KEY`
   - **Value**: [lim inn API-nøkkelen din]
   - Klikk **"Save"**
7. Gjenta for alle 6 variabler:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`

### Metode 2: Via CLI (Avansert)

```powershell
# For hver variabel:
npx expo config --type public --set EXPO_PUBLIC_FIREBASE_API_KEY="din-api-key"
```

**Anbefaling**: Bruk Metode 1 (Dashboard) - det er enklere!

---

## STEG 8: Deploy appen til Expo

Nå er det tid for selve deploymenten!

### Metode 1: Bruk deploy-scriptet (anbefalt)
```powershell
npm run deploy
```

### Metode 2: Manuelt
```powershell
# Først bygg web-versjonen
npx expo export:web

# Deretter publiser
npx expo publish
```

**Hva skjer:**
1. Expo bygger web-versjonen av appen
2. Laster opp til Expo-servrene
3. Dette kan ta 2-5 minutter
4. Du får en melding når det er ferdig

**Eksempel på output:**
```
✔ Published
Your app is live at:
https://expo.dev/@ditt-brukernavn/fro

QR code:
[QR-kode vises her]
```

**⚠️ Merk**: Hvis `expo publish` ikke fungerer (deprecated i nyere versjoner), bruk i stedet:

### Alternativ: Deploy til Vercel (gratis og enkelt)

1. **Bygg web-versjonen:**
   ```powershell
   npx expo export:web
   ```

2. **Installer Vercel CLI:**
   ```powershell
   npm install -g vercel
   ```

3. **Deploy:**
   ```powershell
   cd web-build
   vercel --prod
   ```

4. **Sett miljøvariabler i Vercel Dashboard:**
   - Gå til [vercel.com](https://vercel.com)
   - Velg prosjektet
   - Settings → Environment Variables
   - Legg til alle `EXPO_PUBLIC_*` variabler

5. **Få QR-kode:**
   - Bruk en QR-kode generator online
   - Lim inn Vercel-URL-en
   - Del QR-koden

**Fordeler med Vercel:**
- ✅ Gratis hosting
- ✅ Automatisk HTTPS
- ✅ Rask deployment
- ✅ Enkel oppdatering

---

## STEG 9: Få QR-kode og lenker

Etter deployment får du:

### 1. QR-kode
- Vises i terminalen
- Kan skannes med **Expo Go**-appen (iOS/Android)
- Kan deles med andre

### 2. Web-link
- F.eks.: `https://expo.dev/@ditt-brukernavn/fro`
- Fungerer i alle nettlesere
- Deles direkte

### 3. Expo Go-link
- For mobil-testing
- Åpnes i Expo Go-appen

---

## STEG 10: Test appen

### Test på web:
1. Åpne web-linken i nettleseren
2. Appen skal laste og fungere

### Test på mobil:
1. Last ned **Expo Go**-appen:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Åpne Expo Go
3. Skann QR-koden fra terminalen
4. Appen lastes ned og kjører

---

## STEG 11: Del appen med andre

### Del QR-kode:
1. Ta skjermbilde av QR-koden fra terminalen
2. Del bildet med andre
3. De skanner med Expo Go

### Del web-link:
1. Kopier web-linken fra terminalen
2. Del via e-post, melding, etc.
3. Fungerer i alle nettlesere

### Embed på nettside (valgfritt):
- Kan legges inn på nettsider
- Se Expo-dokumentasjon for detaljer

---

## 🔄 Oppdatere appen (når du gjør endringer)

Når du har gjort endringer og vil oppdatere den deployede versjonen:

1. Gjør endringene i koden
2. Test lokalt: `npm start`
3. Deploy igjen:
   ```powershell
   npm run deploy
   ```
4. Den nye versjonen er live om få minutter!

---

## ⚠️ Feilsøking

### Problem: "Not logged in"
**Løsning:**
```powershell
npx expo login
```

### Problem: "Environment variables not found"
**Løsning:**
- Sjekk at miljøvariabler er satt i Expo Dashboard
- Sjekk at de har `EXPO_PUBLIC_` prefix
- Rebuild appen etter å ha lagt til variabler

### Problem: "Build failed"
**Løsning:**
- Sjekk at alle avhengigheter er installert: `npm install`
- Sjekk for feil i koden: `npm run lint`
- Test lokalt først: `npm start`

### Problem: "Firebase connection error"
**Løsning:**
- Sjekk at miljøvariabler er riktig satt
- Sjekk Firebase Security Rules
- Sjekk at Firebase-prosjektet er aktivt

### Problem: QR-kode fungerer ikke
**Løsning:**
- Sjekk at du er logget inn: `npx expo login`
- Sjekk at appen er deployet (ikke bare lokalt)
- Prøv å oppdatere Expo Go-appen

---

## 📋 Sjekkliste før deployment

- [ ] Expo-konto opprettet
- [ ] Logget inn på Expo CLI
- [ ] Appen fungerer lokalt (`npm start`)
- [ ] `.env` fil eksisterer med alle variabler
- [ ] Miljøvariabler satt i Expo Dashboard
- [ ] Ingen feil i koden (`npm run lint`)
- [ ] Firebase Security Rules er konfigurert

---

## 🎉 Gratulerer!

Når du har fullført alle stegene:
- ✅ Appen er live 24/7
- ✅ QR-kode kan deles
- ✅ Web-link fungerer
- ✅ Ingen lokal server nødvendig
- ✅ Oppdateringer er enkle

---

## 📚 Nyttige lenker

- [Expo Dashboard](https://expo.dev)
- [Expo Go App (iOS)](https://apps.apple.com/app/expo-go/id982107779)
- [Expo Go App (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)
- [Expo Dokumentasjon](https://docs.expo.dev)

---

## 💡 Tips

1. **Test lokalt først** - alltid test før deployment
2. **Miljøvariabler** - sett dem opp i Dashboard, ikke i kode
3. **Versjonering** - hver deployment får en ny versjon
4. **Gratis tier** - Expo har gratis hosting (nok for testing/demo)
5. **Backup** - ta backup av `.env` filen (men ikke commit den!)

---

**Lykke til med deployment! 🚀**
