# 🚫 Secrets som blokkeres automatisk

GitHub Secret Scanning og vår GitHub Actions workflow blokkerer følgende:

## 🔐 Firebase Secrets

### API Keys
```
AIza[0-9A-Za-z_-]{35}
```
**Eksempel:**
```
AIzaSyB1234567890abcdefghijklmnopqrstuvwxyz
```

### Service Account Keys
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----"
}
```

### Firebase Config med hardkodede verdier
```javascript
// ❌ DETTE BLOKKERES:
const firebaseConfig = {
  apiKey: "AIzaSyB1234567890...",
  authDomain: "myproject.firebaseapp.com",
  projectId: "myproject-12345"
};

// ✅ DETTE ER OK:
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
};
```

---

## 🔑 Private Keys

### Filtyper som blokkeres:
- `.pem` - Private key files
- `.key` - Key files
- `.p12` - PKCS#12 certificate files
- `.jks` - Java KeyStore files

**Eksempler:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

---

## 📧 OAuth og Tokens

### OAuth Secrets
```
oauth_secret.*=.*['"][a-zA-Z0-9]{20,}['"]
```

### Access Tokens
```
access_token.*=.*['"][a-zA-Z0-9]{32,}['"]
```

### JWT Tokens
```
eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}
```

---

## 🗄️ Database Credentials

### Connection Strings
```
mongodb://.*:.*@
postgres://.*:.*@
mysql://.*:.*@
```

### Hardkodede passord
```javascript
// ❌ BLOKKERES:
const password = "MySecretPassword123!";
const dbPassword = "admin123";

// ✅ OK:
const password = process.env.DATABASE_PASSWORD;
```

---

## 🔐 .env Filer

### Filer som blokkeres:
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `.env.test`
- `.env.*.local`

**Innhold som blokkeres:**
```env
# ❌ DETTE BLOKKERES:
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyB1234567890...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=myproject.firebaseapp.com
DATABASE_PASSWORD=secret123
```

---

## ✅ Hva som ER trygt

### .env.example (OK)
```env
# ✅ Dette er trygt - ingen faktiske nøkler
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key-here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
```

### firebaseConfig.js (OK)
```javascript
// ✅ Dette er trygt - bruker miljøvariabler
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
};
```

### .gitignore (OK)
```
# ✅ Dette er trygt
.env
.env.local
*.key
*.pem
```

---

## 🔍 Hvordan det fungerer

1. **GitHub Secret Scanning** (automatisk)
   - Scanner alle commits automatisk
   - Blokkerer push hvis secrets oppdages
   - Sender varsel til repository-eier

2. **GitHub Actions Workflow** (vår egen)
   - Kjører på hver push og pull request
   - Sjekker for `.env` filer
   - Sjekker for hardkodede nøkler
   - Blokkerer merge hvis secrets funnes

3. **Pre-commit hooks** (valgfritt)
   - Kan settes opp lokalt
   - Blokkerer commit før det skjer

---

## 🆘 Hvis du får feil

**Feil:** "❌ FEIL: .env filer funnet i repository!"

**Løsning:**
```bash
# Fjern .env fra Git
git rm --cached .env
git commit -m "Remove .env from Git"
git push
```

**Feil:** "❌ FEIL: Hardkodede API-nøkler funnet!"

**Løsning:**
1. Fjern hardkodede nøkler fra koden
2. Bruk `process.env.EXPO_PUBLIC_*` i stedet
3. Commit og push igjen

---

## 📝 Best Practices

1. ✅ Bruk alltid miljøvariabler
2. ✅ Sjekk `.gitignore` før commit
3. ✅ Bruk `.env.example` som mal
4. ✅ Review kode før merge
5. ❌ Aldri hardkod secrets
6. ❌ Aldri commit `.env` filer
