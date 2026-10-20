'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/** Corpo JSON della risposta; in caso di errore, il messaggio del server. */
async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || '');
  return body;
}

/**
 * Modello, effort, tetto mensile e chiave API, salvati sul database.
 * La chiave si scrive e non si rilegge: dal server arrivano solo l'origine e le ultime 4 cifre.
 *
 * @param {{ data: object, onSaved: (data: object) => void }} props
 */
export default function AiConfigCard({ data, onSaved }) {
  const t = useTranslations('settingsAi');
  const { fmtUsd } = useFormat();
  const { settings, keys, catalog, efforts, demo } = data;

  const [form, setForm] = useState({
    importModel: settings.importModel.value,
    importEffort: settings.importEffort.value,
    monthlyBudgetUsd: String(settings.monthlyBudgetUsd.value),
  });
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'success'|'error'|'info', text }

  const key = keys.anthropic;
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
    save({ importModel: form.importModel, importEffort: form.importEffort, monthlyBudgetUsd: budget }, t('saved'));
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!apiKey) return;
    if (await save({ anthropicApiKey: apiKey }, t('keySaved'))) setApiKey('');
  };

  const handleRemoveKey = () => save({ anthropicApiKey: null }, t('keyRemoved'));

  const handleVerify = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ai/settings/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKey ? { apiKey } : {}),
      });
      const { valid } = await jsonOrThrow(res);
      if (valid === true) setMessage({ kind: 'success', text: t('keyValid') });
      else if (valid === false) setMessage({ kind: 'error', text: t('keyInvalid') });
      else setMessage({ kind: 'info', text: t('keyUnknown') });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('verifyFailed') });
    } finally {
      setBusy(false);
    }
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
              {catalog.map((p) => (
                <optgroup key={p.id} label={p.label}>
                  {p.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {t('modelOption', { model: m.id.split(':')[1], input: fmtUsd(m.input), output: fmtUsd(m.output) })}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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

          <p className="text-xs text-base-content/60 md:col-span-2">{t('effortHint')}</p>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={disabled}>
              {busy && <span className="loading loading-spinner loading-sm" />}
              {t('save')}
            </button>
          </div>
        </form>

        <form className="rounded-xl border border-base-200 p-4 flex flex-col gap-3" onSubmit={handleSaveKey}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{t('keyTitle')}</h3>
            {key.configured && sourceBadge(key.source)}
          </div>
          <p className="text-sm text-base-content/70">
            {key.configured ? t('keyConfigured', { hint: key.hint }) : t('keyMissing')}
          </p>
          {key.unreadable && <div className="alert alert-warning py-2 text-sm"><span>{t('keyUnreadable')}</span></div>}
          {key.source === 'env' && <p className="text-xs text-base-content/60">{t('keyFromEnv')}</p>}

          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="input w-full md:flex-1 font-mono"
              placeholder={t('keyPlaceholder')}
              aria-label={t('keyTitle')}
              value={apiKey}
              disabled={disabled}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline" onClick={handleVerify} disabled={disabled || (!apiKey && !key.configured)}>
                {t('verify')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={disabled || !apiKey}>
                {t('saveKey')}
              </button>
              {key.source === 'db' && (
                <button type="button" className="btn btn-outline btn-error" onClick={handleRemoveKey} disabled={disabled}>
                  {t('removeKey')}
                </button>
              )}
            </div>
          </div>
          {/* Avviso, non blocco: Anthropic potrebbe cambiare formato, e la verifica resta la prova vera. */}
          {apiKey && !apiKey.trim().startsWith('sk-ant-') && (
            <p className="text-xs text-warning">{t('keyPrefixWarning')}</p>
          )}
          <p className="text-xs text-base-content/60">{t('keyHint')}</p>
        </form>
      </div>
    </div>
  );
}
