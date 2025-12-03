# 🚀 Push Frö til GitHub - Steg-for-steg

## ⚠️ VIKTIG FØR DU STARTER

**Sjekkliste:**
- [ ] `.env`-filen er i `.gitignore` ✅ (allerede sjekket)
- [ ] Ingen API-nøkler hardkodet i koden
- [ ] Du har en GitHub-konto
- [ ] Sjekk at `.gitignore` inneholder: `.env`, `node_modules/`, `.expo/`, `dist/`, `web-build/`

---

## Steg 1: Opprett GitHub-repository

1. Gå til [github.com](https://github.com) og logg inn
2. Klikk **"+"** (øverst til høyre) → **"New repository"**
3. Fyll ut:
   - **Repository name:** `fro`
   - **Description:** "Barnehage-app for administrasjon"
   - **Public** eller **Private** (velg selv)
   - **IKKE** huk av "Initialize with README"
4. Klikk **"Create repository"**

---

## Steg 2: Initialiser Git i prosjektet

Åpne PowerShell i `fro`-mappen og kjør:

```powershell
# Initialiser git (hvis ikke allerede gjort)
git init

# Sjekk status
git status
```

---

## Steg 3: Legg til alle filer

```powershell
# Legg til alle filer
git add .

# VIKTIG: Sjekk at .env IKKE er med
git status
```

**Hvis du ser `.env` i listen:**
```powershell
git reset HEAD .env
```

---

## Steg 4: Første commit

```powershell
git commit -m "Initial commit: Frö barnehage-app"
```

---

## Steg 5: Koble til GitHub

**Erstatt `[ditt-brukernavn]` med ditt GitHub-brukernavn:**

```powershell
git remote add origin https://github.com/kasa031/fro.git

# Verifiser
git remote -v
```

---

## Steg 6: Push til GitHub

```powershell
# Sett main branch
git branch -M main

# Push (første gang)
git push -u origin main
```

**Hvis du får autentiseringsfeil:**
- Du må bruke **Personal Access Token** i stedet for passord
- Eller bruk **GitHub Desktop**-appen

---

## Steg 7: Verifiser

1. Gå til din GitHub-repository i nettleseren
2. Sjekk at alle filer er der
3. **VIKTIG:** Sjekk at `.env` **IKKE** er synlig

---

## ✅ Ferdig!

Nå kan andre klone prosjektet med:

```powershell
git clone https://github.com/[ditt-brukernavn]/fro.git
cd fro
```

---

## 🔄 Fremtidige oppdateringer

Etter første push, bruk disse kommandoene:

```powershell
git add .
git commit -m "Beskrivelse av endringene"
git push
```

---

## 🆘 Hjelp

**Problem:** "remote origin already exists"
```powershell
git remote remove origin
git remote add origin https://github.com/kasa031/fro.git
```

**Problem:** "Authentication failed"
- Bruk GitHub Personal Access Token
- Eller last ned GitHub Desktop
