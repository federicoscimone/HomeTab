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


