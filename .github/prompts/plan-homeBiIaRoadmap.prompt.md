## Plan: Roadmap IA HomeBI SaaS

Portare HomeBI a un livello superiore con IA in due tempi: MVP in 2-4 settimane focalizzato su Chat analitica + Consigli risparmio, e base tecnica pronta per Benchmark famiglie simili, Analisi bollette e Auto-categorizzazione IA. L'approccio consigliato è retrieval su dati transazionali già presenti (senza fine-tuning iniziale), orchestrazione tool-based su API interne, e guardrail forti su privacy/costi/accuratezza.

**Steps**
1. Fase 0 - Fondazioni dati e sicurezza (bloccante)
1. Definire un contratto dati analytics unificato per IA riusando endpoint esistenti di report/dashboard e query aggregate dedicate per NLP analytics. Dipende da nessuno.
1. Implementare uno strato di pseudonimizzazione per prompt/context (mascheramento payee, note, place, eventuali PII) prima di inviare dati al provider cloud. Dipende da step precedente.
1. Aggiungere audit IA: log delle richieste, tool chiamati, latenza, costo stimato token, esito/fallback. Parallelizzabile con pseudonimizzazione.

2. Fase 1 - MVP Chat analitica su spese (2-4 settimane) (bloccante)
1. Creare endpoint chat server-side con orchestrazione tool: intent parsing -> chiamata API/query dati -> risposta in italiano con numeri verificabili e citazione periodo/filtro usato. Dipende da Fase 0.
1. Definire catalogo intent MVP (esempi): mese con spesa max per categoria, trend YoY, top categorie, confronto metodi pagamento, anomalie mese corrente vs media 3-6 mesi. Dipende da endpoint chat.
1. Implementare fallback deterministici: se domanda mappabile a intent noto, usare pipeline non-generativa con template di risposta; usare LLM per parafrasi/spiegazione. Parallelizzabile parzialmente con intent catalog.
1. Aggiungere UI chat nella dashboard/report con suggerimenti prompt, storico breve, e card di risposta con CTA ai report esistenti. Dipende da endpoint chat.

3. Fase 2 - Consigli risparmio personalizzati (MVP+)
1. Implementare motore regole + scoring (prima del ML): regole su variabilità, crescita YoY per categoria, ricorrenze, quota categoria su totale, picchi anomali. Dipende da Fase 1.
1. Rendere i consigli action-oriented: importo potenziale risparmio, confidenza, motivazione, azione consigliata, e link a vista movimenti filtrata.
1. Inserire feedback loop utente (utile/non utile, applicato/non applicato) per misurare qualità e preparare una futura fase ML. Parallelizzabile con UI consigli.

4. Fase 3 - Benchmark famiglie simili (post-MVP guidato da dati esterni)
1. Definire metrica di comparabilità (nucleo familiare, area geografica, fascia reddito, composizione età) e disclaimer legali/statistici.
1. Integrare dataset ISTAT/open data in pipeline ETL periodica con normalizzazione categorie HomeBI <-> categorie ufficiali. Dipende da definizione metrica.
1. Esporre benchmark come range/percentili (non valore assoluto unico), con spiegazione metodologia e qualità del match. Dipende da ETL.

5. Fase 4 - Analisi bollette luce/gas con storico consumi (post-MVP ad alto valore)
1. Definire nuovo modello dati bollette (fornitore, periodo competenza, kWh/Smc, costi quota energia/fissa/oneri/imposte, POD/PDR hash).
1. Implementare ingestion documenti (PDF/immagini) con estrazione campi ibrida: parser deterministico + OCR/LLM extraction con validazione schema. Dipende da modello dati.
1. Costruire report consumi/costi: trend stagionale, prezzo medio unitario, confronto stessa stagione anno precedente, alert su variazioni anomale.

6. Fase 5 - Auto-categorizzazione IA avanzata (complementare)
1. Estendere la categorizzazione attuale keyword-based con modello suggestivo: top-3 categorie con confidenza, senza auto-apply sotto soglia.
1. Addestrare progressivamente un classificatore leggero sui dati etichettati interni (human-in-the-loop), mantenendo keyword mapping come override di priorità alta.

7. Decisioni architetturali e toolstack (in parallelo a Fasi 1-2)
1. LLM orchestration: iniziare con approccio tool-calling su provider cloud (pseudonimizzato) invece di fine-tuning.
1. Retrieval: usare dati transazionali strutturati come fonte primaria; RAG documentale solo per benchmark esterno e bollette.
1. Fine-tuning: non nel MVP; rivalutare dopo avere almeno dataset feedback + metriche errore intent/categorizzazione.
1. Cost control: caching risposte su query ripetute, limiti token, rate limit per utente, e fallback deterministici.

8. Piano rilascio incrementale
1. Sprint 1: Fase 0 + primo intent chat (Q&A base) + logging.
1. Sprint 2: intent estesi + UI chat + consigli risparmio v1.
1. Sprint 3: hardening, quality gates, rollout graduale su cohort utenti.
1. Sprint 4+: benchmark esterno e bollette.

**Relevant files**
- /home/federico/project/HomeBI/app/api/report/analisi/route.js - logica YoY/proiezioni da riusare come tool analytics
- /home/federico/project/HomeBI/app/api/report/categorie/route.js - breakdown categoria e delta già pronti per intent NLP
- /home/federico/project/HomeBI/app/api/report/pivot/route.js - matrice categoria x mese utile per domande comparative
- /home/federico/project/HomeBI/app/api/dashboard/route.js - KPI mensili/trend base da esporre alla chat
- /home/federico/project/HomeBI/app/api/movimenti/route.js - filtri granulari per drill-down suggerimenti
- /home/federico/project/HomeBI/lib/models/Movement.js - schema transazioni, estensioni per segnali IA
- /home/federico/project/HomeBI/lib/models/KeywordMapping.js - baseline categorizzazione da affiancare con IA
- /home/federico/project/HomeBI/lib/utils/autoCategorize.js - punto di integrazione per ranking categorie IA
- /home/federico/project/HomeBI/app/api/import/parse/route.js - pipeline ingestion già pronta per enrichment IA
- /home/federico/project/HomeBI/components/import/StepReview.js - UX ideale per mostrare suggerimenti con confidenza
- /home/federico/project/HomeBI/app/(dashboard)/page.js - entrypoint naturale per widget/chat IA
- /home/federico/project/HomeBI/app/(dashboard)/report/analisi/page.js - superficie UX per spiegazioni e consigli IA

**Verification**
1. Definire benchmark qualità MVP chat: accuratezza numerica risposte >= 95% su set domande gold interne.
2. Aggiungere test integrazione API chat con casi intent noti, casi ambigui, e fallback deterministici.
3. Validare privacy: test automatici che impediscono invio campi PII non pseudonimizzati al provider.
4. Misurare costi: dashboard metrica token/costo per richiesta, p95 latenza, error rate provider.
5. QA funzionale con scenari reali: domanda comparativa, domanda risparmio, drill-down a movimenti filtrati.
6. Per bollette: validazione estrazione campi su campione documenti (precision/recall per campo chiave).

**Decisions**
- Incluso nel primo rilascio: chat analitica + consigli risparmio (MVP in 2-4 settimane).
- Incluso in roadmap ma non MVP: benchmark famiglie simili, bollette, auto-categorizzazione IA avanzata.
- Escluso per ora: fine-tuning iniziale su LLM generalista (costo/tempo non coerenti con MVP).
- Vincolo privacy: provider cloud consentito solo con pseudonimizzazione e auditing.
- Posizionamento prodotto: progettare da subito per scenario SaaS multi-account.

**Further Considerations**
1. Benchmark esterno: meglio partire con ISTAT nazionale (implementazione rapida) o già con segmentazione geografica fine (più precisa ma più lenta).
2. Bollette: priorità a energia elettrica prima del gas per ridurre complessità parser iniziale.
3. UX chat: posizionamento in dashboard come assistente globale con deep-link ai report specialistici.