#!/usr/bin/env node

/**
 * Script principale di migrazione MongoDB
 * Coordina backup locale → migrazione → verifica
 * 
 * Uso:
 *   node scripts/migrate-all.js --source <SOURCE_URL> --destination <DEST_URL> [--skip-backup] [--skip-verify]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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

const SOURCE_URL = argMap.source;
const DEST_URL = argMap.destination;
const SKIP_BACKUP = argMap['skip-backup'] === true;
const SKIP_VERIFY = argMap['skip-verify'] === true;

if (!SOURCE_URL || !DEST_URL) {
  console.error(`
❌ Parametri mancanti

Uso:
  node scripts/migrate-all.js --source <SOURCE_URL> --destination <DEST_URL> [--skip-backup] [--skip-verify]

Esempio:
  node scripts/migrate-all.js \\
    --source "mongodb://localhost:27017/hometab" \\
    --destination "mongodb+srv://user:pass@cluster.mongodb.net/hometab"

Opzioni:
  --skip-backup   Salta il backup locale
  --skip-verify   Salta la verifica finale
  `);
  process.exit(1);
}

function runScript(scriptName, args) {
  return new Promise((resolve, reject) => {
    const process = spawn('node', [path.join(__dirname, scriptName), ...args], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    process.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

async function runMigration() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   MIGRAZIONE MONGODB - PROCESSO COMPLETO   ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Step 1: Backup
    if (!SKIP_BACKUP) {
      console.log('📝 STEP 1: Backup del database locale\n');
      console.log('='.repeat(50));
      await runScript('backup-mongodb.js', [
        '--source',
        SOURCE_URL,
      ]);
      console.log('='.repeat(50) + '\n');
    } else {
      console.log('⏭️  STEP 1: Backup SKIPPATO\n');
    }

    // Step 2: Migrazione
    console.log('📤 STEP 2: Migrazione dei dati\n');
    console.log('='.repeat(50));
    await runScript('migrate-mongodb.js', [
      '--source',
      SOURCE_URL,
      '--destination',
      DEST_URL,
    ]);
    console.log('='.repeat(50) + '\n');

    // Step 3: Verifica
    if (!SKIP_VERIFY) {
      console.log('🔍 STEP 3: Verifica migrazione\n');
      console.log('='.repeat(50));
      await runScript('verify-migration.js', [
        '--source',
        SOURCE_URL,
        '--destination',
        DEST_URL,
      ]);
      console.log('='.repeat(50) + '\n');
    } else {
      console.log('⏭️  STEP 3: Verifica SKIPPATA\n');
    }

    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ MIGRAZIONE COMPLETATA CON SUCCESSO ║');
    console.log('╚════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n╔════════════════════════════════════════╗');
    console.error('║      ❌ ERRORE DURANTE LA MIGRAZIONE    ║');
    console.error('╚════════════════════════════════════════╝\n');
    console.error(error.message);
    process.exit(1);
  }
}

runMigration();
