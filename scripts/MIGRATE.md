# Script di Migrazione MongoDB

Script per copiare i dati da un database MongoDB a un altro, ad esempio da locale a MongoDB Atlas in produzione.

## Installazione

Il script richiede il driver MongoDB (già incluso in `package.json`):

```bash
npm install
```

## Utilizzo Rapido

### Modalità Interattiva (Consigliato)

Esegui semplicemente lo script e rispondi alle domande:

```bash
node scripts/migrate-mongodb.js
```

Lo script ti chiederà:
1. **Connection string di origine** (es. `mongodb://localhost:27017/homebi`)
2. **Connection string di destinazione** (es. `mongodb+srv://user:pass@cluster.mongodb.net/homebi`)
3. Se **cancellare** i dati nella destinazione (con conferma extra)

### Con Parametri da CLI (Opzionale)

Se preferisci passare gli URI direttamente:

```bash
node scripts/migrate-mongodb.js \
  --source "mongodb://localhost:27017/homebi" \
  --destination "mongodb+srv://user:password@cluster.mongodb.net/homebi"
```

### Con Cancellazione della Destinazione

```bash
node scripts/migrate-mongodb.js \
  --source "mongodb://localhost:27017/homebi" \
  --destination "mongodb+srv://user:password@cluster.mongodb.net/homebi" \
  --clear
```

## Script Disponibili

### 1. migrate-mongodb.js - Migrazione

Copia i dati da un database all'altro.

```bash
node scripts/migrate-mongodb.js
```

Opzioni:
- `--source <URL>` - Connection string di origine (opzionale, richiesta se non fornito)
- `--destination <URL>` - Connection string di destinazione (opzionale, richiesta se non fornito)
- `--clear` - Cancella i dati nella destinazione prima di copiare

### 2. verify-migration.js - Verifica

Confronta il numero di documenti tra i due database per verificare che la migrazione sia riuscita.

```bash
node scripts/verify-migration.js
```

Output:
```
📊 VERIFICA MIGRAZIONE
============================================================
Collezione                     Origine         Destinazione Status
============================================================
users                          5               5               ✅ OK
categories                     12              12              ✅ OK
movements                      1523            1523            ✅ OK
...
============================================================
✅ Verifica completata: 7/7 collezioni corrette!
```

### 3. backup-mongodb.js - Backup

Crea un backup locale dei dati in formato JSON.

```bash
node scripts/backup-mongodb.js
```

Il backup viene salvato in una cartella con data/ora:
```
backup-2024-04-25-1234567890/
  ├── users.json
  ├── categories.json
  ├── movements.json
  ├── audit_logs.json
  ├── keyword_mappings.json
  ├── import_templates.json
  ├── password_reset_tokens.json
  └── metadata.json
```

## Dalla tua macchina locale a MongoDB Atlas

### Step 1: Ottieni i dati di connessione da Atlas

1. Accedi a [MongoDB Atlas](https://cloud.mongodb.com)
2. Seleziona il tuo cluster in produzione
3. Clicca **"Connect"**
4. Seleziona **"Drivers"** → **"Node.js"**
5. Copia il connection string (sostituisci `<password>` con la tua password)

Sarà qualcosa come:
```
mongodb+srv://username:password@my-cluster.mongodb.net/homebi?retryWrites=true&w=majority
```

### Step 2: Esegui la migrazione

```bash
node scripts/migrate-mongodb.js
```

Quando richiesto:
- **Origine**: `mongodb://localhost:27017/homebi`
- **Destinazione**: `mongodb+srv://username:password@my-cluster.mongodb.net/homebi`
- **Cancellare**: Rispondi "sì" se vuoi cancellare i dati precedenti in Atlas

### Step 3: Verifica

```bash
node scripts/verify-migration.js
```

Inserisci gli stessi URI e lo script verificherà che tutti i documenti siano stati copiati.

## Cosa Fa Lo Script

1. **Connessione**: Si connette a entrambi i database
2. **Elenca collezioni**: Legge tutte le 7 collezioni
3. **Cancella (opzionale)**: Se richiesto, cancella i dati nella destinazione
4. **Copia**: Trasferisce i documenti in batch di 1000 per efficienza
5. **Report**: Mostra statistiche dettagliate

## Output Esempio

```
🔄 Connessione ai database...

✅ Connesso al database di origine
✅ Connesso al database di destinazione

📦 Found 7 collezioni nel database di origine

Cancellare TUTTI i dati nel database di destinazione prima della migrazione? (sì/no): sì

⚠️  AVVISO: Cancellazione database di destinazione
Questo cancellerà TUTTI i dati nel database di destinazione!

Digita "sì" per confermare la cancellazione: sì

📥 Inizio copia dei dati...

  ✓ users: 5 documenti copiati
  ✓ categories: 12 documenti copiati
  ✓ movements: 1523 documenti copiati
  ✓ audit_logs: 234 documenti copiati
  ✓ keyword_mappings: 45 documenti copiati
  ✓ import_templates: 8 documenti copiati
  ✓ password_reset_tokens: 0 documenti copiati

==================================================
📊 REPORT DELLA MIGRAZIONE
==================================================
Collezioni copiate: 7
Collezioni fallite: 0
Totale documenti: 1827

Dettagli:
  • users: 5 documenti
  • categories: 12 documenti
  • movements: 1523 documenti
  • audit_logs: 234 documenti
  • keyword_mappings: 45 documenti
  • import_templates: 8 documenti
  • password_reset_tokens: 0 documenti
==================================================

✅ Migrazione completata con successo!
```

## Funzionalità

✅ **Modo interattivo**: Chiede gli URI invece di richiederli come parametri
✅ **Copia completa**: Tutti i documenti e le collezioni
✅ **Trasferimento in batch**: Processa 1000 documenti per volta
✅ **Gestione errori**: Continua anche se una collezione ha errori
✅ **Duplicati**: Ignora errori di chiave duplicata
✅ **Report dettagliato**: Statistiche per ogni collezione
✅ **Sicurezza**: Chiede conferma prima di cancellare
✅ **Backup**: Backup locale prima della migrazione

## Sicurezza

⚠️ **Importante**: Non committare le credenziali nel git!

### Opzioni sicure:

1. **Variabili di ambiente** (consigliato):
   ```bash
   export MONGODB_ATLAS_URI="mongodb+srv://..."
   node scripts/migrate-mongodb.js
   # Lo script chiederà di inserirla interattivamente
   ```

2. **Script wrapper**:
   Crea `migrate.sh` (non committare):
   ```bash
   #!/bin/bash
   node scripts/migrate-mongodb.js \
     --source "$MONGODB_LOCAL" \
     --destination "$MONGODB_ATLAS"
   ```

## Troubleshooting

### "Errore di connessione" a MongoDB locale

- Assicurati che MongoDB stia girando: `mongod`
- Verifica che l'URI sia corretto (es. `mongodb://localhost:27017/homebi`)

### "Errore di autenticazione" ad Atlas

- Controlla username e password nell'URI
- Verifica che l'IP sia whitelisted in Atlas (Security → Network Access)
- Assicurati di usare il password corretto

### "Timeout"

Se il database è grande:
- Aumenta il timeout negli script
- Usa `mongodump/mongorestore` (vedi sotto)

### Chiavi duplicate

Se ricevi errori di chiavi duplicate:
- Lo script ignora automaticamente i documenti già esistenti
- Usa `--clear` per cancellare prima di migrare

## Alternativa: mongodump + mongorestore

Se preferisci uno strumento standard MongoDB:

```bash
# Backup locale
mongodump --uri "mongodb://localhost:27017/homebi" -o ./backup

# Restore su Atlas
mongorestore --uri "mongodb+srv://user:pass@cluster.mongodb.net/homebi" ./backup/homebi
```

## Collezioni Migrate

- `users` - Utenti del sistema
- `categories` - Categorie di movimento
- `movements` - Movimenti finanziari
- `audit_logs` - Log di audit
- `keyword_mappings` - Mappature parole chiave
- `import_templates` - Template di importazione
- `password_reset_tokens` - Token reset password
