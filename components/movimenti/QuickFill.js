'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';

/** Lato lungo della foto inviata: abbastanza per leggere uno scontrino, poche centinaia di KB. */
const MAX_SIDE = 2000;

/** Rimpicciolisce la foto nel browser e la restituisce in JPEG, in base64 senza intestazione. */
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/**
 * Le scorciatoie della pagina «Nuovo movimento»: una riga di testo o la foto di uno scontrino
 * riempiono il modulo, che poi si controlla e si salva come sempre.
 *
 * @param {{ onDraft: (draft: object) => void }} props
 */
export default function QuickFill({ onDraft }) {
  const t = useTranslations('quickFill');
  const { data: receipt } = useApiData('/api/movimenti/scontrino', 'scontrino');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null); // 'text' | 'photo' | null
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  const send = async (url, body, kind) => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('failed'));
      onDraft(data.draft);
      setMessage({ kind: 'success', text: data.draft.categoryFromAi ? t('filledAi') : data.draft.categoryId ? t('filled') : t('filledNoCategory') });
      if (kind === 'text') setText('');
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('failed') });
    } finally {
      setBusy(null);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('photo');
    let image;
    try {
      image = await shrink(file);
    } catch {
      setBusy(null);
      setMessage({ kind: 'error', text: t('photoUnreadable') });
      return;
    }
    await send('/api/movimenti/scontrino', { image, mediaType: 'image/jpeg' }, 'photo');
  };

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm mb-4">
      <div className="card-body p-4 gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send('/api/movimenti/rapido', { text }, 'text'); }}>
            <input
              className="input input-sm flex-1" maxLength={200} value={text} disabled={Boolean(busy)}
              placeholder={t('placeholder')} aria-label={t('placeholder')}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn btn-sm" disabled={Boolean(busy) || !text.trim()}>
              {busy === 'text' && <span className="loading loading-spinner loading-xs" />}
              {t('fill')}
            </button>
          </form>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          <button
            type="button" className="btn btn-sm btn-outline" disabled={Boolean(busy) || !receipt?.available}
            title={receipt && !receipt.available ? t('photoOff') : t('photoHint')}
            onClick={() => fileRef.current?.click()}
          >
            {busy === 'photo' && <span className="loading loading-spinner loading-xs" />}
            {t('photo')}
          </button>
        </div>
        <p className="text-xs text-base-content/60">{receipt && !receipt.available ? t('introNoAi') : t('intro')}</p>
        {message && <div className={`alert py-2 text-sm alert-${message.kind}`} role="status"><span>{message.text}</span></div>}
      </div>
    </div>
  );
}
