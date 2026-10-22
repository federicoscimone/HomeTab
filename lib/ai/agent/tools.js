/**
 * @fileoverview Gli strumenti dell'agente della chat: tutti in sola lettura.
 * @module lib/ai/agent/tools
 *
 * Il modello non fa conti: sceglie lo strumento e i parametri, e i numeri li calcolano le stesse
 * funzioni dei report (lib/services/reports.js). Ogni risultato porta:
 * - gli importi già formattati nella lingua dell'utente, da citare così come sono;
 * - il link alla pagina dell'app che mostra lo stesso numero con gli stessi filtri, per verificarlo.
 *
 * I testi dei movimenti (causali, esercenti) sono mascherati come nell'import, e il modello li
 * riceve come dati: una causale che contiene istruzioni non diventa un'azione, perché nessuno
 * strumento modifica qualcosa.
 *
 * Gli strumenti usano gli stessi valori predefiniti delle pagine (pagamenti tradizionali, buoni
 * pasto esclusi): altrimenti il numero in chat e quello del link non coinciderebbero.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import Category from '../../models/Category.js';
import Movement from '../../models/Movement.js';
import Goal from '../../models/Goal.js';
import { projectBreakdown, tasksSummary } from '../../utils/project.js';
import { categoryReport, monthSummary, subcategoryReport, totalsByCategory } from '../../services/reports.js';
import { getGoalsOverview } from '../../services/goals.js';
import { istatComparison } from '../../services/istatCompare.js';
import { loadSignals, rankSignals } from '../../services/insights.js';
import { yearProjection } from '../../services/projection.js';
import { listDeadlines } from '../../services/deadlines.js';
import { parseChanges, runScenario } from '../../services/scenario.js';
import { signalView } from '../tasks/advice.js';
import { buildMovementFilter } from '../../utils/movementFilter.js';
import { fmtFull, fmtPct } from '../../utils/format.js';
import { todayString } from '../../utils/comparePeriods.js';
import { maskRow } from '../mask.js';

const GROUPS = { tradizionali: 'traditional', alternativi: 'alternative', tutti: 'all' };
const TYPES = { uscite: 'expense', entrate: 'income' };
const MAX_MOVEMENTS = 20;

const gruppo = z.enum(['tradizionali', 'alternativi', 'tutti']).default('tradizionali')
  .describe('Gruppo di pagamenti: "tradizionali" (predefinito, come le pagine dell\'app: esclusi buoni pasto e simili), "alternativi" (solo buoni) o "tutti".');
const tipo = z.enum(['uscite', 'entrate']).default('uscite');
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Data YYYY-MM-DD.');

/** Arrotonda al centesimo e affianca il testo formattato: il modello cita il secondo. */
const money = (value, locale) => ({ valore: Math.round((value ?? 0) * 100) / 100, testo: fmtFull(value ?? 0, locale) });
const pct = (v, locale) => (v == null ? null : fmtPct(v, locale));
const link = (path, params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  return q.toString() ? `${path}?${q}` : path;
};
/** I risultati degli strumenti sono JSON compatto: meno token, e il modello li legge bene. */
const out = (obj) => JSON.stringify(obj);

/**
 * Cerca una categoria di primo livello per nome, senza badare a maiuscole e accenti. Il nome di
 * una sottocategoria porta alla sua categoria, segnalandolo.
 */
async function resolveCategory(name) {
  const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const all = await Category.find({ level: { $in: [1, 2] } }).select('name level parentId').lean();
  const wanted = norm(name);
  const exact = all.find((c) => norm(c.name) === wanted) ?? all.find((c) => norm(c.name).includes(wanted));
  if (!exact) return { error: 'categoria non trovata', categorie: all.filter((c) => c.level === 1).map((c) => c.name) };
  if (exact.level === 1) return { category: exact };
  const parent = all.find((c) => String(c._id) === String(exact.parentId));
  return { category: parent, subcategory: exact };
}

/**
 * @param {{ locale: string, uncategorized: string, labels: { division: (code: string) => string, area: (code: string) => string } }} ctx
 * @returns {import('@langchain/core/tools').StructuredTool[]}
 */
export function buildTools({ locale, uncategorized, labels }) {
  const riepilogoMese = tool(async ({ anno, mese, gruppo: g }) => {
    const r = await monthSummary({ year: anno, month: mese, paymentGroup: GROUPS[g], uncategorized });
    const saving = r.current.totalIncome - r.current.totalExpense;
    return out({
      periodo: `${anno}-${String(mese).padStart(2, '0')}`,
      in_corso: r.previous.toDay != null,
      gruppo: g,
      uscite: money(r.current.totalExpense, locale),
      entrate: money(r.current.totalIncome, locale),
      risparmio: money(saving, locale),
      mese_precedente: {
        uscite: money(r.previous.totalExpense, locale),
        entrate: money(r.previous.totalIncome, locale),
        // Mese in corso: il confronto è con gli stessi giorni del mese prima.
        fino_al_giorno: r.previous.toDay,
      },
      categorie_principali: r.byCategory.map((c) => ({ categoria: c.name, uscite: money(c.amount, locale) })),
      link: link('/', { year: anno, month: mese, paymentGroup: GROUPS[g] }),
    });
  }, {
    name: 'riepilogo_mese',
    description: 'Entrate, uscite e risparmio di un mese, con il confronto con il mese precedente e le categorie di spesa principali. Per il mese in corso il confronto è con gli stessi giorni del mese prima.',
    schema: z.object({ anno: z.number().int().min(2000).max(2100), mese: z.number().int().min(1).max(12), gruppo }),
  });

  const spesePerCategoria = tool(async ({ anno, mese, tipo: t, categoria, confronto, gruppo: g }) => {
    let categoryId = null;
    const pg = GROUPS[g] === 'all' ? '' : GROUPS[g];
    if (categoria) {
      const found = await resolveCategory(categoria);
      if (found.error) return out(found);
      categoryId = String(found.category._id);
      if (found.subcategory) {
        // Sottocategoria: il report per categoria mostra solo le principali, quindi il numero si
        // verifica sulla lista dei movimenti filtrata, che ne mostra il totale.
        const subId = String(found.subcategory._id);
        const r = await subcategoryReport({
          year: anno, month: mese ?? null, type: TYPES[t], paymentGroup: pg, subCategoryId: subId,
          compare: confronto === 'anno_intero' ? 'full' : 'period',
        });
        const listLink = (range) => link('/movimenti', {
          from: range.from, to: range.to, categoryIds: subId, type: TYPES[t], paymentGroup: pg, inAnalysis: 1,
        });
        return out({
          anno, mese: mese ?? null, tipo: t, gruppo: g, confronto,
          categoria: `${found.category.name} → ${found.subcategory.name}`,
          periodo: { da: r.current.from, a: r.current.to, totale: money(r.current.total, locale), movimenti: r.current.count, link: listLink(r.current) },
          anno_prima: { da: r.previous.from, a: r.previous.to, totale: money(r.previous.total, locale), movimenti: r.previous.count, link: listLink(r.previous) },
          differenza: money(r.deltaAbs, locale),
          variazione: pct(r.deltaPct, locale),
        });
      }
    }
    const r = await categoryReport({
      year: anno, month: mese ?? null, type: TYPES[t], paymentGroup: pg, categoryId,
      compare: confronto === 'anno_intero' ? 'full' : 'period',
    });
    return out({
      anno, mese: mese ?? null, tipo: t, gruppo: g, confronto,
      // Periodo in corso: con "stesso_periodo" l'anno prima è contato fino allo stesso giorno.
      fino_al: r.cutoff,
      categorie: r.categories.slice(0, categoryId ? 1 : 15).map((c) => ({
        categoria: c.categoryName,
        totale: money(c.totalCur, locale),
        anno_prima: money(c.totalPrev, locale),
        differenza: money(c.deltaAbs, locale),
        variazione: pct(c.deltaPct, locale),
        ...(c.avg != null ? { media_mensile: money(c.avg, locale) } : {}),
      })),
      link: link('/report/categorie', {
        year: anno, month: mese, type: TYPES[t], paymentGroup: GROUPS[g],
        compare: confronto === 'anno_intero' ? 'full' : null,
      }),
    });
  }, {
    name: 'spese_per_categoria',
    description: 'Totali per categoria in un anno (o in un mese di quell\'anno) e confronto con lo stesso periodo dell\'anno prima. Con "categoria" restituisce solo quella, anche se è una sottocategoria. Per l\'anno o il mese in corso, "stesso_periodo" confronta fino allo stesso giorno dell\'anno prima, "anno_intero" con tutto l\'anno o mese precedente.',
    schema: z.object({
      anno: z.number().int().min(2000).max(2100),
      mese: z.number().int().min(1).max(12).optional().describe('Solo un mese dell\'anno; ometti per l\'anno intero.'),
      tipo,
      categoria: z.string().max(100).optional().describe('Nome di una categoria o di una sottocategoria, come nell\'elenco (es. «Ristorante», dentro «Cibo Pronto»). Usa la sottocategoria quando la domanda riguarda quella.'),
      confronto: z.enum(['stesso_periodo', 'anno_intero']).default('stesso_periodo'),
      gruppo,
    }),
  });

  const confrontaPeriodi = tool(async ({ periodo_a: a, periodo_b: b, tipo: t, gruppo: g }) => {
    const pg = GROUPS[g] === 'all' ? '' : GROUPS[g];
    const [ra, rb] = await Promise.all([
      totalsByCategory({ from: a.da, to: a.a, type: TYPES[t], paymentGroup: pg, uncategorized }),
      totalsByCategory({ from: b.da, to: b.a, type: TYPES[t], paymentGroup: pg, uncategorized }),
    ]);
    const names = [...new Set([...ra.byCategory, ...rb.byCategory].map((c) => c.name))];
    const amount = (r, n) => r.byCategory.find((c) => c.name === n)?.amount ?? 0;
    const rows = names.map((n) => {
      const va = amount(ra, n);
      const vb = amount(rb, n);
      return { categoria: n, a: money(va, locale), b: money(vb, locale), differenza: money(vb - va, locale), variazione: pct(va > 0 ? ((vb - va) / va) * 100 : null, locale) };
    }).sort((x, y) => Math.abs(y.differenza.valore) - Math.abs(x.differenza.valore)).slice(0, 15);
    return out({
      tipo: t, gruppo: g,
      periodo_a: { da: a.da, a: a.a, totale: money(ra.total, locale), movimenti: ra.count, link: link('/report/analisi', { from: a.da, to: a.a, type: TYPES[t], paymentGroup: GROUPS[g] }) },
      periodo_b: { da: b.da, a: b.a, totale: money(rb.total, locale), movimenti: rb.count, link: link('/report/analisi', { from: b.da, to: b.a, type: TYPES[t], paymentGroup: GROUPS[g] }) },
      differenza_totale: money(rb.total - ra.total, locale),
      variazione_totale: pct(ra.total > 0 ? ((rb.total - ra.total) / ra.total) * 100 : null, locale),
      categorie: rows,
    });
  }, {
    name: 'confronta_periodi',
    description: 'Confronta due intervalli di date qualsiasi, per categoria (differenza = B meno A). Per confrontare con lo stesso periodo dell\'anno prima usa spese_per_categoria.',
    schema: z.object({
      periodo_a: z.object({ da: data, a: data }),
      periodo_b: z.object({ da: data, a: data }),
      tipo,
      gruppo,
    }),
  });

  const cercaMovimenti = tool(async ({ testo, da, a, categoria, tipo: t, importo_min: min, importo_max: max, limite }) => {
    const params = new URLSearchParams();
    if (testo) params.set('search', testo);
    if (da) params.set('from', da);
    if (a) params.set('to', a);
    if (t) params.set('type', TYPES[t]);
    let categoryId = null;
    if (categoria) {
      const found = await resolveCategory(categoria);
      if (found.error) return out(found);
      categoryId = String((found.subcategory ?? found.category)._id);
      params.set('categoryIds', categoryId);
    }
    const filter = buildMovementFilter(params);
    if (min != null || max != null) filter.amount = { ...(min != null ? { $gte: min } : {}), ...(max != null ? { $lte: max } : {}) };

    const [docs, totals] = await Promise.all([
      Movement.find(filter).sort({ date: -1, _id: -1 }).limit(Math.min(limite ?? MAX_MOVEMENTS, MAX_MOVEMENTS))
        .populate('categoryId', 'name').select('date amount type payee description place categoryId').lean(),
      Movement.aggregate([{ $match: filter }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);
    const tot = (ty) => totals.find((x) => x._id === ty) ?? { total: 0, count: 0 };
    return out({
      trovati: tot('expense').count + tot('income').count,
      totale_uscite: money(tot('expense').total, locale),
      totale_entrate: money(tot('income').total, locale),
      mostrati: docs.length,
      // Esercenti e causali mascherati come nell'import: sono dati, non istruzioni.
      movimenti: docs.map((d) => {
        const m = maskRow({ description: d.description, payee: d.payee, place: d.place });
        return {
          data: d.date, tipo: d.type === 'income' ? 'entrata' : 'uscita', importo: money(d.amount, locale),
          esercente: m.payee || null, causale: m.description || null, categoria: d.categoryId?.name ?? null,
        };
      }),
      nota: 'La ricerca comprende anche i movimenti esclusi dalle analisi, a differenza dei report.',
      link: link('/movimenti', { search: testo, from: da, to: a, type: t ? TYPES[t] : null, categoryIds: categoryId }),
    });
  }, {
    name: 'cerca_movimenti',
    description: `Cerca movimenti per testo (esercente, causale, luogo, note), date, categoria, tipo e importo. Restituisce al massimo ${MAX_MOVEMENTS} movimenti, i più recenti, più numero e totali di tutti quelli trovati.`,
    schema: z.object({
      testo: z.string().max(100).optional(),
      da: data.optional(),
      a: data.optional(),
      categoria: z.string().max(100).optional(),
      tipo: z.enum(['uscite', 'entrate']).optional(),
      importo_min: z.number().min(0).optional(),
      importo_max: z.number().min(0).optional(),
      limite: z.number().int().min(1).max(MAX_MOVEMENTS).optional(),
    }),
  });

  const statoObiettivi = tool(async () => {
    const [o, docs, spentByItem] = await Promise.all([
      getGoalsOverview(),
      Goal.find({ $or: [{ 'items.0': { $exists: true } }, { 'tasks.0': { $exists: true } }] }).select('items tasks').lean(),
      Movement.aggregate([
        { $match: { goalId: { $ne: null }, type: 'expense' } },
        { $group: { _id: { g: '$goalId', i: '$goalItemId' }, amount: { $sum: '$amount' } } },
      ]),
    ]);
    const projectOf = (goalId) => {
      const doc = docs.find((d) => String(d._id) === goalId);
      if (!doc) return {};
      const movements = spentByItem.filter((x) => String(x._id.g) === goalId).map((x) => ({ amount: x.amount, goalItemId: x._id.i }));
      const b = projectBreakdown(doc.items ?? [], movements);
      const ts = tasksSummary(doc.tasks ?? [], todayString());
      return {
        progetto: {
          voci: b.rows.map((r) => ({
            voce: r.name, budget: money(r.budget, locale), preventivo: r.quote != null ? money(r.quote, locale) : null,
            speso: money(r.spent, locale), sfora: r.over, preventivo_sopra_budget: r.quoteOver,
          })),
          cose_da_fare: (doc.tasks ?? []).map((x) => ({ cosa: x.text, entro: x.due, fatta: x.done })),
          cose_in_ritardo: ts.overdue,
        },
      };
    };
    return out({
      mese_corrente: o.currentMonth,
      risparmio_medio_mensile: o.avgSavings == null ? null : money(o.avgSavings, locale),
      obiettivi: o.goals.map((g) => ({
        nome: g.name,
        stato: g.state,
        traguardo: money(g.targetAmount, locale),
        accumulato: money(g.saved, locale),
        avanzamento: `${Math.round(g.progress * 100)}%`,
        scadenza: g.deadline,
        ...(g.projection ? {
          mancante: money(g.projection.remaining, locale),
          quota_mensile_necessaria: g.projection.requiredMonthly == null ? null : money(g.projection.requiredMonthly, locale),
          mese_previsto_di_arrivo: g.projection.reachMonth,
        } : {}),
        ...projectOf(g.id),
      })),
      link: '/obiettivi',
    });
  }, {
    name: 'stato_obiettivi',
    description: 'Gli obiettivi di risparmio: traguardo, accumulato, avanzamento, scadenza, quota mensile necessaria e mese previsto di arrivo; per quelli che sono progetti, le voci con budget, preventivo e speso, e le cose da fare.',
    schema: z.object({}),
  });

  const confrontoIstat = tool(async () => {
    const r = await istatComparison();
    const row = (x) => ({
      voi: x.yours == null ? null : money(x.yours, locale),
      istat: x.istat == null ? null : money(x.istat, locale),
      differenza: x.diff == null ? null : money(x.diff, locale),
      variazione: pct(x.pct, locale),
      ...(x.estimated ? { stima: true } : {}),
      ...(x.area && x.area !== r.profile.region ? { dato_istat_di: labels.area(x.area) } : {}),
    });
    return out({
      anno_istat: r.istatYear,
      periodo: { da: r.period.from, a: r.period.to, mesi: r.period.months },
      profilo: {
        regione: r.profile.region ? labels.area(r.profile.region) : null,
        componenti: r.profile.members,
        ...(r.profileComplete ? {} : { nota: 'Profilo incompleto: il confronto usa la media italiana. Si completa nella pagina del link.' }),
      },
      importi: 'medie mensili',
      capitoli: r.rows.map((x) => ({ capitolo: labels.division(x.code), ...row(x) })),
      totale: row(r.total),
      non_confrontate: [
        ...r.unmapped.map((u) => ({ categoria: u.name, al_mese: money(u.monthly, locale) })),
        ...(r.uncategorized > 0 ? [{ categoria: uncategorized, al_mese: money(r.uncategorized, locale) }] : []),
      ],
      avvertenze: [
        'La media ISTAT include le famiglie che in un capitolo non spendono nulla.',
        'Casa: la media ISTAT mescola inquilini e proprietari, quindi chi è in affitto risulta quasi sempre sopra. Affitti figurativi esclusi (per regione è una stima); le rate del mutuo non sono spesa per ISTAT.',
        'Le cifre della famiglia includono tutti i metodi di pagamento, anche i buoni pasto.',
      ],
      fonte: `Istat, Indagine sulle spese delle famiglie ${r.istatYear}`,
      link: '/report/famiglie-simili',
    });
  }, {
    name: 'confronto_istat',
    description: 'Confronta la spesa media mensile della famiglia per capitolo (alimentari, casa, trasporti…) con la media ISTAT delle famiglie con lo stesso numero di componenti nella stessa regione, sugli ultimi 12 mesi completi. Da usare per «spendiamo più o meno degli altri?» e simili.',
    schema: z.object({}),
  });

  const segnaliRisparmio = tool(async () => {
    const { signals, hiddenCount } = await loadSignals();
    const top = rankSignals(signals, { perKind: 3, limit: 8 });
    return out({
      segnali: top.map((x) => ({ ...signalView(x, { locale, division: labels.division }), link: x.link })),
      altri_segnali: signals.length - top.length,
      nascosti_perche_non_utili: hiddenCount,
      nota: 'Segnali calcolati dal codice, in ordine di risparmio possibile. Spiega i più utili con i loro numeri; non inventare prezzi o offerte.',
    });
  }, {
    name: 'segnali_risparmio',
    description: 'Dove la famiglia potrebbe risparmiare: spese ricorrenti (abbonamenti, bollette) con il costo annuo, categorie in crescita sull\'anno prima, mesi anomali, capitoli sopra le famiglie simili, con l\'effetto sull\'obiettivo più indietro. Da usare per «dove possiamo risparmiare?», «quali abbonamenti paghiamo?» e simili.',
    schema: z.object({}),
  });

  const proiezioneAnno = tool(async () => {
    const { projection: p, goals } = await yearProjection();
    const flows = (x) => ({ entrate: money(x.income, locale), uscite: money(x.expense, locale), risparmio: money(x.savings, locale) });
    return out({
      oggi: todayString(),
      ...(p ? {
        anno: p.year,
        finora: flows(p.actual),
        previsto_a_fine_anno: flows(p.projected),
        anno_scorso_intero: p.lastYear ? flows(p.lastYear) : null,
        metodo: p.method === 'seasonal'
          ? 'mesi che mancano come gli stessi mesi dell\'anno scorso, corretti per l\'andamento di quest\'anno'
          : 'mesi che mancano come la media dei mesi chiusi (manca l\'anno scorso)',
      } : { nota: 'Dati insufficienti per una stima: serve almeno un mese chiuso o l\'anno scorso.' }),
      gruppo: 'tradizionali',
      obiettivi: goals.map((g) => ({
        nome: g.name,
        stato: g.state,
        traguardo: money(g.target, locale),
        accumulato: money(g.saved, locale),
        scadenza: g.deadline,
        arrivo_previsto: g.reachMonth,
        ...(g.remaining != null ? { mancante: money(g.remaining, locale) } : {}),
        ...(g.requiredMonthly != null ? { servirebbe_al_mese: money(g.requiredMonthly, locale) } : {}),
        ...(g.expectedMonthly != null ? { arriva_al_mese: money(g.expectedMonthly, locale) } : {}),
      })),
      link: '/',
    });
  }, {
    name: 'proiezione_anno',
    description: 'Quanto la famiglia avrà risparmiato a fine anno continuando così (entrate, uscite e risparmio finora e previsti, con il confronto sull\'anno scorso) e se gli obiettivi attivi arriveranno entro la scadenza. Da usare per «quanto avremo risparmiato quest\'anno?», «riusciremo a raggiungere gli obiettivi?». Per migliorare, combinalo con segnali_risparmio.',
    schema: z.object({}),
  });

  const scadenze = tool(async ({ giorni }) => {
    const { deadlines, totals, today } = await listDeadlines();
    const within = deadlines.filter((d) => d.active && d.daysLeft <= giorni);
    return out({
      oggi: today,
      entro_giorni: giorni,
      scadenze: within.map((d) => ({
        cosa: d.title,
        data: d.nextDate,
        giorni_mancanti: d.daysLeft,
        importo: d.amount != null ? money(d.amount, locale) : null,
        ogni_mesi: d.everyMonths,
        ...(d.payment ? { pagamento_trovato: { data: d.payment.date, importo: money(d.payment.amount, locale) } } : {}),
      })),
      totale_entro_30_giorni: money(totals.soonAmount, locale),
      da_accantonare_al_mese: money(totals.monthlyReserve, locale),
      altre_scadenze_attive: deadlines.filter((d) => d.active).length - within.length,
      link: '/scadenze',
    });
  }, {
    name: 'scadenze',
    description: 'Le scadenze di pagamento della famiglia (bollette, tasse, polizze, abbonamenti, rate) entro un certo numero di giorni, con la quota mensile da accantonare per quelle non mensili. Da usare per «cosa dobbiamo pagare questo mese?», «quando scade l\'assicurazione?».',
    schema: z.object({ giorni: z.number().int().min(1).max(400).default(30).describe('Entro quanti giorni da oggi; le scadute non pagate ci sono sempre.') }),
  });

  const TIPI = { rata: 'installment', categoria: 'category', entrate: 'income', una_tantum: 'oneOff' };
  const mese = z.string().regex(/^\d{4}-\d{2}$/).describe('Mese YYYY-MM.');
  const simulaScenario = tool(async ({ cambiamenti }) => {
    const changes = [];
    for (const c of cambiamenti) {
      const change = { type: TIPI[c.tipo], from: c.da ?? null, months: c.mesi ?? null };
      if (c.tipo === 'categoria') {
        const found = c.categoria ? await resolveCategory(c.categoria) : { error: 'categoria mancante' };
        if (found.error) return out(found);
        change.categoryId = String(found.category._id);
        if (c.percentuale != null) change.percent = c.percentuale; else change.amount = c.importo;
      } else {
        change.amount = c.importo;
        if (c.tipo === 'una_tantum') change.income = c.entrata === true;
      }
      changes.push(change);
    }
    const { data, error } = parseChanges(changes);
    if (error) return out({ error: 'cambiamenti non validi: servono importi (o percentuali per una categoria) e mesi YYYY-MM' });
    const r = await runScenario(data);
    const pair = (x) => ({ oggi: money(x.before, locale), con_ipotesi: money(x.after, locale), differenza: money(x.after - x.before, locale) });
    return out({
      risparmio_fine_anno: pair(r.yearEnd),
      risparmio_prossimi_12_mesi: pair(r.next12),
      obiettivi: r.goals.map((g) => ({
        nome: g.name, scadenza: g.deadline, arrivo_oggi: g.before, arrivo_con_ipotesi: g.after,
        mesi_di_ritardo: g.shift, in_tempo_con_ipotesi: g.onTimeAfter,
      })),
      nota: 'Conti senza IA: i mesi di quest\'anno seguono la proiezione, dopo il risparmio medio; gli obiettivi ricevono la loro percentuale ogni mese.',
      link: '/simulatore',
    });
  }, {
    name: 'simula_scenario',
    description: 'Simula una decisione («e se compriamo l\'auto a rate?», «e se riduciamo i ristoranti del 30%?», «e se uno passa al part-time?»): effetto sul risparmio di fine anno, dei prossimi 12 mesi e sull\'arrivo degli obiettivi. Gli importi li dà la domanda; se mancano, chiedili invece di inventarli.',
    schema: z.object({
      cambiamenti: z.array(z.object({
        tipo: z.enum(['rata', 'categoria', 'entrate', 'una_tantum']),
        importo: z.number().optional().describe('Euro al mese (rata, entrate: negativo se calano, categoria) o euro una volta (una_tantum).'),
        percentuale: z.number().optional().describe('Solo per categoria: variazione in %, es. -30.'),
        categoria: z.string().max(100).optional(),
        da: mese.optional(),
        mesi: z.number().int().min(1).max(360).optional().describe('Durata; ometti per «sempre».'),
        entrata: z.boolean().optional().describe('Solo per una_tantum: true se è un\'entrata.'),
      })).min(1).max(10),
    }),
  });

  return [riepilogoMese, spesePerCategoria, confrontaPeriodi, cercaMovimenti, statoObiettivi, confrontoIstat, segnaliRisparmio, proiezioneAnno, scadenze, simulaScenario];
}

/** Elenco delle categorie per le istruzioni: il modello deve usare nomi che esistono. */
export async function categoryOutline() {
  const cats = await Category.find({ level: { $in: [1, 2] } }).sort({ level: 1, name: 1 }).select('name level parentId').lean();
  return cats.filter((c) => c.level === 1).map((c) => {
    const subs = cats.filter((s) => s.level === 2 && String(s.parentId) === String(c._id)).map((s) => s.name);
    return subs.length ? `${c.name} (${subs.join(', ')})` : c.name;
  }).join('; ');
}

export { todayString };
