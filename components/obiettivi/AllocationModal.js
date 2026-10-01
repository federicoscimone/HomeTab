/**
 * @fileoverview AllocationModal — scelta della percentuale di risparmio per ogni obiettivo.
 *
 * Quando un obiettivo attivo non ha ancora una quota la modale si apre in modalità `forced`,
 * senza pulsante di chiusura: è il punto in cui il sistema obbliga a decidere la ripartizione.
 * Accanto a ogni percentuale mostra quanto vale in euro sul risparmio medio e quanto servirebbe
 * per arrivare in tempo, così la scelta non si fa al buio.
 */

'use client';

import { useMemo, useState } from 'react';
import { fmt, fmtMonth } from '@/lib/utils/format';

/**
 * @param {object}   props
 * @param {object}   props.overview - Risposta di GET /api/obiettivi.
 * @param {boolean}  props.forced   - true se ci sono obiettivi senza quota: niente "Annulla".
 * @param {Function} props.onSaved
 * @param {Function} props.onClose
 */
export default function AllocationModal({ overview, forced, onSaved, onClose }) {
  const rows = useMemo(
    () => overview.goals.filter((g) => g.status === 'active' && g.state !== 'reached'),
    [overview],
  );
  const reached = overview.goals.filter((g) => g.status === 'active' && g.state === 'reached');
  const suggested = Object.fromEntries(overview.suggestion.shares.map((s) => [s.goalId, s.pct]));

  const [pcts, setPcts] = useState(() =>
    Object.fromEntries(rows.map((g) => [g.id, String(g.pct ?? suggested[g.id] ?? 0)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parsed = Object.fromEntries(Object.entries(pcts).map(([id, v]) => [id, Number(v)]));
  const invalid = Object.values(parsed).some((v) => !Number.isInteger(v) || v < 0 || v > 100);
  const total = Object.values(parsed).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const avg = overview.avgSavings;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/obiettivi/ripartizione', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares: rows.map((g) => ({ goalId: g.id, pct: parsed[g.id] })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore durante il salvataggio');
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError('Errore di rete. Riprova.');
      setSaving(false);
    }
  };

  const applySuggestion = () =>
    setPcts(Object.fromEntries(rows.map((g) => [g.id, String(suggested[g.id] ?? 0)])));

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <h3 className="font-bold text-lg mb-1">Ripartizione del risparmio</h3>
        <p className="text-sm text-base-content/60 mb-4">
          {forced
            ? 'Ci sono obiettivi senza percentuale. Scegli quanta parte del risparmio mensile va a ciascuno: '
            : 'Quanta parte del risparmio mensile va a ciascun obiettivo. '}
          vale dal mese in corso ({fmtMonth(overview.currentMonth)}) in poi, i mesi già chiusi restano com&apos;erano.
          Quello che non assegni resta risparmio libero.
        </p>

        {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

        {overview.suggestion.feasible === false && (
          <div className="alert alert-warning text-sm py-2 mb-3">
            <span>
              Per arrivare in tempo su tutti gli obiettivi servirebbero {fmt(overview.totalRequired)} al mese, ma il
              risparmio medio è {fmt(avg)}. Il suggerimento divide comunque il 100%: valuta di spostare una scadenza
              o ridurre un importo.
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Obiettivo</th>
                <th className="text-right">Servono/mese</th>
                <th className="text-right">Suggerito</th>
                <th className="w-28">Percentuale</th>
                <th className="text-right">≈ €/mese</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const v = parsed[g.id];
                return (
                  <tr key={g.id}>
                    <td>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-base-content/50">entro {fmtMonth(g.deadline)}</p>
                    </td>
                    <td className="text-right">{fmt(g.projection?.requiredMonthly)}</td>
                    <td className="text-right text-base-content/60">{suggested[g.id] ?? 0}%</td>
                    <td>
                      <label className="input input-bordered input-sm flex items-center gap-1">
                        <input
                          type="number" min="0" max="100" step="1" className="w-14"
                          aria-label={`Percentuale per ${g.name}`}
                          value={pcts[g.id]}
                          onChange={(e) => setPcts((p) => ({ ...p, [g.id]: e.target.value }))}
                        />
                        <span className="text-base-content/50">%</span>
                      </label>
                    </td>
                    <td className="text-right">
                      {avg != null && Number.isFinite(v) ? fmt((avg * v) / 100) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right font-medium">Totale assegnato</td>
                <td className={`font-bold ${total > 100 ? 'text-error' : ''}`}>{total}%</td>
                <td className="text-right">{avg != null ? fmt((avg * total) / 100) : '—'}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-right text-base-content/60">Risparmio libero</td>
                <td className="text-base-content/60">{Math.max(0, 100 - total)}%</td>
                <td className="text-right text-base-content/60">
                  {avg != null ? fmt((avg * Math.max(0, 100 - total)) / 100) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {total > 100 && (
          <p className="text-xs text-error mt-2">
            La somma supera il 100%: riduci qualche percentuale o usa il suggerimento.
          </p>
        )}
        {reached.length > 0 && (
          <p className="text-xs text-base-content/50 mt-2">
            Già raggiunti, non ricevono più quote: {reached.map((g) => g.name).join(', ')}.
          </p>
        )}
        <p className="text-xs text-base-content/50 mt-2">
          {avg != null
            ? `Importi in euro calcolati sul risparmio medio degli ultimi ${overview.avgMonths} mesi chiusi (${fmt(avg)}/mese).`
            : 'Non ci sono ancora mesi chiusi con movimenti: gli importi in euro compariranno dopo il primo mese.'}
        </p>

        <div className="modal-action flex-wrap">
          <button type="button" className="btn btn-ghost btn-sm mr-auto" onClick={applySuggestion}>
            Usa il suggerimento
          </button>
          {!forced && <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Annulla</button>}
          <button
            type="button" className="btn btn-primary btn-sm"
            onClick={handleSave} disabled={saving || invalid || total > 100}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : 'Salva ripartizione'}
          </button>
        </div>
      </div>
      {!forced && <div className="modal-backdrop" onClick={onClose} />}
    </div>
  );
}
