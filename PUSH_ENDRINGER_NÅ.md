# 🚀 Push endringer til GitHub - Kommandoer

## Steg 1: Sjekk status
```powershell
cd "c:\Users\Karina\Desktop\2025_2026\SmidigProsjekt\Eventyrhagen"
git status
```

## Steg 2: Legg til endringene
```powershell
git add .
```

## Steg 3: Commit endringene
```powershell
git commit -m "Legg til passordvalidering med spesialtegn-krav og fiks syntaksfeil"
```

## Steg 4: Push til GitHub
```powershell
git push
```

---

## Hvis du får feil:

**Hvis det står "nothing to commit":**
- Endringene er allerede committet, eller
- Ingen filer er endret siden siste commit

**Hvis det står "remote origin" feil:**
- Sjekk at remote er riktig: `git remote -v`
- Skal være: `https://github.com/kasa031/Fro.git`

**Hvis det krever autentisering:**
- Du må bruke GitHub Personal Access Token i stedet for passord
- Se `PUSH_TIL_GITHUB.md` for detaljer
