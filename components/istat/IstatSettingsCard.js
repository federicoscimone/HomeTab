'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DIVISIONS } from '@/lib/utils/coicop';
import { MAX_MEMBERS, REGIONS } from '@/lib/utils/istat';

async function put(body) {
  const res = await fetch('/api/impostazioni/confronto-istat', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '');
  return data;
}

/**
 * Profilo della famiglia e capitoli ISTAT delle categorie, per gli amministratori.
 * Una sottocategoria senza capitolo eredita quello della madre: il menu lo mostra.
 *
 * @param {{ profile: { region: string|null, members: number|null }, categories: object[], startOpen: boolean, onSaved: () => void }} props
 */
export default function IstatSettingsCard({ profile, categories, startOpen, onSaved }) {
  const t = useTranslations('istat');
  const [region, setRegion] = useState(profile.region ?? '');
  const [members, setMembers] = useState(profile.members ? String(profile.members) : '');
  const [edits, setEdits] = useState({}); // categoryId → codice o null
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  // Aperta o chiusa solo all'inizio: completare il profilo non deve richiuderla sotto il messaggio.
  const [open] = useState(startOpen);

  const tree = useMemo(() => categories.filter((c) => c.level === 1).map((c) => ({
    ...c,
    children: categories.filter((s) => s.level === 2 && s.parentId === c._id),
  })), [categories]);

  const current = (c) => (c._id in edits ? edits[c._id] : c.coicop ?? null);
  const chapter = (code) => `${code} · ${t(`divisions.d${code}`)}`;

  const run = async (body, okText) => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await put(body);
      setMessage({ kind: 'success', text: typeof okText === 'function' ? okText(data) : okText });
      setEdits({});
      onSaved();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('settings.failed') });
    } finally {
      setBusy(false);
    }
  };

  const select = (c, parentCode) => (
    <select
      className="select select-sm w-full sm:w-80"
      value={current(c) ?? ''}
      disabled={busy}
      aria-label={c.name}
      onChange={(e) => setEdits((x) => ({ ...x, [c._id]: e.target.value || null }))}
    >
      <option value="">
        {parentCode === undefined ? t('settings.none')
          : parentCode ? t('settings.inherit', { chapter: chapter(parentCode) }) : t('settings.inheritNone')}
      </option>
      {DIVISIONS.map((d) => <option key={d} value={d}>{chapter(d)}</option>)}
    </select>
  );

  return (
    <details className="card bg-base-100 shadow-sm" open={open}>
      <summary className="card-title text-lg cursor-pointer px-8 py-6">{t('settings.title')}</summary>
      <div className="card-body gap-4 pt-0">
        {message && <div className={`alert py-2 text-sm alert-${message.kind}`} role="status"><span>{message.text}</span></div>}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run({ region: region || null, members: members ? Number(members) : null }, t('settings.saved'));
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('settings.region')}</span>
            <select className="select select-sm w-56" value={region} disabled={busy} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{t('settings.choose')}</option>
              {Object.keys(REGIONS).map((code) => <option key={code} value={code}>{t(`regions.${code}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('settings.members')}</span>
            <select className="select select-sm w-40" value={members} disabled={busy} onChange={(e) => setMembers(e.target.value)}>
              <option value="">{t('settings.choose')}</option>
              {Array.from({ length: MAX_MEMBERS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n === MAX_MEMBERS ? t('membersMany') : String(n)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{t('settings.saveProfile')}</button>
        </form>

        <div className="divider my-0" />

        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{t('settings.mapping')}</h3>
          <p className="text-xs text-base-content/60">{t('settings.mappingIntro')}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {tree.map((c) => (
            <li key={c._id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                {select(c)}
              </div>
              {c.children.map((s) => (
                <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 pl-4">
                  <span className="text-sm text-base-content/70">{s.name}</span>
                  {select(s, current(c))}
                </div>
              ))}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            title={t('settings.applyDefaultsHint')}
            onClick={() => run({ applyDefaults: true }, (d) => t('settings.defaultsApplied', { n: d.applied }))}
          >
            {t('settings.applyDefaults')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || Object.keys(edits).length === 0}
            onClick={() => run({ mappings: edits }, t('settings.saved'))}
          >
            {t('settings.saveMapping')}
          </button>
        </div>
      </div>
    </details>
  );
}
