export const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Contanti',        group: 'traditional', color: 'badge-success' },
  { value: 'credit_card',   label: 'Carta di Credito', group: 'traditional', color: 'badge-info' },
  { value: 'debit_card',    label: 'Carta di Debito',  group: 'traditional', color: 'badge-info' },
  { value: 'bank_transfer', label: 'Bonifico',         group: 'traditional', color: 'badge-neutral' },
  { value: 'paypal',        label: 'PayPal',           group: 'traditional', color: 'badge-primary' },
  { value: 'satispay',      label: 'Satispay',         group: 'traditional', color: 'badge-primary' },
  { value: 'meal_ticket',   label: 'Ticket Pasto',     group: 'alternative', color: 'badge-warning' },
  { value: 'gift_voucher',  label: 'Buono Acquisto',   group: 'alternative', color: 'badge-warning' },
  { value: 'fuel_voucher',  label: 'Buono Carburante', group: 'alternative', color: 'badge-warning' },
  { value: 'other_voucher', label: 'Altro Voucher',    group: 'alternative', color: 'badge-warning' },
  { value: 'other',         label: 'Altro',            group: 'traditional', color: 'badge-ghost' },
];

export function getPaymentMethod(value) {
  return PAYMENT_METHODS.find((m) => m.value === value);
}

export function getPaymentGroup(value) {
  return getPaymentMethod(value)?.group ?? 'traditional';
}
