'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';
import { CustomModels, OllamaSettings, ProviderKeys } from '@/components/settings/AiProviders';
import AiPrices from '@/components/settings/AiPrices';

/** Corpo JSON della risposta; in caso di errore, il messaggio del server. */
async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || '');
  return body;
}

/**
 * Modelli, effort, tetto mensile, chiavi dei fornitori, Ollama e modelli aggiunti a mano,
 * salvati sul database.
 *
 * @param {{ data: object, onSaved: (data: object) => void }} props
 */
export default function AiConfigCard({ data, onSaved }) {
  const t = useTranslations('settingsAi');
  const { fmtUsd } = useFormat();
  const { settings, keys, catalog, efforts, demo } = data;

  const [form, setForm] = useState({
    importModel: settings.importModel.value,
    importFallbackModel: settings.importFallbackModel.value,
    importEffort: settings.importEffort.value,
    chatModel: settings.chatModel.value,
    chatEffort: settings.chatEffort.value,
    monthlyBudgetUsd: String(settings.monthlyBudgetUsd.value),
    importAutoSuggest: settings.importAutoSuggest.value === true,
    importWebSearch: settings.importWebSearch.value === true,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'success'|'error'|'info', text }

  const known = new Set(catalog.flatMap((p) => p.models.map((m) => m.id)));
  const modelName = (id) => id.slice(id.indexOf(':') + 1);
  /**
   * Le opzioni dei menu, un gruppo per fornitore. Un modello scelto che non c'è più (Ollama spento,
   * modello aggiunto a mano e poi tolto) resta visibile, segnato come non disponibile.
   */
  const modelOptions = (current) => [
    ...catalog.filter((p) => p.models.length > 0).map((p) => (
      <optgroup key={p.id} label={p.local ? t('ollamaGroup') : keys[p.id]?.configured ? p.label : t('noKeyGroup', { provider: p.label })}>
        {p.models.map((m) => (
          <option key={m.id} value={m.id}>
            {p.local
              ? t('localOption', { model: modelName(m.id), caps: [m.vision && t('capVision'), m.tools && t('capTools')].filter(Boolean).join(', ') || '—' })
              : t(m.custom ? 'modelOptionCustom' : 'modelOption', { model: modelName(m.id), input: fmtUsd(m.input), output: fmtUsd(m.output) })}
          </option>
        ))}
      </optgroup>
    )),
    current && current !== 'none' && !known.has(current)
      ? <option key="unavailable" value={current}>{t('unavailableOption', { model: current })}</option>
      : null,
  ];
  const disabled = demo || busy;

  const save = async (body, okText) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSaved(await jsonOrThrow(res));
      setMessage({ kind: 'success', text: okText });
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('saveFailed') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const budget = Number(form.monthlyBudgetUsd.replace(',', '.'));
    save({
      importModel: form.importModel, importFallbackModel: form.importFallbackModel,
      importEffort: form.importEffort, monthlyBudgetUsd: budget,
      chatModel: form.chatModel, chatEffort: form.chatEffort,
      importAutoSuggest: form.importAutoSuggest,
      importWebSearch: form.importWebSearch,
    }, t('saved'));
  };

  const sourceBadge = (source) => (
    <span className="badge badge-ghost badge-sm">{t(`sources.${source}`)}</span>
  );

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
      <div className="card-body gap-5">
        <div>
          <h2 className="card-title text-lg">{t('configTitle')}</h2>
          <p className="text-sm text-base-content/60">{t('configIntro')}</p>
        </div>

        {demo && <div className="alert alert-info py-2 text-sm"><span>{t('demoLocked')}</span></div>}
        {message && (
          <div className={`alert py-2 text-sm alert-${message.kind}`} role="status"><span>{message.text}</span></div>
        )}

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveSettings}>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('importModel')} {sourceBadge(settings.importModel.source)}</span>
            <select
              className="select w-full"
              value={form.importModel}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, importModel: e.target.value }))}
            >
              <option value="none">{t('modelOff')}</option>
              {modelOptions(form.importModel)}
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('fallbackModel')} {sourceBadge(settings.importFallbackModel.source)}</span>
            <select
              className="select w-full"
              value={form.importFallbackModel}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, importFallbackModel: e.target.value }))}
            >
              <option value="none">{t('fallbackOff')}</option>
              {modelOptions(form.importFallbackModel)}
            </select>
            <span className="text-xs text-base-content/60">{t('fallbackHint')}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('effort')} {sourceBadge(settings.importEffort.source)}</span>
            <select
              className="select w-full"
              value={form.importEffort}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, importEffort: e.target.value }))}
            >
              {efforts.map((e) => <option key={e} value={e}>{t(`efforts.${e}`)}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('budget')} {sourceBadge(settings.monthlyBudgetUsd.source)}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max={data.maxBudgetUsd}
              step="0.01"
              className="input w-full"
              value={form.monthlyBudgetUsd}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, monthlyBudgetUsd: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('chatModel')} {sourceBadge(settings.chatModel.source)}</span>
            <select
              className="select w-full"
              value={form.chatModel}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, chatModel: e.target.value }))}
            >
              <option value="none">{t('modelOff')}</option>
              {modelOptions(form.chatModel)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('chatEffort')} {sourceBadge(settings.chatEffort.source)}</span>
            <select
              className="select w-full"
              value={form.chatEffort}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, chatEffort: e.target.value }))}
            >
              {efforts.map((e) => <option key={e} value={e}>{t(`efforts.${e}`)}</option>)}
            </select>
          </label>
          <p className="text-xs text-base-content/60 self-end">{t('chatHint')}</p>

          <p className="text-xs text-base-content/60 md:col-span-2">{t('effortHint')}</p>
          <label className="md:col-span-2 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary mt-0.5"
              checked={form.importAutoSuggest}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, importAutoSuggest: e.target.checked }))}
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('autoSuggest')} {sourceBadge(settings.importAutoSuggest.source)}</span>
              <span className="text-xs text-base-content/60">{t('autoSuggestHint')}</span>
            </span>
          </label>
          <label className="md:col-span-2 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary mt-0.5"
              checked={form.importWebSearch}
              disabled={disabled}
              onChange={(e) => setForm((f) => ({ ...f, importWebSearch: e.target.checked }))}
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium flex flex-wrap items-center gap-2">{t('webSearch')} {sourceBadge(settings.importWebSearch.source)}</span>
              <span className="text-xs text-base-content/60">{t('webSearchHint')}</span>
            </span>
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={disabled}>
              {busy && <span className="loading loading-spinner loading-sm" />}
              {t('save')}
            </button>
          </div>
        </form>

        <ProviderKeys data={data} disabled={disabled} save={save} setMessage={setMessage} />
        <OllamaSettings data={data} disabled={disabled} save={save} setMessage={setMessage} />
        <CustomModels data={data} disabled={disabled} save={save} />
        <AiPrices
          data={data}
          disabled={disabled}
          // Dopo l'aggiornamento i menu devono mostrare i prezzi nuovi: si rilegge la vista.
          onApplied={async () => onSaved(await jsonOrThrow(await fetch('/api/ai/settings', { cache: 'no-store' })))}
        />
      </div>
    </div>
  );
}
