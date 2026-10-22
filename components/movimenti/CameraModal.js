'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Lo scatto dalla webcam, per il computer: sul telefono lo stesso pulsante apre la fotocamera
 * del sistema, che è migliore. Il flusso video si chiude appena il riquadro si chiude.
 *
 * @param {{ onShot: (canvas: HTMLCanvasElement) => void, onClose: () => void }} props
 */
export default function CameraModal({ onShot, onClose }) {
  const t = useTranslations('quickFill');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      })
      .catch((err) => setError(err?.name === 'NotAllowedError' ? t('cameraDenied') : t('cameraUnavailable')));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [t]);

  const shoot = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    onShot(canvas);
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <h3 className="font-bold text-lg mb-2">{t('cameraTitle')}</h3>
        {error ? <div className="alert alert-warning py-2 text-sm"><span>{error}</span></div> : (
          <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="w-full rounded-box bg-base-300" />
            <p className="text-xs text-base-content/60 mt-2">{t('cameraHint')}</p>
          </>
        )}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('cameraCancel')}</button>
          {!error && <button type="button" className="btn btn-primary btn-sm" disabled={!ready} onClick={shoot}>{t('cameraShoot')}</button>}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
