/**
 * Seed demo mode: resetta DB, aggiunge categorie, movimenti demo, obiettivi e utente test Mario.
 *
 * I movimenti coprono gli ultimi 24 mesi fino a oggi, calcolati sulla data corrente: con anni
 * fissi la demo invecchiava (dopo un anno non c'erano più dati recenti) e conteneva movimenti
 * futuri, che falsano tutto ciò che guarda al risparmio "fino a oggi".
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './mongodb.js';
import Category from './models/Category.js';
import KeywordMapping from './models/KeywordMapping.js';
import Movement from './models/Movement.js';
import User from './models/User.js';
import Goal from './models/Goal.js';
import AllocationPlan from './models/AllocationPlan.js';
import { getPaymentGroup } from './utils/payments.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demoAccounts.js';
import { addMonths, monthOf, dayOf } from './utils/goalMath.js';

const CATEGORIES = [
  {
    name: 'Utenze', color: '#3b82f6', icon: 'zap', level: 1,
    children: ['Luce', 'Gas', 'Internet', 'Acqua', 'Telefono'],
  },
  {
    name: 'Spesa', color: '#22c55e', icon: 'shopping-cart', level: 1,
    children: ['Supermercato', 'Mercato', 'Panetteria', 'Macelleria'],
  },
  {
    name: 'Carburante', color: '#f97316', icon: 'fuel', level: 1,
    children: ['Benzina', 'Diesel', 'GPL', 'Elettrico'],
  },
  {
    name: 'Cibo Pronto', color: '#ef4444', icon: 'utensils', level: 1,
    children: ['Ristorante', 'Pizzeria', 'Fast Food', 'Delivery', 'Bar'],
  },
  {
    name: 'Salute', color: '#ec4899', icon: 'heart', level: 1,
    children: ['Farmacia', 'Medico', 'Dentista', 'Ottico', 'Esami'],
  },
  {
    name: 'Shopping', color: '#8b5cf6', icon: 'bag', level: 1,
    children: ['Abbigliamento', 'Elettronica', 'Casa', 'Sport'],
  },
  {
    name: 'Vacanze', color: '#06b6d4', icon: 'plane', level: 1,
    children: ['Trasporti', 'Alloggio', 'Attività', 'Vitto'],
  },
  {
    name: 'Affitto', color: '#64748b', icon: 'home', level: 1,
    children: ['Canone', 'Condominio', 'Manutenzione'],
  },
  {
    name: 'Regali', color: '#f59e0b', icon: 'gift', level: 1,
    children: [],
  },
  {
    name: 'Studio', color: '#10b981', icon: 'book', level: 1,
    children: ['Corsi', 'Libri', 'Software', 'Abbonamenti'],
  },
  {
    name: 'Animali', color: '#84cc16', icon: 'paw', level: 1,
    children: ['Cibo', 'Veterinario', 'Accessori', 'Toelettatura'],
  },
  {
    name: 'Intrattenimento', color: '#a855f7', icon: 'tv', level: 1,
    children: ['Cinema', 'Concerti', 'Abbonamenti', 'Videogiochi'],
  },
  {
    name: 'Trasporti', color: '#0ea5e9', icon: 'car', level: 1,
    children: ['Treno', 'Bus', 'Taxi', 'Parcheggio', 'Autostrada'],
  },
  {
    name: 'Altro', color: '#94a3b8', icon: 'circle', level: 1,
    children: [],
  },
  {
    name: 'Stipendio', color: '#ec4899', icon: 'dollar-sign', level: 1,
    children: [],
  },
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

/** Parametri per l'anno precedente e per quello corrente (relativi alla data del seed). */
const CONFIG = {
  previous: {
    stipendioMarco: 2050,
    stipendioLucia: 1720,
    affitto: 900,
    internet: 35.99,
    telefono: 19.99,
    luceMult: 0.90,
    gasMult: 0.90,
    spesaMult: 0.93,
    carburanteMult: 0.93,
    vacanzaMare: { settimane: 2, alloggio: [130, 155] },
    vacanzaMontagna: null,
    nataleBudget: { giulia: 95, lorenzo: 110, colleghi: 65 },
    rimborsoAnnuo: null,
  },
  current: {
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

/**
 * @param {number} year
 * @param {number} relYear - Anno relativo a oggi: 0 corrente, -1 precedente, -2 quello prima.
 */
function generateYearlyMovements(year, relYear) {
  const C = relYear < 0 ? CONFIG.previous : CONFIG.current;
  const movements = [];

  const m = (date, amount, paymentMethod, description, place, category, subcat1, type = 'expense') => ({
    date, amount: Math.round(amount * 100) / 100,
    paymentMethod, description, place, payee: place, category, subcat1, type,
  });

  const d = (month, day) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fissi mensili
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

    // Spesa settimanale
    for (let day = 2; day <= daysInMonth; day += 7) {
      const amt = (130 + Math.random() * 35) * C.spesaMult;
      movements.push(m(d(month, day), amt, 'credit_card', 'Spesa settimanale', 'Esselunga', 'Spesa', 'Supermercato'));
    }

    // Carburante
    for (let day = 2; day <= daysInMonth; day += 5) {
      const amt = (44 + Math.random() * 12) * C.carburanteMult;
      const stazione = ['ENI', 'Q8', 'AGIP'][Math.floor(Math.random() * 3)];
      movements.push(m(d(month, day), amt, 'credit_card', 'Benzina - auto Marco', stazione, 'Carburante', 'Benzina'));
    }

    // Cibo fuori
    const foodPlaces = ['Bar', 'Pizzeria', 'Ristorante', 'Fast Food'];
    const foodSubcats = ['Bar', 'Pizzeria', 'Ristorante', 'Fast Food'];
    for (let day = 3; day <= daysInMonth; day += 5) {
      const idx = Math.floor(Math.random() * foodPlaces.length);
      movements.push(m(
        d(month, day),
        8 + Math.random() * 22,
        Math.random() > 0.5 ? 'cash' : 'credit_card',
        'Pasto fuori / snack',
        foodPlaces[idx],
        'Cibo Pronto',
        foodSubcats[idx]
      ));
    }

    // Abbonamenti streaming
    if ([1, 4, 7, 10].includes(month)) {
      movements.push(m(d(month, 10), 12.99, 'credit_card', 'Spotify Premium', 'Spotify', 'Intrattenimento', 'Abbonamenti'));
      movements.push(m(d(month, 11), 15.99, 'credit_card', 'Netflix', 'Netflix', 'Intrattenimento', 'Abbonamenti'));
    }
    if ([1, 6].includes(month)) {
      movements.push(m(d(month, 15), 15.99, 'credit_card', 'Abbonamento Disney+', 'Disney', 'Intrattenimento', 'Abbonamenti'));
    }

    // Mensili irregolari
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

    // Movimenti specifici per mese
    if (month === 1) {
      movements.push(m(d(1, 8), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
      movements.push(m(d(1, 12), 45, 'cash', 'Zaino + penne scuola', 'Cartoleria', 'Shopping', 'Sport'));
      movements.push(m(d(1, 15), 30, 'cash', 'Regali capodanno', 'Negozio', 'Regali', null));
    }
    if (month === 2) {
      movements.push(m(d(2, 15), 25, 'cash', 'Costumi Carnevale', 'Negozio', 'Shopping', 'Abbigliamento'));
      movements.push(m(d(2, 18), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    if (month === 3) {
      movements.push(m(d(3, 20), 35, 'cash', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    if (month === 4) {
      movements.push(m(d(4, 10), 40, 'cash', 'Cibo pasquale', 'Panetteria', 'Spesa', 'Panetteria'));
      movements.push(m(d(4, 12), 25, 'cash', 'Regalo Pasqua', 'Negozio', 'Regali', null));
      movements.push(m(d(4, 20), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    if (month === 5) {
      movements.push(m(d(5, 10), 18, 'cash', 'Fiori festa della mamma', 'Fioraio', 'Altro', null));
      movements.push(m(d(5, 15), 40, 'cash', 'Iscrizione palestra - Giulia', 'Palestra', 'Intrattenimento', 'Abbonamenti'));
      movements.push(m(d(5, 20), 30, 'cash', 'Lezioni nuoto - Lorenzo', 'Piscina', 'Intrattenimento', 'Attività'));
      movements.push(m(d(5, 25), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
      if (C.rimborsoAnnuo) {
        movements.push(m(d(5, 15), C.rimborsoAnnuo.importo, 'bank_transfer', 'Rimborso spese viaggio', 'Azienda', 'Stipendio', null, 'income'));
      }
    }
    if (month === 6) {
      movements.push(m(d(6, 10), 55, 'credit_card', 'Gita scolastica Giulia', 'Trenitalia', 'Trasporti', 'Treno'));
      movements.push(m(d(6, 12), 60, 'credit_card', 'Gita scolastica Lorenzo', 'Trenitalia', 'Trasporti', 'Treno'));
      movements.push(m(d(6, 20), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
    }
    if (month === 7) {
      const [h1, h2] = C.vacanzaMare.alloggio;
      movements.push(m(d(7, 1), h1, 'bank_transfer', 'Albergo settimana 1 - Mare', 'Hotel', 'Vacanze', 'Alloggio'));
      movements.push(m(d(7, 8), h2, 'bank_transfer', 'Albergo settimana 2 - Mare', 'Hotel', 'Vacanze', 'Alloggio'));
      movements.push(m(d(7, 2), 65, 'credit_card', 'Benzina trasferta vacanza', 'ENI', 'Carburante', 'Benzina'));
      movements.push(m(d(7, 5), 45, 'cash', 'Spiaggia - stabilimento', 'Spiaggia', 'Vacanze', 'Attività'));
      movements.push(m(d(7, 10), 120, 'cash', 'Cena ristorante pesce', 'Ristorante', 'Vacanze', 'Vitto'));
      movements.push(m(d(7, 15), 80, 'cash', 'Escursioni e attività', 'Agenzia', 'Vacanze', 'Attività'));
      movements.push(m(d(7, 3), 95, 'credit_card', 'Spesa vacanza', 'Supermarket', 'Spesa', 'Supermercato'));
      movements.push(m(d(7, 10), 88, 'credit_card', 'Spesa vacanza', 'Supermarket', 'Spesa', 'Supermercato'));
    }
    if (month === 8) {
      if (C.vacanzaMontagna) {
        movements.push(m(d(8, 5), C.vacanzaMontagna.alloggio, 'bank_transfer', 'Albergo settimana - Montagna', 'Hotel', 'Vacanze', 'Alloggio'));
        movements.push(m(d(8, 12), 45, 'cash', 'Cena ristorante montagna', 'Rifugio', 'Vacanze', 'Vitto'));
        movements.push(m(d(8, 18), 35, 'cash', 'Escursione guidata', 'Guide', 'Vacanze', 'Attività'));
      }
      movements.push(m(d(8, 25), 92, 'credit_card', 'Spesa vacanza', 'Supermarket', 'Spesa', 'Supermercato'));
    }
    if (month === 9) {
      movements.push(m(d(9, 1), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
      movements.push(m(d(9, 5), 120, 'credit_card', 'Libri scolastici Giulia', 'Libreria', 'Studio', 'Libri'));
      movements.push(m(d(9, 6), 95, 'credit_card', 'Libri scolastici Lorenzo', 'Libreria', 'Studio', 'Libri'));
      movements.push(m(d(9, 10), 75, 'cash', 'Zaino + astuccio nuovi', 'Cartoleria', 'Shopping', 'Sport'));
      movements.push(m(d(9, 12), 45, 'cash', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
      movements.push(m(d(9, 20), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    if (month === 10) {
      movements.push(m(d(10, 15), 180, 'credit_card', 'Revisione auto + tagliando', 'Officina', 'Affitto', 'Manutenzione'));
      movements.push(m(d(10, 20), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    if (month === 11) {
      movements.push(m(d(11, 10), 75, 'credit_card', 'Decorazioni natalizie', 'Negozio', 'Altro', null));
      movements.push(m(d(11, 15), 150, 'bank_transfer', 'Retta scuola media - Giulia', 'Scuola', 'Studio', 'Corsi'));
      movements.push(m(d(11, 20), 35, 'bank_transfer', 'Lezioni inglese - Giulia', 'Centro linguistico', 'Studio', 'Corsi'));
    }
    if (month === 12) {
      movements.push(m(d(12, 1), C.nataleBudget.giulia, 'credit_card', 'Regalo per Giulia - Natale', 'Negozio', 'Regali', null));
      movements.push(m(d(12, 2), C.nataleBudget.lorenzo, 'credit_card', 'Regalo per Lorenzo - Natale', 'Negozio', 'Regali', null));
      movements.push(m(d(12, 3), C.nataleBudget.colleghi, 'cash', 'Regali colleghi - Natale', 'Negozio', 'Regali', null));
      movements.push(m(d(12, 15), 75, 'credit_card', 'Panettone e dolci natalizi', 'Pasticceria', 'Spesa', 'Panetteria'));
      movements.push(m(d(12, 18), 120, 'credit_card', 'Cibo per cena Natale', 'Supermercato', 'Spesa', 'Supermercato'));
      movements.push(m(d(12, 20), 95, 'cash', 'Cena fuori capodanno', 'Ristorante', 'Cibo Pronto', 'Ristorante'));
      movements.push(m(d(12, 10), 55, 'cash', 'Biglietti auguri + carta', 'Cartoleria', 'Altro', null));
    }

    // ── IMPREVISTI E EMERGENZE ────────────────────────────────────────────────

    // Gennaio: influenza Lorenzo
    if (relYear === -1 && month === 1) {
      movements.push(m(d(1, 18), 35, 'cash', 'Visita medica urgente - Lorenzo', 'Studi medici', 'Salute', 'Medico'));
      movements.push(m(d(1, 19), 28.50, 'cash', 'Farmaci e sciroppi - influenza', 'Farmacia', 'Salute', 'Farmacia'));
    }

    // Febbraio: infezione orecchie Giulia
    if (relYear === -1 && month === 2) {
      movements.push(m(d(2, 14), 40, 'cash', 'Visita otorino - Giulia', 'Studi medici', 'Salute', 'Medico'));
      movements.push(m(d(2, 15), 32, 'cash', 'Antibiotici e gocce auricolari', 'Farmacia', 'Salute', 'Farmacia'));
    }

    // Maggio: rottura lavatrice
    if (relYear === -1 && month === 5) {
      movements.push(m(d(5, 12), 85, 'credit_card', 'Tecnico lavatrice', 'Assistenza elettrodomestici', 'Affitto', 'Manutenzione'));
      movements.push(m(d(5, 13), 120, 'credit_card', 'Ricambio tamburo lavatrice', 'Negozio ricambi', 'Affitto', 'Manutenzione'));
    }

    // Ottobre: infiltrazione in casa dopo pioggia
    if (relYear === -1 && month === 10) {
      movements.push(m(d(10, 8), 150, 'bank_transfer', 'Muratore - riparazione infiltrazioni', 'Operaio', 'Affitto', 'Manutenzione'));
      movements.push(m(d(10, 9), 85, 'credit_card', 'Materiali (cemento, vernice)', 'Ferramenta', 'Affitto', 'Manutenzione'));
      movements.push(m(d(10, 12), 60, 'credit_card', 'Deumidificatore per muffa', 'Negozio elettronica', 'Affitto', 'Manutenzione'));
    }

    // Novembre: guasto auto - dischi freno
    if (relYear === -1 && month === 11) {
      movements.push(m(d(11, 14), 220, 'credit_card', 'Cambio dischi freno e pastiglie', 'Officina Rossi', 'Affitto', 'Manutenzione'));
      movements.push(m(d(11, 14), 45, 'cash', 'Ispezione e diagnosi auto', 'Officina Rossi', 'Affitto', 'Manutenzione'));
    }

    // Gennaio (anno corrente): gastroenterite Marco
    if (relYear === 0 && month === 1) {
      movements.push(m(d(1, 22), 50, 'cash', 'Visita medica urgente - Marco', 'Guardia medica', 'Salute', 'Medico'));
      movements.push(m(d(1, 23), 38.50, 'cash', 'Farmaci (antiemetici, fermenti)', 'Farmacia', 'Salute', 'Farmacia'));
    }

    // Marzo: pulizia dentale + tartaro Lorenzo
    if (relYear === 0 && month === 3) {
      movements.push(m(d(3, 17), 95, 'credit_card', 'Pulizia denti e detartrasazione - Lorenzo', 'Studio dentistico', 'Salute', 'Dentista'));
      movements.push(m(d(3, 17), 25, 'credit_card', 'Sigillante solchi - prevenzione carie', 'Studio dentistico', 'Salute', 'Dentista'));
    }

    // Aprile: problema caldaia
    if (relYear === 0 && month === 4) {
      movements.push(m(d(4, 5), 165, 'bank_transfer', 'Tecnico caldaia - controllo e pulizia', 'Ditta Impianti', 'Affitto', 'Manutenzione'));
      movements.push(m(d(4, 6), 42, 'credit_card', 'Filtri ricambio caldaia', 'Ferramenta', 'Affitto', 'Manutenzione'));
    }

    // Giugno: visita oculista preventiva
    if (relYear === 0 && month === 6) {
      movements.push(m(d(6, 5), 55, 'cash', 'Visita oculista - Giulia', 'Studio oculistico', 'Salute', 'Ottico'));
      movements.push(m(d(6, 12), 180, 'credit_card', 'Occhiali nuovi - Giulia', 'Ottica Centro', 'Salute', 'Ottico'));
    }

    // Settembre: carie scoperta durante controllo
    if (relYear === 0 && month === 9) {
      movements.push(m(d(9, 14), 85, 'cash', 'Otturazione carie - Marco', 'Studio dentistico', 'Salute', 'Dentista'));
      movements.push(m(d(9, 14), 65, 'cash', 'Controllo carie - Lorenzo', 'Studio dentistico', 'Salute', 'Dentista'));
    }

    // Novembre: rottura tubo scarico bagno
    if (relYear === 0 && month === 11) {
      movements.push(m(d(11, 5), 75, 'cash', 'Idraulico - ispezione e strappo', 'Idraulico Bianchi', 'Affitto', 'Manutenzione'));
      movements.push(m(d(11, 6), 220, 'credit_card', 'Tubo rame + raccordi ricambio', 'Negozio idraulica', 'Affitto', 'Manutenzione'));
      movements.push(m(d(11, 7), 95, 'cash', 'Installazione e sigillatura', 'Idraulico Bianchi', 'Affitto', 'Manutenzione'));
    }
  }

  return movements;
}

/**
 * Tre obiettivi che mostrano tutti i casi della sezione Obiettivi:
 * - le vacanze dell'ultimo luglio, raggiunte prima della partenza, pagate con le spese collegate
 *   e poi concluse;
 * - un viaggio in linea con la scadenza;
 * - un'auto in ritardo, così la proiezione ha qualcosa da segnalare.
 *
 * @param {string} currentMonth - YYYY-MM.
 * @param {Object<string, import('mongoose').Types.ObjectId>} categoryMap
 */
async function seedDemoGoals(currentMonth, categoryMap) {
  console.log('🎯 Inserimento obiettivi demo...');
  // L'ultimo luglio già passato: è il mese delle vacanze al mare nei movimenti generati.
  const year = Number(currentMonth.slice(0, 4));
  const july = `${currentMonth > `${year}-07` ? year : year - 1}-07`;
  const before = addMonths(july, -6);
  const after = addMonths(july, 1);

  const [vacanze, giappone, auto] = await Goal.insertMany([
    {
      name: `Vacanze estive ${july.slice(0, 4)}`, targetAmount: 600, deadline: july,
      initialAmount: 0, createdMonth: before, status: 'completed', closedMonth: after,
    },
    {
      name: 'Viaggio in Giappone', targetAmount: 6000, deadline: addMonths(currentMonth, 10),
      initialAmount: 0, createdMonth: before, status: 'active',
    },
    {
      name: 'Auto nuova', targetAmount: 15000, deadline: addMonths(currentMonth, 20),
      initialAmount: 3000, createdMonth: after, status: 'active',
    },
  ]);

  await AllocationPlan.insertMany([
    { effectiveFrom: before, shares: [{ goalId: vacanze._id, pct: 10 }, { goalId: giappone._id, pct: 40 }] },
    { effectiveFrom: after,  shares: [{ goalId: giappone._id, pct: 45 }, { goalId: auto._id, pct: 40 }] },
  ]);

  // Le spese della vacanza pagano l'obiettivo invece di pesare sul risparmio di luglio.
  const linked = await Movement.updateMany(
    { categoryId: categoryMap.Vacanze, type: 'expense', date: { $gte: `${july}-01`, $lte: `${july}-31` } },
    { $set: { goalId: vacanze._id } },
  );
  console.log(`✓ Inseriti 3 obiettivi, ${linked.modifiedCount} spese collegate a "${vacanze.name}"`);
}

async function seedDemoMode() {
  try {
    await connectDB();
    const now = new Date();
    const today = dayOf(now);
    const currentMonth = monthOf(now);
    const windowStart = `${addMonths(currentMonth, -23)}-01`;
    console.log(`🔄 DEMO_MODE: Reset e seed automatico (${windowStart} → ${today})`);

    // Reset database
    console.log('🧹 Reset database...');
    await Category.deleteMany({});
    await KeywordMapping.deleteMany({});
    await Movement.deleteMany({});
    await User.deleteMany({});
    await Goal.deleteMany({});
    await AllocationPlan.deleteMany({});
    console.log('✓ Database pulito');

    // Seed categorie
    console.log('📝 Inserimento categorie...');
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

    // Seed keywords
    console.log('🔑 Inserimento keyword mapping...');
    const kwDocs = KEYWORDS.map((kw) => ({
      keyword: kw.keyword,
      categoryId: categoryMap[kw.category],
      subCategory1Id: kw.sub1 ? categoryMap[`${kw.category}::${kw.sub1}`] : null,
      caseSensitive: false,
      priority: 10,
    })).filter((kw) => kw.categoryId);

    await KeywordMapping.insertMany(kwDocs);
    console.log(`✓ Inserite ${kwDocs.length} keyword`);

    // Seed movimenti: ultimi 24 mesi, mai oltre oggi
    console.log('📊 Inserimento movimenti demo...');
    let totalInserted = 0;
    const currentYear = now.getFullYear();

    for (const year of [currentYear - 2, currentYear - 1, currentYear]) {
      const categories = await Category.find();
      const rawMovements = generateYearlyMovements(year, year - currentYear)
        .filter(mv => mv.date >= windowStart && mv.date <= today);

      const movements = rawMovements.map(mv => {
        const cat = categories.find(c => c.name === mv.category);
        const sub1 = mv.subcat1 ? categories.find(c => c.name === mv.subcat1) : null;

        return {
          amount: mv.amount,
          paymentMethod: mv.paymentMethod,
          // Stessa fonte di verità delle API: prima qui i contanti finivano tra gli alternativi.
          paymentGroup: getPaymentGroup(mv.paymentMethod),
          date: mv.date,
          time: '14:30',
          description: mv.description,
          place: mv.place,
          payee: mv.payee || '',
          notes: '',
          categoryId: cat ? cat._id : null,
          subCategory1Id: sub1 ? sub1._id : null,
          subCategory2Id: null,
          type: mv.type,
          source: 'manual',
          importBatchId: null,
          excludeFromAnalysis: false,
        };
      }).filter(m => m.categoryId);

      if (movements.length === 0) continue;
      const result = await Movement.insertMany(movements);
      totalInserted += result.length;

      const expenses = result.filter(m => m.type === 'expense');
      const incomes = result.filter(m => m.type === 'income');
      const totExp = expenses.reduce((s, m) => s + m.amount, 0);
      const totInc = incomes.reduce((s, m) => s + m.amount, 0);

      console.log(`  ✓ ${year}: ${result.length} movimenti (spese: €${totExp.toFixed(2)}, entrate: €${totInc.toFixed(2)})`);
    }
    console.log(`✓ Totale inseriti: ${totalInserted} movimenti`);

    await seedDemoGoals(currentMonth, categoryMap);

    // Un account per ruolo, così la vetrina mostra le differenze senza doverli creare a mano.
    // Mario per ultimo: il root layout usa la sua esistenza per capire che il seed è completo.
    console.log('👤 Creazione utenti demo...');
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const account of [...DEMO_ACCOUNTS].reverse()) {
      await User.create({ ...account, hashedPassword });
      console.log(`✓ Creato utente: ${account.name} (${account.email}) — ${account.role}`);
    }

    console.log('\n✅ Demo mode seed completato!');
    console.log(`📧 Utenti: ${DEMO_ACCOUNTS.map((a) => a.email).join(', ')}`);
    console.log(`🔐 Password: ${DEMO_PASSWORD}`);
    console.log(`📊 Dati: ultimi 24 mesi fino al ${today}`);

    return true;
  } catch (err) {
    console.error('❌ Errore seed demo mode:', err.message);
    throw err;
  }
}

export default seedDemoMode;
