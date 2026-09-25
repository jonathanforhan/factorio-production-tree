/** CSS color for a quality tier's outline, or '' for normal (falls back to the default border). */
export function qualityOutlineColor(qualityId: string): string {
  return qualityId === 'normal' ? '' : `var(--fpt-quality-${qualityId})`;
}
