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

The app sends the codes itself (an outgoing HTTPS call). Receiving what users send to the bot
(that's how a chat gets linked to an account) works in one of two ways.

## 3. Choose how the bot receives messages

**Public HTTPS deploy (Vercel, or a server reachable from the internet): webhook.** Add a random
secret and redeploy:

```
TELEGRAM_WEBHOOK_SECRET=<e.g. the output of: openssl rand -hex 32>
```

At startup the app registers `https://<your domain>/api/telegram/webhook` with Telegram, only if
it isn't registered already (changing the secret registers it again). Telegram then sends every
message there, with the secret in a header the route checks. No extra process is needed.

**Server reachable only in the LAN: polling.** Telegram can't reach the app, so a separate
process asks Telegram for new messages. Leave `TELEGRAM_WEBHOOK_SECRET` empty; the process is
the `telegram` service of `docker-compose.yml`, under the profile of the same name. Enable it and
recreate the stack:

```
COMPOSE_PROFILES=telegram docker compose up -d --build
```

(or put `COMPOSE_PROFILES=telegram` in `.env`). It uses
[long polling (`getUpdates`)](https://core.telegram.org/bots/api#getupdates), so it works behind
NAT, and stores the update offset in MongoDB, so a restart does not reprocess old messages.

**One bot per installation.** Linked chats live in each installation's database, and Telegram
doesn't allow a webhook and polling on the same bot. Two installations (say, production on Vercel
and a test copy at home) need two bots.

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

Nel file `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AA…
TELEGRAM_BOT_USERNAME=lamiafamiglia_hometab_bot
```

L'app invia i codici da sola (una chiamata HTTPS in uscita). Ricevere ciò che gli utenti
mandano al bot (è così che una chat viene collegata a un account) funziona in uno di due modi.

## 3. Scegli come il bot riceve i messaggi

**Deploy pubblico in HTTPS (Vercel, o un server raggiungibile da internet): webhook.** Aggiungi
un segreto casuale e ripubblica:

```
TELEGRAM_WEBHOOK_SECRET=<es. il risultato di: openssl rand -hex 32>
```

All'avvio l'app registra presso Telegram `https://<il tuo dominio>/api/telegram/webhook`, solo
se non è già registrato (cambiando il segreto lo registra di nuovo). Da lì Telegram invia ogni
messaggio a quell'indirizzo, con il segreto in un header che la route controlla. Non serve
nessun processo in più.

**Server raggiungibile solo in LAN: polling.** Telegram non può raggiungere l'app, quindi un
processo separato gli chiede i messaggi nuovi. Lascia vuoto `TELEGRAM_WEBHOOK_SECRET`; il
processo è il servizio `telegram` di `docker-compose.yml`, sotto il profilo con lo stesso nome.
Attivalo e ricrea lo stack:

```
COMPOSE_PROFILES=telegram docker compose up -d --build
```

(oppure metti `COMPOSE_PROFILES=telegram` nel `.env`). Usa il
[long polling (`getUpdates`)](https://core.telegram.org/bots/api#getupdates), quindi funziona
anche dietro NAT, e salva su MongoDB l'offset degli aggiornamenti, così un riavvio non
rielabora i vecchi messaggi.

**Un bot per installazione.** Le chat collegate stanno nel database di ogni installazione, e
Telegram non ammette webhook e polling sullo stesso bot. Due installazioni (per esempio la
produzione su Vercel e una copia di prova a casa) richiedono due bot.

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
- Il webhook richiede un indirizzo HTTPS pubblico; il polling un server sempre acceso. Un
  deploy senza nessuno dei due può comunque inviare i codici via email.
