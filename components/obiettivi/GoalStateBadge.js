/**
 * @fileoverview GoalStateBadge — stato di un obiettivo, sempre con testo e mai solo colore.
 */

/** @type {Object<string, {label: string, cls: string, hint: string}>} */
export const GOAL_STATES = {
  on_track:  { label: 'In linea',   cls: 'badge-success', hint: 'Con il ritmo attuale arrivi entro la scadenza' },
  behind:    { label: 'In ritardo', cls: 'badge-warning', hint: 'Con il ritmo attuale non arrivi entro la scadenza' },
  reached:   { label: 'Raggiunto',  cls: 'badge-success', hint: 'Importo raggiunto: non riceve più quote' },
  expired:   { label: 'Scaduto',    cls: 'badge-error',   hint: 'Scadenza passata senza raggiungere l\'importo' },
  unknown:   { label: 'Da pianificare', cls: 'badge-ghost', hint: 'Manca la percentuale o non ci sono ancora mesi chiusi' },
  completed: { label: 'Concluso',   cls: 'badge-neutral', hint: 'Acquistato: l\'avanzo è tornato al risparmio libero' },
  cancelled: { label: 'Annullato',  cls: 'badge-ghost',   hint: 'Annullato: il disponibile è stato spostato' },
};

/** Classi letterali: Tailwind non genera classi composte a runtime come `badge-${size}`. */
const SIZES = { sm: 'badge-sm', md: 'badge-md' };

/**
 * @param {{ state: string, size?: 'sm'|'md' }} props
 */
export default function GoalStateBadge({ state, size = 'sm' }) {
  const s = GOAL_STATES[state] ?? GOAL_STATES.unknown;
  return (
    <span className={`badge ${SIZES[size]} ${s.cls} whitespace-nowrap`} title={s.hint}>
      {s.label}
    </span>
  );
}
