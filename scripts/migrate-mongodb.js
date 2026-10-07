#!/usr/bin/env node

/**
 * Script di migrazione MongoDB
 * Copia i dati da un database MongoDB a un altro (es. da locale a Atlas in produzione)
 * 
 * Uso:
 *   node scripts/migrate-mongodb.js
 *   Oppure: node scripts/migrate-mongodb.js --source <URL> --destination <URL> [--clear]
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
const CLEAR_DEST = argMap.clear === true;

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
  console.log('║   MIGRAZIONE MONGODB - IMPOSTAZIONI         ║');
  console.log('╚════════════════════════════════════════════╝\n');

  if (!SOURCE_URL) {
    console.log('🔹 Database di ORIGINE (sorgente)');
    console.log('   Esempi:');
    console.log('   • MongoDB locale: mongodb://localhost:27017/hometab');
    console.log('   • Con autenticazione: mongodb://user:pass@localhost:27017/hometab\n');
    SOURCE_URL = await askQuestion('Inserisci connection string di origine: ');

    if (!SOURCE_URL) {
      console.error('❌ Connection string di origine non può essere vuota');
      process.exit(1);
    }
  }

  if (!DEST_URL) {
    console.log('\n🔹 Database di DESTINAZIONE (target)');
    console.log('   Esempi:');
    console.log('   • MongoDB Atlas: mongodb+srv://user:password@cluster.mongodb.net/hometab');
    console.log('   • MongoDB local: mongodb://localhost:27018/hometab\n');
    DEST_URL = await askQuestion('Inserisci connection string di destinazione: ');

    if (!DEST_URL) {
      console.error('❌ Connection string di destinazione non può essere vuota');
      process.exit(1);
    }
  }

  console.log('\n✅ Connection strings configurate\n');
}

/**
 * Copia i dati tra database
 */
async function migrateData() {
  // Richiedi gli URL se non forniti
  await getConnectionStrings();
  let sourceClient;
  let destClient;

  try {
    console.log('🔄 Connessione ai database...\n');

    // Connetti al database di origine
    sourceClient = new MongoClient(SOURCE_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    console.log('✅ Connesso al database di origine');

    // Connetti al database di destinazione
    destClient = new MongoClient(DEST_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    await destClient.connect();
    const destDb = destClient.db();
    console.log('✅ Connesso al database di destinazione\n');

    // Get list of collections
    const sourceCollections = await sourceDb
      .listCollections()
      .toArray();
    console.log(
      `📦 Found ${sourceCollections.length} collezioni nel database di origine\n`
    );

    // Se non si fornisce --clear da CLI, chiedi all'utente
    let shouldClear = CLEAR_DEST;
    if (!shouldClear) {
      const clearResponse = await askQuestion(
        'Cancellare TUTTI i dati nel database di destinazione prima della migrazione? (sì/no): '
      );
      shouldClear = clearResponse.toLowerCase() === 'sì' || clearResponse.toLowerCase() === 'si';
    }

    if (shouldClear) {
      console.log('\n⚠️  AVVISO: Cancellazione database di destinazione');
      console.log('Questo cancellerà TUTTI i dati nel database di destinazione!\n');

      const confirm = await askQuestion(
        'Digita "sì" per confermare la cancellazione: '
      );

      if (confirm.toLowerCase() !== 'sì' && confirm.toLowerCase() !== 'si') {
        console.log('❌ Migrazione annullata');
        process.exit(0);
      }

      console.log('🗑️  Cancellazione collezioni nel database di destinazione...\n');
      for (const collection of sourceCollections) {
        const collName = collection.name;
        try {
          await destDb.collection(collName).deleteMany({});
          console.log(`  ✓ Cancellato: ${collName}`);
        } catch (err) {
          console.log(`  ✗ Errore nel cancellare ${collName}: ${err.message}`);
        }
      }
      console.log();
    }
    console.log('📥 Inizio copia dei dati...\n');

    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      collections: [],
    };

    for (const collectionInfo of sourceCollections) {
      const collectionName = collectionInfo.name;

      try {
        const sourceCollection = sourceDb.collection(collectionName);
        const destCollection = destDb.collection(collectionName);

        // Conta i documenti nella origine
        const count = await sourceCollection.countDocuments();

        if (count === 0) {
          console.log(`  ⊘ ${collectionName}: nessun documento`);
          continue;
        }

        // Copia i documenti in batch
        const batchSize = 1000;
        let copied = 0;

        const cursor = sourceCollection.find();

        while (await cursor.hasNext()) {
          const batch = [];

          for (let i = 0; i < batchSize && (await cursor.hasNext()); i++) {
            batch.push(await cursor.next());
          }

          if (batch.length > 0) {
            try {
              await destCollection.insertMany(batch, { ordered: false });
              copied += batch.length;
            } catch (err) {
              // Se gli ID già esistono, ignora l'errore (duplicati)
              if (err.code === 11000) {
                // Duplicate key error - try inserting without _id to see how many are new
                const newDocs = batch.filter(
                  (doc) => !doc._id
                );
                if (newDocs.length > 0) {
                  await destCollection.insertMany(newDocs, { ordered: false });
                  copied += newDocs.length;
                }
              } else {
                throw err;
              }
            }
          }
        }

        console.log(
          `  ✓ ${collectionName}: ${copied} documenti copiati`
        );
        stats.successful++;
        stats.total += copied;
        stats.collections.push({
          name: collectionName,
          count: copied,
        });
      } catch (err) {
        console.log(`  ✗ ${collectionName}: ${err.message}`);
        stats.failed++;
      }
    }

    // Report finale
    console.log('\n' + '='.repeat(50));
    console.log('📊 REPORT DELLA MIGRAZIONE');
    console.log('='.repeat(50));
    console.log(`Collezioni copiate: ${stats.successful}`);
    console.log(`Collezioni fallite: ${stats.failed}`);
    console.log(`Totale documenti: ${stats.total}`);
    console.log('\nDettagli:');
    for (const col of stats.collections) {
      console.log(`  • ${col.name}: ${col.count} documenti`);
    }
    console.log('='.repeat(50));

    if (stats.failed === 0) {
      console.log('\n✅ Migrazione completata con successo!\n');
    } else {
      console.log(
        '\n⚠️  Migrazione completata con alcuni errori\n'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (destClient) await destClient.close();
  }
}

// Esegui la migrazione
migrateData();
