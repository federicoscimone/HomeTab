# AI-assisted import

[Versione italiana](#import-assistito-dallia) più sotto.

HomeTab can use a language model while importing a bank statement: to suggest a template for a
bank it doesn't know yet and a category for the rows that no keyword rule recognises. Everything
here is optional: without a key the AI features stay off and imports work exactly as before.

Models are reached through [LangChain](https://js.langchain.com), so the app is not tied to one
vendor. Out of the box it uses Anthropic's Claude.

## What it does today

**Before any AI: the family's own history.** Right after the keyword rules, the import looks for
each merchant among the movements already categorized, locally (nothing leaves the server).
Many merchants have names that say nothing ("SUMUP *LA BOTTEGA DI SARA", "SQ *GIO 2"), but the
family has categorized them before. Payment-processor prefixes ("SUMUP *", "SQ *", "PAYPAL *")
and bank boilerplate ("PAGAMENTO POS CARTA…") are ignored, and each word weighs as much as it is
rare in the history, so "ESSELUNGA" counts and "MILANO" barely does. A category is applied by
itself, marked "from history", only when the whole merchant name matches, the past movements
agree (80%) and they are of the same kind (an outflow is never matched with an income). On a test
statement of 8 rows: 1 by keyword, 5 from history, 2 left for the AI. Names truncated by the
bank ("ESSELUNG") or with one typo ("MCDONLDS") still match, on words of five letters or more.

**The bank's own category.** If the statement has a column where the bank classifies each
movement ("Alimentari", "Trasporti"), map it in the template as *Bank's category* (the AI
template proposal finds it by itself). It is saved on each movement, and the history teaches what
it means for the family: when at least 3 past movements with that label, of the same kind, went
80% into one category, a new one goes there by itself, marked "from bank". Until then the label is
sent to the AI as a hint.

**Second pass.** Rows the first model leaves without a category can be passed again to a more
capable model, chosen in Settings → AI (default Claude Sonnet 5.5, or "None"). Each request
carries the category tree and the examples again, so on the test statement the second pass on a
single row cost $0.0070, against $0.0004 for the whole first pass: still about 400 imports a
month within a $3 cap.

On the review screen of an import, **Suggest with AI** sends the rows without a category to the
model in one request (identical rows only once), together with the category tree, twenty recent
merchants of the family and, **for each row, up to three similar past movements** with their
category, found in the history as above. They are masked like everything else, using the whole
original row, so a transfer saved with a person's name as payee is never sent. Suggestions below
60% confidence are dropped.
Each suggestion is marked "suggested by AI" and disappears as soon as the category is changed by
hand; keyword rules always win. When the payee is empty, the merchant is extracted from the bank
description. If the AI is off, over budget or failing, the import works exactly as before.

Nothing is sent until you press the button; **See what is sent**, next to it, shows the request
exactly as it would leave, without sending it, also when the AI is off. Suggestions can start by
themselves when the review opens: switch on "Automatic suggestions" in Settings → AI.

**Template for a new bank.** In Settings → Import templates, **Suggest with AI** takes a
statement from a bank HomeTab doesn't know yet and proposes the template: columns, date format,
sign of the amounts, rows to skip and keywords for the payment method. What is sent is even less
than for categories:

- the code finds the column titles and the first data row by itself (a date and an amount);
  everything above the titles (account holder, account number, IBAN, balances) is **never
  sent**, only how many rows were left out. The rows to skip are counted by the code too;
- only the titles and the first 5 data rows leave, cell by cell: dates and amounts stay as they
  are, because their format is what the model must recognise; long numbers without decimals
  (references, account numbers) become `[NUM]`; text goes through the same masking as the
  import, with the stricter rule for transfers between people.

**See what is sent** shows the original cells next to the sent ones before anything leaves. The
proposal comes back already tried with the app's own parser on the whole file ("read 7
movements out of 7 rows with a date"), opens in the template form, and is saved by you. One call
per bank: $0.0004 with Claude Haiku 5.5 on the test statement.

Measured on 2026-10-20 with Claude Haiku 5.5 on a test statement of 18 rows: 5 recognised by
keyword rules, 13 sent to the model, 12 categorized plausibly, in 7.7 seconds, for $0.0011.

## 1. Get an API key with a spending limit

1. On the [Claude Console](https://platform.claude.com) create a workspace for HomeTab and give
   it a monthly [spend limit](https://platform.claude.com/docs/en/manage-claude/workspaces), the
   same as the app's cap. It is a second safety net, in case the app's own counter were ever
   wrong, and the only limit that covers several installations together.
2. Create an API key **inside that workspace** and buy some credits.

## 2. Configure it from Settings → AI

Everything is set from the **Settings → AI** page, by an administrator, and saved in the
database: the model, the effort, the monthly cap and the API key. Changes apply from the next
call, with no redeploy. The page also shows the month's spending against the cap and the last
calls.

- **The model** is picked from a list that contains only models with a known price, because the
  spending cap needs it (the price table is in `lib/ai/pricing.js`). The default is
  `anthropic:claude-haiku-5-5`: classification and extraction don't need more, at $0.10 / $0.50
  per million tokens.
- **The effort** sets how much the model reasons, and so cost and time. Default: low.
- **The API key** is stored encrypted (AES-256-GCM, with a key derived from the server secret,
  the same scheme used for the Google Drive tokens). It is never shown again nor returned by the
  server: the page shows only its last four characters, with buttons to verify (a free call that
  lists the models), replace or remove it. If you change `NEXTAUTH_SECRET`, the saved key can no
  longer be decrypted and has to be entered again; the page says so.
- In the public demo the page is read-only: the demo account is an administrator with a public
  password.

**Environment variables** (`AI_MODEL_IMPORT`, `AI_MONTHLY_BUDGET_USD`, `ANTHROPIC_API_KEY`) still
work as a fallback: they apply until a value is saved from the page, which then takes
precedence. Useful for an installation configured only from files.

**Another provider** (OpenAI, a local model through Ollama…): install its LangChain package
(`@langchain/openai`, `@langchain/ollama`) and add an entry to `lib/ai/providers.js`; its models
then appear in the list. A local provider costs nothing and is not counted against the cap.

## 3. How the spending cap works

The monthly cap is a hard limit, in US dollars because Anthropic bills in dollars.

- **Before every call** the app reserves the most it could cost: the input estimated from above
  (a token never covers less than one byte, so the bytes sent are an upper bound) plus all of
  `max_tokens`, which caps the output including the model's thinking. If the reservation doesn't
  fit under the cap, the call is not sent.
- **After the call** the reservation is replaced by the real cost, computed from the tokens the
  API reports.
- The check and the reservation are a single atomic MongoDB update: twenty requests started
  together at the edge of the cap cannot all slip through.
- **Failed calls:** if the API answers with an error, nothing is charged. After a timeout or a
  dropped connection nobody knows whether the request was processed, so its reservation stays
  counted as spent.
- **No automatic retries.** LangChain and the Anthropic SDK retry by default, and retrying a
  request that timed out could pay for it twice, outside the reservation. The user retries.
- When the cap is reached, AI features switch off until the first of the month (UTC) and the
  import works as it does without AI.

The counter can only overestimate the spending, never underestimate it.

## 4. Privacy

Only the description, the payee, the place, the type and the amount of each row are sent, plus
the category tree and some merchants from history as examples. Dates, notes, payment methods,
user names and account data never leave the server. `lib/ai/mask.js` then cleans the text:

- **Identifiers**, everywhere: card numbers (also partial: `CARTA 782872`, `*1234`), IBANs, tax
  codes, email addresses, phone numbers and any sequence of 6+ digits, the last digits after
  `N.`, `CC`, `RIF`… They become `[CARTA]`, `[IBAN]`, `[CF]`, `[EMAIL]`, `[NUM]`.
- **Names**, everywhere: after the usual transfer wording ("a favore di", "ordinante"…) and the
  surname after a title ("DR ROSSI", "AVV. BIANCHI"). They become `[NOME]`.
- **Transfers between people** (bank transfers, Satispay, PayPal, top-ups, giroconti): the payee
  column is sent only if it looks like a business (BAR, FARMACIA, SRL, SPA, STUDIO…), otherwise it
  becomes `[NOME]`; in the description, the name right after the transfer wording is masked,
  while the reason words ("AFFITTO", "RIMBORSO") stay. Keyword rules run locally on the original
  text, so well-known merchants paid through PayPal are categorized before the AI.
- **Examples from history** that masking would reduce to a placeholder are not sent.

It is data minimization, not anonymization: merchants and amounts stay, because they are what
categorization needs, and they reveal spending habits (a pharmacy, a vet). The rules are
heuristics, so check them on your own statements:

- **See what is sent** in the import review shows each row as you see it next to what the model
  would receive, the examples and the full JSON request, without sending anything;
- `node scripts/mask-preview.js statement.csv --description B --payee C --skip 1` does the same
  on a whole file, locally, and flags with ⚠ the transfers where no name was masked.

The usage log (`aiusages`) stores numbers only: model, tokens, cost, outcome. Never the text
sent or received.

If the LangSmith tracing variables (`LANGSMITH_TRACING`, `LANGCHAIN_TRACING_V2`) were ever set,
LangChain would also send a copy of the (masked) prompts to LangSmith: leave them unset.

In the public demo (`DEMO_MODE=true`) the AI is always off: anyone could use up the credit.

---

# Import assistito dall'IA

HomeTab può usare un modello linguistico durante l'import di un estratto conto: per proporre il
template di una banca che non conosce ancora e una categoria per le righe che nessuna parola
chiave riconosce. Tutto è facoltativo: senza chiave le funzioni IA restano spente e l'import
funziona esattamente come prima.

I modelli passano da [LangChain](https://js.langchain.com), quindi l'app non è legata a un solo
fornitore. Di serie usa Claude di Anthropic.

## Cosa fa oggi

**Prima dell'IA, lo storico della famiglia.** Subito dopo le regole per parola chiave, l'import
cerca ogni esercente tra i movimenti già categorizzati, in locale (nulla lascia il server). Molti
esercenti hanno nomi che non dicono nulla («SUMUP *LA BOTTEGA DI SARA», «SQ *GIO 2»), ma la
famiglia li ha già categorizzati in passato. I prefissi dei circuiti di pagamento («SUMUP *»,
«SQ *», «PAYPAL *») e le formule della banca («PAGAMENTO POS CARTA…») si ignorano, e ogni parola
pesa quanto è rara nello storico: «ESSELUNGA» conta, «MILANO» quasi nulla. La categoria si applica
da sola, segnata «dallo storico», solo se il nome dell'esercente combacia per intero, i movimenti
passati sono concordi (80%) e dello stesso tipo (un'uscita non si confronta mai con un'entrata).
Su un estratto di prova di 8 righe: 1 dalle regole, 5 dallo storico, 2 lasciate all'IA. I nomi
troncati dalla banca («ESSELUNG») o con un errore di battitura («MCDONLDS») combaciano lo stesso,
sulle parole di almeno cinque lettere.

**La categoria della banca.** Se l'estratto ha una colonna in cui la banca classifica ogni
movimento («Alimentari», «Trasporti»), mappala nel template come *Categoria della banca* (la
proposta del template con l'IA la trova da sola). Si salva su ogni movimento, e lo storico insegna
che cosa vuol dire per la famiglia: quando almeno 3 movimenti passati con quell'etichetta, dello
stesso tipo, sono finiti all'80% in una categoria, uno nuovo ci va da solo, segnato «dalla banca».
Fino ad allora l'etichetta parte verso l'IA come indizio.

**Secondo passaggio.** Le righe che il primo modello lascia senza categoria si possono ripassare
a un modello più capace, scelto in Impostazioni → IA (predefinito Claude Sonnet 5.5, oppure
«Nessuno»). Ogni richiesta riporta l'albero delle categorie e gli esempi, quindi sull'estratto di
prova il secondo passaggio su una sola riga è costato 0,0070 $, contro 0,0004 $ dell'intero primo
passaggio: restano comunque circa 400 import al mese dentro un tetto di 3 $.

Nella revisione di un import, **Suggerisci con l'IA** manda al modello le righe senza categoria in
una sola richiesta (le righe uguali una volta sola), insieme all'albero delle categorie, a venti
esercenti recenti della famiglia e, **per ogni riga, fino a tre movimenti passati simili** con la
loro categoria, trovati nello storico come sopra. Sono mascherati come tutto il resto, usando la
riga originale intera: un bonifico salvato con il nome di una persona come esercente non parte. I suggerimenti con confidenza sotto
il 60% vengono scartati. Ogni suggerimento è segnato «suggerita dall'IA» e sparisce appena la
categoria si cambia a mano; le regole per parola chiave vincono sempre. Se manca l'esercente,
viene ricavato dalla causale. Con l'IA spenta, a tetto raggiunto o in errore, l'import funziona
esattamente come prima.

Finché non premi il pulsante non parte nulla; **Vedi cosa viene inviato**, accanto, mostra la
richiesta esattamente come partirebbe, senza inviarla, anche con l'IA spenta. I suggerimenti
possono partire da soli all'apertura della revisione: attiva «Suggerimenti automatici» in
Impostazioni → IA.

**Template per una banca nuova.** In Impostazioni → Template Import, **Proponi con l'IA** prende
un estratto conto di una banca che HomeTab non conosce ancora e propone il template: colonne,
formato della data, segno degli importi, righe da saltare e parole chiave per il metodo di
pagamento. Parte ancora meno che per le categorie:

- il codice trova da solo i titoli delle colonne e la prima riga di dati (una data e un
  importo); tutto ciò che sta sopra i titoli (intestatario, numero di conto, IBAN, saldi) **non
  parte mai**, solo quante righe sono state omesse. Anche le righe da saltare le conta il codice;
- partono solo i titoli e le prime 5 righe di dati, cella per cella: date e importi restano come
  sono, perché il modello deve riconoscerne il formato; i numeri lunghi senza decimali
  (riferimenti, numeri di conto) diventano `[NUM]`; il testo passa dallo stesso mascheramento
  dell'import, con la regola più stretta sui trasferimenti tra persone.

**Vedi cosa viene inviato** mostra le celle originali accanto a quelle inviate prima che parta
qualsiasi cosa. La proposta torna già provata con il parser dell'app su tutto il file («letti 7
movimenti su 7 righe con una data»), si apre nel modulo del template e la salvi tu. Una chiamata
per banca: 0,0004 $ con Claude Haiku 5.5 sull'estratto di prova.

Misurato il 20 ottobre 2026 con Claude Haiku 5.5 su un estratto conto di prova di 18 righe: 5
riconosciute dalle regole, 13 inviate al modello, 12 categorizzate in modo sensato, in 7,7
secondi, per 0,0011 $.

## 1. Procurati una chiave API con un limite di spesa

1. Nella [Claude Console](https://platform.claude.com) crea un workspace per HomeTab e dagli un
   [limite di spesa](https://platform.claude.com/docs/en/manage-claude/workspaces) mensile, uguale
   al tetto dell'app. È una seconda rete di sicurezza, nel caso il contatore dell'app sbagliasse,
   e l'unico limite che copre insieme più installazioni.
2. Crea una chiave API **dentro quel workspace** e acquista dei crediti.

## 2. Configura da Impostazioni → IA

Tutto si imposta dalla pagina **Impostazioni → IA**, da un amministratore, e si salva sul
database: modello, effort, tetto mensile e chiave API. Le modifiche valgono dalla chiamata
successiva, senza ripubblicare. La pagina mostra anche la spesa del mese rispetto al tetto e le
ultime chiamate.

- **Il modello** si sceglie da un elenco che contiene solo modelli con un prezzo noto, perché il
  tetto di spesa ne ha bisogno (la tabella prezzi sta in `lib/ai/pricing.js`). Il predefinito è
  `anthropic:claude-haiku-5-5`: per classificare ed estrarre non serve di più, a 0,10 $ / 0,50 $
  per milione di token.
- **L'effort** regola quanto ragiona il modello, e quindi costo e tempo. Predefinito: basso.
- **La chiave API** è salvata cifrata (AES-256-GCM, con una chiave ricavata dal segreto del
  server, lo stesso schema dei token di Google Drive). Non viene più mostrata né restituita dal
  server: la pagina ne mostra solo gli ultimi quattro caratteri, con i pulsanti per verificarla
  (una chiamata gratuita che elenca i modelli), sostituirla o eliminarla. Se cambi
  `NEXTAUTH_SECRET`, la chiave salvata non si decifra più e va reinserita; la pagina lo segnala.
- Nella demo pubblica la pagina è in sola lettura: l'account demo è amministratore e ha la
  password pubblica.

**Le variabili d'ambiente** (`AI_MODEL_IMPORT`, `AI_MONTHLY_BUDGET_USD`, `ANTHROPIC_API_KEY`)
restano come ripiego: valgono finché dalla pagina non si salva un valore, che da lì ha la
precedenza. Servono a un'installazione configurata solo da file.

**Un altro fornitore** (OpenAI, un modello locale con Ollama…): installa il suo pacchetto
LangChain (`@langchain/openai`, `@langchain/ollama`) e aggiungi una voce in
`lib/ai/providers.js`; i suoi modelli compaiono nell'elenco. Un fornitore locale non costa nulla
e non pesa sul tetto.

## 3. Come funziona il tetto di spesa

Il tetto mensile è un limite rigido, in dollari perché Anthropic fattura in dollari.

- **Prima di ogni chiamata** l'app prenota il massimo che potrebbe costare: l'ingresso stimato
  per eccesso (un token non copre mai meno di un byte, quindi i byte inviati sono un limite
  superiore) più tutti i `max_tokens`, che limitano l'uscita compreso il ragionamento del
  modello. Se la prenotazione non sta sotto il tetto, la chiamata non parte.
- **Dopo la chiamata** la prenotazione viene sostituita dal costo vero, calcolato dai token che
  l'API riporta.
- Controllo e prenotazione sono un unico aggiornamento atomico di MongoDB: venti richieste
  partite insieme al limite del tetto non possono passare tutte.
- **Chiamate fallite:** se l'API risponde con un errore, non si addebita nulla. Dopo un timeout
  o una connessione caduta nessuno sa se la richiesta è stata elaborata, quindi la sua
  prenotazione resta contata come spesa.
- **Nessuna ripetizione automatica.** LangChain e l'SDK di Anthropic ripetono di default, e
  ripetere una richiesta andata in timeout potrebbe farla pagare due volte, fuori dalla
  prenotazione. Riprova l'utente.
- Raggiunto il tetto, le funzioni IA si spengono fino al primo del mese (UTC) e l'import
  funziona come senza IA.

Il contatore può solo sovrastimare la spesa, mai sottostimarla.

## 4. Riservatezza

Di ogni riga partono solo causale, esercente, luogo, tipo e importo, più l'albero delle categorie
e alcuni esercenti dello storico come esempi. Date, note, metodi di pagamento, nomi degli utenti
e dati del conto non lasciano mai il server. Poi `lib/ai/mask.js` ripulisce il testo:

- **Identificativi**, ovunque: numeri di carta (anche parziali: `CARTA 782872`, `*1234`), IBAN,
  codici fiscali, email, telefoni e qualsiasi sequenza di 6+ cifre, le ultime cifre dopo `N.`,
  `CC`, `RIF`… Diventano `[CARTA]`, `[IBAN]`, `[CF]`, `[EMAIL]`, `[NUM]`.
- **Nomi**, ovunque: dopo le diciture tipiche dei bonifici («a favore di», «ordinante»…) e il
  cognome dopo un titolo («DR ROSSI», «AVV. BIANCHI»). Diventano `[NOME]`.
- **Trasferimenti tra persone** (bonifici, Satispay, PayPal, ricariche, giroconti): la colonna
  dell'esercente si invia solo se ha l'aria di un'attività (BAR, FARMACIA, SRL, SPA, STUDIO…),
  altrimenti diventa `[NOME]`; nella causale si maschera il nome subito dopo la dicitura del
  trasferimento, mentre le parole della causale («AFFITTO», «RIMBORSO») restano. Le regole per
  parola chiave girano in locale sul testo originale, quindi gli esercenti noti pagati con PayPal
  sono categorizzati prima dell'IA.
- **Gli esempi dallo storico** che il mascheramento ridurrebbe a un segnaposto non partono.

È una minimizzazione, non un'anonimizzazione: esercenti e importi restano, perché servono a
categorizzare, e rivelano le abitudini di spesa (una farmacia, un veterinario). Le regole sono
euristiche, quindi provale sui tuoi estratti conto:

- **Vedi cosa viene inviato**, nella revisione dell'import, mostra ogni riga come la vedi tu
  accanto a quella che riceverebbe il modello, gli esempi e la richiesta JSON completa, senza
  inviare nulla;
- `node scripts/mask-preview.js estratto.csv --description B --payee C --skip 1` fa lo stesso su
  un file intero, in locale, e segnala con ⚠ i trasferimenti in cui non è stato mascherato nessun
  nome.

Il registro delle chiamate (`aiusages`) contiene solo numeri: modello, token, costo, esito. Mai
il testo inviato o ricevuto.

Se un giorno fossero impostate le variabili di tracciamento di LangSmith (`LANGSMITH_TRACING`,
`LANGCHAIN_TRACING_V2`), LangChain manderebbe una copia dei prompt (mascherati) anche a LangSmith:
lasciale vuote.

Nella demo pubblica (`DEMO_MODE=true`) l'IA è sempre spenta: chiunque potrebbe consumare il
credito.
