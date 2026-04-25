#!/usr/bin/env node

/**
 * Script di backup MongoDB locale
 * Esporta i dati in formato JSON
 * 
 * Uso:
 *   node scripts/backup-mongodb.js
 *   Oppure: node scripts/backup-mongodb.js --source <SOURCE_URL> [--output ./backup]
 */

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const argMap = {};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].substring(2);
    if (args[i + 1] && !args[i + 1].startsWith('--')) {
      argMap[key] = args[i + 1];
      i++;
    } else {
      argMap[key] = true;
    }
  }
}

let SOURCE_URL = argMap.source;
const BACKUP_DIR =
  argMap.output ||
  `./backup-${new Date().toISOString().slice(0, 10)}-${new Date().getTime()}`;

/**
 * Chiede una domanda all'utente
 */
async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Richiede l'URL se non fornito
 */
async function getConnectionString() {
  if (SOURCE_URL) {
    return; // L'URL è già stato fornito come argomento
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   BACKUP MONGODB                           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('🔹 Database da backuppare');
  console.log('   Esempi:');
  console.log('   • MongoDB locale: mongodb://localhost:27017/homebi');
  console.log('   • Con autenticazione: mongodb://user:pass@localhost:27017/homebi\n');
  SOURCE_URL = await askQuestion('Inserisci connection string: ');

  if (!SOURCE_URL) {
    console.error('❌ Connection string non può essere vuota');
    process.exit(1);
  }

  console.log('\n✅ Connection string configurata\n');
}

async function backupDatabase() {
  // Richiedi l'URL se non fornito
  await getConnectionString();

  let sourceClient;

  try {
    console.log('🔄 Connessione al database...\n');

    sourceClient = new MongoClient(SOURCE_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    console.log('✅ Connesso al database\n');

    // Crea directory di backup
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const collections = await sourceDb.listCollections().toArray();

    console.log(`📦 Backup di ${collections.length} collezioni\n`);

    let totalDocuments = 0;

    for (const collection of collections) {
      const name = collection.name;
      const col = sourceDb.collection(name);

      // Leggi tutti i documenti
      const documents = await col.find({}).toArray();

      // Salva in file JSON
      const filePath = path.join(BACKUP_DIR, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));

      console.log(`  ✓ ${name}: ${documents.length} documenti`);
      totalDocuments += documents.length;
    }

    // Salva metadata
    const metadataPath = path.join(BACKUP_DIR, 'metadata.json');
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          collections: collections.length,
          totalDocuments: totalDocuments,
        },
        null,
        2
      )
    );

    console.log('\n' + '='.repeat(50));
    console.log('✅ BACKUP COMPLETATO');
    console.log('='.repeat(50));
    console.log(`📁 Cartella: ${path.resolve(BACKUP_DIR)}`);
    console.log(`📊 Totale documenti: ${totalDocuments}`);
    console.log(`📅 Data: ${new Date().toISOString()}`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('\n❌ Errore durante il backup:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.close();
  }
}

backupDatabase();
