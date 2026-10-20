'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PAYMENT_METHODS } from '@/lib/utils/payments';
import MappingModal from '@/components/shared/MappingModal';
import useCan from '@/lib/auth/useCan';
import { useFormat } from '@/lib/hooks/useFormat';
import AiPreviewModal from '@/components/import/AiPreviewModal';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Righe da chiedere all'IA: senza categoria, non duplicate e non già sistemate a mano. */
const needsSuggestion = (r) => !r.categoryId && !r._isDuplicate && !r._catManual;

/** I campi che lasciano il browser verso il server; il server li maschera prima del modello. */
const toAiRow = (r) => ({
  id: r._rowId, description: r.description, payee: r.payee, place: r.place, type: r.type, amount: r.amount,
  bankCategory: r.bankCategory || '',
});

/**
 * Fonde i suggerimenti nelle righe. Non tocca mai ciò che l'utente ha cambiato a mano né ciò che
 * le parole chiave hanno già riempito: l'IA completa, non sovrascrive.
 */
function mergeSuggestions(rows, suggestions) {
  const byId = new Map(suggestions.map((s) => [s.id, s]));
  return rows.map((r) => {
    const s = byId.get(r._rowId);
    if (!s) return r;
    const next = { ...r };
    if (s.categoryId && !r.categoryId && !r._catManual) {
      Object.assign(next, { categoryId: s.categoryId, subCategory1Id: s.subCategory1Id, _aiCat: true, _aiConfidence: s.confidence });
    }
    if (s.merchant && !r.payee) Object.assign(next, { payee: s.merchant, _aiPayee: true });
    if (s.place && !r.place) next.place = s.place;
    return next;
  });
}

export default function StepReview({
  rows: initialRows, categories, aiAvailable = false, aiAutoSuggest = false, onImported, onSaved, onBack,
}) {
  const [rows, setRows] = useState(initialRows);
  const tAi = useTranslations('importAi');
  // Lo stato iniziale si decide qui, non nell'effetto: impostarlo lì farebbe un render in più.
  // Di serie i suggerimenti partono solo dal pulsante: i dati escono quando l'utente lo decide.
  const autoStart = aiAvailable && aiAutoSuggest && initialRows.some(needsSuggestion);
  const [ai, setAi] = useState(() => (
    autoStart ? { status: 'loading', asked: initialRows.filter(needsSuggestion).length } : { status: 'idle' }
  ));
  const [previewRows, setPreviewRows] = useState(null);
  const aiRequest = useRef(null);
  const canDo = useCan();
  const t = useTranslations('import');
  const tMov = useTranslations('movements');
  const tForm = useTranslations('movementForm');
  const tCommon = useTranslations('common');
  const tPay = useTranslations('payments');
  const { fmtFull, fmtUsd } = useFormat();
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [editingRow, setEditingRow] = useState(null); // indice riga in modifica
  const [mappingModal, setMappingModal] = useState(null); // { keyword, categoryId, subCategory1Id, priority, caseSensitive }
  const [mappingError, setMappingError] = useState('');

  /** Chiede i suggerimenti per le righe date; l'esito arriva nello stato `ai`. */
  const requestSuggestions = (sourceRows) => {
    const asked = sourceRows.filter(needsSuggestion).map(toAiRow);
    aiRequest.current?.abort();
    const controller = new AbortController();
    aiRequest.current = controller;
    fetch('/api/import/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: asked }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!data.available) { setAi({ status: 'error', asked: asked.length, error: data.reason === 'budget' ? 'budget' : 'failed' }); return; }
        setRows((rs) => mergeSuggestions(rs, data.suggestions));
        const suggested = new Set(data.suggestions.filter((x) => x.categoryId).map((x) => x.id)).size;
        setAi({ status: data.error && suggested === 0 ? 'error' : 'done', asked: asked.length, suggested, costUsd: data.costUsd, error: data.error, fallbackModel: data.fallbackModel });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setAi({ status: 'error', asked: asked.length, error: 'failed' });
      });
  };

  const handleSuggest = () => {
    setAi({ status: 'loading', asked: rows.filter(needsSuggestion).length });
    requestSuggestions(rows);
  };

  useEffect(() => {
    if (autoStart) requestSuggestions(initialRows);
    return () => aiRequest.current?.abort();
    // Una sola volta, all'apertura della revisione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingAi = rows.filter(needsSuggestion);

  const level1 = categories.filter(c => c.level === 1);
  const level2of = (catId) => categories.filter(c => c.level === 2 && c.parentId?.toString() === catId);

  const selected         = rows.filter(r => r.selected);
  const autocat          = rows.filter(r => r._autocat).length;
  const fromHistory      = rows.filter(r => (r._histCat || r._bankCat) && r.categoryId).length;
  const duplicatesCount  = rows.filter(r => r._isDuplicate).length;
  const missingMethod    = rows.filter(r => r.selected && !r.paymentMethod).length;
  const undetectedMethod = missingMethod;

  const toggleAll = (val) => setRows(rs => rs.map(r => ({ ...r, selected: val })));
  const toggleRow = (i) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const updateRow = (i, field, value) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  // Category changes are always manual — protect from future mapping re-applies
  const updateCategory = (i, field, value) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value, _catManual: true, _aiCat: false, _histCat: false, _bankCat: false } : r));

  const updatePaymentMethod = (i, value) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, paymentMethod: value, _methodAutoDetected: true } : r));

  // Apply a newly-saved keyword mapping to all rows that haven't been manually categorized
  const applyNewMapping = (mapping) => {
    const flags   = mapping.caseSensitive ? '' : 'i';
    const regex   = new RegExp(`\\b${escapeRegex(mapping.keyword)}`, flags);
    setRows(rs => rs.map(r => {
      if (r._catManual) return r; // never overwrite manual edits
      const haystack = [r.payee, r.description, r.place].filter(Boolean).join(' ');
      if (!regex.test(haystack)) return r;
      return {
        ...r,
        categoryId:     mapping.categoryId     || null,
        subCategory1Id: mapping.subCategory1Id || null,
        _autocat:       true,
      };
    }));
  };

  const openMappingModal = (row) => {
    setMappingError('');
    setMappingModal({
      keyword:        row.payee || row.description || '',
      categoryId:     '',
      subCategory1Id: '',
      priority:       10,
      caseSensitive:  false,
    });
  };

  const handleMappingConfirm = async () => {
    if (!mappingModal.keyword.trim()) {
      setMappingError(tMov('mappingKeywordRequired'));
      return;
    }
    if (!mappingModal.categoryId) {
      setMappingError(tMov('mappingCategoryRequired'));
      return;
    }
    setMappingError('');

    const body = {
      keyword:        mappingModal.keyword.trim(),
      categoryId:     mappingModal.categoryId,
      subCategory1Id: mappingModal.subCategory1Id || null,
      priority:       Number(mappingModal.priority) || 10,
      caseSensitive:  !!mappingModal.caseSensitive,
    };

    const res = await fetch('/api/impostazioni/keyword-mapping', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      setMappingError(tMov('mappingSaveFailed'));
      return;
    }

    applyNewMapping(body);
    setMappingModal(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = selected.map(r => ({
      amount:              r.amount,
      paymentMethod:       r.paymentMethod || 'other',
      date:                r.date,
      time:                r.time || null,
      type:                r.type || 'expense',
      description:         r.description,
      place:               r.place,
      payee:               r.payee,
      notes:               r.notes,
      bankCategory:        r.bankCategory || '',
      categoryId:          r.categoryId || null,
      subCategory1Id:      r.subCategory1Id || null,
      subCategory2Id:      null,
      excludeFromAnalysis: !!r.excludeFromAnalysis,
      importMethod:        r.importMethod || null,
    }));

    // Prima un errore del server fermava lo spinner e basta: nessun messaggio, nessun risultato.
    setSaveError('');
    try {
      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload, skipDuplicates }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setResult(data); onImported?.(); }
      else setSaveError(data.error || t('saveFailed'));
    } catch {
      setSaveError(tCommon('networkError'));
    }
    setSaving(false);
  };

  if (result) {
    return (
      <div className="card bg-base-100 border border-base-200 shadow-sm max-w-md mx-auto">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">{'✅'}</div>
          <h2 className="text-xl font-bold">{t('doneTitle')}</h2>
          <div className="stats stats-vertical shadow-sm">
            <div className="stat py-2">
              <div className="stat-title text-xs">{t('savedCount')}</div>
              <div className="stat-value text-success text-2xl">{result.saved}</div>
            </div>
            {result.duplicates > 0 && (
              <div className="stat py-2">
                <div className="stat-title text-xs">{t('duplicatesSkipped')}</div>
                <div className="stat-value text-warning text-2xl">{result.duplicates}</div>
              </div>
            )}
            {result.errors > 0 && (
              <div className="stat py-2">
                <div className="stat-title text-xs">{t('errorsCount')}</div>
                <div className="stat-value text-error text-2xl">{result.errors}</div>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={onSaved}>{t('goToMovements')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Alert duplicati */}
      {duplicatesCount > 0 && (
        <div className="alert alert-warning text-sm py-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{t.rich('duplicatesAlert', { count: duplicatesCount, b: (chunks) => <strong>{chunks}</strong> })}</span>
        </div>
      )}

      {/* Alert metodo pagamento non rilevato */}
      {undetectedMethod > 0 && (
        <div className="alert alert-warning text-sm py-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            {t.rich('methodAlert', { count: undetectedMethod, fallback: tPay('other'), b: (chunks) => <strong>{chunks}</strong> })}
          </span>
        </div>
      )}

      {ai.status === 'loading' && (
        <div className="alert alert-info text-sm py-2" role="status">
          <span className="loading loading-spinner loading-sm" />
          <span>{tAi('loading', { count: ai.asked })}</span>
        </div>
      )}
      {ai.status === 'done' && (
        <div className="alert text-sm py-2" role="status">
          <span>{tAi('done', { suggested: ai.suggested, asked: ai.asked, cost: fmtUsd(ai.costUsd) })}</span>
          {ai.fallbackModel && <span className="text-base-content/60">{tAi('withFallback', { model: ai.fallbackModel })}</span>}
          {ai.error && <span className="text-warning">{tAi(`partial.${ai.error}`)}</span>}
        </div>
      )}
      {ai.status === 'error' && (
        <div className="alert alert-warning text-sm py-2" role="status">
          <span>{tAi(`errors.${ai.error === 'budget' ? 'budget' : 'failed'}`)}</span>
        </div>
      )}

      {saveError && (
        <div className="alert alert-error text-sm py-2" role="alert"><span>{saveError}</span></div>
      )}

      {/* Riepilogo -*/}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('reviewTitle')}</h2>
          <p className="text-sm text-base-content/50">
            {`${t('analyzedRows', { count: rows.length })} · ${t('autocategorized', { count: autocat })} · `}
            {fromHistory > 0 && `${tAi('fromHistoryCount', { count: fromHistory })} · `}
            {duplicatesCount > 0 && (
              <span className="text-warning font-medium">{`${t('duplicates', { count: duplicatesCount })} · `}</span>
            )}
            <span className="text-primary font-medium">{t('selectedRows', { count: selected.length })}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm"
              checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} />
            {t('skipDuplicates')}
          </label>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>{t('back')}</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || selected.length === 0}
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            {saving ? tCommon('saving') : t('importCount', { count: selected.length })}
          </button>
        </div>
      </div>

      {/* Seleziona tutto / nessuno, e i comandi dell'IA */}
      <div className="flex gap-2 text-xs flex-wrap items-center">
        <button className="btn btn-ghost btn-xs" onClick={() => toggleAll(true)}>{tCommon('selectAll')}</button>
        <button className="btn btn-ghost btn-xs" onClick={() => toggleAll(false)}>{tCommon('deselectAll')}</button>
        {pendingAi.length > 0 && (
          <div className="ml-auto flex gap-2">
            {/* L'anteprima non invia nulla: c'è anche con l'IA spenta, per provare il mascheramento. */}
            <button className="btn btn-outline btn-xs" onClick={() => setPreviewRows(pendingAi)}>
              {tAi('previewButton')}
            </button>
            {aiAvailable && (
              <button className="btn btn-info btn-xs" onClick={handleSuggest} disabled={ai.status === 'loading'}>
                {ai.status === 'loading' && <span className="loading loading-spinner loading-xs" />}
                {tAi('suggestButton', { count: pendingAi.length })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabella */}
      <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-xs">
            <thead>
              <tr className="bg-base-200">
                <th className="w-8"></th>
                <th>{tMov('columns.date')}</th>
                <th>{tMov('columns.payee')}</th>
                <th>{t('columns.type')}</th>
                <th>{tMov('columns.method')}</th>
                <th>{tCommon('category')}</th>
                <th className="text-right">{tMov('columns.amount')}</th>
                <th className="text-center hidden sm:table-cell" title={tMov('excludeFromAnalysis')}>{tMov('columns.exclude')}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                editingRow === i
                  ? <EditRow key={i} row={row} index={i} categories={categories}
                      level1={level1} level2of={level2of}
                      onSave={(field, value) => { updateRow(i, field, value); }}
                      onClose={() => setEditingRow(null)} />
                  : (
                    <tr key={i} className={`hover ${!row.selected ? 'opacity-40' : ''} ${row._isDuplicate ? 'bg-warning/10' : row.selected && !row._methodAutoDetected ? 'bg-warning/5' : ''}`}>
                      <td>
                        <input type="checkbox" className="checkbox checkbox-xs"
                          checked={row.selected} onChange={() => toggleRow(i)} />
                      </td>
                      <td className="whitespace-nowrap">{row.date.split('-').reverse().join('/')}</td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium">{row.payee || row.description || '—'}</p>
                          {row._aiPayee && (
                            <span className="badge badge-info badge-outline badge-xs shrink-0" title={tAi('payeeTitle')}>{tAi('badge')}</span>
                          )}
                          {row._isDuplicate && (
                            <span className="badge badge-warning badge-xs shrink-0" title={t('duplicateTitle')}>{t('duplicateBadge')}</span>
                          )}
                          {/* Il mapping è un'impostazione: lo crea solo un amministratore. */}
                          {!row._autocat && canDo('settings:manage') && (
                            <button
                              className="btn btn-ghost btn-xs p-0 h-4 min-h-0 w-4 opacity-30 hover:opacity-80"
                              title={tMov('createMapping')}
                              onClick={() => openMappingModal(row)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {row.payee && row.description && (
                          <p className="text-xs text-base-content/50">{row.description}</p>
                        )}
                        {row.bankCategory && (
                          <p className="text-xs text-base-content/40">{tAi('bankLabel', { label: row.bankCategory })}</p>
                        )}
                      </td>
                      <td>
                        <select
                          className={`select select-xs select-bordered ${row.type === 'income' ? 'border-success text-success' : 'border-error text-error'}`}
                          value={row.type || 'expense'}
                          onChange={e => updateRow(i, 'type', e.target.value)}
                        >
                          <option value="expense">{`↑ ${tForm('expense')}`}</option>
                          <option value="income">{`↓ ${tForm('income')}`}</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className={`select select-xs select-bordered min-w-[130px] ${!row._methodAutoDetected ? 'border-warning text-warning' : ''}`}
                          value={row.paymentMethod || ''}
                          onChange={e => updatePaymentMethod(i, e.target.value)}
                        >
                          {!row._methodAutoDetected && <option value="">{t('chooseMethod')}</option>}
                          {PAYMENT_METHODS.map(m => (
                            <option key={m.value} value={m.value}>{tPay(m.value)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <select
                            className={`select select-xs select-bordered min-w-[130px] ${row._autocat && row.categoryId ? 'border-success' : (row._histCat || row._bankCat) && row.categoryId ? 'border-secondary' : row._aiCat && row.categoryId ? 'border-info' : ''}`}
                            value={row.categoryId || ''}
                            onChange={e => updateCategory(i, 'categoryId', e.target.value || null)}
                          >
                            <option value="">{tCommon('none')}</option>
                            {level1.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                          {row.categoryId && level2of(row.categoryId).length > 0 && (
                            <select
                              className="select select-xs select-bordered min-w-[130px]"
                              value={row.subCategory1Id || ''}
                              onChange={e => updateCategory(i, 'subCategory1Id', e.target.value || null)}
                            >
                              <option value="">{t('subNone')}</option>
                              {level2of(row.categoryId).map(c => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                          {row._autocat && row.categoryId && (
                            <span className="badge badge-success badge-xs">{t('autoBadge')}</span>
                          )}
                          {row._histCat && row.categoryId && (
                            <span className="badge badge-secondary badge-xs" title={tAi('historyTitle', { count: row._histSupport ?? 0, text: row._histText ?? '' })}>
                              {tAi('historyBadge')}
                            </span>
                          )}
                          {row._bankCat && row.categoryId && (
                            <span className="badge badge-secondary badge-outline badge-xs" title={tAi('bankTitle', { count: row._bankSupport ?? 0, label: row.bankCategory ?? '' })}>
                              {tAi('bankBadge')}
                            </span>
                          )}
                          {row._aiCat && row.categoryId && (
                            <span className="badge badge-info badge-xs" title={tAi('categoryTitle', { pct: Math.round((row._aiConfidence ?? 0) * 100) })}>
                              {tAi('suggestedBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`text-right font-semibold whitespace-nowrap ${row.type === 'income' ? 'text-success' : 'text-error'}`}>
                        {row.type === 'income' ? '+' : '-'}{fmtFull(row.amount)}
                      </td>
                      <td className="text-center hidden sm:table-cell">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={!!row.excludeFromAnalysis}
                          onChange={() => updateRow(i, 'excludeFromAnalysis', !row.excludeFromAnalysis)}
                          title={t('excludeTitle')}
                        />
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" title={t('editDetails')}
                          onClick={() => setEditingRow(i)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewRows && <AiPreviewModal rows={previewRows} onClose={() => setPreviewRows(null)} />}

      {/* Modale nuovo mapping */}
      {mappingModal && (
        <MappingModal
          modal={mappingModal}
          onChange={patch => setMappingModal(m => ({ ...m, ...patch }))}
          onConfirm={handleMappingConfirm}
          onClose={() => setMappingModal(null)}
          level1={level1}
          level2of={level2of}
          error={mappingError}
        />
      )}
    </div>
  );
}

// ── Riga in modalità modifica inline ─────────────────────────────────────────

function EditRow({ row, index, level1, level2of, onSave, onClose }) {
  const [local, setLocal] = useState({ ...row });
  const t = useTranslations('import');
  const tForm = useTranslations('movementForm');
  const tMov = useTranslations('movements');
  const tCommon = useTranslations('common');

  const commit = (field, value) => {
    setLocal(l => ({ ...l, [field]: value }));
    onSave(field, value);
  };

  return (
    <tr className="bg-base-200">
      <td colSpan={7} className="py-3 px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">{tMov('columns.date')}</span></div>
            <input type="date" className="input input-bordered input-xs"
              value={local.date} onChange={e => commit('date', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">{t('amount')}</span></div>
            <input type="number" step="0.01" className="input input-bordered input-xs"
              value={local.amount} onChange={e => commit('amount', parseFloat(e.target.value))} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">{tForm('payee')}</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.payee} onChange={e => commit('payee', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">{tForm('description')}</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.description} onChange={e => commit('description', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">{tForm('place')}</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.place} onChange={e => commit('place', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">{tMov('columns.notes')}</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.notes} onChange={e => commit('notes', e.target.value)} />
          </label>
        </div>
        <div className="mt-2 flex justify-end">
          <button className="btn btn-primary btn-xs" onClick={onClose}>{tCommon('close')}</button>
        </div>
      </td>
    </tr>
  );
}
