import { getPaymentMethod } from '@/lib/utils/payments';

export default function PaymentBadge({ value, size = '' }) {
  const method = getPaymentMethod(value);
  if (!method) return null;
  return (
    <span className={`badge ${method.color} badge-outline ${size} whitespace-nowrap`}>
      {method.label}
    </span>
  );
}
