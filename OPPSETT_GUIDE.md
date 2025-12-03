# 🚀 Oppsettsguide for Frö

## Steg 1: Klon prosjektet

```powershell
# Naviger til ønsket mappe
cd [din-prosjektsti]

# Klon repository
git clone https://github.com/kasa031/fro.git

# Gå inn i prosjektmappen
cd fro
```

## Steg 2: Installer dependencies

```powershell
npm install
```

## Steg 3: Opprett `.env`-fil

1. I `fro`-mappen, opprett en fil som heter `.env` (uten noe annet)

2. Åpne filen i en teksteditor og legg inn:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=din-api-key-her
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=eventyrhagen-15b7a.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=eventyrhagen-15b7a
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=eventyrhagen-15b7a.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=162112552936
EXPO_PUBLIC_FIREBASE_APP_ID=1:162112552936:web:7c32c74498afd4dd0d6e5d
EXPO_PUBLIC_FIREBASE_VAPID_KEY=din-vapid-key-her
```

**Hvor finner du verdiene?**
- Gå til [Firebase Console](https://console.firebase.google.com)
- Velg prosjektet "eventyrhagen-15b7a"
- Tannhjul-ikon → Project settings → General
- Scroll ned til "Your apps" → Velg web-appen
- Kopier verdiene fra `firebaseConfig`

## Steg 4: Kjør appen

```powershell
npm start
```

## Steg 5: Test på mobil

1. Last ned **Expo Go** (iOS/Android)
2. Skann QR-koden fra terminalen
3. Appen lastes automatisk!

---

**Merk:** `.env`-filen er allerede i `.gitignore`, så den blir ikke committet til Git.
