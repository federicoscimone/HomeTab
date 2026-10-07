/**
 * @fileoverview GoalStateBadge — stato di un obiettivo, sempre con testo e mai solo colore.
 */

import { useTranslations } from 'next-intl';

/** Colore di ogni stato. Etichetta e spiegazione stanno in messages/*.json, sotto goalStates. */
export const GOAL_STATE_CLASSES = {
  on_track:  'badge-success',
  behind:    'badge-warning',
  reached:   'badge-success',
  expired:   'badge-error',
  unknown:   'badge-ghost',
  completed: 'badge-neutral',
  cancelled: 'badge-ghost',
};

/** Classi letterali: Tailwind non genera classi composte a runtime come `badge-${size}`. */
const SIZES = { sm: 'badge-sm', md: 'badge-md' };

/**
 * @param {{ state: string, size?: 'sm'|'md' }} props
 */
export default function GoalStateBadge({ state, size = 'sm' }) {
  const t = useTranslations('goalStates');
  const key = Object.hasOwn(GOAL_STATE_CLASSES, state) ? state : 'unknown';
  return (
    <span className={`badge ${SIZES[size]} ${GOAL_STATE_CLASSES[key]} whitespace-nowrap`} title={t(`${key}.hint`)}>
      {t(`${key}.label`)}
    </span>
  );
}
