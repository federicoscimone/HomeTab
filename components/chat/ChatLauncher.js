'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ChatPanel from '@/components/chat/ChatPanel';
import PixelBot from '@/components/chat/PixelBot';

/** Sotto questa larghezza il pannello copre tutta la pagina. */
const FULL_SCREEN_BELOW = 640;

/**
 * Il pulsante della chat, in basso a destra su ogni pagina. Il pannello vive nel layout: aprendo
 * un link di verifica la pagina cambia sotto e la conversazione resta lì. Finché resta chiuso non
 * parte nessuna richiesta, nemmeno quella che controlla se la chat è disponibile.
 */
export default function ChatLauncher() {
  const t = useTranslations('chat');
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // Su telefono il pannello copre il link appena aperto: si chiude, la conversazione resta salvata.
  const onLinkClick = useCallback(() => {
    if (window.innerWidth < FULL_SCREEN_BELOW) setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed z-50 inset-0 bg-base-100 sm:inset-auto sm:bottom-24 sm:right-4 sm:w-[26rem] sm:h-[min(40rem,calc(100vh-8rem))] sm:rounded-box sm:shadow-2xl sm:border sm:border-base-300 overflow-hidden"
        >
          <ChatPanel onClose={close} onLinkClick={onLinkClick} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t(open ? 'close' : 'open')}
        aria-expanded={open}
        title={t('open')}
        className={`fixed z-40 bottom-4 right-4 btn btn-circle btn-lg bg-base-100 border-base-300 shadow-lg hover:-translate-y-0.5 transition-transform ${open ? 'max-sm:hidden' : ''}`}
      >
        <PixelBot size={34} />
      </button>
    </>
  );
}
