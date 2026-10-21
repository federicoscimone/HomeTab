'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import Answer from '@/components/chat/Answer';

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
 * La chat sui dati. Ogni domanda va a POST /api/chat, che risponde in streaming; mentre l'agente
 * lavora si vedono gli strumenti che usa.
 */
export default function ChatPanel() {
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
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/60">{t('intro')}</p>
        </div>
        {turns.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clear} disabled={busy}>{t('clear')}</button>}
      </div>

      {unavailable && <div className="alert alert-info text-sm py-2"><span>{t(`unavailable.${status.reason === 'demo' ? 'demo' : 'other'}`)}</span></div>}

      {turns.length === 0 && !unavailable && (
        <div className="flex flex-wrap gap-2">
          {['q1', 'q2', 'q3', 'q4'].map((k) => (
            <button key={k} className="btn btn-outline btn-sm" onClick={() => ask(t(`examples.${k}`))} disabled={busy}>{t(`examples.${k}`)}</button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {turns.map((turn, i) => (turn.role === 'user' ? (
          <div key={i} className="chat chat-end"><div className="chat-bubble chat-bubble-primary text-sm">{turn.text}</div></div>
        ) : (
          <div key={i} className="chat chat-start">
            <div className={`chat-bubble ${turn.error ? 'chat-bubble-warning' : 'bg-base-200 text-base-content'}`}>
              {turn.error ? <span className="text-sm">{turn.error}</span> : <Answer text={turn.text} />}
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
              {live.text ? <Answer text={live.text} /> : <span className="loading loading-dots loading-sm" />}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form className="flex gap-2 sticky bottom-2 bg-base-100 py-2" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <input
          className="input w-full"
          value={question}
          maxLength={1000}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          disabled={busy || unavailable}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || unavailable || !question.trim()}>
          {busy && <span className="loading loading-spinner loading-sm" />}
          {t('send')}
        </button>
      </form>
      <p className="text-xs text-base-content/50">{t('footnote')}</p>
    </div>
  );
}
