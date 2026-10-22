# Running HomeTab at home

[Versione italiana](#hometab-in-casa) più sotto.

HomeTab is meant to run on hardware you own: a mini PC, a NAS that runs Docker, an old laptop or
a Raspberry Pi 5. With the AI on a local model ([Ollama](ai.md#5-local-models-with-ollama)) the
family's money data never leaves the house.

## Maximum privacy

1. **Install it on a computer in the house** with Docker, as in the [quick
   start](../README.md#quick-start), with `DEMO_MODE=false` before the first start and
   `NEXTAUTH_URL` set to the address you will use, for example `http://192.168.1.20:3000`.
2. **Keep it in the home network.** Don't forward ports on the router: from outside, reach it
   through a VPN (WireGuard, Tailscale), so the app is never exposed to the internet.
3. **AI on a local model**, or off. With Ollama, receipts, import and chat work without sending
   anything out; with a paid provider personal data is masked before sending
   ([docs/ai.md](ai.md#4-privacy)), but merchants and amounts do leave.
4. **The optional services stay off**: Telegram, Google Drive backup and email are the only other
   ways data can leave, and each one works only if you configure it.
5. **Backups on your own disks**, since Google Drive would be a third party. A nightly dump of
   the database, from the HomeTab folder:

   ```bash
   docker compose exec -T mongodb sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > hometab-$(date +%F).archive.gz
   ```

   To restore it (it replaces the current data):

   ```bash
   docker compose exec -T mongodb sh -c 'mongorestore --archive --gzip --drop -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < hometab-2026-10-22.archive.gz
   ```

   Keep a copy on another disk.
6. **Reminders** of deadlines and budgets need a daily cron that calls the app
   ([docs/planning.md](planning.md)); without it the app works, only the Telegram reminders don't
   leave.

**HTTPS in the home network.** On plain HTTP everything works, with two exceptions that browsers
impose: the computer's webcam for receipts (the phone camera and choosing a photo work anyway)
and installing the app as a PWA. For both, put a reverse proxy with a certificate in front (the
compose file has the Traefik labels ready), or use Tailscale's HTTPS addresses.

## Raspberry Pi

HomeTab runs on a **Raspberry Pi 5**. The image is built on the Pi itself from the same
`docker compose up -d`, because all the base images exist for 64-bit ARM. The conditions come
from MongoDB and from memory:

| | |
| --- | --- |
| **Model** | Raspberry Pi 5, 4 GB at least, 8 GB recommended. **Not the Pi 4 or older**: MongoDB 5.0 and later need an ARMv8.2-A processor, and the Pi 4's Cortex-A72 is ARMv8.0, so `mongo:7` stops with "Illegal instruction". |
| **System** | 64-bit Raspberry Pi OS (Lite is enough), with Docker. |
| **Disk** | An SSD (NVMe with the M.2 HAT, or USB 3) rather than the microSD: MongoDB writes its journal all the time, which wears a card out and is slow on it. |
| **MongoDB** | Stay on `mongo:7`, as the compose file does: 8.0.5 and later crash-loop on arm64 on the Pi 5 ([docker-library/mongo#762](https://github.com/docker-library/mongo/issues/762)). |
| **First start** | The app is compiled on the Pi: allow several minutes and about 2 GB of free memory. With 4 GB, add swap first, or build the image on a PC with `docker buildx build --platform linux/arm64` and copy it over. |

**Memory.** MongoDB takes half of (RAM − 1 GB) for its cache by default: 1.5 GB on a 4 GB Pi,
far more than a family's data needs. Cap it with a `docker-compose.override.yml` next to
`docker-compose.yml`, which compose reads by itself:

```yaml
services:
  mongodb:
    command: ["--bind_ip_all", "--wiredTigerCacheSizeGB", "0.5"]
```

**Kernel page size.** The Pi 5 kernel uses 16 KB memory pages, which break some programs built
for 4 KB pages. No problem with MongoDB 7 has been reported, but if `mongod` won't start, add
`kernel=kernel8.img` to `/boot/firmware/config.txt` and reboot: it is the Pi's 4 KB-page kernel.

**AI on the Pi.** Ollama runs on the Pi's processor, with no graphics card: small models
(1–4B) work but slowly, from tens of seconds to minutes per receipt. Two better ways:

- Ollama on another computer in the house with a graphics card, and its address in **Settings →
  AI**: the Pi runs the app, the PC answers in seconds, and data still stays home.
- A paid provider, with masking: a few cents a month.

These notes come from the requirements of the components above; HomeTab itself has not yet
been tried on a physical Pi.

---

# HomeTab in casa

HomeTab è pensato per girare su un hardware vostro: un mini PC, un NAS che fa girare Docker, un
vecchio portatile o un Raspberry Pi 5. Con l'IA su un modello locale
([Ollama](ai.md#5-modelli-locali-con-ollama)) i dati dei soldi della famiglia non escono mai di
casa.

## Massima riservatezza

1. **Installatelo su un computer di casa** con Docker, come nell'[avvio
   rapido](../README.it.md#avvio-rapido), con `DEMO_MODE=false` prima del primo avvio e
   `NEXTAUTH_URL` impostato sull'indirizzo che userete, per esempio `http://192.168.1.20:3000`.
2. **Tenetelo nella rete di casa.** Non aprite porte sul router: da fuori, raggiungetelo con una
   VPN (WireGuard, Tailscale), così l'app non è mai esposta su internet.
3. **IA su un modello locale**, o spenta. Con Ollama scontrini, import e chat funzionano senza
   mandare nulla fuori; con un fornitore a pagamento i dati personali vengono mascherati prima
   dell'invio ([docs/ai.md](ai.md#4-riservatezza)), ma esercenti e importi escono.
4. **I servizi facoltativi restano spenti**: Telegram, backup su Google Drive ed email sono le
   sole altre strade per cui i dati possono uscire, e ognuna funziona solo se la configurate.
5. **Backup sui vostri dischi**, perché Google Drive sarebbe un terzo. Una copia notturna del
   database, dalla cartella di HomeTab:

   ```bash
   docker compose exec -T mongodb sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > hometab-$(date +%F).archive.gz
   ```

   Per ripristinarla (sostituisce i dati attuali):

   ```bash
   docker compose exec -T mongodb sh -c 'mongorestore --archive --gzip --drop -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < hometab-2026-10-22.archive.gz
   ```

   Tenetene una copia su un altro disco.
6. **I promemoria** di scadenze e budget hanno bisogno di un cron giornaliero che chiami l'app
   ([docs/planning.md](planning.md)); senza, l'app funziona, solo i promemoria su Telegram non
   partono.

**HTTPS nella rete di casa.** Su HTTP semplice funziona tutto, con due eccezioni imposte dai
browser: la webcam del computer per gli scontrini (la fotocamera del telefono e la scelta di una
foto funzionano comunque) e l'installazione dell'app come PWA. Per entrambe serve davanti un
reverse proxy con un certificato (il file compose ha già le etichette per Traefik), oppure gli
indirizzi HTTPS di Tailscale.

## Raspberry Pi

HomeTab gira su un **Raspberry Pi 5**. L'immagine si costruisce sul Pi stesso con lo stesso
`docker compose up -d`, perché tutte le immagini di partenza esistono per ARM a 64 bit. Le
condizioni vengono da MongoDB e dalla memoria:

| | |
| --- | --- |
| **Modello** | Raspberry Pi 5, almeno 4 GB, meglio 8. **Non il Pi 4 o precedenti**: MongoDB dalla 5.0 in poi richiede un processore ARMv8.2-A, e il Cortex-A72 del Pi 4 è ARMv8.0, quindi `mongo:7` si ferma con «Illegal instruction». |
| **Sistema** | Raspberry Pi OS a 64 bit (basta la Lite), con Docker. |
| **Disco** | Un SSD (NVMe con l'HAT M.2, o USB 3) invece della microSD: MongoDB scrive di continuo il suo journal, che consuma la scheda ed è lento su di essa. |
| **MongoDB** | Restate su `mongo:7`, come fa il file compose: dalla 8.0.5 in poi su arm64 il Pi 5 va in crash a ripetizione ([docker-library/mongo#762](https://github.com/docker-library/mongo/issues/762)). |
| **Primo avvio** | L'app si compila sul Pi: contate parecchi minuti e circa 2 GB di memoria libera. Con 4 GB aggiungete prima dello swap, oppure costruite l'immagine su un PC con `docker buildx build --platform linux/arm64` e copiatela. |

**Memoria.** MongoDB prende di suo per la cache metà di (RAM − 1 GB): 1,5 GB su un Pi da 4 GB,
molto più di quanto servano i dati di una famiglia. Si limita con un `docker-compose.override.yml`
accanto a `docker-compose.yml`, che compose legge da solo:

```yaml
services:
  mongodb:
    command: ["--bind_ip_all", "--wiredTigerCacheSizeGB", "0.5"]
```

**Dimensione delle pagine del kernel.** Il kernel del Pi 5 usa pagine di memoria da 16 KB, che
rompono alcuni programmi costruiti per pagine da 4 KB. Con MongoDB 7 non sono stati segnalati
problemi, ma se `mongod` non parte aggiungete `kernel=kernel8.img` a `/boot/firmware/config.txt`
e riavviate: è il kernel del Pi con pagine da 4 KB.

**L'IA sul Pi.** Ollama gira sul processore del Pi, senza scheda video: i modelli piccoli (1–4B)
funzionano ma piano, da decine di secondi a minuti per uno scontrino. Due strade migliori:

- Ollama su un altro computer di casa con una scheda video, e il suo indirizzo in **Impostazioni
  → IA**: il Pi fa girare l'app, il PC risponde in pochi secondi, e i dati restano comunque in
  casa.
- Un fornitore a pagamento, con il mascheramento: pochi centesimi al mese.

Queste note vengono dai requisiti dei componenti qui sopra; HomeTab in sé non è ancora stato
provato su un Pi fisico.
