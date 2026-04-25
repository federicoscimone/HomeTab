#!/bin/bash

# Script interattivo di migrazione MongoDB
# Guida l'utente attraverso il processo di migrazione

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         MIGRAZIONE MONGODB - GUIDA INTERATTIVA              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Controlla se Node.js è installato
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non è installato"
  exit 1
fi

# Controlla se MongoDB è installato (opzionale)
MONGOSH_AVAILABLE=false
if command -v mongosh &> /dev/null; then
  MONGOSH_AVAILABLE=true
fi

echo "📋 PASSO 1: Informazioni di connessione"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Database locale
echo "Database di ORIGINE (locale):"
echo "Esempio: mongodb://localhost:27017/homebi"
read -p "Inserisci l'URL di origine: " SOURCE_URL

if [ -z "$SOURCE_URL" ]; then
  echo "❌ URL di origine non può essere vuoto"
  exit 1
fi

echo ""
echo "Database di DESTINAZIONE (MongoDB Atlas):"
echo "Esempio: mongodb+srv://user:password@cluster.mongodb.net/homebi"
read -p "Inserisci l'URL di destinazione: " DEST_URL

if [ -z "$DEST_URL" ]; then
  echo "❌ URL di destinazione non può essere vuoto"
  exit 1
fi

echo ""
echo "📋 PASSO 2: Opzioni di migrazione"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Opzioni
read -p "Desideri fare un BACKUP locale prima della migrazione? (s/n): " DO_BACKUP
read -p "Desideri CANCELLARE i dati nella destinazione prima della migrazione? (s/n): " DO_CLEAR
read -p "Desideri VERIFICARE la migrazione dopo? (s/n): " DO_VERIFY

echo ""
echo "📋 PASSO 3: Riepilogo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔹 Origine:      $SOURCE_URL"
echo "🔹 Destinazione: $DEST_URL"
echo "🔹 Backup:       ${DO_BACKUP:-no}"
echo "🔹 Cancellare:   ${DO_CLEAR:-no}"
echo "🔹 Verificare:   ${DO_VERIFY:-no}"
echo ""

read -p "Procedere con la migrazione? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ]; then
  echo "❌ Migrazione annullata"
  exit 0
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              INIZIO MIGRAZIONE                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: Backup
if [ "$DO_BACKUP" == "s" ]; then
  echo "📝 Step 1: Backup locale..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node "$SCRIPT_DIR/backup-mongodb.js" --source "$SOURCE_URL"
  if [ $? -ne 0 ]; then
    echo "❌ Errore durante il backup"
    exit 1
  fi
  echo ""
fi

# Step 2: Migrazione
echo "📤 Step 2: Migrazione dati..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MIGRATE_ARGS="--source \"$SOURCE_URL\" --destination \"$DEST_URL\""

if [ "$DO_CLEAR" == "s" ]; then
  MIGRATE_ARGS="$MIGRATE_ARGS --clear"
fi

node "$SCRIPT_DIR/migrate-mongodb.js" --source "$SOURCE_URL" --destination "$DEST_URL" $([ "$DO_CLEAR" == "s" ] && echo "--clear")

if [ $? -ne 0 ]; then
  echo "❌ Errore durante la migrazione"
  exit 1
fi

echo ""

# Step 3: Verifica
if [ "$DO_VERIFY" == "s" ]; then
  echo "🔍 Step 3: Verifica migrazione..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node "$SCRIPT_DIR/verify-migration.js" --source "$SOURCE_URL" --destination "$DEST_URL"
  if [ $? -ne 0 ]; then
    echo "⚠️  Errore durante la verifica"
    exit 1
  fi
  echo ""
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           ✅ MIGRAZIONE COMPLETATA                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📌 Prossimi passi:"
echo "  1. Verifica i dati in MongoDB Atlas"
echo "  2. Aggiorna la configurazione dell'app con il nuovo URI"
echo "  3. Esegui i test per verificare tutto sia corretto"
echo "  4. Fa' un deployment in produzione"
echo ""
