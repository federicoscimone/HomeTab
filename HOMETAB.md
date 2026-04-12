# HomeTab — Personal Finance Tracker

## Descrizione

HomeTab è un'applicazione web per l'analisi e il tracciamento delle spese personali. Permette di registrare uscite effettuate con qualsiasi metodo di pagamento (contanti, carte, bonifici, ticket pasto, buoni acquisto), importare automaticamente movimenti bancari da file Excel, categorizzare le spese con un sistema gerarchico flessibile e visualizzare report analitici mensili/annuali con confronti e proiezioni.

---

## Caratteristiche Principali

### 1. Registrazione Spese Manuali
Ogni spesa include i seguenti campi:
- **Importo** — valore numerico
- **Metodo di pagamento** — contanti, carta di credito, carta di debito, bonifico, PayPal, ticket pasto, buono acquisto, altro
- **Data** — obbligatoria
- **Ora** — opzionale
- **Causale** — descrizione libera del motivo della spesa
- **Luogo** — dove è avvenuto il pagamento
- **Esercente** — a chi si è pagato (negozio, persona, azienda)
- **Note** — campo libero opzionale
- **Categoria principale** — obbligatoria
- **Sotto-categoria 1** — opzionale
- **Sotto-categoria 2** — opzionale

### 2. Metodi di Pagamento
Classificati in due macro-gruppi per distinguere le analisi:
- **Tradizionali**: Contanti, Carta di Credito, Carta di Debito, Bonifico, PayPal/Satispay
- **Alternativi**: Ticket Pasto, Buono Acquisto, Buono Carburante, Voucher

### 3. Categorie e Sotto-categorie
Sistema gerarchico a 3 livelli, completamente editabile dalle Impostazioni.

Categorie di esempio predefinite:
| Categoria | Sotto-categoria 1 | Sotto-categoria 2 |
|-----------|-------------------|-------------------|
| Utenze | Luce, Gas, Internet, Acqua, Telefono | — |
| Spesa | Supermercato, Mercato, Panetteria | — |
| Carburante | Benzina, Diesel, GPL, Elettrico | — |
| Cibo Pronto | Ristorante, Pizzeria, Fast Food, Delivery | Pranzo, Cena, Colazione |
| Salute | Farmacia, Medico, Dentista, Ottico | Visite, Esami, Farmaci |
| Shopping | Abbigliamento, Elettronica, Casa | — |
| Vacanze | Trasporti, Alloggio, Attività | — |
| Affitto | Affitto, Condominio | — |
| Regali | — | — |
| Studio | Corsi, Libri, Software | — |
| Animali | Cibo, Veterinario, Accessori | — |
| Intrattenimento | Cinema, Concerti, Abbonamenti | — |
| Trasporti | Treno, Bus, Taxi, Parcheggio | — |

### 4. Importazione da File Excel / CSV
- Caricamento diretto di file `.xlsx`, `.csv`
- Copia-incolla da foglio Excel (testo separato da tabulazioni)
- **Template di mappatura colonne**: ogni banca/formato ha un proprio template salvato che mappa le colonne del file ai campi interni (data, importo, descrizione, esercente, ecc.)
- **Auto-categorizzazione**: mapping parole chiave → categoria. La descrizione del movimento viene analizzata e la categoria viene assegnata automaticamente in base a keyword configurabili
- Revisione e correzione manuale prima del salvataggio definitivo

### 5. Report e Analisi

#### Dashboard
- Riepilogo del mese corrente: totale uscite, suddivisione per categoria, confronto con mese precedente
- Widget per metodo di pagamento (tradizionale vs alternativo)

#### Report Mensile Pivot
- Tabella pivot categorie × mesi
- Filtri per anno, categoria, metodo di pagamento
- Export CSV/Excel

#### Analisi per Categoria
- Media mensile storica
- Andamento mensile (grafico lineare/barre)
- Andamento annuale (confronto anni)

#### Analisi Avanzata
- Selezione range di date libero
- Confronto con stesso periodo dell'anno precedente (delta % e assoluto)
- Proiezioni future basate su media storica (es. proiezione fine anno)
- Separazione visiva pagamenti tradizionali / alternativi

---

## Stack Tecnologico

| Layer | Tecnologia |
|-------|------------|
| Frontend & Backend | Next.js 14 (App Router, JavaScript) |
| Database | MongoDB + Mongoose |
| UI Components | Tailwind CSS + DaisyUI |
| Grafici | Recharts |
| Parsing Excel | xlsx (SheetJS) |
| Gestione form | React Hook Form |
| State | React Context + SWR |
| Autenticazione | (fase 2) NextAuth.js |

---

## Struttura del Progetto

```
hometab/
├── app/
│   ├── (dashboard)/
│   │   ├── page.js              # Dashboard principale
│   │   ├── spese/
│   │   │   ├── page.js          # Lista spese
│   │   │   ├── nuova/page.js    # Form nuova spesa
│   │   │   └── [id]/page.js     # Dettaglio/modifica spesa
│   │   ├── importa/
│   │   │   └── page.js          # Import da file
│   │   ├── report/
│   │   │   ├── page.js          # Report pivot mensile
│   │   │   ├── categorie/page.js
│   │   │   └── analisi/page.js
│   │   └── impostazioni/
│   │       ├── page.js          # Impostazioni generali
│   │       ├── categorie/page.js
│   │       ├── metodi-pagamento/page.js
│   │       ├── template-import/page.js
│   │       └── keyword-mapping/page.js
│   └── api/
│       ├── spese/route.js
│       ├── categorie/route.js
│       ├── import/route.js
│       ├── report/route.js
│       └── impostazioni/route.js
├── components/
│   ├── layout/
│   ├── spese/
│   ├── import/
│   ├── report/
│   └── ui/
├── lib/
│   ├── mongodb.js
│   ├── models/
│   │   ├── Expense.js
│   │   ├── Category.js
│   │   ├── ImportTemplate.js
│   │   └── KeywordMapping.js
│   └── utils/
│       ├── importParser.js
│       ├── autoCategorize.js
│       └── reportHelpers.js
└── public/
```

---

## Modelli Dati (MongoDB)

### Expense
```json
{
  "_id": "ObjectId",
  "amount": 45.80,
  "paymentMethod": "credit_card",
  "paymentGroup": "traditional",
  "date": "2026-03-15",
  "time": "13:30",
  "description": "Pranzo di lavoro",
  "place": "Milano",
  "payee": "Ristorante Da Mario",
  "notes": "",
  "categoryId": "ObjectId",
  "subCategory1Id": "ObjectId",
  "subCategory2Id": null,
  "source": "manual",
  "importBatchId": null,
  "createdAt": "ISODate"
}
```

### Category
```json
{
  "_id": "ObjectId",
  "name": "Cibo Pronto",
  "color": "#FF6B35",
  "icon": "utensils",
  "level": 1,
  "parentId": null,
  "order": 5
}
```

### ImportTemplate
```json
{
  "_id": "ObjectId",
  "name": "Intesa Sanpaolo - Estratto Carta",
  "fileType": "xlsx",
  "skipRows": 2,
  "delimiter": ";",
  "dateFormat": "DD/MM/YYYY",
  "columnMapping": {
    "date": "A",
    "amount": "D",
    "description": "B",
    "payee": "C"
  }
}
```

### KeywordMapping
```json
{
  "_id": "ObjectId",
  "keyword": "esselunga",
  "categoryId": "ObjectId",
  "subCategory1Id": "ObjectId",
  "caseSensitive": false,
  "priority": 10
}
```

---

## Roadmap di Sviluppo

### FASE 1 — Setup e Infrastruttura
- [x] 1.1 Inizializzazione progetto Next.js (JavaScript, App Router)
- [x] 1.2 Configurazione Tailwind CSS + DaisyUI
- [x] 1.3 Connessione MongoDB (local + env config)
- [x] 1.4 Definizione modelli Mongoose (Expense, Category, ImportTemplate, KeywordMapping)
- [x] 1.5 Layout principale con navigazione sidebar
- [x] 1.6 Seed dati iniziali: categorie predefinite, metodi di pagamento

### FASE 2 — Gestione Spese Manuali
- [x] 2.1 Pagina lista spese con filtri (data, categoria, metodo pagamento)
- [x] 2.2 Form inserimento nuova spesa (tutti i campi)
- [x] 2.3 Form modifica spesa esistente
- [x] 2.4 Eliminazione spesa con conferma
- [x] 2.5 Paginazione e ricerca nella lista

### FASE 3 — Impostazioni e Configurazione
- [x] 3.1 Gestione categorie: CRUD con albero gerarchico a 3 livelli
- [x] 3.2 Gestione metodi di pagamento: visualizzazione con gruppi tradizionale/alternativo
- [x] 3.3 Gestione template di importazione: CRUD con mappatura colonne e anteprima
- [x] 3.4 Gestione keyword mapping per auto-categorizzazione

### FASE 4 — Importazione da File
- [x] 4.1 Upload file Excel/CSV con parser SheetJS
- [x] 4.2 Copia-incolla testo tabulato con parser testuale
- [x] 4.3 Selezione/applicazione template di mappatura colonne
- [x] 4.4 Motore di auto-categorizzazione basato su keyword
- [x] 4.5 Schermata di revisione: tabella modificabile pre-import
- [x] 4.6 Salvataggio batch con gestione duplicati

### FASE 5 — Dashboard
- [x] 5.1 Riepilogo mese corrente: totale, top categorie, metodi pagamento
- [x] 5.2 Grafico uscite/entrate per categoria (torta)
- [x] 5.3 Confronto mese corrente vs mese precedente
- [x] 5.4 Widget separato: tradizionale vs alternativo

### FASE 6 — Report e Analisi
- [x] 6.1 Tabella pivot mensile (categoria × mese) con totali
- [x] 6.2 Filtri pivot: anno, metodo pagamento, gruppo pagamento
- [x] 6.3 Sezione per categoria: media mensile + grafico andamento
- [x] 6.4 Grafico andamento annuale per categoria
- [x] 6.5 Analisi range date custom con confronto anno precedente
- [x] 6.6 Proiezioni fine anno basate su media storica
- [x] 6.7 Export report in CSV/Excel

### FASE AUTH — Autenticazione e Sicurezza (completata)
- [x] Auth.1 Auth.js v5 con Credentials provider (email + password)
- [x] Auth.2 Sessioni JWT con cookie HTTP-only (30 giorni)
- [x] Auth.3 Protezione rotte via proxy.js (Next.js 16)
- [x] Auth.4 Modello User (bcryptjs, ruoli admin/viewer)
- [x] Auth.5 Pagina login `/login`
- [x] Auth.6 Setup primo utente `/setup` (attivo solo se DB vuoto)
- [x] Auth.7 Reset password via link criptato con scadenza 60 min
- [x] Auth.8 Token SHA-256 hashed nel DB + indice TTL auto-cleanup
- [x] Auth.9 Email HTML reset + conferma avvenuto cambio (Nodemailer)
- [x] Auth.10 Cambio password da impostazioni (con verifica password attuale)
- [x] Auth.11 Avatar utente + logout nella sidebar

### FASE 7 — Rifinitura e UX
- [x] 7.1 Modalità scura (DaisyUI light/dark, toggle sidebar, FOUC prevention, preferenza OS)
- [ ] 7.2 Multi-utente / famiglie
- [x] 7.3 App mobile (PWA: manifest, service worker, icone, pagina offline, shortcuts)
- [ ] 7.4 Import automatico via API bancarie (PSD2)

---

## Note Architetturali

- Le API sono tutte in `/app/api/` come Route Handlers di Next.js
- La connessione MongoDB viene gestita con un singleton per evitare connessioni multiple in dev
- L'auto-categorizzazione applica le keyword in ordine di priorità; in caso di match multiplo vince la keyword con priorità più alta
- I metodi alternativi (ticket pasto ecc.) vengono sempre evidenziati separatamente in tutti i report
- Il campo `paymentGroup` è derivato dal metodo scelto e semplifica i filtri nei report
