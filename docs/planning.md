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
