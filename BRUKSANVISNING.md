# 📱 Frö - Barnehage App - Test-Guide

**Digital løsning for barnehageadministrasjon**

---

## 🎯 Velg din vei

### 🚀 **VEI 1: Bare teste appen** (5 minutter)
Test appen direkte uten å laste ned noe.

### 💻 **VEI 2: Laste ned og kjøre lokalt** (30-60 minutter)
Last ned prosjektet og kjør det på din maskin.

---

# 🚀 VEI 1: Bare teste appen

## 📱 Test på mobil (anbefalt)

1. Last ned **Expo Go**:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Åpne Expo Go → "Scan QR code"

3. Skann QR-koden fra:
   **https://expo.dev/accounts/ms.tery/projects/fro/updates/e9776169-aec9-4d34-82bd-703eb5c6d55a**
   
   (Klikk lenken og trykk "Preview" for å se QR-koden)

4. Appen lastes automatisk! 📲

## 🌐 Test på nettleser

**Web-link:** https://eventyrhagen-l3jt6bshb-msterys-projects.vercel.app

Åpne lenken i nettleseren (Chrome, Firefox, Safari, Edge).

**💡 Tips:** Hvis appen ikke laster inn på web, kan det være fordi ad-blocker blokkerer Firebase. Se `ADBLOCKER_FIX.md` for løsning.

### 📱 Legg til på hjemmeskjerm (app-ikon)

**iPhone (Safari):**
1. Åpne lenken i **Safari** (ikke Chrome)
2. Trykk på del-ikonet (firkant med pil) nederst
3. Velg **"Legg til på hjemmeskjerm"**
4. Gi den et navn og trykk "Legg til"

**Android (Chrome):**
1. Åpne lenken i Chrome
2. Trykk på tre-prikk-menyen (øverst til høyre)
3. Velg **"Legg til på hjemmeskjerm"** eller **"Install app"**
4. Bekreft

## 🔐 Logg inn / Opprett bruker

**Opprett ny bruker:**
1. Trykk på **"Opprett bruker"** på innloggingsskjermen
2. Fyll ut navn, e-post og passord
3. **Passordkrav:** Minst 6 tegn og minst ett spesialtegn (!@#$%^&*()_+-=[]{}|;:,.<>?)
4. Du blir automatisk logget inn som **Forelder**

**Logg inn:**
- Skriv inn e-post og passord
- Trykk "Logg inn"

---

# 💻 VEI 2: Laste ned og kjøre lokalt

## Forutsetninger

- Node.js (https://nodejs.org/) - Last ned LTS-versjonen
- IDE (valgfritt) - VS Code, WebStorm, eller lignende

## Steg 1: Last ned prosjektet

### Metode 1: Last ned som ZIP (enklest - anbefalt)

1. Gå til: https://github.com/kasa031/Fro
2. Klikk på den grønne knappen **"Code"** (øverst til høyre)
3. Klikk på **"Download ZIP"**
4. Pakk ut ZIP-filen til ønsket mappe (f.eks. Skrivebordet)
5. Mappen heter nå `Fro-main` eller `Fro` - gå inn i den

### Metode 2: Bruk Git (hvis du har Git installert)

```bash
git clone https://github.com/kasa031/Fro.git
cd Fro
```

**Sjekk om du har Git:**
- Åpne PowerShell/Terminal og skriv: `git --version`
- Hvis du får en versjon, har du Git! ✅
- Hvis ikke, bruk Metode 1 (ZIP) i stedet

## Steg 2: Gå inn i prosjektmappen

**Hvis du lastet ned som ZIP:**
- Gå inn i `Fro-main` eller `Fro`-mappen du pakket ut

**Hvis du brukte Git:**
- Du er allerede inne i `Fro`-mappen

Åpne PowerShell/Terminal og naviger til mappen:
```bash
cd Desktop/Fro-main
```
(eller hvor du pakket ut filen)

## Steg 3: Installer dependencies

```bash
npm install
```

Dette kan ta 5-10 minutter.

## Steg 4: Opprett .env fil

1. Opprett en fil som heter `.env` i `Fro`-mappen
2. Kontakt prosjektlederen for å få Firebase-nøklene
3. Lim inn nøklene i `.env`-filen:

```
EXPO_PUBLIC_FIREBASE_API_KEY=din-api-key-her
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=ditt-auth-domain-her
EXPO_PUBLIC_FIREBASE_PROJECT_ID=ditt-project-id-her
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=ditt-storage-bucket-her
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=ditt-sender-id-her
EXPO_PUBLIC_FIREBASE_APP_ID=ditt-app-id-her
EXPO_PUBLIC_FIREBASE_VAPID_KEY=ditt-vapid-key-her
```

## Steg 5: Start appen

```bash
npm start
```

En QR-kode vises i terminalen. Skann med Expo Go, eller trykk `w` for web-versjon.

## Test på mobil

1. Last ned Expo Go (se lenker over)
2. Skann QR-koden fra terminalen
3. **VIKTIG:** Telefon og datamaskin må være på samme Wi-Fi

## Test på nettleser

- Trykk `w` i terminalen, eller
- Gå til `http://localhost:8081` i nettleseren

---

## 🔗 Nyttige lenker

- **QR-kode (mobil):** https://expo.dev/accounts/ms.tery/projects/fro/updates/e9776169-aec9-4d34-82bd-703eb5c6d55a
- **Web-versjon:** https://eventyrhagen-l3jt6bshb-msterys-projects.vercel.app
- **GitHub:** https://github.com/kasa031/Fro
- **Expo Go (iOS):** https://apps.apple.com/app/expo-go/id982107779
- **Expo Go (Android):** https://play.google.com/store/apps/details?id=host.exp.exponent

---

**Lykke til med testing! 🚀**
