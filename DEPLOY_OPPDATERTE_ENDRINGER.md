# 🚀 Deploy oppdaterte endringer - Passordvalidering

## Hva er endret:
- Passordvalidering som krever spesialtegn (Firebase-krav)
- Bedre feilmeldinger
- Hjelpetekst som viser passordkrav

## Steg 1: Deploy til Expo (for mobil)

Kjør denne kommandoen for å oppdatere mobil-appen:

```powershell
cd "c:\Users\Karina\Desktop\2025_2026\SmidigProsjekt\Eventyrhagen"
npx eas update --branch production --message "Legg til passordvalidering med spesialtegn-krav"
```

Dette oppdaterer QR-koden og mobil-appen.

## Steg 2: Deploy til Vercel (for web)

Kjør disse kommandoene for å oppdatere web-versjonen:

```powershell
cd "c:\Users\Karina\Desktop\2025_2026\SmidigProsjekt\Eventyrhagen"
npx expo export --platform web
npx vercel --prod
```

## Steg 3: Test

Etter deployment:
1. **Mobil:** Skann QR-koden på nytt og test innlogging
2. **Web:** Test på https://eventyrhagen-l3jt6bshb-msterys-projects.vercel.app

---

## ⚠️ Om admin-brukeren

Hvis admin-brukeren ikke kan logge inn med "Passord1!":

**Mulige årsaker:**
1. Admin-brukeren eksisterer ikke i Firebase Authentication
2. Passordet er feil
3. Admin-brukeren mangler rolle i Firestore

**Løsning:**
1. Opprett admin-brukeren på nytt via Firebase Console, ELLER
2. Opprett admin-brukeren via Admin-panelet i appen (hvis du har tilgang)
3. Sjekk at brukeren har `role: 'admin'` i Firestore

**Test:**
- Prøv å opprette en ny testbruker med passord som "Test123!" (har spesialtegn)
- Sjekk om den nye brukeren kan logge inn
