# Deploy HomeTab su Raspberry (Ubuntu + Docker)

Questa guida configura:
- Next.js in container Docker
- MongoDB in container Docker con volume persistente
- Nginx reverse proxy su porta 443
- TLS self-signed (solo LAN)

## 1) Prerequisiti

- Docker e Docker Compose plugin installati
- Porte 80 e 443 libere
- Repository disponibile sul Raspberry

Nota operativa:
- I file di configurazione li prepari sul PC (questa cartella progetto).
- I comandi docker di deploy vanno eseguiti sul Raspberry.

Verifica rapida:

```bash
docker --version
docker compose version
```

## 2) Preparazione env di produzione

Dal root del progetto:

```bash
cp .env.production.example .env.production
```

Aggiorna i valori dentro .env.production, in particolare:
- MONGO_ROOT_PASSWORD
- MONGO_APP_PASSWORD
- AUTH_SECRET
- NEXT_PUBLIC_APP_URL
- SMTP_* (opzionale per ora)

Genera AUTH_SECRET robusto:

```bash
openssl rand -hex 32
```

## 3) Certificato self-signed per Nginx

Crea la cartella certificati:

```bash
mkdir -p deploy/nginx/certs
```

Genera certificato e chiave (validi 365 giorni):

```bash
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout deploy/nginx/certs/hometab.key \
  -out deploy/nginx/certs/hometab.crt \
  -days 365 \
  -subj "/CN=hometab.local"
```

Per raggiungere il server da client LAN, aggiungi una entry DNS locale o nel file hosts:

```text
<IP_RASPBERRY> hometab.local
```

## 4) Avvio stack

Build e avvio in background:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Se sei collegato dal PC, entra prima via SSH sul Raspberry:

```bash
ssh <utente>@<ip_raspberry>
cd <cartella_progetto_sul_raspberry>
```

Controllo stato:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f --tail=200
```

## 5) Accesso applicazione

Apri:

```text
https://hometab.local
```

Il browser mostrerà warning TLS perché il certificato è self-signed: è atteso in LAN.

## 6) Comandi operativi

Aggiornamento applicazione:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production restart
```

Stop:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

## 7) Backup MongoDB

Esegui script backup (output in ./backups):

```bash
bash deploy/scripts/backup-mongo.sh .env.production ./backups
```

## 8) Rollback rapido

Se l'ultimo deploy ha problemi:

1. torna al commit precedente
2. rilancia build+up

```bash
git checkout <commit_precedente>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 9) Note importanti

- Il file deploy/mongo/init/01-create-app-user.js viene eseguito solo al primo avvio del volume Mongo vuoto.
- Se cambi credenziali Mongo dopo il primo avvio, aggiornale manualmente su Mongo oppure ricrea il volume dati.
- Se SMTP non è configurato, il reset password via email non funzionerà finché non inserisci SMTP_*.
- Quando vorrai esporre il servizio su internet, conviene passare a certificato trusted (es. Let's Encrypt) e hardening aggiuntivo Nginx/firewall.