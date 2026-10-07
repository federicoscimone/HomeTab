# 🚀 Script di Migrazione MongoDB

Questa cartella contiene tutti gli script necessari per migrare i dati da MongoDB locale a MongoDB Atlas in produzione.

## 📚 Script Disponibili

| Script | Descrizione | Uso |
|--------|-----------|-----|
| **migrate-interactive.sh** | Guida interattiva bash | `bash scripts/migrate-interactive.sh` |
| **migrate-mongodb.js** | Migrazione dati (richiede gli URI) | `node scripts/migrate-mongodb.js` |
| **verify-migration.js** | Verifica migrazione (richiede gli URI) | `node scripts/verify-migration.js` |
| **backup-mongodb.js** | Backup locale (richiede l'URI) | `node scripts/backup-mongodb.js` |
| **migrate-all.js** | Orchestrazione completa | `node scripts/migrate-all.js --source <URL> --destination <URL>` |

## 🎯 Quick Start

### Opzione 1: Modo interattivo (Consigliato)

```bash
node scripts/migrate-mongodb.js
```

Lo script ti chiederà:
1. **Connection string di origine** (es. mongodb://localhost:27017/hometab)
2. **Connection string di destinazione** (es. mongodb+srv://user:pass@cluster.mongodb.net/hometab)
3. Se **cancellare** i dati nella destinazione (chiede conferma extra)

### Opzione 2: Con parametri da CLI

```bash
node scripts/migrate-mongodb.js \
  --source "mongodb://localhost:27017/hometab" \
  --destination "mongodb+srv://user:pass@cluster.mongodb.net/hometab" \
  --clear
```

### Opzione 3: Bash interattivo

```bash
bash scripts/migrate-interactive.sh
```

## ✅ Funzionalità

- 🔍 Chiede interattivamente gli URI di connessione
- 📦 Migra tutte le 7 collezioni del database
- 💾 Backup automatico prima della migrazione
- ✓ Verifica integrata post-migrazione
- 🔐 Gestione sicura con conferma prima di cancellare
- 📊 Report dettagliato con statistiche

## 📖 Documentazione Completa

Vedi [MIGRATE.md](./MIGRATE.md) per la documentazione dettagliata.

## 🔐 Sicurezza

- Non committare le credenziali nel git
- Usa variabili di ambiente o `.env.migration`
- Gli URI vengono richiesti in modo interattivo (non salvati in file)
