/**
 * @fileoverview Collegamento di Telegram e verifica in due passaggi, nella pagina Account.
 *
 * La 2FA si attiva in due mosse: si chiede un codice sul canale scelto, poi lo si inserisce.
 * Così chi la attiva ha già visto il canale funzionare, invece di scoprire al login successivo di
 * essere rimasto chiuso fuori.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/** Ogni quanto si ricontrolla lo stato mentre si aspetta che l'utente prema Start nel bot. */
const LINK_POLL_MS = 3000;

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function SecurityCard() {
  const t = useTranslations('account.security');
  const tCommon = useTranslations('common');
  const { fmtDateTime } = useFormat();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null);          // { url, minutes } mentre si attende lo Start
  const [setup, setSetup] = useState(null);        // { channel, sent } durante l'attivazione
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');

  const load = useCallback(() => api('/api/account/security').then(setState).catch((err) => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  // In attesa del collegamento: si rilegge lo stato finché il bot non registra la chat.
  useEffect(() => {
    if (!link) return undefined;
    const timer = setInterval(() => {
      api('/api/account/security').then((s) => {
        setState(s);
        if (s.telegram.linked) {
          setLink(null);
          setNotice(t('telegram.linkedNow'));
        }
      }).catch(() => {});
    }, LINK_POLL_MS);
    return () => clearInterval(timer);
  }, [link, t]);

  /** Esegue un'azione mostrando l'errore del server, se c'è. */
  const act = async (fn) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || tCommon('networkError'));
    }
    setBusy(false);
  };

  if (!state) {
    return error
      ? <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
      : <span className="loading loading-spinner loading-sm text-primary" />;
  }

  const { telegram, twoFactor, channels } = state;

  if (state.demo) return <p className="text-sm text-base-content/60">{t('demo')}</p>;

  return (
    <div className="flex flex-col gap-5">
      {error && <div className="alert alert-error py-2 text-sm" role="alert"><span>{error}</span></div>}
      {notice && <div className="alert alert-success py-2 text-sm"><span>{notice}</span></div>}

      {/* Telegram */}
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('telegram.title')}</h3>
        {!telegram.configured ? (
          <p className="text-sm text-base-content/60">{t('telegram.notConfigured')}</p>
        ) : telegram.linked ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge badge-success">{t('telegram.linked')}</span>
            {telegram.linkedAt && (
              <span className="text-xs text-base-content/60">{t('telegram.since', { date: fmtDateTime(telegram.linkedAt) })}</span>
            )}
            <button
              type="button" className="btn btn-ghost btn-xs text-error" disabled={busy}
              onClick={() => act(async () => { await api('/api/account/telegram', 'DELETE'); await load(); })}
            >
              {t('telegram.unlink')}
            </button>
          </div>
        ) : link ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{t('telegram.openHint', { minutes: link.minutes })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                {t('telegram.open', { bot: telegram.bot })}
              </a>
              <span className="loading loading-dots loading-sm text-primary" aria-label={t('telegram.waiting')} />
              <span className="text-xs text-base-content/60">{t('telegram.waiting')}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-base-content/60">{t('telegram.intro')}</p>
            <button
              type="button" className="btn btn-outline btn-sm w-fit" disabled={busy}
              onClick={() => act(async () => setLink(await api('/api/account/telegram', 'POST')))}
            >
              {t('telegram.link')}
            </button>
          </div>
        )}
      </section>

      {/* Verifica in due passaggi */}
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('twoFactor.title')}</h3>
        <p className="text-sm text-base-content/60">{t('twoFactor.intro')}</p>

        {twoFactor.enabled && !setup && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge badge-success">{t(`twoFactor.activeOn.${twoFactor.channel}`)}</span>
            {channels.filter((c) => c !== twoFactor.channel).map((c) => (
              <button key={c} type="button" className="btn btn-ghost btn-xs" disabled={busy}
                onClick={() => { setSetup({ channel: c, sent: false }); setCode(''); }}>
                {t(`twoFactor.switchTo.${c}`)}
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-xs text-error" disabled={busy}
              onClick={() => { setDisabling(true); setPassword(''); }}>
              {t('twoFactor.disable')}
            </button>
          </div>
        )}

        {!twoFactor.enabled && !setup && (
          channels.length === 0 ? (
            <p className="text-sm text-warning">{t('twoFactor.noChannel')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => (
                <button key={c} type="button" className="btn btn-outline btn-sm" disabled={busy}
                  onClick={() => { setSetup({ channel: c, sent: false }); setCode(''); }}>
                  {t(`twoFactor.enableWith.${c}`)}
                </button>
              ))}
            </div>
          )
        )}

        {setup && (
          <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
            {!setup.sent ? (
              <>
                <p className="text-sm">{t(`twoFactor.sendHint.${setup.channel}`)}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => act(async () => {
                      await api('/api/account/two-factor/code', 'POST', { channel: setup.channel });
                      setSetup({ ...setup, sent: true });
                    })}>
                    {busy && <span className="loading loading-spinner loading-xs" />}
                    {t('twoFactor.sendCode')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSetup(null)}>{tCommon('cancel')}</button>
                </div>
              </>
            ) : (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  setState(await api('/api/account/two-factor', 'POST', { channel: setup.channel, code }));
                  setSetup(null);
                  setNotice(t('twoFactor.enabled'));
                });
              }}>
                <label className="form-control">
                  <div className="label py-1"><span className="label-text text-sm">{t('twoFactor.code')}</span></div>
                  <input
                    type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus
                    className="input input-bordered input-sm font-mono tracking-widest w-32" placeholder="123456"
                    value={code} onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{t('twoFactor.confirm')}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSetup(null)}>{tCommon('cancel')}</button>
              </form>
            )}
          </div>
        )}

        {disabling && (
          <form className="flex flex-wrap items-end gap-2 rounded-lg border border-base-300 p-3" onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              setState(await api('/api/account/two-factor', 'DELETE', { password }));
              setDisabling(false);
              setNotice(t('twoFactor.disabled'));
            });
          }}>
            <label className="form-control">
              <div className="label py-1"><span className="label-text text-sm">{t('twoFactor.passwordToDisable')}</span></div>
              <input type="password" className="input input-bordered input-sm" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-error btn-sm" disabled={busy}>{t('twoFactor.disable')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDisabling(false)}>{tCommon('cancel')}</button>
          </form>
        )}
      </section>
    </div>
  );
}
