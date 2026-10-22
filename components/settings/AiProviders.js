'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * Le parti della configurazione IA che riguardano i fornitori: le chiavi dei servizi a pagamento,
 * l'indirizzo di Ollama per i modelli locali e i modelli aggiunti a mano con il loro prezzo.
 * Salvano con le funzioni della scheda che le contiene, che mostra l'esito in un posto solo.
 */

/** Verifica una chiave o l'indirizzo di Ollama; senza `secret` quella già configurata. */
async function verifySecret(provider, secret) {
  const res = await fetch('/api/ai/settings/verify-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secret ? { provider, secret } : { provider }),
  });
  if (!res.ok) throw new Error('');
  return (await res.json()).valid;
}

/**
 * La chiave di un fornitore. Si scrive e non si rilegge: dal server arrivano solo l'origine e le
 * ultime 4 cifre.
 */
function ProviderKey({ provider, keyInfo, disabled, save, setMessage }) {
  const t = useTranslations('settingsAi');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const name = provider.label;

  const handleSave = async (e) => {
    e.preventDefault();
    if (apiKey && await save({ apiKey: { provider: provider.id, key: apiKey } }, t('keySaved'))) setApiKey('');
  };

  const handleVerify = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const valid = await verifySecret(provider.id, apiKey);
      if (valid === true) setMessage({ kind: 'success', text: t('keyValid', { provider: name }) });
      else if (valid === false) setMessage({ kind: 'error', text: t('keyInvalid', { provider: name }) });
      else setMessage({ kind: 'info', text: t('keyUnknown', { provider: name }) });
    } catch {
      setMessage({ kind: 'error', text: t('verifyFailed') });
    } finally {
      setBusy(false);
    }
  };

  const off = disabled || busy;
  return (
    <form className="flex flex-col gap-2 py-3 border-t border-base-200 first:border-t-0" onSubmit={handleSave}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">{name}</h4>
        {keyInfo.configured
          ? <span className="badge badge-success badge-sm">{t('keyConfiguredShort', { hint: keyInfo.hint })}</span>
          : <span className="badge badge-ghost badge-sm">{t('keyMissingShort')}</span>}
        {keyInfo.configured && <span className="badge badge-ghost badge-sm">{t(`sources.${keyInfo.source}`)}</span>}
        {provider.keyUrl && (
          <a className="link link-hover text-xs ml-auto" href={provider.keyUrl} target="_blank" rel="noreferrer">{t('keyGet')}</a>
        )}
      </div>
      {keyInfo.unreadable && <div className="alert alert-warning py-2 text-sm"><span>{t('keyUnreadable')}</span></div>}
      {keyInfo.source === 'env' && <p className="text-xs text-base-content/60">{t('keyFromEnv', { env: provider.keyEnv })}</p>}
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          className="input input-sm w-full md:flex-1 font-mono"
          placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : t('keyPlaceholder')}
          aria-label={t('keyTitle', { provider: name })}
          value={apiKey}
          disabled={off}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-outline" onClick={handleVerify} disabled={off || (!apiKey && !keyInfo.configured)}>
            {busy && <span className="loading loading-spinner loading-xs" />}
            {t('verify')}
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={off || !apiKey}>{t('saveKey')}</button>
          {keyInfo.source === 'db' && (
            <button type="button" className="btn btn-sm btn-outline btn-error" disabled={off}
              onClick={() => save({ apiKey: { provider: provider.id, key: null } }, t('keyRemoved'))}>
              {t('removeKey')}
            </button>
          )}
        </div>
      </div>
      {/* Avviso, non blocco: il formato può cambiare, e la verifica resta la prova vera. */}
      {apiKey && provider.keyPrefix && !apiKey.trim().startsWith(provider.keyPrefix) && (
        <p className="text-xs text-warning">{t('keyPrefixWarning', { provider: name, prefix: provider.keyPrefix })}</p>
      )}
    </form>
  );
}

/** Le chiavi dei fornitori a pagamento: ne basta una, quella dei modelli che si usano. */
export function ProviderKeys({ data, disabled, save, setMessage }) {
  const t = useTranslations('settingsAi');
  const cloud = data.catalog.filter((p) => !p.local);
  return (
    <section className="rounded-xl border border-base-200 p-4 flex flex-col gap-1">
      <h3 className="font-semibold">{t('providersTitle')}</h3>
      <p className="text-xs text-base-content/60 mb-1">{t('providersIntro')}</p>
      {cloud.map((p) => (
        <ProviderKey key={p.id} provider={p} keyInfo={data.keys[p.id]} disabled={disabled} save={save} setMessage={setMessage} />
      ))}
      <p className="text-xs text-base-content/60">{t('keyHint')}</p>
    </section>
  );
}

/** Dove risponde Ollama, e quali modelli ci sono installati. */
export function OllamaSettings({ data, disabled, save, setMessage }) {
  const t = useTranslations('settingsAi');
  const setting = data.settings.ollamaBaseUrl;
  const [url, setUrl] = useState(setting.value);
  const [busy, setBusy] = useState(false);
  const models = data.catalog.find((p) => p.local)?.models ?? [];

  const handleVerify = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const valid = await verifySecret('ollama', url);
      setMessage(valid ? { kind: 'success', text: t('ollamaReachable') } : { kind: 'error', text: t('ollamaUnreachable', { url }) });
    } catch {
      setMessage({ kind: 'error', text: t('verifyFailed') });
    } finally {
      setBusy(false);
    }
  };

  const off = disabled || busy;
  return (
    <form
      className="rounded-xl border border-base-200 p-4 flex flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); save({ ollamaBaseUrl: url.trim() || null }, t('ollamaSaved')); }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{t('ollamaTitle')}</h3>
        <span className="badge badge-ghost badge-sm">{t(`sources.${setting.source}`)}</span>
        {data.ollamaOnline
          ? <span className="badge badge-success badge-sm">{t('ollamaOnline', { n: models.length })}</span>
          : <span className="badge badge-ghost badge-sm">{t('ollamaOffline')}</span>}
      </div>
      <p className="text-xs text-base-content/60">{t('ollamaIntro')}</p>
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          className="input input-sm w-full md:flex-1 font-mono" inputMode="url" spellCheck={false}
          aria-label={t('ollamaUrl')} placeholder="http://127.0.0.1:11434"
          value={url} disabled={off} onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-outline" disabled={off || !url.trim()} onClick={handleVerify}>
            {busy && <span className="loading loading-spinner loading-xs" />}
            {t('verify')}
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={off}>{t('save')}</button>
        </div>
      </div>
      {data.ollamaOnline && models.length > 0 && (
        <ul className="text-xs text-base-content/70 flex flex-wrap gap-x-4 gap-y-1">
          {models.map((m) => (
            <li key={m.id}>
              <span className="font-mono">{m.id.slice('ollama:'.length)}</span>
              {m.vision && <span className="badge badge-ghost badge-xs ml-1">{t('capVision')}</span>}
              {m.tools && <span className="badge badge-ghost badge-xs ml-1">{t('capTools')}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-base-content/60">{t('ollamaHint')}</p>
    </form>
  );
}

const EMPTY_CUSTOM = { provider: '', name: '', input: '', output: '' };

/** Un modello a pagamento che non è nell'elenco, con il prezzo scritto dall'utente. */
export function CustomModels({ data, disabled, save }) {
  const t = useTranslations('settingsAi');
  const { fmtUsd } = useFormat();
  const cloud = data.catalog.filter((p) => !p.local);
  const [form, setForm] = useState({ ...EMPTY_CUSTOM, provider: cloud[0]?.id ?? '' });
  const num = (v) => Number(String(v).replace(',', '.'));
  const valid = form.name.trim() && form.input !== '' && form.output !== '' && Number.isFinite(num(form.input)) && Number.isFinite(num(form.output));

  const handleAdd = async (e) => {
    e.preventDefault();
    const ok = await save({
      addCustomModel: { provider: form.provider, name: form.name.trim(), input: num(form.input), output: num(form.output) },
    }, t('customAdded'));
    if (ok) setForm((f) => ({ ...EMPTY_CUSTOM, provider: f.provider }));
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const labelOf = (spec) => cloud.find((p) => spec.startsWith(`${p.id}:`))?.label ?? '';

  return (
    <form className="rounded-xl border border-base-200 p-4 flex flex-col gap-3" onSubmit={handleAdd}>
      <div>
        <h3 className="font-semibold">{t('customTitle')}</h3>
        <p className="text-xs text-base-content/60">{t('customIntro')}</p>
      </div>
      {data.customModels.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {data.customModels.map((c) => (
            <li key={c.spec} className="flex flex-wrap items-center gap-2">
              <span className="badge badge-ghost badge-sm">{labelOf(c.spec)}</span>
              <span className="font-mono">{c.spec.slice(c.spec.indexOf(':') + 1)}</span>
              <span className="text-xs text-base-content/60">{t('customPrice', { input: fmtUsd(c.input), output: fmtUsd(c.output) })}</span>
              <button type="button" className="btn btn-ghost btn-xs ml-auto" disabled={disabled}
                onClick={() => save({ removeCustomModel: c.spec }, t('customRemoved'))}>
                {t('customRemove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 md:grid-cols-[10rem_1fr_7rem_7rem_auto] gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs">{t('customProvider')}</span>
          <select className="select select-sm w-full" value={form.provider} disabled={disabled} onChange={set('provider')}>
            {cloud.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs">{t('customName')}</span>
          <input className="input input-sm w-full font-mono" spellCheck={false} placeholder="mistral-medium-2604"
            value={form.name} disabled={disabled} onChange={set('name')} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs">{t('customInput')}</span>
          <input className="input input-sm w-full" inputMode="decimal" placeholder="1.50" value={form.input} disabled={disabled} onChange={set('input')} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs">{t('customOutput')}</span>
          <input className="input input-sm w-full" inputMode="decimal" placeholder="7.50" value={form.output} disabled={disabled} onChange={set('output')} />
        </label>
        <button type="submit" className="btn btn-sm btn-primary col-span-2 md:col-span-1" disabled={disabled || !valid}>{t('customAdd')}</button>
      </div>
      <p className="text-xs text-base-content/60">{t('customHint')}</p>
    </form>
  );
}
