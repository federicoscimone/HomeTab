/**
 * @fileoverview Payment method definitions and lookup helpers.
 * @module lib/utils/payments
 */

/**
 * @typedef {'traditional'|'alternative'} PaymentGroup
 */

/**
 * @typedef {Object} PaymentMethodDef
 * @property {string}       value - Internal enum value (matches Expense.paymentMethod).
 * @property {PaymentGroup} group - Macro-group for reporting.
 * @property {string}       color - DaisyUI badge class for UI display.
 *
 * Il nome visibile sta in messages/*.json, sotto payments.<value>, nella lingua dell'interfaccia.
 */

/** @type {PaymentMethodDef[]} */
export const PAYMENT_METHODS = [
  { value: 'cash',          group: 'traditional', color: 'badge-success' },
  { value: 'credit_card',   group: 'traditional', color: 'badge-info'    },
  { value: 'debit_card',    group: 'traditional', color: 'badge-info'    },
  { value: 'bank_transfer', group: 'traditional', color: 'badge-neutral' },
  { value: 'direct_debit',  group: 'traditional', color: 'badge-secondary' },
  { value: 'paypal',        group: 'traditional', color: 'badge-primary' },
  { value: 'satispay',      group: 'traditional', color: 'badge-primary' },
  { value: 'meal_ticket',   group: 'alternative', color: 'badge-warning' },
  { value: 'gift_voucher',  group: 'alternative', color: 'badge-warning' },
  { value: 'fuel_voucher',  group: 'alternative', color: 'badge-warning' },
  { value: 'other_voucher', group: 'alternative', color: 'badge-warning' },
  { value: 'other',         group: 'traditional', color: 'badge-ghost'   },
];

/**
 * Finds the full definition for a payment method value.
 *
 * @param {string} value - Payment method enum value.
 * @returns {PaymentMethodDef|undefined}
 */
export function getPaymentMethod(value) {
  return PAYMENT_METHODS.find(m => m.value === value);
}

/**
 * Returns the payment group ('traditional' or 'alternative') for a given value.
 * Falls back to 'traditional' for unknown values.
 *
 * @param {string} value - Payment method enum value.
 * @returns {PaymentGroup}
 */
export function getPaymentGroup(value) {
  return getPaymentMethod(value)?.group ?? 'traditional';
}
