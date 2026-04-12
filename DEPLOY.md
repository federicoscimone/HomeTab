# Piano di Deployment: HomeTab su Raspberry Pi 4

## Contesto tecnico

- **App:** Next.js 16.2 + MongoDB + Auth.js (stack già completo)
- **Target:** Raspberry Pi 4 a `192.168.1.200` (architettura `arm64`)
- **Obiettivo:** Container Docker + pipeline CI/CD che si aggiorna automaticamente ad ogni push su `main`

---

## Architettura finale

```
[PC sviluppo] → git push → [GitHub]
                               ↓
                    GitHub Actions (ubuntu-latest)
                    build immagine arm64 con QEMU
                    push su ghcr.io/federicoscimone/HomeTab
                               ↓
                    GitHub Actions (self-hosted sul Pi)
                    docker compose pull + up
                               ↓
               [Raspberry Pi 192.168.1.200]
               ┌──────────────────────────────┐
               │  hometab-app (porta 3000)    │
               │  mongodb (porta 27017)       │
               └──────────────────────────────┘
```

> Il Pi non espone nessuna porta verso internet. Il self-hosted runner si connette a GitHub in outbound.

---

## Fase A — Dockerizzazione ✅

File creati nel repository:

| File | Scopo |
|------|-------|
| `Dockerfile` | Build multi-stage (deps → builder → runner minimale) |
| `.dockerignore` | Esclude node_modules, .next, .env*, logs, xlsx |
| `docker-compose.yml` | Servizi mongodb + app per la produzione |
| `docker-compose.override.yml` | Override per test locali (`docker compose up --build`) |
| `.env.production.example` | Template variabili d'ambiente per il Pi |
| `next.config.mjs` | Aggiunto `output: 'standalone'` |

---

## Fase B — Setup Raspberry Pi

### B.1 — Eseguire lo script di setup

Copia lo script sul Pi e lancialo come root (o con sudo):

```bash
scp scripts/setup-pi.sh pi@192.168.1.200:~/
ssh pi@192.168.1.200
sudo bash setup-pi.sh
```

Lo script installa Docker, crea l'utente `federico`, crea le directory e guida all'installazione del runner.

### B.2 — Creare `.env.production` sul Pi

```bash
su - federico
nano /home/federico/hometab/.env.production
```

Contenuto (usa `.env.production.example` come riferimento):

```env
AUTH_SECRET=<genera con: openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=http://192.168.1.200:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tua@email.com
SMTP_PASS=tua_app_password
SMTP_FROM=HomeTab <tua@email.com>
```

### B.3 — Installare il self-hosted runner GitHub Actions

1. Vai su: `https://github.com/federicoscimone/HomeTab/settings/actions/runners/new`
2. Seleziona **Linux / ARM64**
3. Esegui i comandi mostrati da GitHub come utente `federico`:

```bash
su - federico
mkdir actions-runner && cd actions-runner
# incolla qui i comandi di download e config mostrati da GitHub
./config.sh --url https://github.com/federicoscimone/HomeTab --token <TOKEN>
```

4. Installa e avvia come servizio systemd (si avvia automaticamente al reboot):

```bash
sudo ./svc.sh install hometab
sudo ./svc.sh start
```

---

## Fase C — CI/CD con GitHub Actions ✅

File creato: `.github/workflows/deploy.yml`

### Come funziona il workflow

Si attiva automaticamente su ogni push a `main` (o manualmente dalla UI GitHub).

**Job 1 — `build`** (runner GitHub, ubuntu-latest):
- Emula arm64 con QEMU
- Builda l'immagine Docker e la pusha su `ghcr.io/federicoscimone/HomeTab:latest`
- Usa la cache di GitHub Actions per build più veloci

**Job 2 — `deploy`** (self-hosted runner sul Pi):
- Fa `docker pull` dell'immagine appena pubblicata
- Esegue `docker compose up -d`
- Health check su `http://localhost:3000`

### Unica configurazione richiesta su GitHub

Il workflow usa `GITHUB_TOKEN` (automatico) per autenticarsi al Container Registry.
Non servono secret aggiuntivi per il deploy di base.

Per abilitare il pull dell'immagine dal Pi, rendi il package **pubblico** oppure configura l'autenticazione a ghcr.io sull'utente `federico` del Pi:

```bash
# sul Pi, come utente hometab
echo "<GITHUB_PAT>" | docker login ghcr.io -u federicoscimone --password-stdin
```

---

## Fase D — Backup e manutenzione

### Script di backup MongoDB

Da aggiungere come cron job sul Pi (`crontab -e` come utente `federico`):

```bash
# Backup MongoDB ogni giorno alle 02:00
0 2 * * * docker exec $(docker ps -qf name=mongodb) mongodump --db hometab --archive | gzip > /home/federico/backups/hometab-$(date +\%Y\%m\%d).gz

# Pulizia backup più vecchi di 30 giorni
0 3 * * * find /home/federico/backups -name "*.gz" -mtime +30 -delete
```

### Aggiornamenti manuali

Se si vuole forzare un deploy senza push:

```bash
# dalla UI GitHub: Actions → Build & Deploy → Run workflow
# oppure dal Pi:
cd /home/federico/hometab
docker compose pull && docker compose up -d
```

---

## Riepilogo file del progetto legati al deploy

| File | Stato |
|------|-------|
| `Dockerfile` | ✅ creato |
| `.dockerignore` | ✅ creato |
| `docker-compose.yml` | ✅ creato |
| `docker-compose.override.yml` | ✅ creato |
| `.env.production.example` | ✅ creato |
| `.github/workflows/deploy.yml` | ✅ creato |
| `scripts/setup-pi.sh` | ✅ creato |
| `scripts/backup-mongo.sh` | da fare (opzionale) |
| `nginx/hometab.conf` | da fare (opzionale) |
