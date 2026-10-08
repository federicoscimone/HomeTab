# Telegram and two-step verification

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
