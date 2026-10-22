# AI-assisted import

[Versione italiana](#import-assistito-dallia) più sotto.

HomeTab can use a language model while importing a bank statement: to suggest a template for a
bank it doesn't know yet and a category for the rows that no keyword rule recognises; and to
answer questions about the data in a [chat](#chat-on-the-data); and to explain [saving
suggestions](#saving-suggestions-on-request) when asked. Everything here is optional: without a
key the AI features stay off and imports work exactly as before.

Models are reached through [LangChain](https://js.langchain.com), so the app is not tied to one
vendor: Anthropic (the default, Claude), OpenAI, Google Gemini and Mistral as paid services, or
**local models with [Ollama](https://ollama.com)**, which run on a computer of yours: then no data
leaves home and nothing is paid ([section 5](#5-local-models-with-ollama)).

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

**Uncertain suggestions.** A suggestion between 30% and 60% confidence is not applied: in the
import review it appears under the category menu as "Maybe: …", one click to use it; in the review
of incomplete movements it fills the category but stays unticked, marked "uncertain". Below 30%
it is dropped.

**No catch-all categories.** Categories such as "Altro", "Varie", "Spese varie" or "Other" are
not sent to the model, so it cannot propose them and leaves the row empty instead: "other" says
as little as no category. A catch-all with specific subcategories ("Altro → Regali") is sent only
as a group, with its subcategories choosable. They stay available for manual choice and for the
local sources. On the demo data the uncertain proposals filed under "Altro" went from dozens to
none.

**Web search.** For the rows no other source recognises, **Search the web** asks the model to
look each merchant up (Anthropic's web search tool, one search per row at most, at most 15 rows per
click). It runs only from its button, after the AI pass, and **See what it would search** shows
beforehand the exact text the searches would be built from: the same masked rows, without the
examples from history. Each search costs $0.01 plus the tokens of the results, and both are
reserved before the call; a result also says what the business is ("airport operator",
"lakeside restaurant"), shown on the suggestion. On Claude Haiku 5.5 the basic tool version is
used: with the dynamic-filtering version the searches are billed but the model never sees the
results (tried on 2026-10-20). On the demo data: 15 rows, 11 searches, 7 categories found (most
of them uncertain), $0.1256. It can be switched off in Settings → AI.

**Known limit.** Card payments to sole traders often carry the owner's name ("GUIZZARDI DAVIDE",
"LUMA SAS DI MARCO B."): they are merchants, not transfers, so masking leaves them as they are,
and the web search would look them up. Check them with the preview before searching.

**Movements without a category.** On the Movements page, **Complete the categories** opens the
same review for the movements already saved without a category (the 300 most recent): keywords,
history and bank's category locally, then on request the AI with the same preview and second
pass. Nothing changes until you press **Apply**, and only movements still without a category are
touched, so a choice made by hand in the meantime is kept. On the demo data: 97 incomplete
movements, 17 proposed locally, 26 more by the AI ($0.0225), 43 applied after review.

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

## Chat on the data

The chat opens from the pixel owl at the bottom right of every page and answers questions such
as "how much will we have saved this year at this pace?", "where can we improve to save more?",
"will we reach our goals?" or "how much did we spend on restaurants compared with last year?". It
is read-only and uses the same functions as the reports. The panel lives in the layout: opening
a verification link changes the page underneath and the conversation stays.

**The model doesn't compute; it picks.** It has thirteen tools (`lib/ai/agent/tools.js`): month
summary, totals by category or subcategory with the year-over-year comparison, any two date ranges
compared, movement search, savings goals, comparison with similar households, saving signals,
year-end projection, deadlines, what-if, deductible expenses, budgets, and a calculator. The code
computes every number. Each result carries the amounts already
formatted, which the model must quote verbatim, and the link to the app page that shows the same
number with the same filters, so every answer can be checked with one click. The tools use the
pages' defaults (traditional payments, meal vouchers excluded), otherwise the chat and the linked
page would disagree.

**When the question needs a sum the tools don't make.** "Add up this year's salary and subtract
all expenses" is a subtraction no report shows. At first the chat could only answer "do it
yourselves": the rule against mental arithmetic held, but the answer was useless. Three changes
fixed it (2026-10-22):

- `calcola`, a calculator: sums, differences and averages done by the code, and **every term must
  be a number that already appeared** in a tool result, an earlier answer or the question
  (`lib/ai/agent/calc.js`). An invented number is refused and the model has to fetch it from a
  tool. Only numbers and labels pass through it, so there is nothing to mask.
- `proiezione_anno` takes `solo_entrate_di` / `escludi_entrate_di`: the projection counting only
  some income ("only the salary", "without extraordinary income"), computed by the same code as
  the dashboard's.
- `cerca_movimenti` counts like the reports by default (same payment group, without the movements
  excluded from analysis): its totals used to include excluded movements, so they couldn't be
  compared with the projection, and the model rightly refused to subtract them.

**Why tools and not RAG.** The questions are about numbers, and numbers come from aggregations,
not from text similar to the question: retrieving "relevant" movements and asking the model to
sum them is how a chat invents totals. Tool use keeps arithmetic in the database. External data
(the ISTAT comparison, [docs/istat.md](istat.md)) are a versioned snapshot behind one more tool,
not a live call. A vector index would earn its place only with a large body of free text, which
HomeTab does not have.

**The loop** (`lib/ai/agent/run.js`) is written by hand on LangChain, not a ready-made agent:
every step goes through the spending reservation, at most 6 steps, and the instructions with the
category list carry a cache breakpoint, so from the second step on they are read at 5% of the
input price (with Sonnet 5.5). Answers stream in, and the page shows which tools are running. The
conversation stays in the browser tab (the last 6 turns are sent back with each question): nothing
is saved on the server.

Default model: Claude Sonnet 5.5 with low effort, chosen from the same settings page. A question
costs one or two cents.

**Measured** with `node scripts/chat-eval.js` on the demo data: fifteen questions whose expected
answers are read from the pages' own APIs (dashboard, reports, movements, goals, similar
households, year projection), one of them off topic, two with a subtraction or a filtered
projection. On 2026-10-21 with Sonnet 5.5 every answer was correct over five runs as the set grew
(three of the first ten questions, one of eleven, one of all thirteen), about $0.12 per run; on
2026-10-22 all fifteen, $0.18, and the two new ones again with a €25,000 one-off income added to
the data, where the filtered projection must differ.

## Saving suggestions, on request

The dashboard card **Saving suggestions** does nothing until someone presses **Give me
suggestions**: no summary is generated or sent by itself. The chat answers "where could we save?"
with the same signals, through the `segnali_risparmio` tool.

**The code finds the signals** (`lib/utils/insights.js`), each with its amount and a link to the
movements behind it:

- *recurring*: the same amount to the same merchant every month (subscriptions, bills), with the
  yearly cost; above 200 € a month they are rent and instalments, which a cancellation doesn't
  cut, so they stay out;
- *growth*: categories of the last 3 complete months above the same months a year before;
- *anomaly*: the last complete month well above the average of the previous 6;
- *istat*: categories above [similar households](istat.md), housing excluded.

Each signal with a monthly amount also says how many months earlier it would bring the goal that
gains most from it (behind-schedule goals first), with the app's own goal projections.

**The model picks and explains** (`lib/ai/tasks/advice.js`): it receives at most 12 signals and
returns at most 3, each with a title, why it matters and what to do. Amounts, links and the goal
effect shown on the card come from the signal, not from the model's text; and every number the
model writes must appear in the signal it chose, otherwise its text is dropped and the signal is
shown without explanation. One call, about one cent with Sonnet 5.5. Without AI (in the demo,
over the cap) the card shows the three heaviest signals, unexplained.

**Useful / not useful** is saved per signal: "not useful" hides it for six months, and the
judgements reach the model as preferences.

## 1. Choose a provider

| Provider | Models in the list (price per million tokens, in / out) | Key | Notes |
| --- | --- | --- | --- |
| Anthropic | Haiku 5.5 ($0.10 / $0.50), Sonnet 5.5, Opus 5.5, Haiku 4.5 | [Claude Console](https://platform.claude.com/settings/keys) | Default. Only one with the web search of merchants |
| OpenAI | gpt-6-luna ($0.10 / $0.50), gpt-6.1-sol | [platform.openai.com](https://platform.openai.com/api-keys) | |
| Google | gemini-3.5-flash-lite, gemini-3.8-flash, gemini-4-argon | [AI Studio](https://aistudio.google.com/apikey) | Announced increases (Dec 1, 2026 and Jan 1, 2027) apply by themselves on their date |
| Mistral | mistral-small-2603 ($0.15 / $0.60) | [console.mistral.ai](https://console.mistral.ai/api-keys) | European company |
| Ollama | whatever is installed | none | Local: free, no cap, data stays home |

Prices were checked on the providers' pages on 22 October 2026 and are in `lib/ai/pricing.js`:
that is the starting point. **Update prices** re-reads the official pages when you ask (below),
and any other paid model can be added from the settings page (**Other models**: provider, exact
name and price) without touching the code.

**For a paid provider**, create the key with a monthly spending limit where the provider allows
it (on the [Claude Console](https://platform.claude.com) a workspace with a [spend
limit](https://platform.claude.com/docs/en/manage-claude/workspaces), the same as the app's cap):
it is a second safety net, in case the app's own counter were ever wrong, and the only limit that
covers several installations together.

## 2. Configure it from Settings → AI

Everything is set from the **Settings → AI** page, by an administrator, and saved in the
database: the models, the effort, the monthly cap, the providers' keys and the Ollama address.
Changes apply from the next call, with no redeploy. The page also shows the month's spending
against the cap and the last calls.

- **The models** — one for the import (and receipts), a fallback for the rows it leaves empty,
  one for the chat — are picked from a list grouped by provider. Paid models need a known price,
  because the spending cap does; local ones show what they can do (images for receipts, tools for
  the chat). The default is `anthropic:claude-haiku-5-5` for the import and
  `anthropic:claude-sonnet-5-5` for the chat. Providers can be mixed: a local model for receipts
  and a paid one for the chat, for instance.
- **The effort** sets how much the model reasons, and so cost and time. It applies to Anthropic
  and OpenAI; for local models "low" turns reasoning off. Default: low.
- **Other models**: a paid model not in the list, with its price per million tokens as written on
  the provider's page. With the name of a listed model, the price entered replaces the code's.
- **Each provider's key** is stored encrypted (AES-256-GCM, with a key derived from the server secret,
  the same scheme used for the Google Drive tokens). It is never shown again nor returned by the
  server: the page shows only its last four characters, with buttons to verify (a free call that
  lists the models), replace or remove it. If you change `NEXTAUTH_SECRET`, the saved key can no
  longer be decrypted and has to be entered again; the page says so.
- In the public demo the page is read-only: the demo account is an administrator with a public
  password.

**Environment variables** (`AI_MODEL_IMPORT`, `AI_MODEL_CHAT`, `AI_MONTHLY_BUDGET_USD`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `OLLAMA_BASE_URL`)
still work as a fallback: they apply until a value is saved from the page, which then takes
precedence. Useful for an installation configured only from files.

**How the providers differ, in the code.** Everything goes through LangChain's common interface
(`withStructuredOutput`, `bindTools`, `stream`); `lib/ai/providers.js` is the only file that
knows the providers, and records what changes between them:

- *structured answers*: the native JSON schema for Anthropic, OpenAI and Ollama, Gemini's
  `responseSchema`, a forced function call for Mistral (its LangChain package doesn't pass the
  native schema);
- *images*: sent as `image_url` with a data URL, the block every adapter converts to its own
  format;
- *prompt cache*: the `cache_control` marker on the instructions exists only on Anthropic and is
  removed for the others (OpenAI and Gemini cache the prefix by themselves);
- *errors*: each SDK names the HTTP status differently, and the status decides whether a failed
  call is charged.

A new provider is its LangChain package plus an entry there.

### Keeping prices current

Providers change prices every few weeks, and none of them publishes prices in a form a program
can read: the model lists of their APIs have no prices. **Settings → AI → Model prices → Update
prices** does it on request:

1. The server downloads the official pricing pages (Anthropic, OpenAI and Google: one page each;
   Mistral: the page of each current chat model, picked from its model index) and keeps their
   visible text. Long pages are cut to the pieces around the models of interest.
2. The import model reads them, one call per provider (about one cent in all with Haiku 5.5),
   and for each model returns the standard prices, any announced future price with its date, and
   **the sentence it read them from**.
3. The code keeps a price only if that sentence is really in the page and contains those
   numbers. A price the model made up, or one suggested by text written to fool it, does not
   pass: the spending cap relies on these numbers, and the pages are third-party text.
4. The page shows old and new side by side, with the sentence; nothing changes until an
   administrator presses **Apply**. The check is applied by its id, so what is saved is exactly
   what the server read and verified.

Applied prices are saved in the database (`priceOverrides`, or on the model for those added by
hand) and take the place of the code's table; announced increases apply on their date.

**New models.** The same check looks for models the app doesn't know yet. Their identifiers come
from the provider's own list of models (a free API call with the key: Anthropic, OpenAI, Google
and Mistral all have one), not from the page, so a proposed model really exists under that name;
the page only gives the price, verified like the others. Old versions are never proposed: for each
family — the name without the version, `claude-opus-5-5` and `claude-opus-4-6` are both
"claude-opus" — only the newest counts, by release date or, where the provider gives none
(Google), by version number, and only if the app doesn't have it already. Embedding, audio and
image models, `-latest` aliases and dated copies are left out. A provider without a key is not
searched, and the page says so: its models couldn't be used anyway. Models already in the list
are never removed by the check, since one may be in use.

**History.** Every change is recorded in `modelprices`: the starting price, the prices read from
the pages, those entered by hand, and announced ones with their future date. The page shows it
model by model, newest first, with an arrow for each rise or fall: over time it shows how
prices move.

## 3. How the spending cap works

The monthly cap is a hard limit, in US dollars because the providers bill in dollars. It covers
all paid providers together; local models are free and outside it.

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
- **No automatic retries.** LangChain and the providers' SDKs retry by default, and retrying a
  request that timed out could pay for it twice, outside the reservation. The user retries.
- **Images** are reserved at 4,784 tokens each with Anthropic (its documented maximum) and 8,000
  with the others, which count them in different, not always documented ways: a generous
  reservation only lasts for the call.
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

**In the chat** the model receives the question, the category tree, goal names and what the
tools return: totals, category names and, from the movement search, at most 20 movements with
date, amount and the same masked description and payee as the import. Tool results are handed
to the model as data, and no tool can change anything, so a bank description written to look
like an instruction cannot trigger an action.

**Quick entry** (New movement page or Telegram): a receipt photo goes to the model as it is,
reduced to 2,000 px by the browser (merchant, items and total are what it is for; the photo is
not stored), and a line the local chain can't categorize goes to the categorization step with
the same masking as the import ([docs/telegram.md](telegram.md)). The photo can be taken
(phone camera, or the webcam on a computer, which browsers allow only over HTTPS: on plain HTTP
the button explains it), chosen from the gallery or a folder, or dragged onto the card; all
three paths go through the same reduction.

**For saving suggestions** the model receives the signals: category names, amounts already
written, the masked merchant of recurring expenses and the name of the goal they would help.

With a local model all of this stays on your network: masking still applies, but nothing reaches
a third party.

In the public demo (`DEMO_MODE=true`) the AI is always off: anyone could use up the credit.

## 5. Local models with Ollama

[Ollama](https://ollama.com) runs open models on a computer of yours. HomeTab talks to it like
any other provider: the data never leaves your network, nothing is paid and the monthly cap
doesn't apply.

1. Install Ollama on the same computer as HomeTab or, better, on one with a graphics card, and
   download the models: `ollama pull qwen3-vl:4b` (reads images and uses tools: receipts, import
   and chat).
2. In **Settings → AI → Local models with Ollama** enter where it answers and press *Verify*.
   On the same machine it is `http://127.0.0.1:11434` (the default); from the Docker container,
   `http://host.docker.internal:11434`; on another computer, its address, after starting Ollama
   there with `OLLAMA_HOST=0.0.0.0` so it listens on the network.
3. The installed models appear in the menus, with what each can do.

Things worth knowing, all measured on 22 October 2026 with `qwen3-vl:4b` on an RTX 3060 Ti:

- **Context.** Ollama uses 4,096 tokens by default and **silently cuts** the start of a longer
  prompt: the chat, with instructions and tools, would lose them. HomeTab asks for 16,384
  (`OLLAMA_NUM_CTX` to change it; more context, more memory) and writes a warning in the log when
  a call fills it. The value stays fixed because changing it makes Ollama reload the model.
- **Reasoning.** Models that reason (qwen3, deepseek-r1) spent 1,000–2,000 tokens on a receipt
  and once ran out before answering. With effort "low" HomeTab turns it off: the receipt went
  from 12–18 seconds to under one.
- **Quality.** A 4B model reads merchant, date and total reliably (5 out of 5), but got the
  payment method wrong 2 times out of 5, and in the chat it lets internal codes slip into the
  text ("on_track"). The form is always checked before saving; for the chat a larger model
  (14B and up) or a paid one does better. Providers can be mixed.
- **Speed.** Receipt 3.6 s, category 0.9 s, a chat question about 26 s. Without a graphics card
  everything is several times slower: the timeout for local models is 5 minutes
  (`OLLAMA_TIMEOUT_MS`).

---

# Import assistito dall'IA

HomeTab può usare un modello linguistico durante l'import di un estratto conto: per proporre il
template di una banca che non conosce ancora e una categoria per le righe che nessuna parola
chiave riconosce; per rispondere alle domande sui dati in una [chat](#la-chat-sui-dati); e per
spiegare i [consigli di risparmio](#consigli-di-risparmio-su-richiesta) quando li chiedete. Tutto è
facoltativo: senza chiave le funzioni IA restano spente e l'import
funziona esattamente come prima.

I modelli passano da [LangChain](https://js.langchain.com), quindi l'app non è legata a un solo
fornitore: Anthropic (il predefinito, Claude), OpenAI, Google Gemini e Mistral come servizi a
pagamento, oppure **modelli locali con [Ollama](https://ollama.com)**, che girano su un vostro
computer: allora nessun dato esce di casa e non si paga nulla
([sezione 5](#5-modelli-locali-con-ollama)).

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
riga originale intera: un bonifico salvato con il nome di una persona come esercente non parte. I
suggerimenti con confidenza sotto il 60% vengono scartati. Ogni suggerimento è segnato «suggerita
dall'IA» e sparisce appena la categoria si cambia a mano; le regole per parola chiave vincono
sempre. Se manca l'esercente, viene ricavato dalla causale. Con l'IA spenta, a tetto raggiunto o
in errore, l'import funziona esattamente come prima.

Finché non premi il pulsante non parte nulla; **Vedi cosa viene inviato**, accanto, mostra la
richiesta esattamente come partirebbe, senza inviarla, anche con l'IA spenta. I suggerimenti
possono partire da soli all'apertura della revisione: attiva «Suggerimenti automatici» in
Impostazioni → IA.

**Suggerimenti incerti.** Un suggerimento fra il 30% e il 60% di confidenza non si applica: nella
revisione dell'import compare sotto il menu della categoria come «Forse: …», un clic per usarlo;
nella revisione dei movimenti incompleti compila la categoria ma resta senza spunta, segnato
«incerta». Sotto il 30% si scarta.

**Niente categorie contenitore.** Categorie come «Altro», «Varie», «Spese varie» o «Other» non
partono verso il modello, che quindi non può proporle e lascia la riga vuota: «altro» dice tanto
quanto nessuna categoria. Una categoria contenitore con sottocategorie specifiche («Altro →
Regali») parte solo come raggruppamento, con le figlie scegliibili. Restano disponibili per la
scelta manuale e per le fonti locali. Sui dati della demo le proposte incerte in «Altro» sono
passate da decine a zero.

**Ricerca web.** Per le righe che nessuna altra fonte riconosce, **Cerca sul web** chiede al modello
di cercare ogni esercente (lo strumento di ricerca web di Anthropic, al massimo una ricerca per
riga e 15 righe per clic). Parte solo dal suo pulsante, dopo il passaggio dell'IA, e **Vedi cosa
cercherebbe** mostra prima il testo esatto da cui verrebbero costruite le ricerche: le stesse
righe mascherate, senza gli esempi dallo storico. Ogni ricerca costa 0,01 $ più i token dei
risultati, ed entrambi si prenotano prima della chiamata; il risultato dice anche che attività è
(«gestore aeroportuale», «ristorante sul lago»), mostrato sul suggerimento. Con Claude Haiku 5.5 si
usa la versione di base dello strumento: con quella a filtro dinamico le ricerche vengono
addebitate ma il modello non ne vede mai i risultati (provato il 20 ottobre 2026). Sui dati della
demo: 15 righe, 11 ricerche, 7 categorie trovate (quasi tutte incerte), 0,1256 $. Si spegne in
Impostazioni → IA.

**Limite noto.** I pagamenti con carta alle ditte individuali riportano spesso il nome del titolare
(«GUIZZARDI DAVIDE», «LUMA SAS DI MARCO B.»): sono esercenti, non trasferimenti, quindi il
mascheramento li lascia come sono, e la ricerca web li cercherebbe. Controllali con l'anteprima
prima di cercare.

**Movimenti senza categoria.** Nella pagina Movimenti, **Completa le categorie** apre la stessa
revisione sui movimenti già salvati senza categoria (i 300 più recenti): parole chiave, storico e
categoria della banca in locale, poi su richiesta l'IA con la stessa anteprima e lo stesso secondo
passaggio. Non cambia nulla finché non premi **Applica**, e si toccano solo i movimenti ancora
senza categoria: una scelta fatta a mano nel frattempo resta. Sui dati della demo: 97 movimenti
incompleti, 17 proposti in locale, altri 26 dall'IA (0,0225 $), 43 applicati dopo la revisione.

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

## La chat sui dati

La chat si apre dal gufo in basso a destra su ogni pagina e risponde a domande come «quanto
avremo risparmiato quest'anno continuando così?», «dove possiamo migliorare per risparmiare di
più?», «riusciremo a raggiungere gli obiettivi?» o «quanto abbiamo speso in ristoranti rispetto
all'anno scorso?». È in sola lettura e usa le stesse funzioni dei report. Il pannello vive nel
layout: aprendo un link di verifica la pagina cambia sotto e la conversazione resta.

**Il modello non calcola: sceglie.** Ha tredici strumenti (`lib/ai/agent/tools.js`): riepilogo
del mese, totali per categoria o sottocategoria con il confronto sull'anno prima, confronto fra
due intervalli qualsiasi, ricerca dei movimenti, obiettivi di risparmio, confronto con le famiglie
simili, segnali di risparmio, proiezione di fine anno, scadenze, simulatore, spese detraibili,
budget e una calcolatrice. Ogni numero lo calcola il codice. Ogni
risultato porta gli importi già formattati, che il modello deve citare così come sono, e il link
alla pagina dell'app che mostra lo stesso numero con gli stessi filtri: ogni risposta si verifica
con un clic. Gli strumenti usano i valori predefiniti delle pagine (pagamenti tradizionali, buoni
pasto esclusi), altrimenti chat e pagina collegata non coinciderebbero.

**Quando la domanda chiede un conto che gli strumenti non fanno.** «Somma gli stipendi dell'anno e
togli tutte le uscite» è una sottrazione che nessun report mostra. All'inizio la chat poteva solo
rispondere «fatela voi»: la regola contro i conti a mente reggeva, ma la risposta era inutile. Tre
modifiche l'hanno risolto (22 ottobre 2026):

- `calcola`, una calcolatrice: somme, differenze e medie fatte dal codice, e **ogni termine deve
  essere un numero già comparso** in un risultato di uno strumento, in una risposta precedente o
  nella domanda (`lib/ai/agent/calc.js`). Un numero inventato viene rifiutato e il modello deve
  prenderlo da uno strumento. Ci passano solo numeri ed etichette: niente da mascherare.
- `proiezione_anno` accetta `solo_entrate_di` / `escludi_entrate_di`: la proiezione contando solo
  alcune entrate («solo lo stipendio», «senza le entrate straordinarie»), calcolata dallo stesso
  codice di quella della dashboard.
- `cerca_movimenti` di base conta come i report (stesso gruppo di pagamenti, senza i movimenti
  esclusi dalle analisi): i suoi totali comprendevano quelli esclusi, quindi non si potevano
  confrontare con la proiezione, e il modello giustamente si rifiutava di sottrarli.

**Perché strumenti e non RAG.** Le domande riguardano numeri, e i numeri vengono da aggregazioni,
non da testi simili alla domanda: recuperare i movimenti «pertinenti» e chiedere al modello di
sommarli è il modo in cui una chat inventa i totali. Con gli strumenti l'aritmetica resta nel
database. I dati esterni (il confronto ISTAT, [docs/istat.md](istat.md)) sono un'istantanea
versionata dietro un altro strumento, non una chiamata dal vivo. Un indice vettoriale avrebbe
senso solo con una grande mole di testo libero, che HomeTab non ha.

**Il ciclo** (`lib/ai/agent/run.js`) è scritto a mano su LangChain, non un agente pronto: ogni
passo passa dalla prenotazione di spesa, al massimo 6 passi, e le istruzioni con l'elenco delle
categorie hanno un punto di cache, così dal secondo passo si leggono al 5% del prezzo
dell'input (con Sonnet 5.5). La risposta arriva
in streaming e la pagina mostra quali strumenti sono in uso. La conversazione resta nella scheda
del browser (gli ultimi 6 turni si rimandano a ogni domanda): sul server non si salva nulla.

Modello predefinito: Claude Sonnet 5.5 con effort basso, scelto dalla stessa pagina delle
impostazioni. Una domanda costa uno o due centesimi.

**Misurata** con `node scripts/chat-eval.js` sui dati della demo: quindici domande le cui risposte
attese si leggono dalle API delle pagine (dashboard, report, movimenti, obiettivi, famiglie
simili, proiezione), una fuori tema, due con una sottrazione o una proiezione filtrata. Il 21
ottobre 2026 con Sonnet 5.5 tutte le risposte sono state giuste in cinque passate, man mano che il
set cresceva (tre sulle prime dieci domande, una su undici, una su tutte e tredici), circa 0,12 $
a passata; il 22 ottobre tutte e quindici, 0,18 $, e le due nuove anche aggiungendo ai dati
un'entrata una tantum di 25.000 €, con cui la proiezione filtrata deve dare un altro numero.

## Consigli di risparmio, su richiesta

La scheda **Consigli di risparmio** della dashboard non fa nulla finché qualcuno non preme **Dammi
dei consigli**: nessun riepilogo si prepara o parte da solo. La chat risponde a «dove potremmo
risparmiare?» con gli stessi segnali, con lo strumento `segnali_risparmio`.

**I segnali li trova il codice** (`lib/utils/insights.js`), ciascuno con il suo importo e il link
ai movimenti da cui viene:

- *ricorrenti*: lo stesso importo allo stesso esercente ogni mese (abbonamenti, bollette), con il
  costo annuo; oltre 200 € al mese sono affitti e rate, che una disdetta non taglia, quindi
  restano fuori;
- *in crescita*: categorie degli ultimi 3 mesi completi sopra gli stessi mesi dell'anno prima;
- *mesi anomali*: l'ultimo mese completo molto sopra la media dei 6 precedenti;
- *famiglie simili*: capitoli sopra la media delle [famiglie simili](istat.md), casa esclusa.

Ogni segnale con un importo mensile dice anche di quanti mesi anticiperebbe l'obiettivo che ne
guadagna di più (prima quelli in ritardo), con le proiezioni degli obiettivi dell'app.

**Il modello sceglie e spiega** (`lib/ai/tasks/advice.js`): riceve al massimo 12 segnali e ne
restituisce al massimo 3, ognuno con titolo, perché conta e cosa fare. Importi, link ed effetto
sull'obiettivo mostrati nella scheda vengono dal segnale, non dal testo del modello; e ogni numero
che il modello scrive deve comparire nel segnale scelto, altrimenti il suo testo si scarta e il
segnale resta senza spiegazione. Una chiamata, circa un centesimo con Sonnet 5.5. Senza IA (nella
demo, oltre il tetto) la scheda mostra i tre segnali più pesanti, senza spiegazione.

**Utile / non utile** si salva per segnale: «non utile» lo nasconde per sei mesi, e i giudizi
arrivano al modello come preferenze.

## 1. Scegli un fornitore

| Fornitore | Modelli nell'elenco (prezzo per milione di token, ingresso / uscita) | Chiave | Note |
| --- | --- | --- | --- |
| Anthropic | Haiku 5.5 (0,10 $ / 0,50 $), Sonnet 5.5, Opus 5.5, Haiku 4.5 | [Claude Console](https://platform.claude.com/settings/keys) | Predefinito. L'unico con la ricerca web degli esercenti |
| OpenAI | gpt-6-luna (0,10 $ / 0,50 $), gpt-6.1-sol | [platform.openai.com](https://platform.openai.com/api-keys) | |
| Google | gemini-3.5-flash-lite, gemini-3.8-flash, gemini-4-argon | [AI Studio](https://aistudio.google.com/apikey) | I rincari annunciati (1° dicembre 2026 e 1° gennaio 2027) si applicano da soli alla loro data |
| Mistral | mistral-small-2603 (0,15 $ / 0,60 $) | [console.mistral.ai](https://console.mistral.ai/api-keys) | Azienda europea |
| Ollama | quelli installati | nessuna | In locale: gratis, senza tetto, i dati restano in casa |

I prezzi sono verificati sulle pagine dei fornitori il 22 ottobre 2026 e stanno in
`lib/ai/pricing.js`: è il punto di partenza. **Aggiorna i prezzi** rilegge le pagine ufficiali
quando lo chiedete (sotto), e qualsiasi altro modello a pagamento si aggiunge dalla pagina delle
impostazioni (**Altri modelli**: fornitore, nome esatto e prezzo) senza toccare il codice.

**Per un fornitore a pagamento**, crea la chiave con un limite di spesa mensile dove il fornitore
lo permette (nella [Claude Console](https://platform.claude.com) un workspace con un [limite di
spesa](https://platform.claude.com/docs/en/manage-claude/workspaces), uguale al tetto dell'app):
è una seconda rete di sicurezza, nel caso il contatore dell'app sbagliasse, e l'unico limite che
copre insieme più installazioni.

## 2. Configura da Impostazioni → IA

Tutto si imposta dalla pagina **Impostazioni → IA**, da un amministratore, e si salva sul
database: modelli, effort, tetto mensile, chiavi dei fornitori e indirizzo di Ollama. Le modifiche
valgono dalla chiamata successiva, senza ripubblicare. La pagina mostra anche la spesa del mese
rispetto al tetto e le ultime chiamate.

- **I modelli** — uno per l'import (e gli scontrini), uno di riserva per le righe che lascia
  vuote, uno per la chat — si scelgono da un elenco raggruppato per fornitore. Quelli a pagamento
  devono avere un prezzo noto, perché il tetto di spesa ne ha bisogno; quelli locali mostrano cosa
  sanno fare (immagini per gli scontrini, strumenti per la chat). Il predefinito è
  `anthropic:claude-haiku-5-5` per l'import e `anthropic:claude-sonnet-5-5` per la chat. I
  fornitori si possono mescolare: per esempio un modello locale per gli scontrini e uno a
  pagamento per la chat.
- **L'effort** regola quanto ragiona il modello, e quindi costo e tempo. Vale per Anthropic e
  OpenAI; per i modelli locali «basso» spegne il ragionamento. Predefinito: basso.
- **Altri modelli**: un modello a pagamento che non è nell'elenco, con il prezzo per milione di
  token come sulla pagina del fornitore. Con il nome di un modello dell'elenco, il prezzo inserito
  prende il posto di quello del codice.
- **La chiave di ogni fornitore** è salvata cifrata (AES-256-GCM, con una chiave ricavata dal segreto del
  server, lo stesso schema dei token di Google Drive). Non viene più mostrata né restituita dal
  server: la pagina ne mostra solo gli ultimi quattro caratteri, con i pulsanti per verificarla
  (una chiamata gratuita che elenca i modelli), sostituirla o eliminarla. Se cambi
  `NEXTAUTH_SECRET`, la chiave salvata non si decifra più e va reinserita; la pagina lo segnala.
- Nella demo pubblica la pagina è in sola lettura: l'account demo è amministratore e ha la
  password pubblica.

**Le variabili d'ambiente** (`AI_MODEL_IMPORT`, `AI_MODEL_CHAT`, `AI_MONTHLY_BUDGET_USD`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `OLLAMA_BASE_URL`)
restano come ripiego: valgono finché dalla pagina non si salva un valore, che da lì ha la
precedenza. Servono a un'installazione configurata solo da file.

**Come cambiano i fornitori, nel codice.** Tutto passa dall'interfaccia comune di LangChain
(`withStructuredOutput`, `bindTools`, `stream`); `lib/ai/providers.js` è l'unico file che conosce
i fornitori, e registra ciò che cambia fra loro:

- *risposte strutturate*: lo schema JSON nativo per Anthropic, OpenAI e Ollama, il
  `responseSchema` di Gemini, una chiamata a funzione forzata per Mistral (il suo pacchetto
  LangChain non passa lo schema nativo);
- *immagini*: inviate come `image_url` con un data URL, il blocco che ogni adattatore converte
  nel formato del suo fornitore;
- *cache del prompt*: il segnaposto `cache_control` sulle istruzioni esiste solo su Anthropic e
  per gli altri si toglie (OpenAI e Gemini mettono in cache il prefisso da soli);
- *errori*: ogni SDK chiama lo stato HTTP a modo suo, e lo stato decide se una chiamata fallita
  si paga.

Un fornitore nuovo è il suo pacchetto LangChain più una voce lì.

### Tenere aggiornati i prezzi

I fornitori cambiano i prezzi ogni poche settimane, e nessuno li pubblica in una forma leggibile
da un programma: gli elenchi dei modelli delle loro API non hanno prezzi. **Impostazioni → IA →
Prezzi dei modelli → Aggiorna i prezzi** lo fa su richiesta:

1. Il server scarica le pagine ufficiali dei prezzi (Anthropic, OpenAI e Google: una pagina
   ciascuno; Mistral: la pagina di ogni modello di chat attuale, presa dal suo indice) e ne tiene
   il testo visibile. Le pagine lunghe si riducono ai pezzi intorno ai modelli che interessano.
2. Il modello dell'import le legge, una chiamata per fornitore (circa un centesimo in tutto con
   Haiku 5.5), e per ogni modello restituisce i prezzi standard, l'eventuale prezzo futuro
   annunciato con la sua data e **la frase da cui li ha letti**.
3. Il codice tiene un prezzo solo se quella frase è davvero nella pagina e contiene quei numeri.
   Un prezzo inventato dal modello, o suggerito da un testo scritto per ingannarlo, non passa:
   il tetto di spesa si basa su questi numeri, e le pagine sono testo di terzi.
4. La pagina mostra vecchio e nuovo affiancati, con la frase; nulla cambia finché un
   amministratore non preme **Applica**. Il controllo si applica per id, quindi si salva
   esattamente ciò che il server ha letto e verificato.

I prezzi applicati si salvano sul database (`priceOverrides`, o sul modello per quelli aggiunti a
mano) e prendono il posto della tabella del codice; i rincari annunciati scattano alla loro data.

**Modelli nuovi.** Lo stesso controllo cerca i modelli che l'app non conosce ancora. I loro
identificativi vengono dall'elenco dei modelli del fornitore (una chiamata gratuita con la chiave:
Anthropic, OpenAI, Google e Mistral ce l'hanno tutti), non dalla pagina, quindi un modello proposto
esiste davvero con quel nome; la pagina dà solo il prezzo, verificato come gli altri. Le versioni
vecchie non si propongono mai: per ogni famiglia — il nome senza la versione, `claude-opus-5-5` e
`claude-opus-4-6` sono entrambi «claude-opus» — conta solo il più recente, per data d'uscita o,
dove il fornitore non la dà (Google), per numero di versione, e solo se l'app non lo ha già.
Restano fuori i modelli per embedding, audio e immagini, gli alias `-latest` e le copie con la
data. Un fornitore senza chiave non si cerca, e la pagina lo dice: i suoi modelli non si potrebbero
usare comunque. Il controllo non toglie mai i modelli già nell'elenco, perché uno potrebbe essere
in uso.

**Storico.** Ogni cambiamento resta in `modelprices`: il prezzo di partenza, quelli letti dalle
pagine, quelli scritti a mano e quelli annunciati con la loro data futura. La pagina lo mostra
modello per modello, dal più recente, con una freccia per ogni salita o discesa: col tempo fa
vedere come si muovono i prezzi.

## 3. Come funziona il tetto di spesa

Il tetto mensile è un limite rigido, in dollari perché i fornitori fatturano in dollari. Vale per
tutti i fornitori a pagamento insieme; i modelli locali sono gratis e ne restano fuori.

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
- **Nessuna ripetizione automatica.** LangChain e gli SDK dei fornitori ripetono di default, e
  ripetere una richiesta andata in timeout potrebbe farla pagare due volte, fuori dalla
  prenotazione. Riprova l'utente.
- **Le immagini** si prenotano a 4.784 token l'una con Anthropic (il suo massimo documentato) e a
  8.000 con gli altri, che le contano in modi diversi e non sempre documentati: una prenotazione
  larga dura solo il tempo della chiamata.
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

**Nella chat** il modello riceve la domanda, l'albero delle categorie, i nomi degli obiettivi e
ciò che restituiscono gli strumenti: totali, nomi delle categorie e, dalla ricerca, al massimo
20 movimenti con data, importo e la stessa causale ed esercente mascherati dell'import. I
risultati degli strumenti arrivano al modello come dati, e nessuno strumento modifica nulla: una
causale scritta per sembrare un'istruzione non può far scattare un'azione.

**Registrazione rapida** (pagina Nuovo movimento o Telegram): la foto di uno scontrino parte
verso il modello così com'è, ridotta a 2.000 px dal browser (esercente, voci e totale sono ciò che
serve; la foto non si salva), e una riga che la catena locale non sa categorizzare passa dalla
categorizzazione con lo stesso mascheramento dell'import
([docs/telegram.md](telegram.md#5-registra-le-spese-dalla-chat)). La foto si può scattare
(fotocamera del telefono, o webcam sul computer, che i browser concedono solo su HTTPS: su HTTP
semplice il pulsante lo spiega), scegliere dalla galleria o da una cartella, o trascinare sulla
scheda; le tre strade passano dalla stessa riduzione.

**Per i consigli di risparmio** il modello riceve i segnali: nomi delle categorie, importi già
scritti, l'esercente mascherato delle spese ricorrenti e il nome dell'obiettivo che aiuterebbero.

Con un modello locale tutto questo resta nella vostra rete: il mascheramento si applica lo
stesso, ma niente arriva a terzi.

Nella demo pubblica (`DEMO_MODE=true`) l'IA è sempre spenta: chiunque potrebbe consumare il
credito.

## 5. Modelli locali con Ollama

[Ollama](https://ollama.com) fa girare modelli aperti su un vostro computer. HomeTab ci parla come
con ogni altro fornitore: i dati non escono dalla vostra rete, non si paga nulla e il tetto
mensile non si applica.

1. Installate Ollama sullo stesso computer di HomeTab o, meglio, su uno con una scheda video, e
   scaricate i modelli: `ollama pull qwen3-vl:4b` (legge le immagini e usa gli strumenti:
   scontrini, import e chat).
2. In **Impostazioni → IA → Modelli locali con Ollama** indicate dove risponde e premete
   *Verifica*. Sulla stessa macchina è `http://127.0.0.1:11434` (il predefinito); dal container
   Docker, `http://host.docker.internal:11434`; su un altro computer, il suo indirizzo, dopo aver
   avviato lì Ollama con `OLLAMA_HOST=0.0.0.0` perché ascolti in rete.
3. I modelli installati compaiono nei menu, con ciò che sa fare ciascuno.

Cose da sapere, tutte misurate il 22 ottobre 2026 con `qwen3-vl:4b` su una RTX 3060 Ti:

- **Contesto.** Ollama usa di suo 4.096 token e **taglia in silenzio** l'inizio di un prompt più
  lungo: la chat, con istruzioni e strumenti, li perderebbe. HomeTab ne chiede 16.384
  (`OLLAMA_NUM_CTX` per cambiarlo; più contesto, più memoria) e scrive un avviso nel registro
  quando una chiamata lo riempie. Il valore resta fisso perché cambiarlo costringe Ollama a
  ricaricare il modello.
- **Ragionamento.** I modelli che ragionano (qwen3, deepseek-r1) spendevano 1.000–2.000 token su
  uno scontrino, e una volta hanno finito il limite prima di rispondere. Con effort «basso»
  HomeTab lo spegne: lo scontrino è passato da 12–18 secondi a meno di uno.
- **Qualità.** Un modello da 4B legge esercente, data e totale in modo affidabile (5 volte su 5),
  ma ha sbagliato il metodo di pagamento 2 volte su 5, e nella chat lascia passare codici interni
  nel testo («on_track»). Il modulo si controlla sempre prima di salvare; per la chat va meglio un
  modello più grande (da 14B in su) o uno a pagamento. I fornitori si possono mescolare.
- **Velocità.** Scontrino 3,6 s, categoria 0,9 s, una domanda alla chat circa 26 s. Senza scheda
  video tutto è parecchie volte più lento: il tempo massimo per i modelli locali è di 5 minuti
  (`OLLAMA_TIMEOUT_MS`).
