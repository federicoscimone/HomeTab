'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';
import AiPreviewModal from '@/components/import/AiPreviewModal';
import { needsSuggestion, toAiRow } from '@/components/import/aiRows';

const BADGE = { keyword: 'badge-success', history: 'badge-secondary', bank: 'badge-secondary badge-outline', ai: 'badge-info', web: 'badge-warning' };

/** Righe ancora da chiedere: vuote, oppure con un suggerimento incerto non toccato dall'utente. */
const isPending = (r) => needsSuggestion(r) || (r._uncertain && !r._catManual);

/** Una riga della revisione, dalla risposta del server. */
function toRow(m, i) {
  const s = m.suggestion;
  return {
    ...m,
    _rowId: i,
    categoryId: s?.categoryId ?? null,
    subCategory1Id: s?.subCategory1Id ?? null,
    _src: s?.source ?? null,
    _support: s?.support ?? null,
    _text: s?.text ?? null,
    apply: Boolean(s),
  };
}

/**
 * Revisione dei movimenti senza categoria, con la stessa catena dell'import: parole chiave,
 * storico, categoria della banca in locale; poi, su richiesta, l'IA. Niente si salva finché
 * l'utente non preme «Applica».
 *
 * @param {{ onClose: () => void, onApplied: (updated: number) => void }} props
 */
export default function IncompleteReviewModal({ onClose, onApplied }) {
  const t = useTranslations('incompleteReview');
  const tAi = useTranslations('importAi');
  const tCommon = useTranslations('common');
  const { fmtFull, fmtUsd, fmtDate } = useFormat();
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [ai, setAi] = useState({ status: 'idle' });
  const [web, setWeb] = useState({ status: 'idle' });
  const [previewMode, setPreviewMode] = useState('categorize');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const aiRequest = useRef(null);

  /**
   * Chiede i suggerimenti per le righe ancora vuote, all'IA o alla ricerca web. Si toccano solo le
   * righe vuote: l'IA completa, non sovrascrive. Un suggerimento incerto compila la categoria ma
   * lascia la spunta tolta: si applica solo se l'utente la mette.
   */
  const requestSuggestions = (sourceRows, source = 'ai') => {
    const asked = sourceRows.filter(isPending).map(toAiRow);
    if (asked.length === 0) return;
    const setState = source === 'web' ? setWeb : setAi;
    setState({ status: 'loading', asked: source === 'web' ? Math.min(asked.length, 15) : asked.length });
    aiRequest.current?.abort();
    const controller = new AbortController();
    aiRequest.current = controller;
    fetch(source === 'web' ? '/api/import/suggest/web' : '/api/import/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: asked }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((res) => {
        if (!res.available) { setState({ status: 'error', error: res.reason === 'budget' ? 'budget' : 'failed' }); return; }
        const byId = new Map(res.suggestions.filter((x) => x.categoryId).map((x) => [x.id, x]));
        setRows((rs) => rs.map((r) => {
          const s = byId.get(r._rowId);
          // Una riga incerta si può sostituire con un suggerimento affidabile o più sicuro.
          if (!s || r._catManual || (r.categoryId && !(r._uncertain && (!s.uncertain || s.confidence > (r._confidence ?? 0))))) return r;
          return {
            ...r, categoryId: s.categoryId, subCategory1Id: s.subCategory1Id, _src: source,
            _confidence: s.confidence, _uncertain: s.uncertain, _kind: s.kind ?? null, apply: !s.uncertain,
          };
        }));
        const confident = res.suggestions.filter((x) => x.categoryId && !x.uncertain).length;
        setState({
          status: res.error && byId.size === 0 ? 'error' : 'done', asked: asked.length, suggested: confident,
          uncertain: byId.size - confident, costUsd: res.costUsd, searches: res.searches, error: res.error,
          fallbackModel: res.fallbackModel, skipped: res.skipped,
        });
      })
      .catch((err) => { if (err.name !== 'AbortError') setState({ status: 'error', error: 'failed' }); });
  };

  useEffect(() => {
    const controller = new AbortController();
    const json = (r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)));
    Promise.all([
      fetch('/api/movimenti/incomplete-review', { signal: controller.signal }).then(json),
      fetch('/api/categorie', { signal: controller.signal }).then(json),
    ]).then(([review, cats]) => {
      const initial = review.movements.map(toRow);
      setData(review);
      setRows(initial);
      setCategories(cats);
      if (review.aiAutoSuggest) requestSuggestions(initial);
    }).catch((err) => { if (err.name !== 'AbortError') setError(t('loadFailed')); });
    return () => { controller.abort(); aiRequest.current?.abort(); };
    // Una sola volta, all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level1 = categories.filter((c) => c.level === 1);
  const level2of = (id) => categories.filter((c) => c.level === 2 && String(c.parentId) === id);
  const update = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setCategory = (i, field, value) => update(i, {
    [field]: value || null,
    ...(field === 'categoryId' ? { subCategory1Id: null } : {}),
    _src: null, _uncertain: false, _catManual: true, apply: Boolean(field === 'categoryId' ? value : rows[i].categoryId),
  });

  const toApply = rows.filter((r) => r.apply && r.categoryId);
  const pending = rows.filter(isPending);
  const local = rows.filter((r) => ['keyword', 'history', 'bank'].includes(r._src)).length;

  const handleApply = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/movimenti/apply-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: toApply.map((r) => ({ id: r.id, categoryId: r.categoryId, subCategory1Id: r.subCategory1Id })) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || t('applyFailed'));
      onApplied(out.updated);
    } catch (err) {
      setError(err.message || t('applyFailed'));
      setSaving(false);
    }
  };

  const sourceTitle = (r) => {
    if (r._src === 'history') return tAi('historyTitle', { count: r._support ?? 0, text: r._text ?? '' });
    if (r._src === 'bank') return tAi('bankTitle', { count: r._support ?? 0, label: r.bankCategory });
    if (r._src === 'web' && r._kind) return tAi('webTitle', { kind: r._kind, pct: Math.round((r._confidence ?? 0) * 100) });
    if (r._src === 'ai' || r._src === 'web') return tAi('categoryTitle', { pct: Math.round((r._confidence ?? 0) * 100) });
    return '';
  };

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="incomplete-title">
      <div className="modal-box max-w-6xl">
        <h3 id="incomplete-title" className="font-bold text-lg">{t('title')}</h3>
        <p className="text-sm text-base-content/70 mt-1">{t('intro')}</p>

        {error && <div className="alert alert-error text-sm py-2 mt-4"><span>{error}</span></div>}
        {!data && !error && <span className="loading loading-spinner loading-md mt-4" />}

        {data && (
          <div className="flex flex-col gap-3 mt-4">
            <div className="alert text-sm py-2" role="status">
              <span>
                {t('summary', { shown: rows.length, local })}
                {data.total > rows.length && ` ${t('more', { shown: rows.length, total: data.total })}`}
              </span>
            </div>
            {ai.status === 'loading' && (
              <div className="alert alert-info text-sm py-2" role="status">
                <span className="loading loading-spinner loading-sm" />
                <span>{tAi('loading', { count: ai.asked })}</span>
              </div>
            )}
            {ai.status === 'done' && (
              <div className="alert text-sm py-2" role="status">
                <span>{tAi('done', { suggested: ai.suggested, asked: ai.asked, cost: fmtUsd(ai.costUsd) })}</span>
                {ai.uncertain > 0 && <span className="text-base-content/60">{t('uncertainCount', { count: ai.uncertain })}</span>}
                {ai.fallbackModel && <span className="text-base-content/60">{tAi('withFallback', { model: ai.fallbackModel })}</span>}
              </div>
            )}
            {ai.status === 'error' && (
              <div className="alert alert-warning text-sm py-2" role="status">
                <span>{tAi(`errors.${ai.error === 'budget' ? 'budget' : 'failed'}`)}</span>
              </div>
            )}
            {web.status === 'loading' && (
              <div className="alert alert-info text-sm py-2" role="status">
                <span className="loading loading-spinner loading-sm" />
                <span>{tAi('webLoading', { count: web.asked })}</span>
              </div>
            )}
            {web.status === 'done' && (
              <div className="alert text-sm py-2" role="status">
                <span>{tAi('webDone', { suggested: web.suggested, asked: Math.min(web.asked, 15), searches: web.searches, cost: fmtUsd(web.costUsd) })}</span>
                {web.uncertain > 0 && <span className="text-base-content/60">{t('uncertainCount', { count: web.uncertain })}</span>}
                {web.skipped > 0 && <span className="text-base-content/60">{tAi('webSkipped', { count: web.skipped })}</span>}
              </div>
            )}
            {web.status === 'error' && (
              <div className="alert alert-warning text-sm py-2" role="status">
                <span>{tAi(`errors.${web.error === 'budget' ? 'budget' : 'failed'}`)}</span>
              </div>
            )}

            {pending.length > 0 && (
              <div className="flex gap-2 justify-end flex-wrap">
                <button className="btn btn-outline btn-xs" onClick={() => { setPreviewMode('categorize'); setPreview(pending); }}>{tAi('previewButton')}</button>
                {data.aiAvailable && (
                  <button className="btn btn-info btn-xs" onClick={() => requestSuggestions(rows)} disabled={ai.status === 'loading'}>
                    {ai.status === 'loading' && <span className="loading loading-spinner loading-xs" />}
                    {tAi('suggestButton', { count: pending.length })}
                  </button>
                )}
                {data.webAvailable && ['done', 'error'].includes(ai.status) && (
                  <>
                    <button className="btn btn-outline btn-xs" onClick={() => { setPreviewMode('web'); setPreview(pending); }}>{tAi('webPreviewButton')}</button>
                    <button className="btn btn-warning btn-xs" onClick={() => requestSuggestions(rows, 'web')} disabled={web.status === 'loading'}>
                      {web.status === 'loading' && <span className="loading loading-spinner loading-xs" />}
                      {tAi('webButton', { count: Math.min(pending.length, 15), cost: fmtUsd(data.webRowUsd) })}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="overflow-x-auto max-h-[50vh]">
              <table className="table table-xs table-pin-rows">
                <thead>
                  <tr>
                    <th className="w-8" aria-label={t('cols.apply')} />
                    <th>{t('cols.date')}</th>
                    <th>{t('cols.movement')}</th>
                    <th>{t('cols.category')}</th>
                    <th className="text-right">{t('cols.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className={r.apply && r.categoryId ? '' : 'opacity-60'}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          aria-label={t('cols.apply')}
                          checked={r.apply && Boolean(r.categoryId)}
                          disabled={!r.categoryId}
                          onChange={() => update(i, { apply: !r.apply })}
                        />
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td>
                        <p className="font-medium">{r.payee || r.description || '—'}</p>
                        {r.payee && r.description && <p className="text-base-content/50">{r.description}</p>}
                        {r.bankCategory && <p className="text-base-content/40">{tAi('bankLabel', { label: r.bankCategory })}</p>}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <select className="select select-xs min-w-[140px]" value={r.categoryId || ''} onChange={(e) => setCategory(i, 'categoryId', e.target.value)}>
                            <option value="">{tCommon('none')}</option>
                            {level1.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                          {r.categoryId && level2of(r.categoryId).length > 0 && (
                            <select className="select select-xs min-w-[140px]" value={r.subCategory1Id || ''} onChange={(e) => setCategory(i, 'subCategory1Id', e.target.value)}>
                              <option value="">{t('subNone')}</option>
                              {level2of(r.categoryId).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                          )}
                          {r._src && r.categoryId && (
                            <span className={`badge badge-xs ${r._uncertain ? 'badge-warning badge-outline' : BADGE[r._src]}`} title={sourceTitle(r)}>
                              {r._uncertain ? t('uncertainBadge', { source: t(`sources.${r._src}`) }) : t(`sources.${r._src}`)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`text-right whitespace-nowrap ${r.type === 'income' ? 'text-success' : 'text-error'}`}>
                        {`${r.type === 'income' ? '+' : '-'}${fmtFull(r.amount)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{tCommon('close')}</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={saving || toApply.length === 0}>
            {saving && <span className="loading loading-spinner loading-sm" />}
            {t('apply', { count: toApply.length })}
          </button>
        </div>
      </div>
      <button className="modal-backdrop" aria-label={tCommon('close')} onClick={onClose} />
      {preview && <AiPreviewModal rows={preview} mode={previewMode} onClose={() => setPreview(null)} />}
    </div>
  );
}
