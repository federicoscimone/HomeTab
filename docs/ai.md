# AI-assisted import

[Versione italiana](#import-assistito-dallia) più sotto.

HomeTab can use a language model while importing a bank statement: to suggest a template for a
bank it doesn't know yet and a category for the rows that no keyword rule recognises. Everything
here is optional: without a key the AI features stay off and imports work exactly as before.

Models are reached through [LangChain](https://js.langchain.com), so the app is not tied to one
vendor. Out of the box it uses Anthropic's Claude.

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

Before anything is sent, `lib/ai/mask.js` replaces card numbers (also partial ones such as
`CARTA 782872`), IBANs, tax codes, email addresses, phone numbers and other long digit
sequences, and the name of the other party in bank transfers, with a placeholder. The model
gets the merchant, the place and the kind of operation, which is what it needs.

**Known limit:** a person's name is recognised only after the usual transfer wording ("a favore
di", "ordinante"…). A name written elsewhere in a description is sent as it is.

The usage log (`aiusages`) stores numbers only: model, tokens, cost, outcome. Never the text
sent or received.

In the public demo (`DEMO_MODE=true`) the AI is always off: anyone could use up the credit.

---

# Import assistito dall'IA

HomeTab può usare un modello linguistico durante l'import di un estratto conto: per proporre il
template di una banca che non conosce ancora e una categoria per le righe che nessuna parola
chiave riconosce. Tutto è facoltativo: senza chiave le funzioni IA restano spente e l'import
funziona esattamente come prima.

I modelli passano da [LangChain](https://js.langchain.com), quindi l'app non è legata a un solo
fornitore. Di serie usa Claude di Anthropic.

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

Prima di ogni invio, `lib/ai/mask.js` sostituisce con un segnaposto i numeri di carta (anche
parziali, come `CARTA 782872`), gli IBAN, i codici fiscali, le email, i numeri di telefono e le
altre sequenze lunghe di cifre, e il nome della controparte nei bonifici. Al modello arrivano
esercente, luogo e tipo di operazione, cioè quello che gli serve.

**Limite noto:** un nome di persona si riconosce solo dopo le diciture tipiche dei bonifici («a
favore di», «ordinante»…). Un nome scritto altrove in una causale viene inviato così com'è.

Il registro delle chiamate (`aiusages`) contiene solo numeri: modello, token, costo, esito. Mai
il testo inviato o ricevuto.

Nella demo pubblica (`DEMO_MODE=true`) l'IA è sempre spenta: chiunque potrebbe consumare il
credito.
