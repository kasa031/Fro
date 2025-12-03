# 🔧 Fiks for "ERR_BLOCKED_BY_CLIENT" på web

## Problemet:
Ad-blocker eller privacy-utvidelse blokkerer Firestore-forespørsler, så appen kan ikke hente brukerdata.

## Løsning 1: Deaktiver ad-blocker for denne siden

1. **Klikk på ad-blocker-ikonet** i nettleseren (f.eks. uBlock Origin, AdBlock Plus)
2. **Klikk "Deaktiver på denne siden"** eller "Whitelist"
3. **Oppdater siden** (F5)

## Løsning 2: Whitelist Firebase-domener

Hvis du vil beholde ad-blocker aktiv:

1. **Åpne ad-blocker-innstillinger**
2. **Legg til disse domenerne i whitelist:**
   - `firestore.googleapis.com`
   - `identitytoolkit.googleapis.com`
   - `firebase.googleapis.com`
   - `*.googleapis.com` (eller spesifikt for Firebase)

## Løsning 3: Test i inkognito-modus

1. **Åpne inkognito-vindu** (Ctrl+Shift+N i Chrome)
2. **Deaktiver utvidelser** i inkognito
3. **Test appen** - skal fungere uten ad-blocker

## Løsning 4: Bruk en annen nettleser

Test i en nettleser uten ad-blocker installert.

---

## Hva jeg har fikset:

- Lagt til fallback som sjekker e-post for å bestemme rolle hvis Firestore er blokkert
- Bedre feilhåndtering for `ERR_BLOCKED_BY_CLIENT`
- Appen skal nå fungere selv om Firestore er blokkert (med fallback-rolle)

---

**Test:** Prøv å logge inn på nytt etter å ha deaktivert ad-blocker eller whitelistet Firebase-domener.
