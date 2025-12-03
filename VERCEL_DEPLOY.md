# 🚀 Deploy til Vercel - Kommando

## Prøv denne metoden:

Siden web-eksporten feiler pga expo-router, prøv å starte web-serveren og deploye direkte:

```powershell
# 1. Start web-serveren i bakgrunnen
npm start -- --web

# 2. I en ny terminal, deploy til Vercel
npx vercel --prod
```

## Alternativ metode (hvis overstående ikke fungerer):

```powershell
# Prøv å eksportere uten static rendering
$env:EXPO_NO_STATIC="1"
npx expo export --platform web
npx vercel --prod
```

## Etter deployment:

1. Vercel gir deg en web-link (f.eks. `https://fro-xxx.vercel.app`)
2. Legg denne linken inn i `BRUKSANVISNING.md` der det står `[Kommer etter Vercel-deployment]`
3. Sett miljøvariabler i Vercel Dashboard:
   - Gå til https://vercel.com
   - Velg prosjektet
   - Settings → Environment Variables
   - Legg til alle `EXPO_PUBLIC_*` variabler fra `.env`-filen

## Hvis det fortsatt feiler:

Du kan også bruke Expo's egen web-hosting:
- Web-link: https://expo.dev/accounts/[ditt-brukernavn]/projects/fro
- Denne fungerer allerede etter EAS Update!
