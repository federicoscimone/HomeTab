/**
 * Aggiunge categorie reddito al DB esistente.
 * Eseguire con: node lib/seed-income.js
 */
import mongoose from 'mongoose';
import connectDB from './mongodb.js';
import Category from './models/Category.js';

const INCOME_CATEGORIES = [
  { name: 'Stipendio',   color: '#16a34a', icon: 'briefcase', children: ['Fisso', 'Variabile', 'Bonus', 'Tredicesima', 'TFR'] },
  { name: 'Freelance',   color: '#15803d', icon: 'laptop',    children: ['Consulenze', 'Progetti', 'Vendite'] },
  { name: 'Pensione',    color: '#166534', icon: 'shield',    children: ['INPS', 'Complementare'] },
  { name: 'Rimborsi',    color: '#65a30d', icon: 'refresh',   children: ['Spese', 'Medici', 'Lavoro', 'Tasse'] },
  { name: 'Rendite',     color: '#0f766e', icon: 'trending',  children: ['Affitti', 'Dividendi', 'Interessi', 'Investimenti'] },
  { name: 'Entrate Varie', color: '#0891b2', icon: 'plus',   children: ['Vendite', 'Regalo', 'Vincite', 'Altro'] },
];

async function seedIncome() {
  await connectDB();
  let added = 0;

  for (let idx = 0; idx < INCOME_CATEGORIES.length; idx++) {
    const cat = INCOME_CATEGORIES[idx];
    const exists = await Category.findOne({ name: cat.name, level: 1 });
    if (exists) { console.log(`Già presente: ${cat.name}`); continue; }

    const parent = await Category.create({
      name: cat.name, color: cat.color, icon: cat.icon,
      level: 1, parentId: null, order: 100 + idx,
    });
    added++;

    for (let j = 0; j < cat.children.length; j++) {
      await Category.create({
        name: cat.children[j], color: cat.color, icon: cat.icon,
        level: 2, parentId: parent._id, order: j,
      });
      added++;
    }
    console.log(`+ ${cat.name} (${cat.children.length} sotto-categorie)`);
  }

  console.log(`\nAggiunte ${added} categorie reddito.`);
  await mongoose.disconnect();
}

seedIncome().catch(err => { console.error(err); process.exit(1); });
