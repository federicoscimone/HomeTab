#!/usr/bin/env node

/**
 * Script di verifica migrazione MongoDB
 * Confronta il numero di documenti tra due database
 * 
 * Uso:
 *   node scripts/verify-migration.js
 *   Oppure: node scripts/verify-migration.js --source <SOURCE_URL> --destination <DEST_URL>
 */

import { MongoClient } from 'mongodb';
import readline from 'readline';

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
let DEST_URL = argMap.destination;

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
 * Richiede gli URL se non forniti
 */
async function getConnectionStrings() {
  if (SOURCE_URL && DEST_URL) {
    return; // Gli URL sono già stati forniti come argomenti
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   VERIFICA MIGRAZIONE MONGODB              ║');
  console.log('╚════════════════════════════════════════════╝\n');

  if (!SOURCE_URL) {
    console.log('🔹 Database di ORIGINE');
    console.log('   Esempi: mongodb://localhost:27017/hometab\n');
    SOURCE_URL = await askQuestion('Inserisci connection string di origine: ');

    if (!SOURCE_URL) {
      console.error('❌ Connection string di origine non può essere vuota');
      process.exit(1);
    }
  }

  if (!DEST_URL) {
    console.log('\n🔹 Database di DESTINAZIONE');
    console.log('   Esempi: mongodb+srv://user:pass@cluster.mongodb.net/hometab\n');
    DEST_URL = await askQuestion('Inserisci connection string di destinazione: ');

    if (!DEST_URL) {
      console.error('❌ Connection string di destinazione non può essere vuota');
      process.exit(1);
    }
  }

  console.log('\n✅ Connection strings configurate\n');
}

async function verifyMigration() {
  // Richiedi gli URL se non forniti
  await getConnectionStrings();

  let sourceClient;
  let destClient;

  try {
    console.log('🔄 Connessione ai database...\n');

    sourceClient = new MongoClient(SOURCE_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    console.log('✅ Connesso al database di origine');

    destClient = new MongoClient(DEST_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    await destClient.connect();
    const destDb = destClient.db();
    console.log('✅ Connesso al database di destinazione\n');

    const sourceCollections = await sourceDb
      .listCollections()
      .toArray();

    console.log('📊 VERIFICA MIGRAZIONE');
    console.log('='.repeat(60));
    console.log(
      `${'Collezione'.padEnd(30)} ${'Origine'.padEnd(15)} ${'Destinazione'.padEnd(15)} Status`
    );
    console.log('='.repeat(60));

    let totalMatch = 0;
    let totalMismatch = 0;

    for (const collection of sourceCollections) {
      const name = collection.name;
      const sourceCount = await sourceDb
        .collection(name)
        .countDocuments();
      const destCount = await destDb
        .collection(name)
        .countDocuments();

      const match = sourceCount === destCount;
      const status = match ? '✅ OK' : '❌ MISMATCH';

      console.log(
        `${name.padEnd(30)} ${sourceCount.toString().padEnd(15)} ${destCount.toString().padEnd(15)} ${status}`
      );

      if (match) {
        totalMatch++;
      } else {
        totalMismatch++;
      }
    }

    console.log('='.repeat(60));

    if (totalMismatch === 0) {
      console.log(
        `\n✅ Verifica completata: ${totalMatch}/${sourceCollections.length} collezioni corrette!\n`
      );
    } else {
      console.log(
        `\n⚠️  Verifica completata: ${totalMismatch} discrepanze trovate!\n`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Errore durante la verifica:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (destClient) await destClient.close();
  }
}

verifyMigration();
