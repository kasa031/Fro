# 🔧 Fiks for "ERR_BLOCKED_BY_CLIENT" på web

## Problemet:
Ad-blocker eller privacy-utvidelse blokkerer Firestore-forespørsler, så appen kan ikke hente brukerdata.

## ✅ Løsning 1: Deaktiver ad-blocker for denne siden (RASKESTE)

### Chrome/Edge med uBlock Origin:
1. **Klikk på uBlock Origin-ikonet** (rød skjold) i adresselinjen
2. **Klikk på storet-ikonet** (stor blå knapp) for å deaktivere på denne siden
3. **Oppdater siden** (F5 eller Ctrl+R)

### Chrome/Edge med AdBlock Plus:
1. **Klikk på AdBlock Plus-ikonet** (ABP) i adresselinjen
2. **Klikk "Deaktiver på denne siden"**
3. **Oppdater siden** (F5)

### Firefox med uBlock Origin:
1. **Klikk på uBlock Origin-ikonet** i adresselinjen
2. **Klikk på storet-ikonet** for å deaktivere
3. **Oppdater siden** (F5)

### Safari med AdBlock:
1. **Gå til Safari → Innstillinger → Utvidelser**
2. **Deaktiver AdBlock** for denne sesjonen, eller
3. **Klikk på AdBlock-ikonet** i adresselinjen og velg "Deaktiver på denne siden"

### For Brave-nettlesere (Brave Shields) - ENKELT:

1. **Klikk på Brave Shields-ikonet** (løve) i adresselinjen (til høyre)
2. **Klikk "Shields down"** for denne siden
3. **Oppdater siden** (F5)

**Alternativ metode:**
1. **Høyreklikk på Brave Shields-ikonet** (løve)
2. **Velg "Site settings"**
3. **Sett "Shields" til "Off"**
4. **Oppdater siden** (F5)

## Løsning 2: Whitelist Firebase-domener

Hvis du vil beholde ad-blocker aktiv:

1. **Åpne ad-blocker-innstillinger**
2. **Legg til disse domenerne i whitelist:**
   - `firestore.googleapis.com`
   - `identitytoolkit.googleapis.com`
   - `firebase.googleapis.com`
   - `*.googleapis.com` (eller spesifikt for Firebase)

### For Brave Shields (whitelist):

1. **Gå til:** `brave://settings/shields` (lim inn i adresselinjen)
2. **Scroll ned til "Advanced controls"**
3. **Klikk "Add exception"** og legg til hver linje:
   - `https://firestore.googleapis.com`
   - `https://identitytoolkit.googleapis.com`
   - `https://firebase.googleapis.com`
   - `https://*.googleapis.com`
4. **Oppdater siden** (F5)

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

## ✅ Verifiser at det fungerer:

Etter å ha deaktivert ad-blocker eller whitelistet Firebase:

1. **Oppdater siden** (F5 eller Ctrl+R)
2. **Åpne Developer Console** (F12)
3. **Sjekk at det ikke lenger er `ERR_BLOCKED_BY_CLIENT`-feil**
4. **Prøv å logge inn** - skal fungere normalt

## 📝 Hvilken ad-blocker har jeg?

**Sjekk adresselinjen:**
- **uBlock Origin:** Rød skjold-ikon
- **AdBlock Plus:** ABP-ikon (grønn/grå)
- **Brave Shields:** Løve-ikon (oransje)
- **AdBlock:** AB-ikon
- **Privacy Badger:** Rød bjørn-ikon

**Hvis du ikke ser noe ikon:**
- Sjekk utvidelser: `chrome://extensions` (Chrome) eller `about:addons` (Firefox)
- Kanskje du har flere ad-blockere installert - deaktiver alle for denne siden

---

**Test:** Prøv å logge inn på nytt etter å ha deaktivert ad-blocker eller whitelistet Firebase-domener.
