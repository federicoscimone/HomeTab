# HomeTab

[English](README.md) · **Italiano**

Un'applicazione web da installare in proprio per tenere traccia delle spese di una famiglia e
capirle: import degli estratti conto con un template per ogni banca, categorizzazione
automatica, report mensili e annuali, obiettivi di risparmio, più utenti con ruoli diversi.

È fatta con Next.js 16 (App Router), MongoDB e NextAuth. Parte con un solo
`docker compose up` e, al primo avvio, contiene già 24 mesi di dati demo realistici.

![Dashboard](docs/images/dashboard.png)

## Funzionalità

- **Movimenti**: uscite ed entrate con categorie su tre livelli, esercente, luogo, note e metodo
  di pagamento. Ticket restaurant e buoni sono tenuti separati dal denaro, così non falsano il
  calcolo del risparmio.
- **Italiano e inglese**: la lingua segue quella del browser, si cambia in ogni momento e resta
  salvata nel profilo; importi, date, plurali, export Excel ed errori delle API la seguono. I dati
  inseriti (nomi delle categorie, esercenti) restano come sono stati scritti.
- **Import dagli estratti conto**: Excel, CSV o testo incollato. Per ogni banca si definisce un
  template (quale colonna contiene cosa, formato delle date, come leggere il segno degli
  importi), e regole a parole chiave assegnano la categoria. I doppioni si riconoscono prima del
  salvataggio. In modalità demo sono già pronti un template e un estratto conto di esempio per
  provarlo.
- **Report**: dashboard mensile, pivot categorie × mesi, confronto con l'anno precedente per
  categoria, intervalli di date a scelta con proiezione a fine anno. Movimenti, pivot e analisi
  si esportano in Excel.
- **Import assistito dall'IA**: facoltativo. Le righe che nessuna regola riconosce ricevono una
  categoria suggerita da un modello linguistico (di serie Claude Haiku 5.5, attraverso
  LangChain), che impara dalle categorie usate finora dalla famiglia; dalla causale ricava anche
  l'esercente, e per una banca nuova propone il template di import, verificato con il parser
  dell'app. I dati personali vengono mascherati prima dell'invio e un tetto mensile rigido
  (3 $ di default) è garantito da una prenotazione atomica; un mese tipico costa pochi centesimi
  ([docs/ai.md](docs/ai.md#import-assistito-dallia)). Spento nella demo pubblica.
- **Chat sui dati**: facoltativa, in sola lettura, dal robottino in basso a destra. Domande come
  «quanto avremo risparmiato quest'anno continuando così?» o «riusciremo a raggiungere gli
  obiettivi?» ricevono risposta chiamando le stesse funzioni dei report, quindi il modello non fa
  mai i conti, e ogni risposta porta il link alla pagina che mostra lo stesso numero. Tutte le
  risposte giuste su un set di tredici domande, uno o due centesimi a domanda
  ([docs/ai.md](docs/ai.md#la-chat-sui-dati)). Spenta nella demo pubblica.
- **L'anno continuando così**: nella dashboard, senza IA, il risparmio finora e quello previsto a
  fine anno (i mesi che mancano come gli stessi mesi dell'anno scorso, corretti per l'andamento di
  quest'anno, così la tredicesima conta) contro l'anno scorso, e se ogni obiettivo arriva entro la
  scadenza.
- **Famiglie simili**: le vostre spese medie mensili per capitolo accanto alla media ISTAT delle
  famiglie con lo stesso numero di componenti nella vostra regione (indagine 2025), da
  un'istantanea versionata dei dati SDMX di ISTAT; la casa è senza affitti figurativi
  ([docs/istat.md](docs/istat.md#confronto-con-le-famiglie-simili)).
- **Consigli di risparmio, su richiesta**: il codice trova abbonamenti, categorie in crescita, mesi
  anomali e scarti dalle famiglie simili, ognuno con il suo importo e i mesi che farebbe guadagnare
  a un obiettivo; l'IA ne sceglie tre e li spiega, e se inventa un numero il suo testo si scarta
  ([docs/ai.md](docs/ai.md#consigli-di-risparmio-su-richiesta)).
- **Scadenze e accantonamenti**: bollette, tasse, polizze e abbonamenti, con la quota da
  accantonare ogni mese per quelle non mensili; le spese che si ripetono vengono trovate fra i
  movimenti e proposte, i pagamenti riconosciuti, e Telegram avvisa prima della scadenza
  ([docs/planning.md](docs/planning.md#strumenti-di-pianificazione)).
- **Registrazione da Telegram**: «12,50 pizza» nella chat del bot registra una spesa,
  categorizzata dalla catena dell'import, con un pulsante Annulla; la foto di uno scontrino la
  legge l'IA e aspetta la conferma ([docs/telegram.md](docs/telegram.md#telegram-e-verifica-in-due-passaggi)).
- **E se…?**: provate una decisione prima di prenderla (una rata, un taglio a una categoria,
  entrate che cambiano, una spesa straordinaria) e vedete l'effetto sul risparmio di fine anno e
  sull'arrivo di ogni obiettivo, con le stesse regole della pagina Obiettivi
  ([docs/planning.md](docs/planning.md#e-se)).
- **Progetti di famiglia**: un obiettivo si divide in voci con budget e preventivo, lo speso si
  segue per voce con le spese collegate, un avviso quando una voce sfora, e una lista di cose da
  fare con le date ([docs/planning.md](docs/planning.md#progetti-di-famiglia)).
- **Spese detraibili (730)**: le spese detraibili dell'anno per tipo, con il controllo sul
  pagamento tracciabile (le sanitarie in contanti da verificare), l'elenco dei movimenti e un CSV
  per il 730; nessun calcolo fiscale ([docs/planning.md](docs/planning.md#spese-detraibili-730)).
- **Budget mensili**: un tetto per categoria con la media degli ultimi mesi come riferimento,
  avanzamento e ritmo di fine mese nella dashboard, avvisi su Telegram all'80% e al 100%
  ([docs/planning.md](docs/planning.md#budget-mensili)).
- **Obiettivi di risparmio**: il risparmio di ogni mese chiuso si ripartisce tra gli obiettivi;
  per ciascuno si vedono la quota mensile che serve e la data prevista di arrivo.
- **Verifica in due passaggi e Telegram**: facoltativa per ogni utente; dopo la password serve
  un codice di 6 cifre su Telegram o via email, e una chat Telegram collegata riceve anche i
  codici di recupero della password ([docs/telegram.md](docs/telegram.md#telegram-e-verifica-in-due-passaggi)). Spenta
  nella demo pubblica.
- **Utenti e ruoli**: lettore, collaboratore e amministratore. Un cambio di ruolo o di password
  vale subito, anche sulle sessioni già aperte.
- **Registro delle attività**, **backup su Google Drive** (manuale o programmato), installabile
  come **PWA**, cinque temi di colore.

| Movimenti | Report per categoria | Obiettivi di risparmio |
| --- | --- | --- |
| ![Movimenti](docs/images/movimenti.png) | ![Report per categoria](docs/images/categorie.png) | ![Obiettivi](docs/images/obiettivi.png) |

## Avvio rapido

Serve Docker con Compose.

```bash
git clone https://github.com/federicoscimone/HomeTab.git
cd HomeTab
cp .env.example .env      # oppure `npm run setup` (Node 22) per generare segreti casuali
docker compose up -d
```

Apri <http://localhost:3000> ed entra come **mario@test.it** / **Asdf_lkjH**. Il primo avvio
costruisce l'immagine e genera i dati demo: servono alcuni minuti.

La modalità demo (`DEMO_MODE=true`) serve per provare l'app. Per i dati veri impostala a
`false` prima del primo avvio: finché non esiste alcun utente, l'app apre la pagina che crea
l'account amministratore. Le
categorie si creano dalle Impostazioni oppure, lanciando l'app dai sorgenti, con `npm run seed`
(un albero predefinito con le regole a parole chiave) e `node lib/seed-income.js` (categorie delle
entrate). Entrambi non fanno nulla se il database ha già delle categorie.

## Pubblicare una demo

La demo può girare gratis su Vercel con un cluster MongoDB Atlas M0, ripristinata ogni notte da
un cron: vedi [docs/vercel.md](docs/vercel.md) (in inglese).

## Sviluppo in locale

Servono Node.js 22 e un'istanza di MongoDB 7.

```bash
docker run -d --name hometab-mongo -p 27017:27017 mongo:7
cp .env.example .env      # poi togli il commento a MONGODB_URI
npm ci
npm run dev
```

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Server di sviluppo sulla porta 3000 |
| `npm test` | Test unitari (test runner integrato in Node) |
| `npm run lint` | ESLint con le regole di Next.js e dei React Hooks |
| `npm run build` | Build di produzione |

`.npmrc` imposta `legacy-peer-deps`: next-auth 4 dichiara nodemailer 7 come dipendenza
facoltativa, mentre l'app usa nodemailer 10.

## Configurazione

Tutto si configura con variabili d'ambiente, descritte una per una in
[`.env.example`](.env.example). Sono obbligatorie solo le credenziali del database e
`NEXTAUTH_SECRET`. Email (per il reset della password) e backup su Google Drive sono facoltativi:
senza, l'app funziona normalmente. Configurazione di Google Drive:
[docs/google-drive.md](docs/google-drive.md).

## Come funziona

```mermaid
flowchart LR
  browser[Browser] -->|richiesta di pagina| proxy["proxy.js<br/>sessione, ruolo, password provvisoria"]
  proxy --> pages["Pagine<br/>componenti React client"]
  pages -->|"fetch /api/..."| api["Route API<br/>ognuna verifica il proprio permesso"]
  api --> db[("MongoDB<br/>modelli Mongoose")]
  proxy -. legge lo stato attuale dell'utente .-> db
```

Alcune scelte che vale la pena guardare nel codice:

- **Sessioni revocabili.** Il JWT contiene solo l'id dell'utente e una versione di sessione;
  ruolo, stato e password provvisoria si rileggono dal database a ogni richiesta
  ([lib/auth/sessionUser.js](lib/auth/sessionUser.js)). Cambiare password incrementa la
  versione, e tutte le altre sessioni si chiudono subito invece di restare valide per altri 30
  giorni.
- **Una sola tabella dei permessi**, usata da API, proxy delle pagine e interfaccia
  ([lib/auth/permissions.js](lib/auth/permissions.js)). Nascondere un pulsante è una comodità; il
  controllo che conta sta in ogni rotta API.
- **Caricamento dei dati senza condizioni di gara.** I dati di una pagina sono legati alla
  richiesta che li ha prodotti, e una richiesta superata viene annullata: la risposta lenta di un
  filtro vecchio non può sovrascrivere quella attuale
  ([lib/hooks/useApiData.js](lib/hooks/useApiData.js)).
- **Una build del container che non ha bisogno del database.** `BUILD_TARGET=container`,
  impostato solo nello stage di build del Dockerfile, attiva l'output standalone e salta
  l'accesso al database durante la build, mentre altrove lo stesso codice gira invariato
  ([next.config.mjs](next.config.mjs), [Dockerfile](Dockerfile)).
- **La pipeline di import**: lettura guidata dal template, con formati numerici italiano e
  americano, date seriali di Excel e fogli che non partono dalla colonna A, coperta dai test in
  [test/importParser.test.js](test/importParser.test.js).
- **Traduzioni che non possono divergere.** I test verificano che le due lingue abbiano le stesse
  chiavi e gli stessi segnaposto e intercettano gli errori di sintassi ICU; una regola di lint
  rifiuta i testi scritti direttamente nel JSX, così una frase nuova non può uscire in una lingua
  sola ([test/i18n.test.js](test/i18n.test.js)).

## Roadmap

- Regole imparate: parole chiave proposte dai suggerimenti dell'IA che la famiglia accetta

## Note di sicurezza

- Gli utenti demo vengono creati solo con `DEMO_MODE=true`, insieme ai dati fittizi: un
  database per uso reale non li contiene.
- I codici inviati su Telegram sono visibili a Telegram: le chat con i bot non sono cifrate
  end-to-end. L'alternativa sono i codici via email.
- `npm audit` non riporta vulnerabilità nelle dipendenze di produzione. Segnala ancora un
  problema di denial of service in `braces`, raggiunto solo dagli strumenti di ESLint, per cui
  non esiste una versione corretta.

## Licenza

[MIT](LICENSE) © Federico Scimone
