# Frö - Barnehage App

En moderne barnehage-app for digital innkrysning, aktivitetsregistrering og kommunikasjon mellom foreldre og ansatte.

## 🚀 Kom i gang

### Forutsetninger

- Node.js (v18 eller nyere)
- npm eller yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase-prosjekt (se nedenfor)

### Installasjon

1. **Klon repositoryet:**
   ```bash
   git clone https://github.com/kasa031/fro.git
   cd fro
   ```

2. **Installer avhengigheter:**
   ```bash
   npm install
   ```

3. **Opprett `.env` fil:**
   ```bash
   cp .env.example .env
   ```
   
   **VIKTIG:** Fyll ut `.env`-filen med dine Firebase-nøkler (se nedenfor).
   
   **Merk:** Hvis `.env.example` ikke eksisterer, opprett en `.env` fil manuelt med variablene listet nedenfor.

4. **Start appen:**
   
   **For web (anbefalt for testing):**
   
   ```bash
   npm run web
   ```
   
   **For alle plattformer (mobil og web):**
   ```bash
   npm start
   ```

## 🔐 Firebase Setup

### Opprett Firebase-prosjekt

1. Gå til [Firebase Console](https://console.firebase.google.com/)
2. Opprett et nytt prosjekt (eller bruk eksisterende)
3. Velg **Europa (Stockholm)** som region for GDPR-compliance
4. Aktiver følgende tjenester:
   - **Authentication** (Email/Password)
   - **Firestore Database** (i Stockholm-region)
   - **Storage** (valgfritt, for bildeopplasting)

### Konfigurer `.env` fil

**VIKTIG:** Du må opprette en `.env` fil med dine Firebase-nøkler. Disse sendes via PM.

1. Opprett en `.env` fil i rotmappen
2. Fyll ut med Firebase-nøklene du mottar via PM
3. Filen skal inneholde:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`

**Hvor finner jeg disse verdiene?**
- Gå til Firebase Console → Prosjektinnstillinger → Generelle innstillinger
- Scroll ned til "Dine apps" og velg Web-app
- Kopier verdiene fra `firebaseConfig`

### Firebase Security Rules

**VIKTIG:** Du må sette opp Security Rules i Firebase Console.

1. Gå til Firestore Database → Rules
2. Lim inn reglene fra `Firebase_Security_Rules_OPPDATERT.txt` (i rotmappen)
   - Dette er den nyeste versjonen som matcher koden

3. Gå til Storage → Rules (hvis du bruker Storage)
4. Lim inn reglene fra `Prosjektarbeid/Firebase_Storage_Security_Rules.txt`

**MERK:** Se `SECURITY_RULES_ANALYSE.md` for detaljert forklaring av reglene.

## 📱 Funksjoner

### For Admin
- ✅ Registrere nye barn
- ✅ Knytte foreldre til barn
- ✅ Check-in/check-out
- ✅ Aktivitetsregistrering (bleieskift, spesielle hendelser)
- ✅ Brukeradministrasjon
- ✅ Samtykkeskjema-håndtering
- ✅ Se alle barn og aktiviteter

### For Ansatte
- ✅ Se barn i egen avdeling
- ✅ Check-in/check-out
- ✅ Registrere aktiviteter
- ✅ Ringe og sende e-post til foreldre
- ✅ Se aktivitetsoversikt

### For Foreldre
- ✅ Se egne barn
- ✅ Check-in/check-out
- ✅ Se aktivitetsoversikt
- ✅ Se samtykkeskjema
- ✅ Se profilbilder og notater

## 🌍 Flerspråklig støtte

Appen støtter følgende språk:
- 🇳🇴 Norsk
- 🇬🇧 English
- 🇵🇱 Polski
- 🇺🇦 Українська

Flere språk kan legges til i `src/i18n/locales/`.

## 🔒 Sikkerhet

- ✅ Alle Firebase-nøkler lagres i `.env` (ikke i Git)
- ✅ Role-based access control (RBAC)
- ✅ Firestore Security Rules implementert
- ✅ Storage Security Rules implementert
- ✅ GDPR-compliant (data lagres i EØS)

## 📁 Prosjektstruktur

```
fro/
├── src/
│   ├── components/       # Gjenbrukbare komponenter
│   ├── config/           # Firebase-konfigurasjon
│   ├── context/          # React Context (Auth, Theme)
│   ├── i18n/             # Oversettelser
│   ├── screens/          # Skjermer
│   ├── services/         # Tjenester (notifikasjoner)
│   └── utils/            # Hjelpefunksjoner
├── assets/               # Bilder og logoer
└── .env                  # Miljøvariabler (IKKE i Git)
```

## 🛠️ Utvikling

### Tilgjengelige scripts

```bash
npm start          # Start Expo development server
npm run web        # Start web-versjon
npm run android    # Start Android-versjon
npm run ios        # Start iOS-versjon
npm run lint       # Kjør ESLint
```

### Kode-standarder

- Bruk funksjonelle komponenter med hooks
- Alle UI-tekster skal bruke i18next (`t('key')`)
- Følg eksisterende filstruktur
- Kommenter komplekse funksjoner

## 📚 Dokumentasjon

Se følgende filer for mer informasjon:
- `OPPSETT_GUIDE.md` - Oppsettsguide for nye utviklere
- `BRUKSANVISNING.md` - Bruksanvisning for testbrukere
- `FUNKSJONER.md` - Oversikt over appens funksjoner
- `PUSH_TIL_GITHUB.md` - Guide for å pushe til GitHub
- `EXPO_DEPLOY_STEG_FOR_STEG.md` - Deployment-guide for Expo
- `Firebase_Security_Rules_OPPDATERT.txt` - Oppdaterte Security Rules
- `SPRINT_OPPGAVER.md` - Sprint-oppgaver og status

## ⚠️ Viktig

- **ALDRI** commit `.env` filen til Git
- **ALDRI** commit Firebase-nøkler eller secrets
- **ALDRI** legg ut nøkler i README eller andre filer
- Sjekk alltid `.gitignore` før du pusher
- Bruk fiktive data i testmiljø
- Firebase-nøkler sendes via PM til de som trenger dem

## 🤝 Bidrag

1. Fork repositoryet
2. Opprett en feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit endringene (`git commit -m 'Add some AmazingFeature'`)
4. Push til branch (`git push origin feature/AmazingFeature`)
5. Åpne en Pull Request

## 📝 Lisens

Dette prosjektet er utviklet for utdanningsformål.

## 👥 Kontakt

For spørsmål eller support, kontakt prosjektlederen.

---

**Husk:** Alle må opprette sin egen `.env` fil med egne Firebase-nøkler!
