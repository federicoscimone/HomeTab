/**
 * @fileoverview Impostazioni → Telegram: il bot dell'installazione, come riceve i messaggi e lo
 * stato della ricezione (app/api/impostazioni/telegram).
 *
 * Il token non torna mai al browser: si vede da dove viene la configurazione e le ultime 4 cifre.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';

async function api(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function TelegramSettings() {
  const t = useTranslations('settingsTelegram');
  const tCommon = useTranslations('common');
  const { fmtDateTime } = useFormat();
  const { data: loaded, error: loadError } = useApiData('/api/impostazioni/telegram', 'telegram-settings');
  // Dopo un salvataggio il server restituisce la vista aggiornata: si usa quella.
  const [saved, setSaved] = useState(null);
  const data = saved ?? loaded;
  const [token, setToken] = useState('');
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (loadError) return <div className="alert alert-error py-2 text-sm"><span>{t('loadFailed')}</span></div>;
  if (!data) return <span className="loading loading-spinner loading-md" />;

  const currentMode = mode ?? data.saved?.mode ?? data.mode ?? 'polling';
  const act = async (fn, done) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await fn();
      if (done) setNotice(done);
    } catch (err) {
      setError(err.message || tCommon('networkError'));
    }
    setBusy(false);
  };
  const save = () => act(async () => {
    setSaved(await api('/api/impostazioni/telegram', 'PUT', { token: token.trim() || null, mode: currentMode }));
    setToken('');
    setMode(null);
  }, t('savedNotice'));
  const remove = () => {
    if (!window.confirm(t('removeConfirm'))) return;
    act(async () => { setSaved(await api('/api/impostazioni/telegram', 'DELETE')); setMode(null); }, t('removedNotice'));
  };
  const test = () => act(() => api('/api/account/telegram/test', 'POST'), t('testSent'));

  const { receiver } = data;
  const sourceLabel = data.source === 'db' ? t('sourceDb') : data.source === 'env' ? t('sourceEnv') : t('sourceNone');

  return (
    <div className="flex flex-col gap-6">
      {data.demo && <div className="alert alert-info py-2 text-sm"><span>{t('demo')}</span></div>}
      {error && <div className="alert alert-error py-2 text-sm" role="alert"><span>{error}</span></div>}
      {notice && <div className="alert alert-success py-2 text-sm"><span>{notice}</span></div>}

      {/* Stato */}
      <section className="card bg-base-100 border border-base-300">
        <div className="card-body gap-3">
          <h2 className="card-title text-lg">{t('statusTitle')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-base-content/60">{t('configuration')}</dt>
            <dd>{sourceLabel}</dd>
            {data.bot && (<>
              <dt className="text-base-content/60">{t('bot')}</dt>
              <dd>
                <a href={`https://t.me/${data.bot}`} target="_blank" rel="noopener noreferrer" className="link">{`@${data.bot}`}</a>
                {data.saved?.botName && <span className="text-base-content/60">{` — ${data.saved.botName}`}</span>}
                {data.saved?.hint && <span className="text-base-content/60">{` · ${t('tokenHint', { hint: data.saved.hint })}`}</span>}
              </dd>
              <dt className="text-base-content/60">{t('receiving')}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className={`badge badge-sm ${receiver.active ? 'badge-success' : 'badge-warning'}`}>
                  {receiver.active ? t('receiverActive') : t('receiverIdle')}
                </span>
                <span>{data.mode === 'webhook' ? t('modeWebhook') : t('modePolling')}</span>
                {receiver.lastContactAt && (
                  <span className="text-base-content/60">{t('lastContact', { date: fmtDateTime(receiver.lastContactAt) })}</span>
                )}
              </dd>
              {receiver.lastError && (<>
                <dt className="text-base-content/60">{t('lastError')}</dt>
                <dd className="text-error break-words">{receiver.lastError}</dd>
              </>)}
            </>)}
          </dl>
          {data.saved?.unreadable && <p className="text-sm text-error">{t('unreadable')}</p>}
          {data.bot && (
            <div className="flex flex-wrap items-center gap-2">
              {data.meLinked ? (
                <button type="button" className="btn btn-outline btn-sm" disabled={busy || data.demo} onClick={test}>{t('test')}</button>
              ) : (
                <p className="text-sm text-base-content/60">
                  {t.rich('testNeedsLink', { link: (chunks) => <Link href="/account" className="link link-primary">{chunks}</Link> })}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Configurazione */}
      <section className="card bg-base-100 border border-base-300">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">{t('configTitle')}</h2>
          <p className="text-sm text-base-content/70">
            {t.rich('botFatherHint', { link: (chunks) => <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="link link-primary">{chunks}</a> })}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{data.saved ? t('tokenReplace') : t('token')}</span>
            <input
              type="password" autoComplete="off" spellCheck={false}
              className="input input-bordered font-mono" placeholder="123456789:AA…"
              value={token} onChange={(e) => setToken(e.target.value)} disabled={data.demo}
            />
            <span className="text-xs text-base-content/60">{t('tokenStored')}</span>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium mb-1">{t('modeTitle')}</legend>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="tg-mode" className="radio radio-sm mt-0.5" checked={currentMode === 'polling'}
                onChange={() => setMode('polling')} disabled={data.demo} />
              <span>
                <span className="text-sm font-medium">{t('modePolling')}</span>
                <span className="block text-xs text-base-content/60">{t('modePollingHint')}</span>
              </span>
            </label>
            <label className={`flex items-start gap-3 ${data.webhook.possible ? 'cursor-pointer' : 'opacity-50'}`}>
              <input type="radio" name="tg-mode" className="radio radio-sm mt-0.5" checked={currentMode === 'webhook'}
                onChange={() => setMode('webhook')} disabled={data.demo || !data.webhook.possible} />
              <span>
                <span className="text-sm font-medium">{t('modeWebhook')}</span>
                <span className="block text-xs text-base-content/60">
                  {data.webhook.possible ? t('modeWebhookHint', { base: data.webhook.base }) : t('modeWebhookNeedsHttps')}
                </span>
              </span>
            </label>
          </fieldset>

          {data.linkedUsers > 0 && (
            <div className="alert alert-warning py-2 text-sm">
              <span>
                {t('changeBotWarning', { count: data.linkedUsers })}
                {data.twoFactorUsers > 0 && <>{' '}<strong>{t('changeBotTwoFactor', { count: data.twoFactorUsers })}</strong></>}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={save}
              disabled={busy || data.demo || (!token.trim() && !data.saved)}>
              {busy && <span className="loading loading-spinner loading-xs" />}
              {t('save')}
            </button>
            {data.saved && (
              <button type="button" className="btn btn-ghost btn-sm text-error" onClick={remove} disabled={busy || data.demo}>
                {data.envConfigured ? t('removeToEnv') : t('remove')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
