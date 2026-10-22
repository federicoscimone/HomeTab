# Deploying the demo on Vercel

A public demo runs for free on **Vercel Hobby** with a **MongoDB Atlas M0** cluster. Demo mode
fills the database on the first start and a nightly cron restores it, so visitors can change
anything without breaking the demo for the next one.

## 1. Database on MongoDB Atlas

1. Create a project and a free **M0** cluster. Pick AWS **Frankfurt (eu-central-1)**: it sits
   next to the Vercel region set in [`vercel.json`](../vercel.json) (`fra1`).
2. Create a database user with read and write access.
3. Network access: allow `0.0.0.0/0`. Vercel functions have no fixed IP addresses, so there is no
   narrower rule that works. The database holds only fictitious data.
4. Copy the connection string and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/hometab?retryWrites=true&w=majority`

Vercel's MongoDB Atlas integration can do steps 1 to 3 for you and sets `MONGODB_URI`; check
that the URI it creates contains a database name.

## 2. Project on Vercel

1. **Add New → Project**, import the GitHub repository. The framework is detected as Next.js;
   leave the build settings as they are.
2. Environment variables:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | the connection string from step 1 |
   | `NEXTAUTH_SECRET` | a random string: `openssl rand -hex 32` |
   | `NEXTAUTH_URL` | the public address, e.g. `https://hometab-demo.vercel.app` |
   | `DEMO_MODE` | `true` |
   | `CRON_SECRET` | another random string, at least 16 characters |

3. Deploy. The first request after a cold start on an empty database generates the demo data,
   which takes a few seconds.

## 3. Nightly reset

`vercel.json` schedules `GET /api/demo/reset` every night at 03:00 UTC; on the Hobby plan Vercel
runs it at some point within that hour. Vercel sends `CRON_SECRET` in the `Authorization`
header, and the endpoint refuses to run unless `DEMO_MODE=true` and the database already contains
the demo account.

To trigger it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://hometab-demo.vercel.app/api/demo/reset
# {"reset":true}
```

## What changes in demo mode

- A banner on every page shows the demo credentials.
- Google Drive backup is disabled: it would need a personal Google account.
- Imported files are limited to 1 MB (10 MB otherwise).
- The demo accounts can't change their password, and password reset is off.
- Telegram and two-step verification are off: the accounts are shared.

## A personal deployment (real data)

The same steps work for your own instance, with `DEMO_MODE=false`; the nightly reset doesn't run
there. `CRON_SECRET` is needed only for the Telegram reminders of deadlines, sent by a daily cron
already declared in `vercel.json` ([docs/planning.md](planning.md)). On first visit the app opens `/setup`, where you create the
administrator. To receive sign-in and recovery codes on Telegram, add `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET`: on Vercel the bot works through the
webhook, which the app registers by itself ([docs/telegram.md](telegram.md)). Use a bot that no
other installation uses.

The AI-assisted import is configured after deploying, from Settings → AI: model, monthly cap
and API key, saved in the database with the key encrypted ([docs/ai.md](ai.md)). No
environment variable is needed. In the demo the AI stays off anyway.
