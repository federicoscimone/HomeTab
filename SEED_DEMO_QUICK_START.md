# 🎯 Demo Data Setup - Quick Start

## TL;DR: Carica i dati in 10 secondi

```bash
# 1 mese (maggio 2026) - veloce, leggero
bash seed-demo.sh 1

# OPPURE

# 12 mesi (gennaio-dicembre 2026) - completo con stagionalità ⭐ CONSIGLIATO
bash seed-demo.sh 12
```

---

## 📊 Cosa carica?

### Dataset 1 mese
```
bash seed-demo.sh 1
```
- **Periodo:** maggio 2026
- **Movimenti:** ~60 (spese + entrate)
- **Tempo:** < 5 secondi
- **Use case:** Test rapido, prototipazione, debug locale

### Dataset 12 mesi ⭐ CONSIGLIATO
```
bash seed-demo.sh 12
```
- **Periodo:** gennaio - dicembre 2026
- **Movimenti:** ~500+ (spese + entrate)
- **Tempo:** < 10 secondi
- **Use case:** Test completo, report storici, stagionalità, analitiche

---

## 👨‍👩‍👧‍👦 Chi sono i dati?

**Famiglia italiana di 4 persone:**
- Marco (padre, lavora) → stipendio €2,200/mese
- Lucia (madre, ospedale) → stipendio €1,850/mese
- Giulia (12 anni, scuola media) → spese scolastiche
- Lorenzo (15 anni, liceo) → spese scolastiche
- Gatto + cane

**Spese realistiche:** affitto, utenze, spesa, carburante, scuola, vacanze, etc.

---

## 📈 Cosa succede ogni mese (12 mesi)

| Mese | Evento | Spese extra |
|------|--------|-----------|
| Gen | Inizio anno | Retta scuola, zaino |
| Feb | Carnevale | Costumi |
| Mar | Primavera | Lezioni |
| Apr | Pasqua | Cibo pasquale, regalo |
| Mag | Festa mamma | Fiori, palestra |
| **Giu** | **Fine scuola** | **Gite, libri** |
| **Lug** | **🏖️ VACANZE** | **Albergo, spiaggia** |
| **Ago** | **🏖️ VACANZE** | **Hotel montagna** |
| **Set** | **📚 SCUOLA** | **Libri, zaino** |
| Ott | Manutenzione | Revisione auto |
| Nov | Natale (prep) | Decorazioni |
| **Dic** | **🎄 NATALE** | **Regali, dolci** |

---

## 💰 Numeri (anno 2026)

| Voce | Importo |
|------|---------|
| **Spese totali** | ~€39,000 |
| **Media mensile** | ~€3,250 |
| **Entrate totali** | ~€51,600 |
| **Bilancio annuale** | **+€12,600** ✅ |
| **Bilancio mensile** | **+€1,050** ✅ |

---

## 🔍 Dopo il seed, verifica con:

```bash
# Conta movimenti
mongosh
> db.movements.countDocuments()     # ~60 (1 mese) o ~500+ (12 mesi)

# Vedi primi movimenti
> db.movements.find().limit(3)

# Totale spese
> db.movements.aggregate([
    { $match: { type: 'expense' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])

# Spese per mese (12 mesi only)
> db.movements.aggregate([
    { $group: { _id: { $substr: ['$date', 0, 7] }, total: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } } } },
    { $sort: { _id: 1 } }
  ])
```

---

## 🧹 Ricominciare da zero

**Cancella tutto:**
```bash
# In MongoDB Compass:
# 1. Tasto destro su database → Drop Database
# 2. Ricorri seed:
bash seed-demo.sh 12
```

---

## 📚 Leggi anche:

- **`DEMO_DATA.md`** — Documentazione completa (categorie, keyword, dettagli)
- **`lib/seed.js`** — Seed categorie base
- **`lib/seed-demo-family.js`** — Dati 1 mese
- **`lib/seed-demo-family-12months.js`** — Dati 12 mesi ⭐
- **`lib/seed-keywords-demo.js`** — Auto-categorizzazione keyword

---

## ❓ FAQ

**Q: Quale dataset dovrei usare?**  
A: 12 mesi, sempre. È quello che mostra veramente come funziona l'app.

**Q: Posso modificare i dati?**  
A: Sì, edita i file `.js` in `lib/seed-*.js`. Leggi DEMO_DATA.md per i dettagli.

**Q: Mi serve un dataset diverso (altre persone, altre categorie)?**  
A: Modifica i file `.js` direttamente. La struttura è semplice e ben commentata.

**Q: Come cancello i dati?**  
A: Cancella la collection `movements` in MongoDB o usa MongoDB Compass.

