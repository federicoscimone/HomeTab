# Telegram and two-step verification

[Versione italiana](#telegram-e-verifica-in-due-passaggi) più sotto.

HomeTab can send sign-in and password-recovery codes through a Telegram bot. Each user links
their own chat from the **Account** page and can then turn on two-step verification, on Telegram
or by email. Everything here is optional: without a bot the app works as before, and email codes
need only the SMTP settings.

## 1. Create the bot

1. In Telegram, open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Choose a display name (e.g. `HomeTab`) and a username ending in `bot`
   (e.g. `my_hometab_bot`).
3. BotFather replies with a token like `123456789:AA…`. Treat it as a password: whoever has it
   can send messages as your bot.

## 2. Configure the app

As an administrator, open **Settings → Telegram**, paste the token and save. The app checks it
with Telegram (which also gives the bot's name, so you don't type it) and stores it **encrypted**
in the database, like the AI keys: afterwards only its last 4 characters are shown. The page
also shows whether the app is receiving messages and when it last talked to Telegram, and sends
you a test message once your own chat is linked.

The app sends messages by itself (an outgoing HTTPS call). Receiving what users send to the bot
(that's how a chat gets linked to an account) works in one of two ways, chosen on the same page.

## 3. Choose how the bot receives messages

**Polling, for a server reachable only in the home network (the default).** The app asks
Telegram for new messages with [long polling (`getUpdates`)](https://core.telegram.org/bots/api#getupdates):
the request stays open and Telegram answers the moment a message arrives, so there is no delay,
and only outgoing connections are needed — no port to open, it works behind NAT. The offset is
stored in MongoDB, so a restart does not reprocess old messages. Every update is handed to the
app's `/api/telegram/webhook` route, authenticated with a token derived from `NEXTAUTH_SECRET`,
so the logic is the same as with the webhook.

**Webhook, for a public HTTPS deploy.** Telegram sends every message to
`https://<your domain>/api/telegram/webhook` (the base is `APP_URL` or `NEXTAUTH_URL`). The app
generates the secret Telegram puts in a header, stores it encrypted and registers the webhook by
itself. On Vercel, where functions don't stay running, this is the only option.

Receiving runs inside the app and follows the settings within a few seconds: no restart and no
extra container. Only one process receives at a time (a lock in MongoDB), because Telegram
refuses two `getUpdates` on the same bot. The `telegram` service of `docker-compose.yml` (profile
of the same name) is no longer needed; if it is still running it uses the same code and the same
lock, so it does no harm, and you can drop `COMPOSE_PROFILES=telegram`.

**Environment variables still work** when nothing is saved on the page: `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_BOT_USERNAME`, plus `TELEGRAM_WEBHOOK_SECRET` (a random value: letters, digits, `_` and
`-`) for the webhook. A configuration saved on the page takes precedence; removing it goes back
to the variables.

**One bot per installation.** Linked chats live in each installation's database, and Telegram
delivers a bot's messages to one place only. Two installations (say, production in the cloud
and a copy at home) need two bots. **Changing bot:** Telegram doesn't let a bot write to someone
who hasn't pressed Start on it, so after a change every user links again from the Account page
(**Link again**); the settings page tells you how many users that is, and how many use Telegram
for two-step verification — move those to email first, or they get no codes until they link again.

## 4. Link an account and turn on two-step verification

1. Account page → **Connect Telegram** → **Open @your_bot** → press **Start** in Telegram. The
   link is valid for 10 minutes and works once; the page updates by itself when the bot confirms.
   **Send a test message** checks that the bot can write to you; **Link again** redoes the link,
   for example after the bot has changed.
2. Under **Two-step verification**, choose Telegram or email and enter the code you receive.
   It is turned on only after a code has arrived, so a broken channel can't lock you out.

From then on, signing in asks for a code after the password. Password recovery sends a code to
the linked chat, besides the usual email link.

The linked chat also receives the reminders of the payment deadlines, if a daily cron calls
`/api/cron/promemoria` ([docs/planning.md](planning.md)).

## 5. Record expenses from the chat

The same quick entry of the app's **New movement** page (`lib/services/quickEntry.js`), from a
chat: on the page a line or a receipt photo fills in the form; here, from a linked chat, users who
can create movements record them without opening the app:

- **One line of text**: `12,50 pizza`, `ieri 40 benzina contanti`, `2 pizze 18`, `+1500
  stipendio` for income. Amount, date ("ieri", "altro ieri"), payment method ("contanti",
  "bancomat", "carta", "buoni pasto"…; debit card otherwise) and description are read without AI
  (`lib/utils/quickEntry.js`); with several numbers the one with a currency sign or decimals
  wins, otherwise the largest. The category comes from the import chain: keywords, merchant
  history, then the AI if it is on. The movement is saved at once, with an **Undo** button valid
  for a day.
- **A photo of a receipt**: the model (the import model, Claude Haiku 5.5 by default) reads
  merchant, date, total and payment method; the movement waits for **Record** or **Cancel**.
  The photo is not stored. About $0.0002 per receipt.

Every movement created from Telegram is marked with source `telegram` and written to the audit
log; a button tapped twice records once.

## How it is protected

- Codes are 6 digits, valid 5 minutes, at most 5 wrong attempts, single use, bound to their
  purpose (sign-in, reset, activation) and stored only as SHA-256 hashes.
- With two-step verification on, the password alone is refused even when calling NextAuth's
  sign-in endpoint directly: the second step needs the ticket issued together with the code.
- Attempts are limited per IP address (counters in MongoDB, so the limit holds across serverless
  instances too). Accounts are never locked: on the public demo anyone could lock everyone out.
- Recovery through Telegram works only for a chat linked beforehand, never for one named at
  recovery time. A chat can belong to one account only.
- An administrator can turn off a user's two-step verification from **Settings → Users**, for
  someone who lost access to their channel.

## Limits

- **Telegram can read the codes.** Chats with bots are not end-to-end encrypted. For a family
  app this is an acceptable trade-off; if it isn't for you, use email codes instead.
- The per-IP limit trusts the `X-Forwarded-For` header set by the reverse proxy. Keep the app
  reachable only through the proxy (`APP_BIND=127.0.0.1`).
- In the public demo (`DEMO_MODE=true`) Telegram and two-step verification are disabled: the
  accounts are shared and their credentials are public.
- The webhook needs a public HTTPS address; the polling process needs an always-on server. A
  deploy without either can still send codes by email.

---

# Telegram e verifica in due passaggi

HomeTab può inviare i codici di accesso e di recupero della password tramite un bot Telegram.
Ogni utente collega la propria chat dalla pagina **Il mio account** e può poi attivare la
verifica in due passaggi, su Telegram o via email. Tutto è facoltativo: senza bot l'app funziona
come prima, e i codici via email richiedono solo la configurazione SMTP.

## 1. Crea il bot

1. In Telegram apri [@BotFather](https://t.me/BotFather) e invia `/newbot`.
2. Scegli un nome visualizzato (es. `HomeTab`) e un nome utente che finisca in `bot`
   (es. `lamiafamiglia_hometab_bot`).
3. BotFather risponde con un token del tipo `123456789:AA…`. Trattalo come una password: chi lo
   possiede può inviare messaggi a nome del tuo bot.

## 2. Configura l'app

Da amministratore apri **Impostazioni → Telegram**, incolla il token e salva. L'app lo verifica
con Telegram (che le dà anche il nome del bot, quindi non va scritto) e lo salva **cifrato** nel
database, come le chiavi dell'IA: dopo se ne vedono solo le ultime 4 cifre. La pagina mostra
anche se l'app sta ricevendo i messaggi e quando ha parlato con Telegram l'ultima volta, e ti
manda un messaggio di prova quando la tua chat è collegata.

L'app invia i messaggi da sola (una chiamata HTTPS in uscita). Ricevere ciò che gli utenti
mandano al bot (è così che una chat viene collegata a un account) funziona in uno di due modi,
da scegliere nella stessa pagina.

## 3. Scegli come il bot riceve i messaggi

**Polling, per un server raggiungibile solo nella rete di casa (il modo predefinito).** L'app
chiede a Telegram i messaggi nuovi con il
[long polling (`getUpdates`)](https://core.telegram.org/bots/api#getupdates): la richiesta resta
aperta e Telegram risponde nell'istante in cui arriva un messaggio, quindi non c'è ritardo, e
servono solo connessioni in uscita: nessuna porta da aprire, funziona dietro NAT. L'offset è
salvato su MongoDB, così un riavvio non rielabora i vecchi messaggi. Ogni update va alla rotta
`/api/telegram/webhook` dell'app, con un token ricavato da `NEXTAUTH_SECRET`, così la logica è
la stessa del webhook.

**Webhook, per un deploy pubblico in HTTPS.** Telegram manda ogni messaggio a
`https://<il tuo dominio>/api/telegram/webhook` (la base è `APP_URL` o `NEXTAUTH_URL`). Il
segreto che Telegram mette in un header lo genera l'app, lo salva cifrato e registra il webhook
da sola. Su Vercel, dove le funzioni non restano accese, è l'unica possibilità.

La ricezione gira dentro l'app e segue le impostazioni in pochi secondi: niente riavvii e niente
container in più. Riceve un solo processo alla volta (un lucchetto su MongoDB), perché Telegram
rifiuta due `getUpdates` sullo stesso bot. Il servizio `telegram` di `docker-compose.yml`
(profilo omonimo) non serve più; se è ancora acceso usa lo stesso codice e lo stesso lucchetto,
quindi non fa danni, e si può togliere `COMPOSE_PROFILES=telegram`.

**Le variabili d'ambiente funzionano ancora** quando nella pagina non è salvato nulla:
`TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME`, più `TELEGRAM_WEBHOOK_SECRET` (un valore casuale:
lettere, cifre, `_` e `-`) per il webhook. La configurazione salvata nella pagina ha la
precedenza; togliendola si torna alle variabili.

**Un bot per installazione.** Le chat collegate stanno nel database di ogni installazione, e
Telegram consegna i messaggi di un bot in un solo posto. Due installazioni (per esempio la
produzione nel cloud e una copia a casa) richiedono due bot. **Cambio di bot:** Telegram non
lascia scrivere un bot a chi non gli ha premuto Start, quindi dopo un cambio ogni utente si
ricollega dalla pagina Account (**Collega di nuovo**); la pagina delle impostazioni dice quanti
sono, e quanti usano Telegram per la verifica in due passaggi: spostali prima sull'email, o non
riceveranno codici finché non si ricollegano.

## 4. Collega un account e attiva la verifica in due passaggi

1. Pagina **Il mio account** → **Collega Telegram** → **Apri @il_tuo_bot** → premi **Start** in
   Telegram. Il link vale 10 minuti e funziona una sola volta; la pagina si aggiorna da sola
   quando il bot conferma. **Invia messaggio di prova** controlla che il bot riesca a scriverti;
   **Collega di nuovo** rifà il collegamento, per esempio dopo un cambio di bot.
2. In **Verifica in due passaggi** scegli Telegram o l'email e inserisci il codice che ricevi.
   Si attiva solo dopo che un codice è arrivato, così un canale che non funziona non può
   chiuderti fuori.

Da quel momento l'accesso chiede un codice dopo la password. Il recupero della password invia un
codice alla chat collegata, oltre al consueto link via email.

La chat collegata riceve anche i promemoria delle scadenze di pagamento, se un cron giornaliero
chiama `/api/cron/promemoria` ([docs/planning.md](planning.md#scadenze-e-accantonamenti)).

## 5. Registra le spese dalla chat

La stessa registrazione rapida della pagina **Nuovo movimento** dell'app
(`lib/services/quickEntry.js`), da una chat: nella pagina una riga o la foto di uno scontrino
riempiono il modulo; qui, da una chat collegata, chi può creare movimenti li registra senza aprire
l'app:

- **Una riga di testo**: `12,50 pizza`, `ieri 40 benzina contanti`, `2 pizze 18`, `+1500
  stipendio` per un'entrata. Importo, data («ieri», «altro ieri»), metodo di pagamento
  («contanti», «bancomat», «carta», «buoni pasto»…; altrimenti carta di debito) e descrizione si
  leggono senza IA (`lib/utils/quickEntry.js`); con più numeri vince quello con la valuta o i
  decimali, altrimenti il più grande. La categoria la trova la catena dell'import: parole chiave,
  storico degli esercenti, poi l'IA se è attiva. Il movimento si salva subito, con un pulsante
  **Annulla** valido per un giorno.
- **La foto di uno scontrino**: il modello (quello dell'import, di serie Claude Haiku 5.5) legge
  esercente, data, totale e metodo di pagamento; il movimento aspetta **Registra** o **Annulla**.
  La foto non si salva. Circa 0,0002 $ a scontrino.

Ogni movimento creato da Telegram ha origine `telegram` e finisce nel registro delle operazioni;
un pulsante toccato due volte registra una volta sola.

## Come è protetta

- I codici sono di 6 cifre, valgono 5 minuti, ammettono al massimo 5 tentativi sbagliati, si
  usano una sola volta, sono legati al loro scopo (accesso, reset, attivazione) e sono salvati
  solo come hash SHA-256.
- Con la verifica in due passaggi attiva, la sola password viene rifiutata anche chiamando
  direttamente l'endpoint di accesso di NextAuth: il secondo passo richiede il ticket rilasciato
  insieme al codice.
- I tentativi sono limitati per indirizzo IP (contatori su MongoDB, così il limite vale anche fra
  più istanze serverless). Gli account non vengono mai bloccati: sulla demo pubblica chiunque
  potrebbe chiudere fuori tutti.
- Il recupero via Telegram funziona solo per una chat collegata in precedenza, mai per una
  indicata al momento del recupero. Una chat può appartenere a un solo account.
- Un amministratore può disattivare la verifica in due passaggi di un utente da
  **Impostazioni → Utenti**, per chi ha perso l'accesso al proprio canale.

## Limiti

- **Telegram può leggere i codici.** Le chat con i bot non sono cifrate end-to-end. Per un'app
  familiare è un compromesso accettabile; se per te non lo è, usa i codici via email.
- Il limite per IP si fida dell'header `X-Forwarded-For` impostato dal reverse proxy. Lascia
  l'app raggiungibile solo attraverso il proxy (`APP_BIND=127.0.0.1`).
- Nella demo pubblica (`DEMO_MODE=true`) Telegram e la verifica in due passaggi sono disattivati:
  gli account sono condivisi e le loro credenziali pubbliche.
- Il webhook richiede un indirizzo HTTPS pubblico; il polling un server sempre acceso. Un
  deploy senza nessuno dei due può comunque inviare i codici via email.
