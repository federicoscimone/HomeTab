'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import Answer from '@/components/chat/Answer';
import PixelBot from '@/components/chat/PixelBot';

/** Lo storico vive solo in questa scheda del browser: niente conversazioni salvate sul server. */
const STORAGE_KEY = 'hometab-chat';
const MAX_KEPT = 20;

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(turns) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-MAX_KEPT)));
  } catch {
    // Archivio del browser non disponibile: la chat funziona lo stesso, senza ricordare.
  }
}

/**
 * La chat sui dati, nel pannello aperto dal pulsante in basso a destra (ChatLauncher). Ogni
 * domanda va a POST /api/chat, che risponde in streaming; mentre l'agente lavora si vedono gli
 * strumenti che usa.
 *
 * @param {{ onClose: () => void, onLinkClick: () => void }} props - onLinkClick: un link di
 *   verifica è stato aperto (su telefono il pannello copre la pagina e si chiude).
 */
export default function ChatPanel({ onClose, onLinkClick }) {
  const t = useTranslations('chat');
  const { fmtUsd } = useFormat();
  const { data: status } = useApiData('/api/chat', 'chat-status');
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null); // { text, tools[] } della risposta in arrivo
  const bottom = useRef(null);
  const controller = useRef(null);

  useEffect(() => {
    // Lo storico si legge dopo il montaggio: sessionStorage non esiste sul server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTurns(loadHistory());
    return () => controller.current?.abort();
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, live]);

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = turns.filter((x) => x.text && !x.error).map(({ role, text: tx }) => ({ role, text: tx }));
    const next = [...turns, { role: 'user', text: q }];
    setTurns(next);
    setQuestion('');
    setBusy(true);
    setLive({ text: '', tools: [] });
    controller.current = new AbortController();

    let answer = '';
    let meta = null;
    let error = null;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
        signal: controller.current.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || t('failed'));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === 'text') { answer += e.delta; setLive((l) => ({ ...l, text: answer })); }
          else if (e.type === 'reset') { answer = ''; setLive((l) => ({ ...l, text: '' })); }
          else if (e.type === 'tool') setLive((l) => ({ ...l, tools: [...l.tools, e.name] }));
          else if (e.type === 'done') meta = { costUsd: e.costUsd, model: e.model };
          else if (e.type === 'error') error = t(`errors.${['budget', 'unavailable', 'tooManySteps'].includes(e.code) ? e.code : 'failed'}`);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') error = err.message || t('failed');
    }
    const final = [...next, error ? { role: 'assistant', error } : { role: 'assistant', text: answer, ...meta }];
    setTurns(final);
    saveHistory(final);
    setLive(null);
    setBusy(false);
  };

  const clear = () => { setTurns([]); saveHistory([]); };
  const unavailable = status && !status.available;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-base-300">
        <PixelBot size={28} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight">{t('title')}</p>
          <p className="text-xs text-base-content/60 truncate">{t('subtitle')}</p>
        </div>
        {turns.length > 0 && <button className="btn btn-ghost btn-xs" onClick={clear} disabled={busy}>{t('clear')}</button>}
        <button className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label={t('close')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {turns.length === 0 && <p className="text-sm text-base-content/70">{t('intro')}</p>}
        {unavailable && <div className="alert alert-info text-sm py-2"><span>{t(`unavailable.${status.reason === 'demo' ? 'demo' : 'other'}`)}</span></div>}

        {turns.length === 0 && !unavailable && (
          <div className="flex flex-col items-start gap-2">
            {['q1', 'q2', 'q3', 'q4'].map((k) => (
              <button key={k} className="btn btn-outline btn-sm h-auto py-1.5 text-left font-normal" onClick={() => ask(t(`examples.${k}`))} disabled={busy}>{t(`examples.${k}`)}</button>
            ))}
          </div>
        )}

        {turns.map((turn, i) => (turn.role === 'user' ? (
          <div key={i} className="chat chat-end"><div className="chat-bubble chat-bubble-primary text-sm">{turn.text}</div></div>
        ) : (
          <div key={i} className="chat chat-start">
            <div className={`chat-bubble ${turn.error ? 'chat-bubble-warning' : 'bg-base-200 text-base-content'}`}>
              {turn.error ? <span className="text-sm">{turn.error}</span> : <Answer text={turn.text} onLinkClick={onLinkClick} />}
            </div>
            {turn.costUsd != null && <div className="chat-footer text-xs opacity-50">{t('cost', { cost: fmtUsd(turn.costUsd) })}</div>}
          </div>
        )))}
        {live && (
          <div className="chat chat-start">
            <div className="chat-bubble bg-base-200 text-base-content">
              {live.tools.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {live.tools.map((name, i) => <span key={i} className="badge badge-ghost badge-sm">{t.has(`tools.${name}`) ? t(`tools.${name}`) : name}</span>)}
                </div>
              )}
              {live.text ? <Answer text={live.text} onLinkClick={onLinkClick} /> : <span className="loading loading-dots loading-sm" />}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form className="flex gap-2 px-3 pt-3 border-t border-base-300" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <input
          className="input input-sm w-full"
          value={question}
          maxLength={1000}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          disabled={busy || unavailable}
          onChange={(e) => setQuestion(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || unavailable || !question.trim()}>
          {busy && <span className="loading loading-spinner loading-xs" />}
          {t('send')}
        </button>
      </form>
      <p className="text-[11px] text-base-content/50 px-3 py-2">{t('footnote')}</p>
    </div>
  );
}
