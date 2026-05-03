/**
 * Seed demo data: famiglia di 4 persone per 12 MESI
 * Uso: node lib/seed-demo-family-12months.js [anno]
 *
 * Variazioni realistiche tra anni:
 *   2025: stipendi base, affitto invariato, vacanza solo mare
 *   2026: aumento stipendi (+7%), bollette più care (+8%), vacanza mare+montagna
 */

import mongoose from 'mongoose';
import Movement from './models/Movement.js';
import Category from './models/Category.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/homebi_demo';

const YEAR = parseInt(process.argv[2]) || 2026;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAZIONE PER ANNO — cambia qui i valori anno per anno
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  2025: {
    stipendioMarco: 2050,
    stipendioLucia: 1720,
    affitto: 900,
    internet: 35.99,
    telefono: 19.99,
    luceMult: 0.90,  // bollette un po' più basse
    gasMult: 0.90,
    spesaMult: 0.93, // spesa lievemente più economica
    carburanteMult: 0.93,
    vacanzaMare: { settimane: 2, alloggio: [130, 155] },   // solo mare, più economico
    vacanzaMontagna: null,                                  // nessuna vacanza montagna
    nataleBudget: { giulia: 95, lorenzo: 110, colleghi: 65 },
    rimborsoAnnuo: null,
  },
  2026: {
    stipendioMarco: 2200,
    stipendioLucia: 1850,
    affitto: 900,
    internet: 35.99,
    telefono: 19.99,
    luceMult: 1.00,
    gasMult: 1.00,
    spesaMult: 1.00,
    carburanteMult: 1.00,
    vacanzaMare: { settimane: 2, alloggio: [150, 180] },
    vacanzaMontagna: { alloggio: 150 },
    nataleBudget: { giulia: 120, lorenzo: 140, colleghi: 85 },
    rimborsoAnnuo: { mese: 5, importo: 250 },
  },
};

const C = CONFIG[YEAR] ?? CONFIG[2026];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const m = (date, amount, paymentMethod, description, place, category, subcat1, type = 'expense') => ({
  date, amount: Math.round(amount * 100) / 100,
  paymentMethod, description, place, payee: place, category, subcat1, type,
});

const d = (month, day) =>
  `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// ─────────────────────────────────────────────────────────────────────────────
// GENERATORE MOVIMENTI
// ─────────────────────────────────────────────────────────────────────────────

function generateYearlyMovements() {
  const movements = [];

  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(YEAR, month, 0).getDate();

    // ── Fissi mensili ─────────────────────────────────────────────────────────

    movements.push(m(d(month, 1), C.affitto, 'bank_transfer', 'Affitto mensile', 'Proprietario', 'Affitto', 'Canone'));
    movements.push(m(d(month, 5), C.internet, 'bank_transfer', 'Internet fibra', 'Vodafone', 'Utenze', 'Internet'));
    movements.push(m(d(month, 5), C.telefono, 'bank_transfer', 'Telefono', 'Vodafone', 'Utenze', 'Telefono'));

    // Luce (stagionale)
    let luce = 78.50;
    if (month <= 3) luce = 95;
    else if (month >= 6 && month <= 9) luce = 110;
    else if (month >= 11) luce = 100;
    movements.push(m(d(month, 5), luce * C.luceMult, 'bank_transfer', 'Bolletta Enel', 'Enel', 'Utenze', 'Luce'));

    // Gas (stagionale)
    let gas = 65;
    if (month <= 4) gas = 120;
    else if (month >= 6 && month <= 9) gas = 15;
    else if (month >= 10) gas = 85;
    movements.push(m(d(month, 6), gas * C.gasMult, 'bank_transfer', 'Bolletta A2A (gas)', 'A2A', 'Utenze', 'Gas'));

    // Stipendi
    movements.push(m(d(month, 1), C.stipendioMarco, 'bank_transfer', 'Stipendio - Marco', 'Azienda', 'Stipendio', null, 'income'));
    movements.push(m(d(month, 1), C.stipendioLucia, 'bank_transfer', 'Stipendio - Lucia', 'Ospedale', 'Stipendio', null, 'income'));

    // Trasporti pubblici
    movements.push(m(d(month, 2), 45, 'cash', 'Abbonamento bus - Lorenzo', 'ATM', 'Trasporti', 'Bus'));
    movements.push(m(d(month, 2), 35, 'cash', 'Carnet bus - Marco', 'ATM', 'Trasporti', 'Bus'));

    // ── Spesa settimanale ─────────────────────────────────────────────────────

    for (let day = 2; day <= daysInMonth; day += 7) {
      const amt = (130 + Math.random() * 35) * C.spesaMult;
      movements.push(m(d(month, day), amt, 'credit_card', 'Spesa settimanale', 'Esselunga', 'Spesa', 'Supermercato'));
    }

    // ── Carburante ────────────────────────────────────────────────────────────

    for (let day = 2; day <= daysInMonth; day += 5) {
      const amt = (44 + Math.random() * 12) * C.carburanteMult;
      const stazione = ['ENI', 'Q8', 'AGIP'][Math.floor(Math.random() * 3)];
      movements.push(m(d(month, day), amt, 'credit_card', 'Benzina - auto Marco', stazione, 'Carburante', 'Benzina'));
    }

    // ── Cibo fuori ────────────────────────────────────────────────────────────

    const foodPlaces   = ['Bar', 'Pizzeria', 'Ristorante', 'Fast Food'];
    const foodSubcats  = ['Bar', 'Pizzeria', 'Ristorante', 'Fast Food'];
    for (let day = 3; day <= daysInMonth; day += 5) {
      const idx = Math.floor(Math.random() * foodPlaces.length);
      movements.push(m(
        d(month, day),
        8 + Math.random() * 22,
        Math.random() > 0.5 ? 'cash' : 'credit_card',
        'Pasto fuori / snack',
        foodPlaces[idx], 'Cibo Pronto', foodSubcats[idx]
      ));
    }

    // ── Abbonamenti streaming (trimestrali) ───────────────────────────────────

    if ([1, 4, 7, 10].includes(month)) {
      movements.push(m(d(month, 10), 12.99, 'credit_card', 'Spotify Premium', 'Spotify', 'Intrattenimento', 'Abbonamenti'));
      movements.push(m(d(month, 11), 15.99, 'credit_card', 'Netflix', 'Netflix', 'Intrattenimento', 'Abbonamenti'));
    }
    if ([1, 6].includes(month)) {
      movements.push(m(d(month, 15), 15.99, 'credit_card', 'Abbonamento Disney+', 'Disney', 'Intrattenimento', 'Abbonamenti'));
    }

    // ── Mensili irregolari ────────────────────────────────────────────────────

    if ([2, 6, 11].includes(month)) {
      movements.push(m(d(month, 12), 25 + Math.random() * 30, 'cash', 'Farmacia', 'Farmacia', 'Salute', 'Farmacia'));
    }
    if ([3, 9].includes(month)) {
      movements.push(m(d(month, 15), 40 + Math.random() * 40, 'cash', 'Visita medica', 'Studi medici', 'Salute', 'Medico'));
    }
    if ([4, 7, 10].includes(month)) {
      const negozio = ['H&M', 'Foot Locker', 'Zara'][Math.floor(Math.random() * 3)];
      movements.push(m(d(month, 8), 60 + Math.random() * 60, 'credit_card', 'Abbigliamento stagionale', negozio, 'Shopping', 'Abbigliamento'));
    }
    if ([2, 5, 8, 11].includes(month)) {
      movements.push(m(d(month, 14), 22 + Math.random() * 35, 'credit_card', 'Cibo animali + accessori', 'Pet store', 'Animali', 'Cibo'));
    }
    if ([3, 6, 9, 12].includes(month)) {
      movements.push(m(d(month, 18), 55, 'cash', 'Toelettatura cane', 'Toelettatura', 'Animali', 'Toelettatura'));
    }
    if (month % 2 === 0) {
      movements.push(m(d(month, 14), 28 + Math.random() * 15, 'credit_card', 'Cinema famiglia', 'UCI Cinema', 'Intrattenimento', 'Cinema'));
    }

    // ── GENNAIO ───────────────────────────────────────────────────────────────
    if (month === 1) {
      movements.push(m(d(1,  8), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
      movements.push(m(d(1, 12),  45, 'cash', 'Zaino + penne scuola', 'Cartoleria', 'Shopping', 'Sport'));
      movements.push(m(d(1, 15),  30, 'cash', 'Regali capodanno', 'Negozio', 'Regali', null));
    }
    // ── FEBBRAIO ──────────────────────────────────────────────────────────────
    if (month === 2) {
      movements.push(m(d(2, 15), 25, 'cash', 'Costumi Carnevale', 'Negozio', 'Shopping', 'Abbigliamento'));
      movements.push(m(d(2, 18), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    // ── MARZO ─────────────────────────────────────────────────────────────────
    if (month === 3) {
      movements.push(m(d(3, 20), 35, 'cash', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    // ── APRILE ────────────────────────────────────────────────────────────────
    if (month === 4) {
      movements.push(m(d(4, 10), 40, 'cash', 'Cibo pasquale', 'Panetteria', 'Spesa', 'Panetteria'));
      movements.push(m(d(4, 12), 25, 'cash', 'Regalo Pasqua', 'Negozio', 'Regali', null));
      movements.push(m(d(4, 20), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    // ── MAGGIO ────────────────────────────────────────────────────────────────
    if (month === 5) {
      movements.push(m(d(5, 10), 18, 'cash', 'Fiori festa della mamma', 'Fioraio', 'Altro', null));
      movements.push(m(d(5, 15), 40, 'cash', 'Iscrizione palestra - Giulia', 'Palestra', 'Intrattenimento', 'Abbonamenti'));
      movements.push(m(d(5, 20), 30, 'cash', 'Lezioni nuoto - Lorenzo', 'Piscina', 'Intrattenimento', 'Attività'));
      movements.push(m(d(5, 25), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
      if (C.rimborsoAnnuo) {
        movements.push(m(d(5, 15), C.rimborsoAnnuo.importo, 'bank_transfer', 'Rimborso spese viaggio', 'Azienda', 'Stipendio', null, 'income'));
      }
    }
    // ── GIUGNO ────────────────────────────────────────────────────────────────
    if (month === 6) {
      movements.push(m(d(6, 10),  55, 'credit_card', 'Gita scolastica Giulia', 'Trenitalia', 'Trasporti', 'Treno'));
      movements.push(m(d(6, 12),  60, 'credit_card', 'Gita scolastica Lorenzo', 'Trenitalia', 'Trasporti', 'Treno'));
      movements.push(m(d(6, 20), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
    }
    // ── LUGLIO — VACANZE MARE ─────────────────────────────────────────────────
    if (month === 7) {
      const [h1, h2] = C.vacanzaMare.alloggio;
      movements.push(m(d(7,  1), h1, 'bank_transfer', 'Albergo settimana 1 - Mare', 'Hotel', 'Vacanze', 'Alloggio'));
      movements.push(m(d(7,  8), h2, 'bank_transfer', 'Albergo settimana 2 - Mare', 'Hotel', 'Vacanze', 'Alloggio'));
      movements.push(m(d(7,  2),  65, 'credit_card', 'Benzina trasferta vacanza', 'ENI', 'Carburante', 'Benzina'));
      movements.push(m(d(7,  5),  45, 'cash', 'Spiaggia - stabilimento', 'Spiaggia', 'Vacanze', 'Attività'));
      movements.push(m(d(7, 10), 120, 'cash', 'Cena ristorante pesce', 'Ristorante', 'Vacanze', 'Vitto'));
      movements.push(m(d(7, 15),  80, 'cash', 'Escursioni e attività', 'Agenzia', 'Vacanze', 'Attività'));
      movements.push(m(d(7,  3),  95, 'credit_card', 'Spesa vacanza', 'Supermarket', 'Spesa', 'Supermercato'));
      movements.push(m(d(7, 10),  88, 'credit_card', 'Spesa vacanza', 'Supermarket', 'Spesa', 'Supermercato'));
    }
    // ── AGOSTO — VACANZE MONTAGNA (solo 2026) ────────────────────────────────
    if (month === 8) {
      if (C.vacanzaMontagna) {
        movements.push(m(d(8,  5), C.vacanzaMontagna.alloggio, 'bank_transfer', 'Albergo settimana - Montagna', 'Hotel', 'Vacanze', 'Alloggio'));
        movements.push(m(d(8, 12),  45, 'cash', 'Cena ristorante montagna', 'Rifugio', 'Vacanze', 'Vitto'));
        movements.push(m(d(8, 18),  35, 'cash', 'Escursione guidata', 'Guide', 'Vacanze', 'Attività'));
      }
      movements.push(m(d(8, 25), 92, 'credit_card', 'Spesa vacanza', 'Supermarket', 'Spesa', 'Supermercato'));
    }
    // ── SETTEMBRE — RITORNO A SCUOLA ─────────────────────────────────────────
    if (month === 9) {
      movements.push(m(d(9,  1), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
      movements.push(m(d(9,  5), 120, 'credit_card', 'Libri scolastici Giulia', 'Libreria', 'Studio', 'Libri'));
      movements.push(m(d(9,  6),  95, 'credit_card', 'Libri scolastici Lorenzo', 'Libreria', 'Studio', 'Libri'));
      movements.push(m(d(9, 10),  75, 'cash', 'Zaino + astuccio nuovi', 'Cartoleria', 'Shopping', 'Sport'));
      movements.push(m(d(9, 12),  45, 'cash', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
      movements.push(m(d(9, 20),  35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    // ── OTTOBRE ───────────────────────────────────────────────────────────────
    if (month === 10) {
      movements.push(m(d(10, 15), 180, 'credit_card', 'Revisione auto + tagliando', 'Officina', 'Affitto', 'Manutenzione'));
      movements.push(m(d(10, 20),  35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    // ── NOVEMBRE ──────────────────────────────────────────────────────────────
    if (month === 11) {
      movements.push(m(d(11, 10),  75, 'credit_card', 'Decorazioni natalizie', 'Negozio', 'Altro', null));
      movements.push(m(d(11, 15), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
      movements.push(m(d(11, 20),  35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    // ── DICEMBRE — NATALE ─────────────────────────────────────────────────────
    if (month === 12) {
      movements.push(m(d(12,  1), C.nataleBudget.giulia,   'credit_card', 'Regalo per Giulia - Natale',   'Negozio',     'Regali',    null));
      movements.push(m(d(12,  2), C.nataleBudget.lorenzo,  'credit_card', 'Regalo per Lorenzo - Natale',  'Negozio',     'Regali',    null));
      movements.push(m(d(12,  3), C.nataleBudget.colleghi, 'cash',        'Regali colleghi - Natale',     'Negozio',     'Regali',    null));
      movements.push(m(d(12, 15),  75, 'credit_card', 'Panettone e dolci natalizi', 'Pasticceria',  'Spesa',         'Panetteria'));
      movements.push(m(d(12, 18), 120, 'credit_card', 'Cibo per cena Natale',       'Supermercato', 'Spesa',         'Supermercato'));
      movements.push(m(d(12, 20),  95, 'cash',        'Cena fuori capodanno',        'Ristorante',   'Cibo Pronto',   'Ristorante'));
      movements.push(m(d(12, 10),  55, 'cash',        'Biglietti auguri + carta',   'Cartoleria',   'Altro',         null));
    }
  }

  return movements;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  try {
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log(`✓ Connesso a MongoDB`);

    // Blocca solo se esistono già movimenti per questo anno
    const existingCount = await Movement.countDocuments({ date: { $regex: `^${YEAR}-` } });
    if (existingCount > 0) {
      console.log(`⚠ Già presenti ${existingCount} movimenti per ${YEAR}. Saltato.`);
      process.exit(0);
    }

    const categories = await Category.find();
    console.log(`✓ Trovate ${categories.length} categorie`);

    const rawMovements = generateYearlyMovements();
    console.log(`✓ Generati ${rawMovements.length} movimenti grezzi per ${YEAR}`);

    const movements = rawMovements.map(mv => {
      const cat  = categories.find(c => c.name === mv.category);
      const sub1 = mv.subcat1 ? categories.find(c => c.name === mv.subcat1) : null;
      return {
        amount:               mv.amount,
        paymentMethod:        mv.paymentMethod,
        paymentGroup:         ['bank_transfer', 'credit_card', 'debit_card'].includes(mv.paymentMethod) ? 'traditional' : 'alternative',
        date:                 mv.date,
        time:                 '14:30',
        description:          mv.description,
        place:                mv.place,
        payee:                mv.payee || '',
        notes:                '',
        categoryId:           cat  ? cat._id  : null,
        subCategory1Id:       sub1 ? sub1._id : null,
        subCategory2Id:       null,
        type:                 mv.type,
        source:               'manual',
        importBatchId:        null,
        excludeFromAnalysis:  false,
      };
    }).filter(mv => mv.categoryId);

    const result = await Movement.insertMany(movements);

    const expenses = result.filter(mv => mv.type === 'expense');
    const incomes  = result.filter(mv => mv.type === 'income');
    const totExp   = expenses.reduce((s, mv) => s + mv.amount, 0);
    const totInc   = incomes.reduce((s, mv)  => s + mv.amount, 0);

    console.log(`✓ Inseriti ${result.length} movimenti`);
    console.log(`\n📊 RIEPILOGO ${YEAR}:`);
    console.log(`   Movimenti: ${result.length}  (spese: ${expenses.length}, entrate: ${incomes.length})`);
    console.log(`   Totale spese:   €${totExp.toFixed(2)}   (media/mese: €${(totExp / 12).toFixed(2)})`);
    console.log(`   Totale entrate: €${totInc.toFixed(2)}   (media/mese: €${(totInc / 12).toFixed(2)})`);
    console.log(`   Bilancio:       €${(totInc - totExp).toFixed(2)}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

run();
