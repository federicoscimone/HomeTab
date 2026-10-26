'use client';

import Link from 'next/link';

/**
 * Un percorso dell'app. Non basta «comincia con /»: il browser legge «//sito» e anche «/\sito»
 * come indirizzi di un altro dominio.
 */
const INTERNAL_LINK = /^\/(?![/\\])/;

/**
 * Il testo della risposta con il poco Markdown che l'agente usa: paragrafi, elenchi, **grassetto**
 * e link. I link diventano cliccabili solo se interni all'app (INTERNAL_LINK): un link
 * esterno scritto dal modello, magari suggerito da una causale costruita apposta, potrebbe
 * portare fuori i dati con un clic. Quelli esterni restano testo.
 */
function inline(text, keyBase, onLinkClick) {
  const parts = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={`${keyBase}-b${i}`}>{m[1]}</strong>);
    else if (INTERNAL_LINK.test(m[3])) parts.push(<Link key={`${keyBase}-l${i}`} href={m[3]} className="link link-primary" onClick={onLinkClick}>{m[2]}</Link>);
    else parts.push(`${m[2]} (${m[3]})`);
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const LIST_RE = /^\s*([-*]|\d+\.)\s+/;

/**
 * Divide un blocco in gruppi di righe consecutive dello stesso genere: testo o elenco. Un elenco
 * preceduto da una riga di testo («Per controllare:») resta un elenco.
 */
function runs(lines) {
  const out = [];
  for (const line of lines) {
    const isItem = LIST_RE.test(line);
    const last = out[out.length - 1];
    if (last && last.list === isItem) last.lines.push(line);
    else out.push({ list: isItem, lines: [line] });
  }
  return out;
}

/** @param {{ text: string, onLinkClick?: () => void }} props */
export default function Answer({ text, onLinkClick }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {blocks.flatMap((block, bi) => runs(block.split('\n')).map((run, ri) => {
        const key = `${bi}-${ri}`;
        if (run.list) {
          return (
            <ul key={key} className="list-disc pl-5">
              {run.lines.map((l, li) => <li key={li}>{inline(l.replace(LIST_RE, ''), `${key}-${li}`, onLinkClick)}</li>)}
            </ul>
          );
        }
        return <p key={key}>{run.lines.flatMap((l, li) => (li ? [<br key={`br${li}`} />, ...inline(l, `${key}-${li}`, onLinkClick)] : inline(l, `${key}-${li}`, onLinkClick)))}</p>;
      }))}
    </div>
  );
}
