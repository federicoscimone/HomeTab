# Telegram and two-step verification

[Versione italiana](#telegram-e-verifica-in-due-passaggi) più sotto.

HomeTab can send sign-in and password-recovery codes through a Telegram bot. Each user links
their own chat from the **Account** page and can then turn on two-step verification, on Telegram
or by email. Everything here is optional: without a bot the app works as before, and email codes
need only the SMTP settings.

## 1. Create the bot

1. In Telegram, open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Choose a display name (e.g. `HomeTab`) and a username ending in `bot`
   (e.g. `myfamily_hometab_bot`).
3. BotFather replies with a token like `123456789:AA…`. Treat it as a password: whoever has it
   can send messages as your bot.

## 2. Configure the app

In `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AA…
TELEGRAM_BOT_USERNAME=myfamily_hometab_bot
```

The app sends the codes itself (an outgoing HTTPS call). A separate process receives the
messages users send to the bot, which is how a chat gets linked to an account.

## 3. Start the bot process

The bot process is the `telegram` service of `docker-compose.yml`, under the profile of the same
name. Enable it and recreate the stack:

```
COMPOSE_PROFILES=telegram docker compose up -d --build
```

(or put `COMPOSE_PROFILES=telegram` in `.env`). Run **one** bot process per bot: Telegram rejects
two clients reading updates at the same time.

The process uses
[long polling (`getUpdates`)](https://core.telegram.org/bots/api#getupdates) instead of a
webhook, so the server needs no public HTTPS address: it works behind NAT. It stores the update
offset in MongoDB, so a restart does not reprocess old messages.

## 4. Link an account and turn on two-step verification

1. Account page → **Connect Telegram** → **Open @your_bot** → press **Start** in Telegram. The
   link is valid for 10 minutes and works once; the page updates by itself when the bot confirms.
2. Under **Two-step verification**, choose Telegram or email and enter the code you receive.
   It is turned on only after a code has arrived, so a broken channel can't lock you out.

From then on, signing in asks for a code after the password. Password recovery sends a code to
the linked chat, besides the usual email link.

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
- On Vercel the bot process can't run (no long-running processes). Codes by email still work.

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

Nel file `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AA…
TELEGRAM_BOT_USERNAME=lamiafamiglia_hometab_bot
```

L'app invia i codici da sola (una chiamata HTTPS in uscita). Un processo separato riceve i
messaggi che gli utenti mandano al bot: è così che una chat viene collegata a un account.

## 3. Avvia il processo del bot

Il processo del bot è il servizio `telegram` di `docker-compose.yml`, sotto il profilo con lo
stesso nome. Attivalo e ricrea lo stack:

```
COMPOSE_PROFILES=telegram docker compose up -d --build
```

(oppure metti `COMPOSE_PROFILES=telegram` nel `.env`). Avvia **un solo** processo per bot:
Telegram rifiuta due client che leggono gli aggiornamenti nello stesso momento.

Il processo usa il
[long polling (`getUpdates`)](https://core.telegram.org/bots/api#getupdates) invece di un
webhook, quindi il server non ha bisogno di un indirizzo HTTPS pubblico: funziona anche dietro
NAT. Salva su MongoDB l'offset degli aggiornamenti, così un riavvio non rielabora i vecchi
messaggi.

## 4. Collega un account e attiva la verifica in due passaggi

1. Pagina **Il mio account** → **Collega Telegram** → **Apri @il_tuo_bot** → premi **Start** in
   Telegram. Il link vale 10 minuti e funziona una sola volta; la pagina si aggiorna da sola
   quando il bot conferma.
2. In **Verifica in due passaggi** scegli Telegram o l'email e inserisci il codice che ricevi.
   Si attiva solo dopo che un codice è arrivato, così un canale che non funziona non può
   chiuderti fuori.

Da quel momento l'accesso chiede un codice dopo la password. Il recupero della password invia un
codice alla chat collegata, oltre al consueto link via email.

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
- Su Vercel il processo del bot non può girare (niente processi di lunga durata). I codici via
  email funzionano comunque.
