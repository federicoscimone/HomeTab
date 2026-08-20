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
 * @property {string}       label - Human-readable Italian label.
 * @property {PaymentGroup} group - Macro-group for reporting.
 * @property {string}       color - DaisyUI badge class for UI display.
 */

/** @type {PaymentMethodDef[]} */
export const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Contanti',         group: 'traditional', color: 'badge-success' },
  { value: 'credit_card',   label: 'Carta di Credito', group: 'traditional', color: 'badge-info'    },
  { value: 'debit_card',    label: 'Carta di Debito',  group: 'traditional', color: 'badge-info'    },
  { value: 'bank_transfer', label: 'Bonifico',         group: 'traditional', color: 'badge-neutral' },
  { value: 'direct_debit',  label: 'Addebito Diretto', group: 'traditional', color: 'badge-secondary' },
  { value: 'paypal',        label: 'PayPal',           group: 'traditional', color: 'badge-primary' },
  { value: 'satispay',      label: 'Satispay',         group: 'traditional', color: 'badge-primary' },
  { value: 'meal_ticket',   label: 'Ticket Pasto',     group: 'alternative', color: 'badge-warning' },
  { value: 'gift_voucher',  label: 'Buono Acquisto',   group: 'alternative', color: 'badge-warning' },
  { value: 'fuel_voucher',  label: 'Buono Carburante', group: 'alternative', color: 'badge-warning' },
  { value: 'other_voucher', label: 'Altro Voucher',    group: 'alternative', color: 'badge-warning' },
  { value: 'other',         label: 'Altro',            group: 'traditional', color: 'badge-ghost'   },
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
