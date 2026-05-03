# Demo Data - Famiglia Italiana (4 persone)

## Panoramica

Dataset demo realistico che simula i movimenti finanziari di una **famiglia italiana di 4 persone** per il **mese di maggio 2026**:

- **Marco** (padre, lavora in azienda)
- **Lucia** (madre, lavora in ospedale)
- **Giulia** (12 anni, scuola media privata)
- **Lorenzo** (15 anni, liceo)
- **Animali domestici**: 1 gatto + 1 cane

---

## Come generare i dati

### Opzione 1: Dataset 1 mese (maggio 2026)

```bash
# Step 1: Seed categorie e keyword base
node lib/seed.js

# Step 2: Inserisci dati demo famiglia (maggio)
node lib/seed-demo-family.js

# Step 3: Aggiungi keyword mapping estesi (opzionale)
node lib/seed-keywords-demo.js
```

**Output atteso:**
```
✓ Connesso a MongoDB
✓ Trovate 14 categorie
✓ Inseriti 60+ movimenti demo

📊 Riepilogo dati creati:
   Periodo: maggio 2026
   Famiglia: 4 persone (2 genitori, 2 figli)
   Totale spese: ~€3,300
   Totale entrate: ~€4,300
```

---

### Opzione 2: Dataset 12 mesi (gennaio-dicembre 2026) ⭐ CONSIGLIATO

```bash
# Step 1: Seed categorie e keyword base
node lib/seed.js

# Step 2: Inserisci dati demo famiglia per TUTTO L'ANNO
node lib/seed-demo-family-12months.js

# Step 3: Aggiungi keyword mapping estesi (opzionale)
node lib/seed-keywords-demo.js
```

**Output atteso:**
```
✓ Connesso a MongoDB
✓ Trovate 14 categorie
✓ Generati 600+ movimenti grezzi
✓ Inseriti 500+ movimenti

📊 RIEPILOGO DATI CREATI - 12 MESI (2026):
   Periodo: gennaio - dicembre 2026
   Famiglia: 4 persone (Marco, Lucia, Giulia 12, Lorenzo 15)
   Totale movimenti: 500+
   ├─ Spese: 480+
   └─ Entrate: 36

💰 ANALISI FINANZIARIA:
   Totale spese anno: €39,000+
   Media mensile spese: €3,250
   Totale entrate anno: €51,600
   Media mensile entrate: €4,300
   Bilancio annuale: €12,600+
   Bilancio mensile medio: €1,050
```

---

## Dataset 12 mesi - Stagionalità e Dettagli

### 📅 Cosa accade ogni mese

| Mese | Eventi | Spese aggiuntive |
|------|--------|------------------|
| **Gennaio** | Inizio anno scolastico, regali capodanno | Retta scuola, zaino, regalo |
| **Febbraio** | Carnevale | Costumi, lezioni inglese |
| **Marzo** | Preparazione primavera | Lezioni inglese |
| **Aprile** | Pasqua | Cibo pasquale, regalo pasqua |
| **Maggio** | Festa della mamma, attività extrascolastiche | Fiori, palestra, nuoto |
| **Giugno** | Fine anno scolastico, gite | Gite scolastiche con treno |
| **Luglio** | 🏖️ **VACANZE ESTIVE SETTIMANA 1-2** | Albergo, spiaggia, ristorante, escursioni |
| **Agosto** | 🏔️ **VACANZE ESTIVE SETTIMANA 3** | Albergo montagna, rifugio, attività |
| **Settembre** | 📚 **RITORNO A SCUOLA** | Retta scuola, libri, zaino, lezioni |
| **Ottobre** | Manutenzione auto | Revisione + tagliando auto |
| **Novembre** | Preparazione Natale | Decorazioni, retta scuola |
| **Dicembre** | 🎄 **NATALE** | Regali, dolci natalizi, cena fuori |

### ⚡ Variabilità stagionale (utenze)

- **Luce**: Bassa primavera (~€80), alta estate (~€110, aria condizionata), media autunno (~€95)
- **Gas**: Alta inverno (~€120), minima estate (~€15), media autunno (~€85)
- **Carburante**: Costante (~€45-55/volta), aumenta per vacanze

### 👨‍👩‍👧‍👦 Pattern familiari

- **Stipendi**: 1° di ogni mese, Marco €2,200 + Lucia €1,850 = €4,050
- **Spesa settimanale**: Giovedì, €140-170 (4-5 volte mese)
- **Cibo fuori**: 2-3 volte a settimana, €8-28 per evento
- **Attività scolastiche**: Ricorrenti (lezioni inglese, palestra, nuoto)
- **Retta scuola**: Pagata alcuni mesi (gennaio, giugno, settembre, novembre)
- **Vacanze**: Luglio-agosto, spese concentrate (albergo, attività, ristorante)

---

## Struttura dati demo

### 📊 Categorie utilizzate

| Categoria | Sottocategoria | Esempi movimenti |
|-----------|----------------|------------------|
| **Affitto** | Canone, Manutenzione | Affitto €900, riparazione lavastoviglie |
| **Utenze** | Luce, Gas, Internet, Telefono | Enel, A2A, Vodafone |
| **Spesa** | Supermercato | Esselunga settimanale (~€140-160) |
| **Carburante** | Benzina | ENI, Q8, AGIP (settimanale) |
| **Cibo Pronto** | Bar, Pizzeria, Ristorante, Fast Food | Caffè, gelato, cena fuori |
| **Salute** | Farmacia, Medico | Farmaci, visita pediatra |
| **Shopping** | Abbigliamento, Sport | Scarpe, zaino, divisa ginnastica |
| **Studio** | Corsi, Libri, Software | Retta scuola, lezioni inglese, Adobe |
| **Intrattenimento** | Abbonamenti, Cinema, Attività | Palestra, cinema, Disney+ |
| **Trasporti** | Bus, Treno | Abbonamento bus, gita scolastica |
| **Animali** | Cibo, Toelettatura | Mangime gatto, toelettatura cane |
| **Regali** | — | Regalo compleanno |
| **Altro** | — | Fiori, rimborsi |

---

## 💰 Riepilogo finanziario (maggio 2026)

### Spese per categoria (approssimativo)

| Categoria | Importo | Note |
|-----------|---------|------|
| **Affitto + Utenze** | ~€1,100 | Affitto €900, luce, gas, internet, telefono |
| **Spesa alimentare** | ~€740 | Supermercato settimanale |
| **Carburante** | ~€240 | Auto Marco, benzina settimanale |
| **Cibo fuori** | ~€125 | Pizzeria, bar, gelato, ristorante |
| **Scuola/Studio** | ~€230 | Retta scuola media, lezioni, software |
| **Attività extrascolastiche** | ~€115 | Palestra, nuoto, gita scolastica |
| **Shopping** | ~€260 | Abbigliamento, scarpe, zaino sportivo |
| **Intrattenimento** | ~€45 | Cinema, abbonamenti |
| **Salute** | ~€57 | Farmacia, visita medico |
| **Trasporti pubblici** | ~€135 | Abbonamento bus, biglietti |
| **Animali** | ~€77 | Cibo gatto, toelettatura cane |
| **Manutenzione casa** | ~€124 | Riparazione, vernice |
| **Regali/Varie** | ~€43 | Regalo, fiori |
| | | |
| **TOTALE SPESE MAGGIO** | **~€3,300** | |

### Entrate (maggio)

| Descrizione | Importo | Frequenza |
|------------|---------|-----------|
| Stipendio Marco | €2,200 | Mensile |
| Stipendio Lucia | €1,850 | Mensile |
| Rimborsi/Bonus | €250 | Episodico |
| | | |
| **TOTALE ENTRATE MAGGIO** | **~€4,300** | |

**Bilancio maggio:** +€1,000 circa

---

## 💰 Riepilogo finanziario ANNUALE (12 mesi 2026)

### Totali annuali

| Voce | Importo | Note |
|------|---------|------|
| **Totale spese anno** | ~€39,000 | Variabile per stagionalità |
| **Media mensile spese** | ~€3,250 | Base €3,100 + variazioni |
| **Totale entrate anno** | ~€51,600 | Stipendi + bonus/rimborsi |
| **Media mensile entrate** | ~€4,300 | 12 x €4,050 stipendi + extra |
| **Bilancio annuale** | **+€12,600** | Avanzo positivo |
| **Bilancio mensile medio** | **+€1,050** | Margine di risparmio |

### Breakdown spese annuali per categoria

| Categoria | Annuale | Mensile medio | Picchi stagionali |
|-----------|---------|---------------|-------------------|
| Affitto + Utenze | ~€13,000 | €1,085 | Estate +20% (AC) |
| Spesa alimentare | ~€8,500 | €708 | Natale +€150 |
| Carburante | ~€2,700 | €225 | Vacanze estive +€150 |
| Cibo fuori | ~€1,400 | €117 | Costante |
| Scuola/Studio | ~€2,200 | €183 | Settembre +€400 |
| Attività extrascolastiche | ~€1,100 | €92 | Primavera/estate +€100 |
| Shopping | ~€2,400 | €200 | Stagionale (4 volte) |
| Intrattenimento | ~€500 | €42 | Costante |
| Salute | ~€600 | €50 | Irregolare |
| Trasporti pubblici | ~€1,600 | €133 | Costante |
| Animali | ~€900 | €75 | Costante |
| Manutenzione casa | ~€1,500 | €125 | Occasionale |
| Regali/Varie | ~€1,000 | €83 | Natale +€400 |
| Vacanze | ~€1,500 | €125 | Luglio-agosto ~€1,500 |
| **TOTALE** | **~€39,000** | **€3,250** | |

---

## 📝 Dettagli dei movimenti

### Ricorrenti (mensili)
- **Affitto**: 1° maggio, €900
- **Utenze**: Luce (5°), Gas (6°), Internet (5°), Telefono (5°)
- **Spesa supermercato**: Ogni giovedì (~€140-160)
- **Carburante**: ~2 volte a settimana (€45-52)
- **Stipendi**: 1° maggio (Marco €2,200, Lucia €1,850)

### Settimanali
- **Cibo fuori casa**: Caffè, bar, pizzeria (€8-24 per evento)
- **Trasporti**: Abbonamento bus, carnet metro

### Occasionali
- **Medico/Farmacia**: Visita pediatra, farmaci
- **Shopping**: Stagionale, acquisti abbigliamento/scarpe per i figli
- **Manutenzione**: Riparazioni casa
- **Intrattenimento**: Cinema, attività sportive

---

## 🔑 Keyword mapping per auto-categorizzazione

I dati demo funzionano bene con questo keyword mapping:

```javascript
// Negozi/Esercizi
esselunga → Spesa > Supermercato
coop → Spesa > Supermercato
eni → Carburante > Benzina
q8 → Carburante > Benzina

// Utenze
enel → Utenze > Luce
a2a → Utenze > Gas
vodafone → Utenze > Telefono

// Cibo fuori
pizzeria → Cibo Pronto > Pizzeria
ristorante → Cibo Pronto > Ristorante
bar → Cibo Pronto > Bar

// Altro
farmacia → Salute > Farmacia
palestra → Intrattenimento > Abbonamenti
atm → Trasporti > Bus
```

---

## 🎯 Casi d'uso per testare l'app

### Con dataset 1 mese (maggio):
Ideale per test rapidi e sviluppo iniziale.

### Con dataset 12 mesi: ⭐ CONSIGLIATO PER TUTTI GLI USE CASE
Ideale per test completi con stagionalità e trend storici.

1. **Dashboard principale**
   - Bilancio mensile (entrate vs spese)
   - Andamento nel mese
   - Confronto anno su anno
   - Categorie più onerose
   - Trend stagionali

2. **Report e analisi**
   - Breakdown per categoria (con variazioni stagionali)
   - Confronto per metodo pagamento (cash vs carte)
   - Trend mensile/trimestrale/annuale
   - Analisi vacanze vs mesi normali
   - Picchi di spesa (Natale, vacanze, back-to-school)

3. **Auto-categorizzazione**
   - Keyword mapping riconosce automaticamente i negozi
   - Priorità delle keyword (marca di benzina vs descrizione)
   - Test con varietà di esercizi (stagionali compresi)

4. **Filtri e ricerca**
   - Per periodo (filtro data su mesi diversi)
   - Per categoria (filtro gerarchico)
   - Per metodo pagamento
   - Ricerche per periodo vacanze vs normali

5. **Importazione da file**
   - Test template import con dati realistici di mesi diversi
   - Batch import e deduplicazione
   - Test con vari formati

6. **Regole e automazione**
   - Keyword per auto-assegnare categoria
   - Regole ricorrenti per abbonamenti/utenze
   - Automazione per spese mensili (affitto, utenze, stipendi)

7. **Analitiche avanzate**
   - Proiezioni annuali basate su 12 mesi storici
   - Seasonal adjustment e trend analysis
   - Previsioni di spesa per categoria
   - Budget vs actual comparison

---

## 🚀 Quick Start - Come scegliere il dataset

### Per sviluppo/test rapido: 1 mese
```bash
node lib/seed.js && node lib/seed-demo-family.js
```
✅ Veloce, leggero, perfetto per test UI/UX  
❌ Manca stagionalità, trend, report storici

### Per test completo: 12 mesi ⭐ RACCOMANDATO
```bash
node lib/seed.js && node lib/seed-demo-family-12months.js
```
✅ Stagionalità realistica  
✅ Trend annuali visibili  
✅ Test report storici  
✅ Vede veramente come funziona l'app  
⏱️ Leggermente più lento (600+ movimenti)

**Consiglio:** Usa sempre 12 mesi per lo sviluppo principale, 1 mese solo per test isolati/rapidi.

---

## 🔧 Personalizzazioni possibili

Se vuoi adattare i dati:

### Modifica dataset familiari

#### Per 1 mese:
Edita `lib/seed-demo-family.js`

#### Per 12 mesi:
Edita `lib/seed-demo-family-12months.js`:
- Modifica `generateYearlyMovements()` per aggiungere/rimuovere mesi
- Cambia `YEAR` per anni diversi
- Regola importi e frequenze
- Aggiungi nuove categorie/spese

### Aggiungi keyword
Edita `lib/seed-keywords-demo.js`:
- Aggiungi nuovi esercizi/negozi
- Regola priorità keyword
- Aggiungi matching per più varianti di nome

### Reset e ricomincia

#### Opzione 1: Ricomincia da zero (cancella tutto)
```bash
# ATTENZIONE: elimina TUTTI i dati!
# 1. Accedi a MongoDB Compass
# 2. Seleziona il database
# 3. Cancella tutte le collection (tasto destro → Drop Collection)
# 4. Riavvia i seed:

node lib/seed.js
node lib/seed-demo-family-12months.js
node lib/seed-keywords-demo.js
```

#### Opzione 2: Ripristina solo i movimenti (mantieni categorie)
```bash
# In mongosh o Compass:
# db.movements.deleteMany({})  # Cancella solo movimenti
# Poi riavvia il seed appropriato:

node lib/seed-demo-family.js      # o
node lib/seed-demo-family-12months.js
```

---

## 📋 Dati tecnici

### Dataset 1 mese (seed-demo-family.js)
- **Periodo**: maggio 2026
- **Numero movimenti**: ~60 tra spese e entrate
- **Data range**: 2026-05-01 a 2026-05-31

### Dataset 12 mesi (seed-demo-family-12months.js)
- **Periodo**: gennaio - dicembre 2026
- **Numero movimenti**: ~500-600 tra spese e entrate
- **Data range**: 2026-01-01 a 2026-12-31
- **Pattern**: Movimenti distribuiti realisticamente (ricorrenti, stagionali, episodici)

### Comuni a entrambi
- **Metodi pagamento**: 
  - `cash` (contanti, bar, farmacia)
  - `credit_card` (carte di credito, supermercato, utilities)
  - `bank_transfer` (bonifici, utenze, stipendi)
- **Gruppi pagamento**:
  - `traditional` (carte, bonifici)
  - `alternative` (contanti)
- **Source**: Tutti `manual` (inseriti manualmente, non da import)
- **Esclusioni**: Nessuno escluso da analisi (`excludeFromAnalysis=false`)

---

## 📊 Statistiche per verificare i dati

### Verifiche generali

```javascript
// In Compass o mongosh
db.movements.countDocuments()                           // ~60 (1 mese) o ~500+ (12 mesi)
db.movements.find({ type: 'expense' }).count()          // ~50+ (1 mese) o ~480+ (12 mesi)
db.movements.find({ type: 'income' }).count()           // ~3 (1 mese) o ~36 (12 mesi, 12 mesi * 3 entrate)
db.movements.aggregate([                                // Totale spese
  { $match: { type: 'expense' } },
  { $group: { _id: null, total: { $sum: '$amount' } } }
])
```

### Verifiche specifiche per 1 mese

```javascript
db.movements.find().sort({ date: 1 }).limit(1)         // 2026-05-01 (primo movimento)
db.movements.find().sort({ date: -1 }).limit(1)        // 2026-05-31 (ultimo movimento)
db.movements.countDocuments({ date: { $regex: '2026-05' } })  // Movimenti maggio
```

### Verifiche specifiche per 12 mesi

```javascript
// Range data completo
db.movements.find().sort({ date: 1 }).limit(1)         // 2026-01-01 (primo movimento)
db.movements.find().sort({ date: -1 }).limit(1)        // 2026-12-31 (ultimo movimento)

// Movimenti per mese
db.movements.aggregate([
  { $group: { _id: { $substr: ['$date', 0, 7] }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
  { $sort: { _id: 1 } }
])
// Output: mostra count e totale per mese (es. 2026-01, 2026-02, ...)

// Vacanze (luglio-agosto)
db.movements.countDocuments({ date: { $regex: '2026-(07|08)' } })  // ~80+ movimenti luglio-agosto
db.movements.aggregate([
  { $match: { date: { $regex: '2026-(07|08)' }, type: 'expense' } },
  { $group: { _id: null, total: { $sum: '$amount' } } }
])  // Spese luglio-agosto ~€3,000+

// Natale (dicembre)
db.movements.countDocuments({ date: { $regex: '2026-12' } })  // ~50+ movimenti
db.movements.find({ description: { $regex: 'natale', $options: 'i' } }).count()  // Regali natale

// Entrate (stipendi)
db.movements.find({ type: 'income' }).count()           // 36 (12 mesi x 3 entrate: Marco + Lucia + rimborsi)
db.movements.aggregate([
  { $match: { type: 'income' } },
  { $group: { _id: null, total: { $sum: '$amount' } } }
])  // ~€51,600

// Spese per categoria
db.movements.aggregate([
  { $group: { _id: '$categoryId', count: { $sum: 1 }, total: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])  // Top 10 categorie per spesa
```

---

## ✅ Checklist verifica

### Dopo il seed, verifica:

- [ ] Connessione MongoDB OK
- [ ] Categorie inserite (14+)
- [ ] Movimenti inseriti (~60 per 1 mese, ~500+ per 12 mesi)
- [ ] Keyword mapping estesi (20+)
- [ ] Date valide (maggio 2026 per 1 mese, gen-dic 2026 per 12 mesi)
- [ ] Metodi pagamento validi
- [ ] Importi plausibili
- [ ] Descrizioni coerenti con categorie
- [ ] Stipendi alle giuste date (1° di ogni mese)
- [ ] Spesa settimanale (giovedì)
- [ ] **[12 MESI]** Vacanze estive visibili (luglio-agosto)
- [ ] **[12 MESI]** Spese natalizie a dicembre
- [ ] **[12 MESI]** Back-to-school spese a settembre

### Test funzionali con i dati:

- [ ] Dashboard mostra bilancio positivo
- [ ] Report per categoria mostra breakdown realistico
- [ ] Trend mensile visibile (se 12 mesi)
- [ ] Vacanze estive visibili nel trend (se 12 mesi)
- [ ] Auto-categorizzazione funziona con i keyword
- [ ] Filtri per data/categoria/metodo pagamento funzionano
- [ ] Esportazione dati non ha errori

