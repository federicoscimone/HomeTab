# Planning tools

[Versione italiana](#strumenti-di-pianificazione) più sotto.

Tools for the family's everyday planning. Every number is computed by the code; where the AI
helps, it says so.

## Deadlines and set-asides

**Deadlines** lists bills, taxes, insurance, subscriptions and instalments: when each is due, how
much, and how often it repeats. For anything not monthly the page shows the **monthly set-aside**:
the amount divided by the months between payments (600 € a year is 50 € a month), so a yearly
expense doesn't land all at once. The dashboard shows the next 30 days and the total set-aside.

- **Recurring expenses found in your movements.** The page proposes expenses with the same
  merchant and a similar amount every 2, 3, 6 or 12 months (`detectPeriodic` in
  `lib/utils/deadlines.js`, no AI). Bank transfers and direct debits count after two payments;
  card and cash need three, otherwise the Christmas cake or the August beach would look like
  yearly deadlines. **Add** opens the form already filled in; **Ignore** is remembered.
- **Payment recognised.** With the merchant words of a deadline ("UNIPOL"), a matching payment
  from 20 days before the due date onwards is pointed out next to it: **Paid** moves the deadline
  to the next period, or closes it if it was one-off.
- **Telegram reminders**, to everyone who linked the chat: a few days before (chosen per deadline)
  and on the day, once each. A daily cron calls `/api/cron/promemoria` with `CRON_SECRET`: on
  Vercel it is in `vercel.json` and needs only the `CRON_SECRET` variable; on your own server, a
  system cron:

  ```bash
  0 7 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/promemoria
  ```

  Without `CRON_SECRET` or without the bot nothing is sent; in the demo it is off.

The chat answers "what do we have to pay this month?" with the `scadenze` tool.

## What if…?

**What if…?** (under Reports) tries a decision before you take it, with no AI: it is arithmetic.
An idea is a list of changes:

- an **instalment**, € a month for some months (a car loan);
- a **category** that changes by a percentage or by € a month (restaurants −30%); the page shows
  each category's average of the last 12 complete months;
- **income** that changes from a month on (part-time: −600 € a month from January);
- a **one-off** expense or income in a given month.

The page shows, before and after: savings at year end, savings over the next 12 months, and
when each goal arrives. Months left this year follow the dashboard projection, then average
savings; goals receive their share of every month's savings exactly as on the Goals page, so the
"before" is what the app already shows and the difference is only the effect of the idea
(`lib/utils/scenario.js`). The dashboard projection links to it, and the chat answers "what if
we buy the car in instalments?" with the `simula_scenario` tool.

## Family projects

A savings goal can become a **project**: a renovation, a wedding, a move, a trip. On the goal page:

- **Items** with a budget and, when you have one, the quote received. What is spent per item
  comes from the expenses linked to the goal, with the item chosen in the movement form; linked
  expenses without an item are shown apart. An item over budget is highlighted with a warning at
  the top, a quote above budget is flagged before you spend (`lib/utils/project.js`).
- **To do**, with optional due dates: anyone who can edit movements ticks and adds them; items and
  budgets need the goals permission.

The chat sees the project too: "how is the Japan trip going?" answers with items, spending and
what is left to do.

## Deductible expenses (730)

**Deductible expenses** (under Reports) prepares the Italian tax return: the year's expenses by
deductible type (medical, veterinary, education, nursery, children's sport, mortgage interest,
insurance), the list of movements and a CSV for whoever fills in the return.

- Categories are linked to a type from the page; seed categories have defaults (Health → medical,
  Pets → Vet → veterinary, Study → Courses → education) and a subcategory follows its parent. A
  single movement can be excluded (private lessons under "Courses") and put back.
- **Traceable payment.** Since 2020, 19% deductions need a traceable payment, except medicines,
  medical devices and services from public facilities or facilities accredited with the national
  health service ([Agenzia delle Entrate](https://www.agenziaentrate.gov.it/portale/le-spese-sanitarie-e-i-mezzi-di-ausilio)).
  Cash medical expenses are therefore marked "to check", other cash expenses are left out of the
  total.
- The app **does not compute the deduction**: rates, thresholds and limits change every year and
  depend on income, and it doesn't know whose name is on each receipt (`lib/utils/deductions.js`).

---

# Strumenti di pianificazione

Strumenti per la pianificazione di tutti i giorni. Ogni numero lo calcola il codice; dove aiuta
l'IA, è detto.

## Scadenze e accantonamenti

**Scadenze** elenca bollette, tasse, polizze, abbonamenti e rate: quando scadono, quanto e ogni
quanto si ripetono. Per quelle non mensili la pagina mostra la **quota da accantonare** ogni mese:
l'importo diviso per i mesi fra un pagamento e l'altro (600 € l'anno sono 50 € al mese), così una
spesa annuale non arriva tutta insieme. La dashboard mostra i prossimi 30 giorni e il totale da
accantonare.

- **Spese che si ripetono, trovate fra i movimenti.** La pagina propone le spese con lo stesso
  esercente e un importo simile ogni 2, 3, 6 o 12 mesi (`detectPeriodic` in
  `lib/utils/deadlines.js`, senza IA). Bonifici e addebiti diretti contano dopo due pagamenti;
  carta e contanti ne vogliono tre, altrimenti il panettone di Natale o la spiaggia d'agosto
  sembrerebbero scadenze annuali. **Aggiungi** apre il modulo già compilato; **Ignora** viene
  ricordato.
- **Pagamento riconosciuto.** Con le parole dell'esercente di una scadenza («UNIPOL»), un
  pagamento corrispondente dai 20 giorni prima della scadenza in poi viene segnalato accanto:
  **Pagata** la sposta al periodo successivo, o la chiude se era una tantum.
- **Promemoria su Telegram**, a chi ha collegato la chat: qualche giorno prima (a scelta per ogni
  scadenza) e il giorno stesso, una volta ciascuno. Un cron giornaliero chiama
  `/api/cron/promemoria` con `CRON_SECRET`: su Vercel è in `vercel.json` e serve solo la
  variabile `CRON_SECRET`; su un server proprio, un cron di sistema:

  ```bash
  0 7 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/promemoria
  ```

  Senza `CRON_SECRET` o senza bot non parte nulla; nella demo è spento.

La chat risponde a «cosa dobbiamo pagare questo mese?» con lo strumento `scadenze`.

## E se…?

**E se…?** (sotto Report) prova una decisione prima di prenderla, senza IA: sono conti.
Un'ipotesi è un elenco di cambiamenti:

- una **rata**, € al mese per un certo numero di mesi (il finanziamento dell'auto);
- una **categoria** che cambia di una percentuale o di € al mese (ristoranti −30%); la pagina
  mostra la media di ogni categoria sugli ultimi 12 mesi completi;
- **entrate** che cambiano da un certo mese (part-time: −600 € al mese da gennaio);
- una spesa o un'entrata **una tantum** in un certo mese.

La pagina mostra, prima e dopo: il risparmio a fine anno, quello dei prossimi 12 mesi e quando
arriva ogni obiettivo. I mesi che restano quest'anno seguono la proiezione della dashboard, poi il
risparmio medio; gli obiettivi ricevono la loro percentuale del risparmio di ogni mese come nella
pagina Obiettivi, così il «prima» è quello che l'app mostra già e la differenza è solo l'effetto
dell'ipotesi (`lib/utils/scenario.js`). La proiezione della dashboard ci porta, e la chat risponde
a «e se compriamo l'auto a rate?» con lo strumento `simula_scenario`.

## Progetti di famiglia

Un obiettivo di risparmio può diventare un **progetto**: una ristrutturazione, un matrimonio, un
trasloco, un viaggio. Nella pagina dell'obiettivo:

- **Voci** con un budget e, quando c'è, il preventivo ricevuto. Lo speso per voce viene dalle
  spese collegate all'obiettivo, con la voce scelta nel modulo del movimento; le spese collegate
  senza voce sono mostrate a parte. Una voce che sfora è evidenziata con un avviso in testa, un
  preventivo sopra il budget è segnalato prima di spendere (`lib/utils/project.js`).
- **Cose da fare**, con una data se serve: le spunta e le aggiunge chiunque possa modificare i
  movimenti; voci e budget richiedono i permessi degli obiettivi.

Anche la chat vede il progetto: «come va il viaggio in Giappone?» risponde con le voci, lo speso e
quello che resta da fare.

## Spese detraibili (730)

**Spese detraibili** (sotto Report) prepara il 730: le spese dell'anno per tipo detraibile
(sanitarie, veterinarie, istruzione, asilo nido, sport dei figli, interessi del mutuo,
assicurazioni), l'elenco dei movimenti e un CSV per chi compila la dichiarazione.

- Le categorie si collegano a un tipo dalla pagina; quelle del seed hanno i predefiniti (Salute →
  sanitarie, Animali → Veterinario → veterinarie, Studio → Corsi → istruzione) e una
  sottocategoria segue la madre. Un singolo movimento si esclude (le lezioni private sotto
  «Corsi») e si rimette.
- **Pagamento tracciabile.** Dal 2020 le detrazioni al 19% richiedono un pagamento tracciabile,
  tranne per medicinali, dispositivi medici e prestazioni di strutture pubbliche o accreditate al
  SSN ([Agenzia delle Entrate](https://www.agenziaentrate.gov.it/portale/le-spese-sanitarie-e-i-mezzi-di-ausilio)).
  Le spese sanitarie in contanti sono quindi «da verificare», le altre in contanti restano fuori
  dal totale.
- L'app **non calcola la detrazione**: percentuali, franchigie e limiti cambiano ogni anno e
  dipendono dal reddito, e non sa a chi è intestata ogni ricevuta (`lib/utils/deductions.js`).
