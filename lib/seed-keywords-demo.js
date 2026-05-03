/**
 * Keyword mapping extended: aggiungi keyword per i dati demo
 * Eseguire con: node lib/seed-keywords-demo.js
 */

import mongoose from 'mongoose';
import Category from './models/Category.js';
import KeywordMapping from './models/KeywordMapping.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/homebi_demo';

// Keyword aggiuntive per i dati demo
const KEYWORDS_EXTENDED = [
  // Supermercati
  { keyword: 'esselunga', category: 'Spesa', sub1: 'Supermercato', priority: 15 },
  { keyword: 'coop', category: 'Spesa', sub1: 'Supermercato', priority: 15 },
  { keyword: 'lidl', category: 'Spesa', sub1: 'Supermercato', priority: 15 },

  // Carburante
  { keyword: 'eni', category: 'Carburante', sub1: 'Benzina', priority: 15 },
  { keyword: 'q8', category: 'Carburante', sub1: 'Benzina', priority: 15 },
  { keyword: 'agip', category: 'Carburante', sub1: 'Benzina', priority: 15 },

  // Utenze
  { keyword: 'enel', category: 'Utenze', sub1: 'Luce', priority: 15 },
  { keyword: 'a2a', category: 'Utenze', sub1: 'Gas', priority: 15 },
  { keyword: 'vodafone', category: 'Utenze', sub1: 'Telefono', priority: 15 },

  // Cibo fuori
  { keyword: 'pizzeria', category: 'Cibo Pronto', sub1: 'Pizzeria', priority: 12 },
  { keyword: 'ristorante', category: 'Cibo Pronto', sub1: 'Ristorante', priority: 12 },
  { keyword: 'gelateria', category: 'Cibo Pronto', sub1: 'Bar', priority: 10 },
  { keyword: 'bar', category: 'Cibo Pronto', sub1: 'Bar', priority: 10 },
  { keyword: 'fast food', category: 'Cibo Pronto', sub1: 'Fast Food', priority: 12 },

  // Farmacia
  { keyword: 'farmacia', category: 'Salute', sub1: 'Farmacia', priority: 15 },

  // Negozi abbigliamento
  { keyword: 'foot locker', category: 'Shopping', sub1: 'Abbigliamento', priority: 12 },
  { keyword: 'h&m', category: 'Shopping', sub1: 'Abbigliamento', priority: 12 },
  { keyword: 'decathlon', category: 'Shopping', sub1: 'Sport', priority: 12 },

  // Scuola
  { keyword: 'libreria', category: 'Studio', sub1: 'Libri', priority: 12 },
  { keyword: 'adobe', category: 'Studio', sub1: 'Software', priority: 14 },

  // Intrattenimento
  { keyword: 'uci cinema', category: 'Intrattenimento', sub1: 'Cinema', priority: 12 },
  { keyword: 'disney', category: 'Intrattenimento', sub1: 'Abbonamenti', priority: 12 },
  { keyword: 'palestra', category: 'Intrattenimento', sub1: 'Abbonamenti', priority: 12 },
  { keyword: 'piscina', category: 'Intrattenimento', sub1: 'Attività', priority: 12 },

  // Trasporti
  { keyword: 'atm', category: 'Trasporti', sub1: 'Bus', priority: 13 },
  { keyword: 'trenitalia', category: 'Trasporti', sub1: 'Treno', priority: 13 },

  // Animali
  { keyword: 'pet store', category: 'Animali', sub1: 'Cibo', priority: 12 },
  { keyword: 'toelettatura', category: 'Animali', sub1: 'Toelettatura', priority: 13 },

  // Generiche
  { keyword: 'stipendio', category: 'Stipendio', sub1: null, priority: 20 },
];

async function seedKeywordsDemo() {
  try {
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log('✓ Connesso a MongoDB');

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

    // Trasforma keyword con reference agli ObjectId
    const keywords = KEYWORDS_EXTENDED.map(kw => ({
      keyword: kw.keyword,
      categoryId: categoryMap[kw.category],
      subCategory1Id: kw.sub1 ? categoryMap[kw.sub1] : null,
      subCategory2Id: null,
      caseSensitive: false,
      priority: kw.priority,
    })).filter(kw => kw.categoryId); // Solo quelle con categoria valida

    // Inserisci keyword (evita duplicati)
    let inserted = 0;
    for (const kw of keywords) {
      const exists = await KeywordMapping.findOne({ keyword: kw.keyword });
      if (!exists) {
        await KeywordMapping.create(kw);
        inserted++;
      }
    }

    console.log(`✓ Inserite ${inserted} keyword mapping aggiuntive`);
    const totalKeywords = await KeywordMapping.countDocuments();
    console.log(`   Totale keyword mapping: ${totalKeywords}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

seedKeywordsDemo();
