# 🔒 Security Policy

## 🛡️ Supported Versions

Vi støtter sikkerhetsoppdateringer for følgende versjoner:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## 🚨 Reporting a Vulnerability

Hvis du oppdager en sikkerhetssårbarhet, vennligst **IKKE** opprett en public issue.

I stedet, send en e-post til prosjektlederen med detaljer om sårbarheten.

**VIKTIG:** Ikke del sensitive informasjon (API-nøkler, passord, etc.) i issues eller pull requests.

---

## 🔐 Secrets og API-nøkler

### ❌ ALDRI commit eller push:

1. **`.env` filer**
   - `.env`
   - `.env.local`
   - `.env.development`
   - `.env.production`
   - `.env.test`

2. **Firebase-nøkler**
   - API Keys (starter med `AIza...`)
   - Service Account Keys (JSON-filer)
   - Private Keys (`.pem`, `.key`, `.p12`)

3. **Andre secrets**
   - Passord
   - Tokens
   - OAuth secrets
   - Database credentials
   - Encryption keys

### ✅ Hva som ER trygt å committe:

- `firebaseConfig.js` (bruker `process.env.EXPO_PUBLIC_*`)
- `.env.example` (uten faktiske nøkler)
- `.gitignore` (som ekskluderer `.env`)

---

## 🔍 Automatisk scanning

Dette prosjektet bruker:
- ✅ **GitHub Secret Scanning** - Automatisk deteksjon av secrets
- ✅ **Dependabot** - Scanning for sårbare dependencies

Hvis secrets oppdages, vil de automatisk bli flagget og blokkert.

---

## 📋 Sjekkliste før commit

Før du committer, sjekk:

- [ ] `.env` er i `.gitignore`
- [ ] `git status` viser IKKE `.env`
- [ ] Ingen hardkodede API-nøkler i koden
- [ ] Alle nøkler bruker `process.env.EXPO_PUBLIC_*`

---

## 🆘 Hvis du ved en feil har pushet secrets

1. **ROTER NØKLENE UMIDDELBART:**
   - Gå til Firebase Console
   - Generer nye API-nøkler
   - Oppdater `.env` filen lokalt

2. **Fjern fra Git-historikk:**
   ```bash
   git rm --cached .env
   git commit -m "Remove .env from Git"
   git push
   ```

3. **Kontakt prosjektleder** hvis secrets allerede er eksponert

---

## 📝 Best Practices

1. **Bruk miljøvariabler** - Aldri hardkod secrets
2. **Sjekk `.gitignore`** - Før hver commit
3. **Bruk `.env.example`** - Som mal for andre utviklere
4. **Review kode** - Før merge til main branch

---

**Husk:** Bedre å være for forsiktig enn å eksponere sensitive data!
