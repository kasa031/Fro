# Språkstøtte (i18n)

## Hvordan legge til nye språk

### Steg 1: Legg til språk i `languages.js`

Åpne `src/i18n/languages.js` og legg til det nye språket i `supportedLanguages`-arrayen:

```javascript
{
  code: 'de',        // ISO 639-1 språkkode
  name: 'Deutsch',   // Engelsk navn
  flag: '🇩🇪',       // Flaggemoji
  nativeName: 'Deutsch' // Navn på språket selv
}
```

### Steg 2: Opprett oversettelsesfil

Opprett en ny fil i `src/i18n/locales/` med samme navn som språkkoden:

- `de.json` for tysk
- `es.json` for spansk
- `fr.json` for fransk
- osv.

Kopier strukturen fra `no.json` og oversett alle tekstene.

### Steg 3: Importer i `config.js`

Åpne `src/i18n/config.js` og legg til import og case i switch-statementen:

```javascript
import de from './locales/de.json';

// I switch-statementet:
case 'de':
  resources.de = { translation: de };
  break;
```

### Steg 4: Test

Språket vil automatisk vises i språkvelgeren på alle skjermer!

## Eksisterende språk

- 🇳🇴 Norsk (no) - Standard
- 🇬🇧 English (en)
- 🇵🇱 Polski (pl)

## Kommenterte eksempler

I `languages.js` finner du kommenterte eksempler for:
- Tysk (de)
- Spansk (es)
- Fransk (fr)
- Svensk (sv)
- Dansk (da)
- Arabisk (ar)
- Urdu (ur)
- Somali (so)
- Tigrinya (ti)

Disse kan enkelt aktiveres ved å fjerne kommentarene og opprette oversettelsesfilene.

