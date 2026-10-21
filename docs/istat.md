# Comparison with similar households

[Versione italiana](#confronto-con-le-famiglie-simili) più sotto.

**Reports → Similar households** puts your average monthly spending by category next to the
average of Italian households with the same number of members in your region, from ISTAT's
household budget survey. The chat answers the same question through the `confronto_istat` tool,
with the same numbers.

## Where the data come from

The figures come from table `31_740_DF_DCCV_SPEMEFAM_COICOP_2018_3` of ISTAT's
[SDMX service](https://www.istat.it/en/methods-and-tools/sdmx-web-service): average monthly
spending by region × number of members × COICOP 2018 division (13 categories: food, housing,
transport…). They are saved in the repo as a snapshot, `data/istat/spese-famiglie.js`, and the
app never calls ISTAT:

- the survey comes out once a year, in October, so a live call would bring nothing newer;
- the service accepts 5 requests a minute per IP and blocks for 1–2 days whoever goes over;
- a number the app shows must be reproducible, and the snapshot is versioned with the code.

To update it when a new survey comes out:

```bash
node scripts/istat-sync.js          # latest published year; --year 2025 for a given one
git diff data/istat/                # check, then commit
```

The script makes a single request. Source: Istat, licence
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the page cites it.

**Why not RAG.** The data are a small table (a few thousand numbers) where the right row is found
by an exact key: region and number of members. Code finds it without errors and the model receives
only about 13 rows already compared. A similarity search could pick the wrong region and the model
would quote it with confidence.

## How the comparison is computed

- **Your figures**: the expenses of the last 12 complete months (fewer, if your data start later)
  divided by the number of months. Every payment method counts, meal vouchers too, because ISTAT
  counts food spending however it is paid. Movements excluded from analysis stay out, as in the
  reports.
- **Categories → ISTAT divisions**: each category has a division, set from the page by an
  administrator; a subcategory without one follows its parent ("Utilities → Internet" is
  communication, not housing). Categories created by the seed come with defaults, and **Apply
  default categories** fills them in on an existing installation. Categories left out are listed
  with their amount and stay in the total.
- **ISTAT reference**: region and number of members; where ISTAT does not publish a value (sample
  too small) the page falls back to the macro-area, then to Italy, and says so on that row.
- **Housing without imputed rent.** ISTAT includes in housing the rent it estimates even for those
  living in their own home: in 2025 it is 611 € out of 1,001 € nationally. The comparison removes
  it. ISTAT publishes it only for Italy by number of members and for the three macro-areas overall,
  so for a region the share is estimated with two factors: the macro-area's, corrected for the
  number of members with the national ratio. The error is a few percentage points, and the page
  marks the row as an estimate.

The page says the rest too: the ISTAT average mixes renters and owners and includes households
that spend nothing on a category; mortgage payments are not spending for ISTAT.

---

# Confronto con le famiglie simili

**Report → Famiglie simili** mette le vostre spese medie mensili per capitolo accanto alla media
delle famiglie italiane con lo stesso numero di componenti nella vostra regione, dall'indagine
ISTAT sulle spese delle famiglie. La chat risponde alla stessa domanda con lo strumento
`confronto_istat`, con gli stessi numeri.

## Da dove vengono i dati

I dati vengono dalla tavola `31_740_DF_DCCV_SPEMEFAM_COICOP_2018_3` del
[servizio SDMX](https://www.istat.it/en/methods-and-tools/sdmx-web-service) di ISTAT: spesa media
mensile per regione × numero di componenti × divisione COICOP 2018 (13 capitoli: alimentari, casa,
trasporti…). Sono salvati nel repo come istantanea, `data/istat/spese-famiglie.js`, e l'app non
chiama mai ISTAT:

- l'indagine esce una volta l'anno, a ottobre, quindi una chiamata dal vivo non porterebbe niente
  di più nuovo;
- il servizio accetta 5 richieste al minuto per IP e blocca per 1-2 giorni chi le supera;
- un numero mostrato dall'app deve essere riproducibile, e l'istantanea è versionata col codice.

Per aggiornarla quando esce l'indagine nuova:

```bash
node scripts/istat-sync.js          # ultimo anno pubblicato; --year 2025 per uno preciso
git diff data/istat/                # controlla, poi committa
```

Lo script fa una sola richiesta. Fonte: Istat, licenza
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); la pagina la cita.

**Perché non RAG.** I dati sono una tabella piccola (qualche migliaio di numeri) in cui la riga
giusta si trova con una chiave esatta: regione e numero di componenti. Il codice la trova senza
sbagliare e il modello riceve solo una tredicina di righe già confrontate. Una ricerca per
somiglianza potrebbe pescare la regione sbagliata, e il modello la citerebbe con sicurezza.

## Come si calcola il confronto

- **Le vostre cifre**: le uscite degli ultimi 12 mesi completi (meno, se i dati cominciano dopo)
  divise per il numero di mesi. Contano tutti i metodi di pagamento, anche i buoni pasto, perché
  ISTAT conta la spesa alimentare comunque sia pagata. I movimenti esclusi dalle analisi restano
  fuori, come nei report.
- **Categorie → capitoli ISTAT**: ogni categoria ha un capitolo, scelto dalla pagina da un
  amministratore; una sottocategoria senza capitolo segue la madre («Utenze → Internet» è
  comunicazione, non casa). Le categorie create dal seed hanno già quello predefinito, e
  **Applica i capitoli predefiniti** lo assegna su un'installazione esistente. Le categorie fuori
  dal confronto sono elencate con il loro importo e restano nel totale.
- **Riferimento ISTAT**: regione e numero di componenti; dove ISTAT non pubblica il valore
  (campione troppo piccolo) si ripiega sulla ripartizione, poi sull'Italia, e la riga lo dice.
- **Casa senza affitti figurativi.** ISTAT mette nel capitolo casa l'affitto che stima anche per
  chi vive in casa propria: nel 2025 sono 611 € su 1.001 € a livello nazionale. Il confronto li
  toglie. ISTAT li pubblica solo per l'Italia per numero di componenti e per le tre ripartizioni
  in totale, quindi per una regione la quota si stima con due fattori: quella della ripartizione,
  corretta per il numero di componenti con il rapporto nazionale. L'errore è di qualche punto
  percentuale, e la pagina segna la riga come stima.

Il resto lo dice la pagina: la media ISTAT mescola inquilini e proprietari e comprende le famiglie
che in un capitolo non spendono nulla; le rate del mutuo non sono spesa per ISTAT.
