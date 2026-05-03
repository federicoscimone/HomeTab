/**
 * Seed semplificato: categorie e keyword mapping base (VERSIONE DEBUG)
 */
import mongoose from 'mongoose';
import Category from './models/Category.js';
import KeywordMapping from './models/KeywordMapping.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/homebi_demo';

const CATEGORIES = [
  { name: 'Utenze', color: '#3b82f6', icon: 'zap', level: 1, children: ['Luce', 'Gas', 'Internet', 'Acqua', 'Telefono'] },
  { name: 'Spesa', color: '#22c55e', icon: 'shopping-cart', level: 1, children: ['Supermercato', 'Mercato', 'Panetteria', 'Macelleria'] },
  { name: 'Carburante', color: '#f97316', icon: 'fuel', level: 1, children: ['Benzina', 'Diesel', 'GPL', 'Elettrico'] },
  { name: 'Cibo Pronto', color: '#ef4444', icon: 'utensils', level: 1, children: ['Ristorante', 'Pizzeria', 'Fast Food', 'Delivery', 'Bar'] },
  { name: 'Salute', color: '#ec4899', icon: 'heart', level: 1, children: ['Farmacia', 'Medico', 'Dentista', 'Ottico', 'Esami'] },
  { name: 'Shopping', color: '#8b5cf6', icon: 'bag', level: 1, children: ['Abbigliamento', 'Elettronica', 'Casa', 'Sport'] },
  { name: 'Vacanze', color: '#06b6d4', icon: 'plane', level: 1, children: ['Trasporti', 'Alloggio', 'Attività', 'Vitto'] },
  { name: 'Affitto', color: '#64748b', icon: 'home', level: 1, children: ['Canone', 'Condominio', 'Manutenzione'] },
  { name: 'Regali', color: '#f59e0b', icon: 'gift', level: 1, children: [] },
  { name: 'Studio', color: '#10b981', icon: 'book', level: 1, children: ['Corsi', 'Libri', 'Software', 'Abbonamenti'] },
  { name: 'Animali', color: '#84cc16', icon: 'paw', level: 1, children: ['Cibo', 'Veterinario', 'Accessori', 'Toelettatura'] },
  { name: 'Intrattenimento', color: '#a855f7', icon: 'tv', level: 1, children: ['Cinema', 'Concerti', 'Abbonamenti', 'Videogiochi'] },
  { name: 'Trasporti', color: '#0ea5e9', icon: 'car', level: 1, children: ['Treno', 'Bus', 'Taxi', 'Parcheggio', 'Autostrada'] },
  { name: 'Altro', color: '#94a3b8', icon: 'circle', level: 1, children: [] },
  { name: 'Stipendio', color: '#16a34a', icon: 'briefcase', level: 1, children: [] },
];

const KEYWORDS = [
  { keyword: 'esselunga', category: 'Spesa', sub1: 'Supermercato' },
  { keyword: 'coop', category: 'Spesa', sub1: 'Supermercato' },
  { keyword: 'lidl', category: 'Spesa', sub1: 'Supermercato' },
  { keyword: 'eurospin', category: 'Spesa', sub1: 'Supermercato' },
  { keyword: 'carrefour', category: 'Spesa', sub1: 'Supermercato' },
  { keyword: 'iper', category: 'Spesa', sub1: 'Supermercato' },
  { keyword: 'eni', category: 'Carburante', sub1: 'Benzina' },
  { keyword: 'agip', category: 'Carburante', sub1: 'Benzina' },
  { keyword: 'q8', category: 'Carburante', sub1: 'Benzina' },
  { keyword: 'ip station', category: 'Carburante', sub1: 'Benzina' },
  { keyword: 'farmacia', category: 'Salute', sub1: 'Farmacia' },
  { keyword: 'enel', category: 'Utenze', sub1: 'Luce' },
  { keyword: 'a2a', category: 'Utenze', sub1: 'Gas' },
  { keyword: 'vodafone', category: 'Utenze', sub1: 'Telefono' },
  { keyword: 'tim', category: 'Utenze', sub1: 'Telefono' },
  { keyword: 'wind', category: 'Utenze', sub1: 'Telefono' },
  { keyword: 'netflix', category: 'Intrattenimento', sub1: 'Abbonamenti' },
  { keyword: 'spotify', category: 'Intrattenimento', sub1: 'Abbonamenti' },
  { keyword: 'amazon', category: 'Shopping', sub1: null },
  { keyword: 'paypal', category: 'Altro', sub1: null },
  { keyword: 'trenitalia', category: 'Trasporti', sub1: 'Treno' },
  { keyword: 'italo', category: 'Trasporti', sub1: 'Treno' },
  { keyword: 'autostrade', category: 'Trasporti', sub1: 'Autostrada' },
  { keyword: 'telepass', category: 'Trasporti', sub1: 'Autostrada' },
];

async function seed() {
  console.log('✓ Inizio seed');
  try {
    console.log('✓ Connessione a MongoDB...');
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log('✓ Connesso!');

    const existingCount = await Category.countDocuments();
    if (existingCount > 0) {
      console.log(`✓ Già presenti ${existingCount} categorie. Seed saltato.`);
      process.exit(0);
    }

    console.log('✓ Inserimento categorie...');
    const categoryMap = {};
    for (const cat of CATEGORIES) {
      const parent = await Category.create({
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        level: 1,
        parentId: null,
        order: CATEGORIES.indexOf(cat),
      });
      categoryMap[cat.name] = parent._id;

      for (let i = 0; i < cat.children.length; i++) {
        const child = await Category.create({
          name: cat.children[i],
          color: cat.color,
          icon: cat.icon,
          level: 2,
          parentId: parent._id,
          order: i,
        });
        categoryMap[`${cat.name}::${cat.children[i]}`] = child._id;
      }
    }
    console.log(`✓ Inserite ${Object.keys(categoryMap).length} categorie`);

    console.log('✓ Inserimento keyword...');
    const kwDocs = KEYWORDS.map((kw) => ({
      keyword: kw.keyword,
      categoryId: categoryMap[kw.category],
      subCategory1Id: kw.sub1 ? categoryMap[`${kw.category}::${kw.sub1}`] : null,
      caseSensitive: false,
      priority: 10,
    })).filter((kw) => kw.categoryId);

    await KeywordMapping.insertMany(kwDocs);
    console.log(`✓ Inserite ${kwDocs.length} keyword`);

    console.log('✅ Seed completato!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

seed();
