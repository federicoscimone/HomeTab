/**
 * Seed demo data: famiglia di 4 persone (2 genitori + 2 figli scolastici)
 * Eseguire con: node lib/seed-demo-family.js
 *
 * Scenario:
 * - Marco (padre, lavora) e Lucia (madre, lavora)
 * - Giulia (12 anni, scuola media) e Lorenzo (15 anni, liceo)
 * - Affitto, utenze, carburante, spesa settimanale, attività scolastiche
 */

import mongoose from 'mongoose';
import connectDB from './mongodb.js';
import Movement from './models/Movement.js';
import Category from './models/Category.js';

// Mese demo: maggio 2026
const DEMO_YEAR = 2026;
const DEMO_MONTH = 5;

// Giorni lavorativi (esclusi weekend)
const isWeekday = (day) => {
  const d = new Date(DEMO_YEAR, DEMO_MONTH - 1, day);
  return d.getDay() !== 0 && d.getDay() !== 6;
};

// Dati demo famiglia
const FAMILY_MOVEMENTS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // AFFITTO E UTENZE (mensili)
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-01', amount: 900, paymentMethod: 'bank_transfer', description: 'Affitto maggio', place: 'Proprietario immobile', category: 'Affitto', subcat1: 'Canone' },
  { date: '2026-05-05', amount: 78.50, paymentMethod: 'bank_transfer', description: 'Bolletta Enel (luce)', place: 'Enel', category: 'Utenze', subcat1: 'Luce' },
  { date: '2026-05-06', amount: 65.30, paymentMethod: 'bank_transfer', description: 'Bolletta A2A (gas)', place: 'A2A', category: 'Utenze', subcat1: 'Gas' },
  { date: '2026-05-05', amount: 35.99, paymentMethod: 'bank_transfer', description: 'Internet fibra', place: 'Vodafone', category: 'Utenze', subcat1: 'Internet' },
  { date: '2026-05-05', amount: 19.99, paymentMethod: 'bank_transfer', description: 'Telefono - Vodafone', place: 'Vodafone', category: 'Utenze', subcat1: 'Telefono' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPESA SETTIMANALE (giovedì pomeriggio, supermercato)
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-02', amount: 145.80, paymentMethod: 'credit_card', description: 'Spesa settimanale', place: 'Esselunga', payee: 'Esselunga', category: 'Spesa', subcat1: 'Supermercato' },
  { date: '2026-05-09', amount: 152.40, paymentMethod: 'credit_card', description: 'Spesa settimanale', place: 'Esselunga', payee: 'Esselunga', category: 'Spesa', subcat1: 'Supermercato' },
  { date: '2026-05-16', amount: 138.75, paymentMethod: 'credit_card', description: 'Spesa settimanale', place: 'Esselunga', payee: 'Esselunga', category: 'Spesa', subcat1: 'Supermercato' },
  { date: '2026-05-23', amount: 160.20, paymentMethod: 'credit_card', description: 'Spesa settimanale', place: 'Esselunga', payee: 'Esselunga', category: 'Spesa', subcat1: 'Supermercato' },
  { date: '2026-05-30', amount: 142.50, paymentMethod: 'credit_card', description: 'Spesa settimanale', place: 'Esselunga', payee: 'Esselunga', category: 'Spesa', subcat1: 'Supermercato' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARBURANTE (genitori che vanno al lavoro)
  // ═══════════════════════════════════════════════════════════════════════ato
  { date: '2026-05-02', amount: 45.00, paymentMethod: 'credit_card', description: 'Benzina - auto Marco', place: 'ENI', category: 'Carburante', subcat1: 'Benzina' },
  { date: '2026-05-08', amount: 50.00, paymentMethod: 'credit_card', description: 'Benzina - auto Marco', place: 'Q8', category: 'Carburante', subcat1: 'Benzina' },
  { date: '2026-05-14', amount: 48.00, paymentMethod: 'credit_card', description: 'Benzina - auto Marco', place: 'ENI', category: 'Carburante', subcat1: 'Benzina' },
  { date: '2026-05-21', amount: 52.00, paymentMethod: 'credit_card', description: 'Benzina - auto Marco', place: 'AGIP', category: 'Carburante', subcat1: 'Benzina' },
  { date: '2026-05-28', amount: 46.00, paymentMethod: 'credit_card', description: 'Benzina - auto Marco', place: 'Q8', category: 'Carburante', subcat1: 'Benzina' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CIBO FUORI CASA (pranzi, caffè, fast food occasionali)
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-03', amount: 8.50, paymentMethod: 'cash', description: 'Caffè mattina', place: 'Bar vicino ufficio', category: 'Cibo Pronto', subcat1: 'Bar' },
  { date: '2026-05-05', amount: 12.00, paymentMethod: 'cash', description: 'Pranzo fuori', place: 'Pizzeria centro', category: 'Cibo Pronto', subcat1: 'Pizzeria' },
  { date: '2026-05-10', amount: 18.50, paymentMethod: 'credit_card', description: 'Pranzo', place: 'Ristorante', category: 'Cibo Pronto', subcat1: 'Ristorante' },
  { date: '2026-05-12', amount: 9.50, paymentMethod: 'cash', description: 'Snack pomeridiano', place: 'Bar', category: 'Cibo Pronto', subcat1: 'Bar' },
  { date: '2026-05-15', amount: 7.50, paymentMethod: 'cash', description: 'Gelato famiglia', place: 'Gelateria', category: 'Cibo Pronto', subcat1: 'Bar' },
  { date: '2026-05-17', amount: 24.00, paymentMethod: 'cash', description: 'Hamburger per i ragazzi', place: 'Fast Food', category: 'Cibo Pronto', subcat1: 'Fast Food' },
  { date: '2026-05-22', amount: 15.00, paymentMethod: 'credit_card', description: 'Cena ristorante famiglia', place: 'Ristorante', category: 'Cibo Pronto', subcat1: 'Ristorante' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FARMACIA E SALUTE
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-04', amount: 22.50, paymentMethod: 'cash', description: 'Farmaci e vitamine', place: 'Farmacia centro', category: 'Salute', subcat1: 'Farmacia' },
  { date: '2026-05-18', amount: 35.00, paymentMethod: 'cash', description: 'Visita pediatra (Giulia)', place: 'Studi medici', category: 'Salute', subcat1: 'Medico' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ABBIGLIAMENTO E SHOPPING
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-07', amount: 85.00, paymentMethod: 'credit_card', description: 'Scarpe da ginnastica - Giulia', place: 'Foot Locker', category: 'Shopping', subcat1: 'Abbigliamento' },
  { date: '2026-05-11', amount: 60.00, paymentMethod: 'credit_card', description: 'Magliette scuola - Lorenzo', place: 'H&M', category: 'Shopping', subcat1: 'Abbigliamento' },
  { date: '2026-05-20', amount: 45.00, paymentMethod: 'credit_card', description: 'Zaino scuola nuovi', place: 'Decathlon', category: 'Shopping', subcat1: 'Sport' },
  { date: '2026-05-25', amount: 72.00, paymentMethod: 'credit_card', description: 'Divisa ginnastica Giulia', place: 'Negozio sportivo', category: 'Shopping', subcat1: 'Sport' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCUOLA E STUDIO
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-01', amount: 150.00, paymentMethod: 'bank_transfer', description: 'Retta scuola media Giulia', place: 'Scuola media privata', category: 'Studio', subcat1: 'Corsi' },
  { date: '2026-05-06', amount: 35.00, paymentMethod: 'cash', description: 'Lezioni di inglese - Giulia', place: 'Centro linguistico', category: 'Studio', subcat1: 'Corsi' },
  { date: '2026-05-13', amount: 28.00, paymentMethod: 'cash', description: 'Libro di matematica - Lorenzo', place: 'Libreria', category: 'Studio', subcat1: 'Libri' },
  { date: '2026-05-19', amount: 12.99, paymentMethod: 'credit_card', description: 'Adobe Creative Cloud student', place: 'Adobe', category: 'Studio', subcat1: 'Software' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTIVITÀ EXTRASCOLASTICHE E INTRATTENIMENTO
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-03', amount: 40.00, paymentMethod: 'cash', description: 'Iscrizione palestra - Giulia', place: 'Palestra Centro', category: 'Intrattenimento', subcat1: 'Abbonamenti' },
  { date: '2026-05-10', amount: 30.00, paymentMethod: 'cash', description: 'Lezioni nuoto - Lorenzo', place: 'Piscina comunale', category: 'Intrattenimento', subcat1: 'Attività' },
  { date: '2026-05-14', amount: 28.00, paymentMethod: 'credit_card', description: 'Ingresso cinema famiglia', place: 'UCI Cinema', category: 'Intrattenimento', subcat1: 'Cinema' },
  { date: '2026-05-24', amount: 15.99, paymentMethod: 'credit_card', description: 'Abbonamento Disney+ (famiglia)', place: 'Disney', category: 'Intrattenimento', subcat1: 'Abbonamenti' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRASPORTI PUBBLICI
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-02', amount: 45.00, paymentMethod: 'cash', description: 'Abbonamento mensile bus - Lorenzo', place: 'ATM', category: 'Trasporti', subcat1: 'Bus' },
  { date: '2026-05-02', amount: 35.00, paymentMethod: 'cash', description: 'Carnet biglietti metro - Marco', place: 'ATM', category: 'Trasporti', subcat1: 'Bus' },
  { date: '2026-05-27', amount: 55.00, paymentMethod: 'credit_card', description: 'Treno gita scolastica (andata ritorno)', place: 'Trenitalia', category: 'Trasporti', subcat1: 'Treno' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMALI DOMESTICI
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-09', amount: 22.00, paymentMethod: 'credit_card', description: 'Cibo gatto (mese)', place: 'Pet store', category: 'Animali', subcat1: 'Cibo' },
  { date: '2026-05-20', amount: 55.00, paymentMethod: 'cash', description: 'Toelettatura cane', place: 'Toelettatura pet', category: 'Animali', subcat1: 'Toelettatura' },

  // ═══════════════════════════════════════════════════════════════════════════
  // REGALI E VARIE
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-12', amount: 25.00, paymentMethod: 'cash', description: 'Compleanno collega Marco', place: 'Regalo', category: 'Regali', subcat1: null },
  { date: '2026-05-26', amount: 18.00, paymentMethod: 'cash', description: 'Fiori festa della mamma', place: 'Fioraio', category: 'Altro', subcat1: null },

  // ═══════════════════════════════════════════════════════════════════════════
  // MANUTENZIONE E CASA
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-08', amount: 89.00, paymentMethod: 'credit_card', description: 'Riparazione lavastoviglie', place: 'Idraulico', category: 'Affitto', subcat1: 'Manutenzione' },
  { date: '2026-05-29', amount: 34.50, paymentMethod: 'cash', description: 'Vernice e pennelli', place: 'Negozio ferramenta', category: 'Affitto', subcat1: 'Manutenzione' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTRATE (stipendi mese precedente, una volta al mese)
  // ═══════════════════════════════════════════════════════════════════════════
  { date: '2026-05-01', amount: 2200.00, paymentMethod: 'bank_transfer', description: 'Stipendio aprile - Marco', place: 'Azienda', type: 'income', category: 'Stipendio', subcat1: null },
  { date: '2026-05-01', amount: 1850.00, paymentMethod: 'bank_transfer', description: 'Stipendio aprile - Lucia', place: 'Ospedale', type: 'income', category: 'Stipendio', subcat1: null },
  { date: '2026-05-15', amount: 250.00, paymentMethod: 'bank_transfer', description: 'Rimborso spese viaggio', place: 'Azienda', type: 'income', category: 'Altro', subcat1: null },
];

async function seedDemoFamily() {
  try {
    await connectDB();
    console.log('✓ Connesso a MongoDB');

    // Verifica se esistono già movimenti
    const existingCount = await Movement.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠ Già presenti ${existingCount} movimenti. Saltato seed demo.`);
      process.exit(0);
    }

    // Mappa categorie per nome
    const categories = await Category.find();
    const categoryMap = {};
    categories.forEach(cat => {
      if (cat.level === 1) {
        categoryMap[cat.name] = cat._id;
      } else if (cat.level === 2) {
        categoryMap[cat.name] = cat._id;
      }
    });

    console.log(`✓ Trovate ${categories.length} categorie`);

    // Trasforma dati movimenti con reference agli ObjectId
    const movements = FAMILY_MOVEMENTS.map(m => {
      const categoryObj = categories.find(c => c.name === m.category);
      const subcatObj = m.subcat1 ? categories.find(c => c.name === m.subcat1) : null;

      return {
        amount: m.amount,
        paymentMethod: m.paymentMethod,
        paymentGroup: ['bank_transfer', 'credit_card', 'debit_card'].includes(m.paymentMethod)
          ? 'traditional'
          : 'alternative',
        date: m.date,
        time: '14:30',
        description: m.description,
        place: m.place,
        payee: m.payee || '',
        notes: '',
        categoryId: categoryObj ? categoryObj._id : null,
        subCategory1Id: subcatObj ? subcatObj._id : null,
        subCategory2Id: null,
        type: m.type || 'expense',
        source: 'manual',
        importBatchId: null,
        excludeFromAnalysis: false,
      };
    }).filter(m => m.categoryId); // Filtra quelli senza categoria mappata

    // Inserisci movimenti
    const result = await Movement.insertMany(movements);
    console.log(`✓ Inseriti ${result.length} movimenti demo`);

    console.log(`\n📊 Riepilogo dati creati:`);
    console.log(`   Periodo: maggio 2026`);
    console.log(`   Famiglia: 4 persone (2 genitori, 2 figli)`);
    console.log(`   Movimenti: ${result.length}`);
    console.log(`   Totale spese: €${movements
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0)
      .toFixed(2)}`);
    console.log(`   Totale entrate: €${movements
      .filter(m => m.type === 'income')
      .reduce((sum, m) => sum + m.amount, 0)
      .toFixed(2)}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

seedDemoFamily();
