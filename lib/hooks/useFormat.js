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
  deltaClass, fmt, fmtDateTime, fmtFull, fmtMonth, fmtPct, monthNames,
} from '@/lib/utils/format';

export function useFormat() {
  const locale = useLocale();
  return useMemo(() => ({
    locale,
    fmt:         (value) => fmt(value, locale),
    fmtFull:     (value) => fmtFull(value, locale),
    fmtPct:      (value) => fmtPct(value, locale),
    fmtMonth:    (month, short = false) => fmtMonth(month, short, locale),
    fmtDateTime: (value, options) => fmtDateTime(value, locale, options),
    deltaClass,
    monthsShort: monthNames(locale, 'short'),
    monthsLong:  monthNames(locale, 'long'),
  }), [locale]);
}
