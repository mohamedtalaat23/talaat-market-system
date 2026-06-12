export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount);
  if (isNaN(num)) return 'EGP 0.00';
  return `EGP ${num.toFixed(2)}`;
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
