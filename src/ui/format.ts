export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return '-';
  const rounded = Number(value.toFixed(maxDecimals));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

export function formatRate(perSec: number): string {
  return `${formatNumber(perSec, perSec < 10 ? 3 : 1)}/s`;
}

export function formatPower(kw: number): string {
  if (kw >= 1000) return `${formatNumber(kw / 1000, 2)} MW`;
  return `${formatNumber(kw, 1)} kW`;
}

export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${formatNumber(pct, 1)}%`;
}

export function titleCase(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
