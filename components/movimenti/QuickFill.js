'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import CameraModal from '@/components/movimenti/CameraModal';

/** Lato lungo della foto inviata: abbastanza per leggere uno scontrino, poche centinaia di KB. */
const MAX_SIDE = 2000;

/**
 * Rimpicciolisce la foto nel browser e la restituisce in JPEG, in base64 senza intestazione.
 *
 * @param {File|HTMLCanvasElement} source - Un file scelto o lo scatto della webcam.
 */
async function shrink(source) {
  const image = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/**
 * Come si scatta su questo dispositivo: la fotocamera del sistema sul telefono (l'input con
 * capture la apre direttamente), la webcam sul computer, se il browser la concede (solo su
 * HTTPS), altrimenti niente.
 *
 * @returns {'native'|'webcam'|'none'|null} null finché la pagina non è nel browser.
 */
function useCameraMode() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const webcam = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
    // Si decide dopo il montaggio: sul server window non esiste.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(touch ? 'native' : webcam ? 'webcam' : 'none');
  }, []);
  return mode;
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
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraMode = useCameraMode();
  const photoOn = Boolean(receipt?.available);

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

  /** Una foto scelta, scattata o trascinata: si rimpicciolisce e si manda alla lettura. */
  const readPhoto = async (source) => {
    setBusy('photo');
    let image;
    try {
      image = await shrink(source);
    } catch {
      setBusy(null);
      setMessage({ kind: 'error', text: t('photoUnreadable') });
      return;
    }
    await send('/api/movimenti/scontrino', { image, mediaType: 'image/jpeg' }, 'photo');
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) readPhoto(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file && photoOn && !busy) readPhoto(file);
  };

  const shoot = () => {
    if (cameraMode === 'native') cameraRef.current?.click();
    else if (cameraMode === 'webcam') setWebcamOpen(true);
  };

  return (
    <div
      className={`card bg-base-100 border shadow-sm mb-4 ${dragging ? 'border-primary border-dashed' : 'border-base-200'}`}
      // Sul computer una foto si può anche trascinare sulla scheda.
      onDragOver={(e) => { if (photoOn) { e.preventDefault(); setDragging(true); } }}
      // Il dragleave arriva anche passando sopra un elemento interno: conta solo l'uscita vera.
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={onDrop}
    >
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
          {/* Due input: con capture il telefono apre la fotocamera; senza, galleria o file. */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <div className="join">
            <button
              type="button" className="btn btn-sm btn-outline join-item"
              disabled={Boolean(busy) || !photoOn || cameraMode === 'none' || cameraMode === null}
              title={!photoOn ? t('photoOff') : cameraMode === 'none' ? t('cameraNeedsHttps') : t('shootHint')}
              onClick={shoot}
            >
              {busy === 'photo' && <span className="loading loading-spinner loading-xs" />}
              {t('shoot')}
            </button>
            <button
              type="button" className="btn btn-sm btn-outline join-item" disabled={Boolean(busy) || !photoOn}
              title={!photoOn ? t('photoOff') : t('chooseHint')}
              onClick={() => fileRef.current?.click()}
            >
              {t('choose')}
            </button>
          </div>
        </div>
        <p className="text-xs text-base-content/60">{receipt && !receipt.available ? t('introNoAi') : t(cameraMode === 'native' ? 'intro' : 'introDesktop')}</p>
        {message && <div className={`alert py-2 text-sm alert-${message.kind}`} role="status"><span>{message.text}</span></div>}
      </div>
      {webcamOpen && (
        <CameraModal
          onClose={() => setWebcamOpen(false)}
          onShot={(canvas) => { setWebcamOpen(false); readPhoto(canvas); }}
        />
      )}
    </div>
  );
}
