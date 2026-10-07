/**
 * @fileoverview Formattatori legati alla lingua dell'interfaccia.
 * @module lib/hooks/useFormat
 *
 * @example
 * const { fmt, fmtPct, monthsShort } = useFormat();
 * fmt(1234) // "1.234 €" in italiano, "€1,234" in inglese
 */

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  deltaClass, fmt, fmtAxis, fmtDate, fmtDateTime, fmtFull, fmtMonth, fmtPct, fmtRound, monthNames,
} from '@/lib/utils/format';

export function useFormat() {
  const locale = useLocale();
  return useMemo(() => ({
    locale,
    fmt:         (value) => fmt(value, locale),
    fmtRound:    (value) => fmtRound(value, locale),
    fmtFull:     (value) => fmtFull(value, locale),
    fmtAxis:     (value) => fmtAxis(value, locale),
    fmtPct:      (value, signed = true) => fmtPct(value, locale, signed),
    fmtMonth:    (month, short = false) => fmtMonth(month, short, locale),
    fmtDate:     (date) => fmtDate(date, locale),
    fmtDateTime: (value, options) => fmtDateTime(value, locale, options),
    deltaClass,
    monthsShort: monthNames(locale, 'short'),
    monthsLong:  monthNames(locale, 'long'),
  }), [locale]);
}
